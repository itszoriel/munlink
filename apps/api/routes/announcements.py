"""Public announcements routes.

SCOPE: Zambales province only, excluding Olongapo City.
"""
from datetime import datetime, timezone
import json
import re
from apps.api.utils.time import utc_now
from flask import Blueprint, jsonify, request
from sqlalchemy import and_, or_, case, func
from sqlalchemy.orm import selectinload
import sqlalchemy as sa
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


def _normalize_shared_municipalities(raw):
    """Return a clean list of int municipality IDs from stored JSON/text values."""
    if not raw:
        return []
    items = raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            items = parsed if isinstance(parsed, list) else []
        except Exception:
            # Fallback: extract digits from string like "[112,113]"
            items = re.findall(r'\d+', raw)
    if not isinstance(items, (list, tuple)):
        return []
    cleaned = []
    for val in items:
        try:
            num = int(val)
        except Exception:
            continue
        cleaned.append(num)
    return cleaned

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
    """Return announcements relevant to a verified resident's registered location.

    Rules:
      - Province-wide announcements are visible to everyone (still Zambales-only).
      - Municipality announcements are visible only to verified residents of that municipality.
      - Barangay announcements are visible only to verified residents of that barangay.
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
                    if requested_municipality_id == resident_municipality_id:
                        effective_muni_id = requested_municipality_id
                        # Only allow barangay browsing within the resident's municipality and assigned barangay
                        if requested_barangay_id and resident_barangay_id == requested_barangay_id:
                            effective_barangay_id = requested_barangay_id
                        else:
                            effective_barangay_id = resident_barangay_id
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
        include_all_barangays = False
        if effective_muni_id:
            muni_filter = and_(Announcement.scope == 'MUNICIPALITY', Announcement.municipality_id == effective_muni_id)
            shared_scope_filter = Announcement.scope.in_(['MUNICIPALITY', 'BARANGAY'])
            if is_guest:
                shared_scope_filter = (Announcement.scope == 'MUNICIPALITY')
            shared_filter = and_(
                shared_scope_filter,
                Announcement.shared_with_municipalities != None,
                func.json_array_length(Announcement.shared_with_municipalities) > 0,
                func.cast(Announcement.shared_with_municipalities, sa.TEXT).like(f'%{effective_muni_id}%')
            )
            if is_guest:
                muni_filter = and_(muni_filter, Announcement.public_viewable == True)
                shared_filter = and_(shared_filter, Announcement.public_viewable == True)
            scope_filters.append(muni_filter)
            scope_filters.append(shared_filter)
            if effective_barangay_id and not is_guest:
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
            if effective_muni_id:
                guest_message = 'Browsing municipality announcements as a guest'
            else:
                guest_message = 'Login as a verified Zambales resident to see municipality-specific announcements'

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

    except (sqlite3.OperationalError, SAOperationalError, SAProgrammingError):
        # Likely missing table in SQLite; return safe empty shape instead of 500
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
            shared_munis = _normalize_shared_municipalities(ann.shared_with_municipalities)

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
                # Municipality scope
                if scope == 'MUNICIPALITY':
                    if user.municipality_id != ann.municipality_id and user.municipality_id not in shared_munis:
                        return jsonify({'error': 'Announcement not found'}), 404
                elif scope == 'BARANGAY':
                    # Allow residents of shared-to municipalities even if they haven't set a barangay.
                    if user.municipality_id in shared_munis:
                        pass
                    elif not user.barangay_id or user.barangay_id != ann.barangay_id:
                        return jsonify({'error': 'Announcement not found'}), 404
            else:
                # Guest or unverified: allow only when explicitly browsing via selector
                if not browse or not requested_muni_id or not is_valid_zambales_municipality(requested_muni_id):
                    return jsonify({'error': 'Announcement not found'}), 404
                if not ann.public_viewable:
                    return jsonify({'error': 'Announcement not found'}), 404
                if scope == 'MUNICIPALITY':
                    if requested_muni_id != ann.municipality_id and requested_muni_id not in shared_munis:
                        return jsonify({'error': 'Announcement not found'}), 404
                elif scope == 'BARANGAY':
                    return jsonify({'error': 'Announcement not found'}), 404

        return jsonify(ann.to_dict()), 200

    except (sqlite3.OperationalError, SAOperationalError, SAProgrammingError):
        return jsonify({'error': 'Announcement not found'}), 404
    except Exception as e:
        return jsonify({'error': 'Failed to get announcement', 'details': str(e)}), 500
