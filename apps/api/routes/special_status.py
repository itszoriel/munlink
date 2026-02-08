"""
MunLink Zambales - Special Status Routes

Endpoints for managing special statuses (Student, PWD, Senior Citizen):
- Resident: Apply for status, view own statuses, renew student status
- Admin: View pending, approve/reject/revoke statuses

SCOPE: Zambales province only
"""
from flask import Blueprint, request, jsonify, current_app
from apps.api.utils.time import utc_now
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import os

from apps.api import db
from apps.api.models.user import User
from apps.api.models.special_status import UserSpecialStatus
from apps.api.utils.special_status import (
    get_active_special_statuses,
    get_user_special_statuses,
    can_apply_for_status,
    get_status_summary,
    approve_special_status,
    reject_special_status,
    revoke_special_status,
)
from apps.api.utils.constants import SPECIAL_STATUS_TYPES
from apps.api.utils.zambales_scope import is_valid_zambales_municipality
from apps.api.utils.admin_audit import log_admin_action

special_status_bp = Blueprint('special_status', __name__, url_prefix='/api')


def _save_status_document(file, user_id: int, status_type: str, doc_name: str) -> str:
    """Save uploaded document for special status application.

    Args:
        file: The uploaded file object
        user_id: The user's ID
        status_type: Type of status (student, pwd, senior)
        doc_name: Name of the document (student_id, cor, pwd_id, senior_id)

    Returns:
        Relative path to the saved file
    """
    if not file or not file.filename:
        return None

    # Create directory structure
    upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
    status_dir = os.path.join(upload_folder, 'special_status', status_type, str(user_id))
    os.makedirs(status_dir, exist_ok=True)

    # Generate filename with timestamp
    timestamp = utc_now().strftime('%Y%m%d_%H%M%S')
    ext = os.path.splitext(file.filename)[1].lower() or '.jpg'
    filename = f"{doc_name}_{timestamp}{ext}"
    filepath = os.path.join(status_dir, filename)

    # Save file
    file.save(filepath)

    # Return relative path
    return os.path.relpath(filepath, upload_folder)


def _parse_semester_dates():
    """Parse semester start/end dates from form data."""
    semester_start_raw = request.form.get('semester_start')
    semester_end_raw = request.form.get('semester_end')

    if not semester_start_raw or not semester_end_raw:
        return None, None, 'Semester start and end dates are required'

    try:
        semester_start = datetime.strptime(semester_start_raw, '%Y-%m-%d').date()
        semester_end = datetime.strptime(semester_end_raw, '%Y-%m-%d').date()
    except ValueError:
        return None, None, 'Semester dates must be in YYYY-MM-DD format'

    if semester_end < semester_start:
        return None, None, 'Semester end date must be on or after the start date'

    return semester_start, semester_end, None


# ============================================
# RESIDENT ENDPOINTS
# ============================================

@special_status_bp.route('/user/special-statuses', methods=['GET'])
@jwt_required()
def get_my_statuses():
    """Get current user's special statuses."""
    user = get_jwt_identity()
    if isinstance(user, dict):
        user_id = user.get('id')
    else:
        user_id = user

    summary = get_status_summary(user_id)
    return jsonify(summary), 200


@special_status_bp.route('/user/special-statuses/student', methods=['POST'])
@jwt_required()
def apply_student_status():
    """Apply for student status.

    Required: school_name, semester_start, semester_end
    Required files: student_id (student ID card), cor (Certificate of Registration)
    """
    user = get_jwt_identity()
    if isinstance(user, dict):
        user_id = user.get('id')
    else:
        user_id = user

    # Check if user can apply
    check = can_apply_for_status(user_id, 'student')
    if not check.get('can_apply'):
        return jsonify({'error': check.get('reason')}), 400

    # Get form data
    school_name = request.form.get('school_name')
    student_id_number = request.form.get('id_number')
    semester_start, semester_end, sem_error = _parse_semester_dates()

    if not school_name:
        return jsonify({'error': 'School name is required'}), 400
    if sem_error:
        return jsonify({'error': sem_error}), 400

    # Check for required files
    student_id_file = request.files.get('student_id')
    cor_file = request.files.get('cor')

    if not student_id_file:
        return jsonify({'error': 'Student ID image is required'}), 400
    if not cor_file:
        return jsonify({'error': 'Certificate of Registration (COR) is required'}), 400

    # Save documents
    student_id_path = _save_status_document(student_id_file, user_id, 'student', 'student_id')
    cor_path = _save_status_document(cor_file, user_id, 'student', 'cor')

    # Create status application
    status = UserSpecialStatus(
        user_id=user_id,
        status_type='student',
        status='pending',
        school_name=school_name,
        semester_start=semester_start,
        semester_end=semester_end,
        id_number=student_id_number,
        student_id_path=student_id_path,
        cor_path=cor_path,
    )

    db.session.add(status)
    db.session.commit()

    return jsonify({
        'message': 'Student status application submitted successfully',
        'status': status.to_dict()
    }), 201


@special_status_bp.route('/user/special-statuses/pwd', methods=['POST'])
@jwt_required()
def apply_pwd_status():
    """Apply for PWD (Person with Disability) status.

    Required files: pwd_id (PWD ID card)
    Optional: disability_type
    """
    user = get_jwt_identity()
    if isinstance(user, dict):
        user_id = user.get('id')
    else:
        user_id = user

    # Check if user can apply
    check = can_apply_for_status(user_id, 'pwd')
    if not check.get('can_apply'):
        return jsonify({'error': check.get('reason')}), 400

    # Get form data
    pwd_id_number = request.form.get('id_number')
    disability_type = request.form.get('disability_type')

    # Check for required files
    pwd_id_file = request.files.get('pwd_id')

    if not pwd_id_file:
        return jsonify({'error': 'PWD ID image is required'}), 400

    # Save document
    pwd_id_path = _save_status_document(pwd_id_file, user_id, 'pwd', 'pwd_id')

    # Create status application
    status = UserSpecialStatus(
        user_id=user_id,
        status_type='pwd',
        status='pending',
        id_number=pwd_id_number,
        disability_type=disability_type,
        pwd_id_path=pwd_id_path,
    )

    db.session.add(status)
    db.session.commit()

    return jsonify({
        'message': 'PWD status application submitted successfully',
        'status': status.to_dict()
    }), 201


@special_status_bp.route('/user/special-statuses/senior', methods=['POST'])
@jwt_required()
def apply_senior_status():
    """Apply for Senior Citizen status.

    Required files: senior_id (Senior Citizen ID card)
    """
    user = get_jwt_identity()
    if isinstance(user, dict):
        user_id = user.get('id')
    else:
        user_id = user

    # Check if user can apply
    check = can_apply_for_status(user_id, 'senior')
    if not check.get('can_apply'):
        return jsonify({'error': check.get('reason')}), 400

    # Get form data
    senior_id_number = request.form.get('id_number')

    # Check for required files
    senior_id_file = request.files.get('senior_id')

    if not senior_id_file:
        return jsonify({'error': 'Senior Citizen ID image is required'}), 400

    # Save document
    senior_id_path = _save_status_document(senior_id_file, user_id, 'senior', 'senior_id')

    # Create status application
    status = UserSpecialStatus(
        user_id=user_id,
        status_type='senior',
        status='pending',
        id_number=senior_id_number,
        senior_id_path=senior_id_path,
    )

    db.session.add(status)
    db.session.commit()

    return jsonify({
        'message': 'Senior Citizen status application submitted successfully',
        'status': status.to_dict()
    }), 201


@special_status_bp.route('/user/special-statuses/<int:status_id>/renew', methods=['PUT'])
@jwt_required()
def renew_student_status(status_id):
    """Renew an expired student status.

    Requires new COR (Certificate of Registration) and updated semester dates.
    """
    user = get_jwt_identity()
    if isinstance(user, dict):
        user_id = user.get('id')
    else:
        user_id = user

    # Get the status
    status = db.session.get(UserSpecialStatus, status_id)
    if not status:
        return jsonify({'error': 'Status not found'}), 404

    # Verify ownership
    if status.user_id != user_id:
        return jsonify({'error': 'Access denied'}), 403

    # Verify it's a student status
    if status.status_type != 'student':
        return jsonify({'error': 'Only student status can be renewed'}), 400

    # Verify it's expired
    if status.is_active():
        return jsonify({'error': 'This status is still active and does not need renewal'}), 400

    # Check for required files
    cor_file = request.files.get('cor')
    student_id_file = request.files.get('student_id')  # Optional for renewal
    semester_start, semester_end, sem_error = _parse_semester_dates()

    if not cor_file:
        return jsonify({'error': 'New Certificate of Registration (COR) is required for renewal'}), 400
    if sem_error:
        return jsonify({'error': sem_error}), 400

    # Update school name if provided
    school_name = request.form.get('school_name')
    if school_name:
        status.school_name = school_name
    status.semester_start = semester_start
    status.semester_end = semester_end

    # Save new documents
    cor_path = _save_status_document(cor_file, user_id, 'student', 'cor')
    status.cor_path = cor_path

    if student_id_file:
        student_id_path = _save_status_document(student_id_file, user_id, 'student', 'student_id')
        status.student_id_path = student_id_path

    # Reset status to pending for admin review
    status.status = 'pending'
    status.expires_at = None
    status.approved_at = None
    status.approved_by_id = None

    db.session.commit()

    return jsonify({
        'message': 'Student status renewal submitted for review',
        'status': status.to_dict()
    }), 200


# ============================================
# ADMIN ENDPOINTS
# ============================================

def _get_admin_context():
    """Get admin user context and verify admin role."""
    user = get_jwt_identity()
    if isinstance(user, dict):
        user_id = user.get('id')
    else:
        user_id = user

    admin = db.session.get(User, user_id)
    if not admin:
        return None

    # Check if user is admin
    admin_roles = ['superadmin', 'provincial_admin', 'municipal_admin', 'barangay_admin']
    if admin.role not in admin_roles:
        return None

    return {
        'user': admin,
        'user_id': admin.id,
        'role': admin.role,
        'municipality_id': admin.admin_municipality_id,
        'barangay_id': admin.admin_barangay_id,
    }


@special_status_bp.route('/admin/special-statuses/pending', methods=['GET'])
@jwt_required()
def get_pending_statuses():
    """Get pending special status applications (admin only).

    Scoped by admin's jurisdiction.
    """
    ctx = _get_admin_context()
    if not ctx:
        return jsonify({'error': 'Admin access required'}), 403

    # Build query
    query = UserSpecialStatus.query.filter_by(status='pending')

    # Join with users table for scoping
    query = query.join(User, UserSpecialStatus.user_id == User.id)

    # Scope by admin's jurisdiction
    if ctx['role'] == 'barangay_admin':
        query = query.filter(User.barangay_id == ctx['barangay_id'])
    elif ctx['role'] == 'municipal_admin':
        query = query.filter(User.municipality_id == ctx['municipality_id'])
    # provincial_admin and superadmin see all in province (Zambales)

    # Filter by status type if provided
    status_type = request.args.get('type')
    if status_type and status_type in SPECIAL_STATUS_TYPES:
        query = query.filter(UserSpecialStatus.status_type == status_type)

    statuses = query.order_by(UserSpecialStatus.created_at.asc()).all()

    result = []
    for status in statuses:
        data = status.to_dict(include_docs=True)
        # Include user info
        if status.user:
            data['user'] = {
                'id': status.user.id,
                'username': status.user.username,
                'first_name': status.user.first_name,
                'last_name': status.user.last_name,
                'municipality_id': status.user.municipality_id,
                'barangay_id': status.user.barangay_id,
            }
        result.append(data)

    return jsonify({
        'statuses': result,
        'total': len(result)
    }), 200


@special_status_bp.route('/admin/special-statuses', methods=['GET'])
@jwt_required()
def get_all_statuses():
    """Get all special status applications with filters (admin only)."""
    ctx = _get_admin_context()
    if not ctx:
        return jsonify({'error': 'Admin access required'}), 403

    # Build query
    query = UserSpecialStatus.query.join(User, UserSpecialStatus.user_id == User.id)

    # Scope by admin's jurisdiction
    if ctx['role'] == 'barangay_admin':
        query = query.filter(User.barangay_id == ctx['barangay_id'])
    elif ctx['role'] == 'municipal_admin':
        query = query.filter(User.municipality_id == ctx['municipality_id'])

    # Filter by status type if provided
    status_type = request.args.get('type')
    if status_type and status_type in SPECIAL_STATUS_TYPES:
        query = query.filter(UserSpecialStatus.status_type == status_type)

    # Filter by application status
    app_status = request.args.get('status')
    if app_status:
        query = query.filter(UserSpecialStatus.status == app_status)

    # Filter by user_id if provided
    user_id = request.args.get('user_id')
    if user_id:
        query = query.filter(UserSpecialStatus.user_id == int(user_id))

    # Pagination
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    per_page = min(per_page, 100)  # Cap at 100

    pagination = query.order_by(UserSpecialStatus.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    result = []
    for status in pagination.items:
        data = status.to_dict(include_docs=True)
        if status.user:
            data['user'] = {
                'id': status.user.id,
                'username': status.user.username,
                'first_name': status.user.first_name,
                'last_name': status.user.last_name,
                'municipality_id': status.user.municipality_id,
                'barangay_id': status.user.barangay_id,
            }
        result.append(data)

    return jsonify({
        'statuses': result,
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages
    }), 200


@special_status_bp.route('/admin/special-statuses/<int:status_id>', methods=['GET'])
@jwt_required()
def get_status_detail(status_id):
    """Get detailed view of a special status application (admin only)."""
    ctx = _get_admin_context()
    if not ctx:
        return jsonify({'error': 'Admin access required'}), 403

    status = db.session.get(UserSpecialStatus, status_id)
    if not status:
        return jsonify({'error': 'Status not found'}), 404

    # Verify jurisdiction
    if ctx['role'] == 'barangay_admin' and status.user.barangay_id != ctx['barangay_id']:
        return jsonify({'error': 'Access denied'}), 403
    if ctx['role'] == 'municipal_admin' and status.user.municipality_id != ctx['municipality_id']:
        return jsonify({'error': 'Access denied'}), 403

    data = status.to_dict(include_docs=True)
    if status.user:
        data['user'] = status.user.to_dict(include_sensitive=True)

    # Log admin view
    log_admin_action(
        admin_id=ctx['user_id'],
        action='view_special_status',
        resource_type='special_status',
        resource_id=status_id,
        details={'status_type': status.status_type, 'user_id': status.user_id}
    )

    return jsonify(data), 200


@special_status_bp.route('/admin/special-statuses/<int:status_id>/approve', methods=['POST'])
@jwt_required()
def approve_status(status_id):
    """Approve a special status application (admin only)."""
    ctx = _get_admin_context()
    if not ctx:
        return jsonify({'error': 'Admin access required'}), 403

    status = db.session.get(UserSpecialStatus, status_id)
    if not status:
        return jsonify({'error': 'Status not found'}), 404

    if status.status != 'pending':
        return jsonify({'error': 'Only pending applications can be approved'}), 400

    # Verify jurisdiction
    if ctx['role'] == 'barangay_admin' and status.user.barangay_id != ctx['barangay_id']:
        return jsonify({'error': 'Access denied'}), 403
    if ctx['role'] == 'municipal_admin' and status.user.municipality_id != ctx['municipality_id']:
        return jsonify({'error': 'Access denied'}), 403

    # Approve the status
    approve_special_status(status, ctx['user_id'])

    # Log admin action
    log_admin_action(
        admin_id=ctx['user_id'],
        action='approve_special_status',
        resource_type='special_status',
        resource_id=status_id,
        details={
            'status_type': status.status_type,
            'user_id': status.user_id,
            'expires_at': status.expires_at.isoformat() if status.expires_at else None
        }
    )

    return jsonify({
        'message': f'{status.status_type.title()} status approved successfully',
        'status': status.to_dict()
    }), 200


@special_status_bp.route('/admin/special-statuses/<int:status_id>/reject', methods=['POST'])
@jwt_required()
def reject_status(status_id):
    """Reject a special status application (admin only).

    Requires: reason
    """
    ctx = _get_admin_context()
    if not ctx:
        return jsonify({'error': 'Admin access required'}), 403

    status = db.session.get(UserSpecialStatus, status_id)
    if not status:
        return jsonify({'error': 'Status not found'}), 404

    if status.status != 'pending':
        return jsonify({'error': 'Only pending applications can be rejected'}), 400

    # Verify jurisdiction
    if ctx['role'] == 'barangay_admin' and status.user.barangay_id != ctx['barangay_id']:
        return jsonify({'error': 'Access denied'}), 403
    if ctx['role'] == 'municipal_admin' and status.user.municipality_id != ctx['municipality_id']:
        return jsonify({'error': 'Access denied'}), 403

    # Get rejection reason
    data = request.get_json() or {}
    reason = data.get('reason')
    if not reason:
        return jsonify({'error': 'Rejection reason is required'}), 400

    # Reject the status
    reject_special_status(status, ctx['user_id'], reason)

    # Log admin action
    log_admin_action(
        admin_id=ctx['user_id'],
        action='reject_special_status',
        resource_type='special_status',
        resource_id=status_id,
        details={
            'status_type': status.status_type,
            'user_id': status.user_id,
            'reason': reason
        }
    )

    return jsonify({
        'message': f'{status.status_type.title()} status rejected',
        'status': status.to_dict()
    }), 200


@special_status_bp.route('/admin/special-statuses/<int:status_id>/revoke', methods=['POST'])
@jwt_required()
def revoke_status(status_id):
    """Revoke a previously approved special status (admin only).

    Requires: reason
    """
    ctx = _get_admin_context()
    if not ctx:
        return jsonify({'error': 'Admin access required'}), 403

    status = db.session.get(UserSpecialStatus, status_id)
    if not status:
        return jsonify({'error': 'Status not found'}), 404

    if status.status != 'approved':
        return jsonify({'error': 'Only approved statuses can be revoked'}), 400

    # Verify jurisdiction
    if ctx['role'] == 'barangay_admin' and status.user.barangay_id != ctx['barangay_id']:
        return jsonify({'error': 'Access denied'}), 403
    if ctx['role'] == 'municipal_admin' and status.user.municipality_id != ctx['municipality_id']:
        return jsonify({'error': 'Access denied'}), 403

    # Get revocation reason
    data = request.get_json() or {}
    reason = data.get('reason')
    if not reason:
        return jsonify({'error': 'Revocation reason is required'}), 400

    # Revoke the status
    revoke_special_status(status, ctx['user_id'], reason)

    # Log admin action
    log_admin_action(
        admin_id=ctx['user_id'],
        action='revoke_special_status',
        resource_type='special_status',
        resource_id=status_id,
        details={
            'status_type': status.status_type,
            'user_id': status.user_id,
            'reason': reason
        }
    )

    return jsonify({
        'message': f'{status.status_type.title()} status has been revoked',
        'status': status.to_dict()
    }), 200


# ============================================
# PUBLIC ENDPOINTS
# ============================================

@special_status_bp.route('/special-status-types', methods=['GET'])
def get_status_types():
    """Get list of available special status types (public)."""
    return jsonify({
        'types': [
            {
                'key': 'student',
                'label': 'Student',
                'description': 'For currently enrolled students. Valid until the declared semester end.',
                'required_documents': ['Student ID', 'Certificate of Registration (COR)']
            },
            {
                'key': 'pwd',
                'label': 'Person with Disability (PWD)',
                'description': 'For persons with disabilities. Permanent once approved.',
                'required_documents': ['PWD ID']
            },
            {
                'key': 'senior',
                'label': 'Senior Citizen',
                'description': 'For senior citizens (60 years and above). Permanent once approved.',
                'required_documents': ['Senior Citizen ID']
            }
        ]
    }), 200
