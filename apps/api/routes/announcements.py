"""Public announcements routes.

SCOPE: Zambales province only, excluding Olongapo City.
"""
from datetime import timezone
from apps.api.utils.time import utc_now
from flask import Blueprint, jsonify, request
from sqlalchemy import and_, or_, case, func
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import OperationalError as SAOperationalError, ProgrammingError as SAProgrammingError
import sqlite3

from apps.api.models.announcement import Announcement
from apps.api import db
from apps.api.utils.zambales_scope import (
    ZAMBALES_MUNICIPALITY_IDS,
    is_valid_zambales_municipality,
)


announcements_bp = Blueprint('announcements', __name__, url_prefix='/api/announcements')


def _parse_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).lower() in ('1', 'true', 'yes', 'y')


def _is_published_active(now, announcement: Announcement) -> bool:
    """Check if announcement is published and inside publish window."""
    status = (announcement.status or '').upper()
    if status != 'PUBLISHED':
        return False
    publish_at = announcement.publish_at
    expire_at = announcement.expire_at
    if publish_at and publish_at.tzinfo:
        publish_at = publish_at.astimezone(timezone.utc).replace(tzinfo=None)
    if expire_at and expire_at.tzinfo:
        expire_at = expire_at.astimezone(timezone.utc).replace(tzinfo=None)
    if publish_at and publish_at > now:
        return False
    if expire_at and expire_at <= now:
        return False
    return True


@announcements_bp.route('', methods=['GET'])
def list_announcements():
    """Return announcements based on location scope filters.

    Rules:
      - Province-wide announcements are visible to everyone (still Zambales-only).
      - Municipality announcements are visible when municipality scope matches effective filter.
      - Barangay announcements are visible only when exact barangay filter is matched.
      - Verified residents default to their own location scope.
      - Verified residents can browse other municipality/barangay scopes via header filters.
      - Guests can browse scoped announcements via header filters (municipality/barangay).
      - Pinned announcements (not expired) are sorted to the top, then newest published.
    """
    from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

    try:
        page = max(1, request.args.get('page', 1, type=int) or 1)
        per_page = max(1, request.args.get('per_page', 20, type=int) or 20)
        browse = _parse_bool(request.args.get('browse'), default=False)
        requested_municipality_id = request.args.get('municipality_id', type=int)
        requested_barangay_id = request.args.get('barangay_id', type=int)

        # Use naive UTC to match stored timestamps (SQLite test DB stores naive datetimes)
        now = utc_now()

        # Attempt to resolve authenticated resident
        resident_municipality_id = None
        resident_barangay_id = None
        has_verified_resident = False
        try:
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            if user_id:
                from apps.api.models.user import User
                user = db.session.get(User, user_id)
                if user and user.role == 'resident' and user.admin_verified and is_valid_zambales_municipality(user.municipality_id):
                    resident_municipality_id = user.municipality_id
                    resident_barangay_id = user.barangay_id
                    has_verified_resident = True
        except Exception:
            # Treat any auth errors as anonymous
            pass

        is_guest = not has_verified_resident

        # Determine effective scope
        if has_verified_resident:
            effective_muni_id = resident_municipality_id
            effective_barangay_id = resident_barangay_id
            # Optional browsing for verified residents (explicitly marked as browse)
            if browse and requested_municipality_id:
                # Still enforce Zambales-only
                if is_valid_zambales_municipality(requested_municipality_id):
                    effective_muni_id = requested_municipality_id
                    if requested_barangay_id:
                        from apps.api.models.municipality import Barangay
                        requested_barangay = db.session.get(Barangay, requested_barangay_id)
                        if requested_barangay and requested_barangay.municipality_id == requested_municipality_id:
                            effective_barangay_id = requested_barangay_id
                        elif requested_municipality_id == resident_municipality_id:
                            effective_barangay_id = resident_barangay_id
                        else:
                            effective_barangay_id = None
                    else:
                        # Keep default barangay only when browsing own municipality
                        if requested_municipality_id == resident_municipality_id:
                            effective_barangay_id = resident_barangay_id
                        else:
                            effective_barangay_id = None
        else:
            # Guests default to province-wide only, unless they intentionally browse via header selector
            effective_muni_id = None
            effective_barangay_id = None
            if browse and requested_municipality_id and is_valid_zambales_municipality(requested_municipality_id):
                effective_muni_id = requested_municipality_id
                if requested_barangay_id:
                    from apps.api.models.municipality import Barangay
                    brgy = db.session.get(Barangay, requested_barangay_id)
                    if brgy and brgy.municipality_id == requested_municipality_id:
                        effective_barangay_id = requested_barangay_id

        # Validate municipality scope (for any non-province filter)
        if effective_muni_id and not is_valid_zambales_municipality(effective_muni_id):
            return jsonify({
                'announcements': [],
                'count': 0,
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': 0,
                    'pages': 0,
                },
                'message': 'Municipality is not available in this system'
            }), 200

        # Validate barangay scope if provided
        if effective_barangay_id:
            from apps.api.models.municipality import Barangay
            barangay = db.session.get(Barangay, effective_barangay_id)
            if not barangay or not is_valid_zambales_municipality(barangay.municipality_id):
                return jsonify({'error': 'Barangay is not available in this system'}), 400
            if effective_muni_id and barangay.municipality_id != effective_muni_id:
                # Keep municipality/barangay consistent
                effective_barangay_id = None

        # Build filters
        filters = [
            Announcement.status == 'PUBLISHED',
            or_(Announcement.publish_at == None, Announcement.publish_at <= now),
            or_(Announcement.expire_at == None, Announcement.expire_at > now),
            or_(Announcement.scope == 'PROVINCE', Announcement.municipality_id.in_(ZAMBALES_MUNICIPALITY_IDS)),
        ]

        scope_filters = [Announcement.scope == 'PROVINCE']
        if effective_muni_id:
            muni_filter = and_(Announcement.scope == 'MUNICIPALITY', Announcement.municipality_id == effective_muni_id)
            scope_filters.append(muni_filter)
            if effective_barangay_id:
                barangay_filter = and_(Announcement.scope == 'BARANGAY', Announcement.barangay_id == effective_barangay_id)
                scope_filters.append(barangay_filter)
        filters.append(or_(*scope_filters))

        pinned_active = and_(
            Announcement.pinned == True,
            or_(Announcement.pinned_until == None, Announcement.pinned_until > now)
        )
        publish_order = func.coalesce(Announcement.publish_at, Announcement.created_at)

        query = Announcement.query.options(
            selectinload(Announcement.municipality),
            selectinload(Announcement.barangay),
            selectinload(Announcement.creator),
        ).filter(and_(*filters))
        query = query.order_by(
            case((pinned_active, 0), else_=1),
            publish_order.desc(),
            Announcement.created_at.desc(),
        )
        paginated = query.paginate(page=page, per_page=per_page, error_out=False)

        guest_message = None
        if not has_verified_resident:
            if effective_barangay_id:
                guest_message = 'Browsing barangay announcements as a guest'
            elif effective_muni_id:
                guest_message = 'Browsing municipality announcements as a guest'
            else:
                guest_message = 'Use the header municipality/barangay filters to browse scoped announcements'

        return jsonify({
            'announcements': [a.to_dict() for a in paginated.items],
            'count': len(paginated.items),
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': paginated.total,
                'pages': paginated.pages,
            },
            'message': guest_message
        }), 200

    except (sqlite3.OperationalError, SAOperationalError, SAProgrammingError) as e:
        # Likely missing table/column; log so it's visible in Railway logs
        import logging
        logging.getLogger(__name__).warning('Announcements query DB error (returning empty): %s', e)
        page = max(1, request.args.get('page', 1, type=int) or 1)
        per_page = max(1, request.args.get('per_page', 20, type=int) or 20)
        return jsonify({
            'announcements': [],
            'count': 0,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': 0,
                'pages': 0,
            }
        }), 200
    except Exception as e:
        import logging
        logging.getLogger(__name__).error('Announcements query failed: %s', e)
        return jsonify({'error': 'Failed to get announcements', 'details': str(e)}), 500


@announcements_bp.route('/<int:announcement_id>', methods=['GET'])
def get_announcement(announcement_id: int):
    """Get a single announcement by id with scope enforcement."""
    from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
    now = utc_now()
    try:
        browse = _parse_bool(request.args.get('browse'), default=False)
        requested_muni_id = request.args.get('municipality_id', type=int)
        requested_barangay_id = request.args.get('barangay_id', type=int)

        ann = db.session.get(Announcement, announcement_id)
        if not ann:
            return jsonify({'error': 'Announcement not found'}), 404

        # Status and publish window enforcement
        if not _is_published_active(now, ann):
            return jsonify({'error': 'Announcement not found'}), 404

        # Scope enforcement
        scope = (ann.scope or '').upper()
        if scope != 'PROVINCE':
            if ann.municipality_id and not is_valid_zambales_municipality(ann.municipality_id):
                return jsonify({'error': 'Announcement not found'}), 404
            try:
                verify_jwt_in_request(optional=True)
                user_id = get_jwt_identity()
                if user_id:
                    from apps.api.models.user import User
                    user = db.session.get(User, user_id)
                else:
                    user = None
            except Exception:
                user = None

            is_verified_resident = bool(
                user and user.role == 'resident' and user.admin_verified and is_valid_zambales_municipality(getattr(user, 'municipality_id', None))
            )

            if is_verified_resident:
                can_browse_selected_scope = bool(
                    browse and requested_muni_id and is_valid_zambales_municipality(requested_muni_id)
                )
                # Municipality scope
                if scope == 'MUNICIPALITY':
                    allowed_muni_id = requested_muni_id if can_browse_selected_scope else user.municipality_id
                    if allowed_muni_id != ann.municipality_id:
                        return jsonify({'error': 'Announcement not found'}), 404
                elif scope == 'BARANGAY':
                    if can_browse_selected_scope:
                        if requested_muni_id != ann.municipality_id:
                            return jsonify({'error': 'Announcement not found'}), 404
                        # Cross-location barangay detail requires explicit barangay filter match
                        if requested_barangay_id:
                            if requested_barangay_id != ann.barangay_id:
                                return jsonify({'error': 'Announcement not found'}), 404
                        else:
                            # Keep default resident restriction unless a specific barangay filter is provided
                            if (
                                requested_muni_id != user.municipality_id
                                or not user.barangay_id
                                or user.barangay_id != ann.barangay_id
                            ):
                                return jsonify({'error': 'Announcement not found'}), 404
                    else:
                        if (
                            user.municipality_id != ann.municipality_id
                            or not user.barangay_id
                            or user.barangay_id != ann.barangay_id
                        ):
                            return jsonify({'error': 'Announcement not found'}), 404
            else:
                # Guest or unverified: allow when explicitly browsing via selector
                if not browse or not requested_muni_id or not is_valid_zambales_municipality(requested_muni_id):
                    return jsonify({'error': 'Announcement not found'}), 404
                if scope == 'MUNICIPALITY':
                    if requested_muni_id != ann.municipality_id:
                        return jsonify({'error': 'Announcement not found'}), 404
                elif scope == 'BARANGAY':
                    if requested_muni_id != ann.municipality_id:
                        return jsonify({'error': 'Announcement not found'}), 404
                    if not requested_barangay_id or requested_barangay_id != ann.barangay_id:
                        return jsonify({'error': 'Announcement not found'}), 404

        return jsonify(ann.to_dict()), 200

    except (sqlite3.OperationalError, SAOperationalError, SAProgrammingError):
        return jsonify({'error': 'Announcement not found'}), 404
    except Exception as e:
        return jsonify({'error': 'Failed to get announcement', 'details': str(e)}), 500
