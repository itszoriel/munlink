"""Public/resident Issue reporting routes.

SCOPE: Zambales province only, excluding Olongapo City.
"""
from flask import Blueprint, jsonify, request
from apps.api.utils.time import utc_now
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_

from apps.api import db
from apps.api.models.issue import Issue, IssueCategory
from apps.api.models.user import User
from apps.api.models.municipality import Municipality
from apps.api.utils import (
    validate_required_fields,
    ValidationError,
    fully_verified_required,
    save_issue_attachment,
)
from apps.api.utils.zambales_scope import (
    ZAMBALES_MUNICIPALITY_IDS,
    is_valid_zambales_municipality,
)


issues_bp = Blueprint('issues', __name__, url_prefix='/api/issues')


@issues_bp.route('/categories', methods=['GET'])
def list_categories():
    """Public list of active issue categories."""
    try:
        cats = IssueCategory.query.filter_by(is_active=True).all()
        return jsonify({'categories': [c.to_dict() for c in cats], 'count': len(cats)}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get categories', 'details': str(e)}), 500

@issues_bp.route('', methods=['GET'])
def list_issues():
    """Public list of issues with municipality scoping.
    
    Query params:
      - municipality_id: int (REQUIRED for guests; authenticated users auto-scoped)
      - status: string (optional filter)
      - category: int or string (optional filter)
      - page: int (default 1)
      - per_page: int (default 20)
    
    Municipality Scoping Rules:
      - Guest users: MUST provide municipality_id; returns empty if not provided
      - Logged-in users: Can view issues from other municipalities (read-only discovery)
      - No global/unscoped data loads by default
    """
    from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
    
    try:
        municipality_id = request.args.get('municipality_id', type=int)
        status = request.args.get('status')
        category = request.args.get('category')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)

        # Check if user is authenticated
        is_authenticated = False
        user_municipality_id = None
        try:
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            if user_id:
                is_authenticated = True
                user = db.session.get(User, user_id)
                if user:
                    user_municipality_id = user.municipality_id
        except Exception:
            pass

        # Municipality Scoping Enforcement:
        # - Guests without municipality_id get empty results (no global data)
        # - Logged-in users default to their municipality if no filter provided
        # - ZAMBALES SCOPE: Only allow Zambales municipalities (excluding Olongapo)
        effective_municipality_id = municipality_id
        if not effective_municipality_id:
            if is_authenticated and user_municipality_id:
                # Default to user's registered municipality
                effective_municipality_id = user_municipality_id
            else:
                # Guest without location context: return empty per scoping rules
                return jsonify({
                    'issues': [],
                    'pagination': {
                        'page': page,
                        'per_page': per_page,
                        'total': 0,
                        'pages': 0,
                    },
                    'message': 'Please select a municipality to view issues'
                }), 200

        # ZAMBALES SCOPE: Verify municipality is valid
        if not is_valid_zambales_municipality(effective_municipality_id):
            return jsonify({
                'issues': [],
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': 0,
                    'pages': 0,
                },
                'message': 'Municipality is not available in this system'
            }), 200

        # Build query with enforced municipality scoping
        query = Issue.query.filter_by(is_public=True)
        query = query.filter(Issue.municipality_id == effective_municipality_id)
        
        if status:
            query = query.filter(Issue.status == status)
        if category:
            # category may be id or slug/name
            try:
                category_id = int(category)
                query = query.filter(Issue.category_id == category_id)
            except (TypeError, ValueError):
                cat = IssueCategory.query.filter(or_(IssueCategory.slug == category, IssueCategory.name == category)).first()
                if cat:
                    query = query.filter(Issue.category_id == cat.id)

        # Manual pagination to avoid paginate() edge cases
        total = query.count()
        items = (
            query.order_by(Issue.created_at.desc())
                 .limit(per_page)
                 .offset((page - 1) * per_page)
                 .all()
        )
        pages = (total + per_page - 1) // per_page if per_page else 1
        return jsonify({
            'issues': [i.to_dict() for i in items],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': pages,
            }
        }), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get issues', 'details': str(e)}), 500


@issues_bp.route('/<int:issue_id>', methods=['GET'])
def get_issue(issue_id: int):
    """Public issue detail if issue is public; otherwise 404."""
    try:
        issue = db.session.get(Issue, issue_id)
        if not issue or not issue.is_public:
            return jsonify({'error': 'Issue not found'}), 404
        return jsonify(issue.to_dict()), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get issue', 'details': str(e)}), 500


@issues_bp.route('', methods=['POST'])
@jwt_required()
@fully_verified_required
def create_issue():
    """Create a new resident issue (scoped to resident's municipality)."""
    try:
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json() or {}
        required = ['category_id', 'title', 'description']
        validate_required_fields(data, required)

        # Municipality scoping
        municipality_id = user.municipality_id
        if not municipality_id:
            return jsonify({'error': 'User has no registered municipality'}), 400
        
        # ZAMBALES SCOPE: Verify municipality is in Zambales (excluding Olongapo)
        if not is_valid_zambales_municipality(municipality_id):
            return jsonify({'error': 'Your municipality is not available in this system'}), 403

        # Validate category
        category = db.session.get(IssueCategory, int(data['category_id']))
        if not category:
            return jsonify({'error': 'Invalid category'}), 400

        # Generate issue number (simple and unique enough)
        count = Issue.query.count() + 1
        issue_number = f"ISS-{municipality_id}-{user_id}-{count}"

        # Require a specific location (address) for actionable triage
        specific_location = (data.get('specific_location') or '').strip()
        if not specific_location:
            return jsonify({'error': 'specific_location is required'}), 400

        issue = Issue(
            issue_number=issue_number,
            user_id=user_id,
            category_id=category.id,
            title=data['title'],
            description=data['description'],
            municipality_id=municipality_id,
            barangay_id=data.get('barangay_id'),
            specific_location=specific_location,
            latitude=data.get('latitude'),
            longitude=data.get('longitude'),
            attachments=[],
            priority=data.get('priority', 'medium'),
            status='submitted',
            is_public=True,
        )
        db.session.add(issue)
        db.session.commit()

        return jsonify({'message': 'Issue created successfully', 'issue': issue.to_dict()}), 201
    except ValidationError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create issue', 'details': str(e)}), 500


@issues_bp.route('/my', methods=['GET'])
@jwt_required()
def my_issues():
    """Get current user's issues."""
    try:
        user_id = int(get_jwt_identity())
        issues = Issue.query.filter(Issue.user_id == user_id).order_by(Issue.created_at.desc()).all()
        return jsonify({'issues': [i.to_dict() for i in issues], 'count': len(issues)}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get issues', 'details': str(e)}), 500


@issues_bp.route('/<int:issue_id>', methods=['PUT'])
@jwt_required()
@fully_verified_required
def update_issue(issue_id: int):
    """Update an issue owned by the current user.
    
    Municipality Scoping Rules:
      - Users can only update issues they created
      - Issue municipality_id is derived from user's profile and cannot be changed
      - Users can only edit issues in their registered municipality
    """
    try:
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        issue = db.session.get(Issue, issue_id)
        if not issue:
            return jsonify({'error': 'Issue not found'}), 404
        
        # Ownership check
        if issue.user_id != int(user_id):
            return jsonify({'error': 'You can only edit your own issues'}), 403
        
        # Municipality scoping: Ensure issue belongs to user's registered municipality
        if not user.municipality_id or issue.municipality_id != user.municipality_id:
            return jsonify({'error': 'You can only edit issues in your registered municipality'}), 403
        
        # Only allow edits when issue is in early status (not yet resolved/closed)
        if issue.status in ['resolved', 'closed', 'rejected']:
            return jsonify({'error': 'Cannot edit issues that are already resolved, closed, or rejected'}), 400
        
        data = request.get_json() or {}
        
        # Update allowed fields (municipality_id CANNOT be changed)
        if 'title' in data and data['title']:
            issue.title = data['title']
        if 'description' in data and data['description']:
            issue.description = data['description']
        if 'specific_location' in data:
            issue.specific_location = data['specific_location']
        if 'latitude' in data:
            issue.latitude = data['latitude']
        if 'longitude' in data:
            issue.longitude = data['longitude']
        if 'category_id' in data:
            category = db.session.get(IssueCategory, int(data['category_id']))
            if category:
                issue.category_id = category.id
        
        # Update timestamp
        from datetime import datetime
        issue.updated_at = utc_now()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Issue updated successfully',
            'issue': issue.to_dict()
        }), 200
    
    except ValidationError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update issue', 'details': str(e)}), 500


@issues_bp.route('/<int:issue_id>/upload', methods=['POST'])
@jwt_required()
@fully_verified_required
def upload_issue_file(issue_id: int):
    """Upload attachment to an owned issue."""
    try:
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        issue = db.session.get(Issue, issue_id)
        if not issue:
            return jsonify({'error': 'Issue not found'}), 404
        if issue.user_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403

        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        file = request.files['file']

        # Determine municipality slug
        municipality = db.session.get(Municipality, user.municipality_id)
        municipality_slug = municipality.slug if municipality else 'unknown'

        # Enforce max 5 attachments per issue
        existing = issue.attachments or []
        if len(existing) >= 5:
            return jsonify({'error': 'Maximum attachments reached (5)'}), 400

        rel_path = save_issue_attachment(file, issue.id, municipality_slug)

        # Append to attachments
        existing.append(rel_path)
        issue.attachments = existing
        db.session.commit()

        return jsonify({'message': 'File uploaded', 'path': rel_path, 'issue': issue.to_dict()}), 200
    except ValidationError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to upload file', 'details': str(e)}), 500


