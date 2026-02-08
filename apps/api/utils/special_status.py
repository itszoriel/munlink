"""
Special Status utility functions for managing Student, PWD, and Senior statuses.

Provides helpers for:
- Checking active statuses for a user
- Managing status expiry (students expire at semester end, with fallback)
- Status validation
"""
from datetime import datetime, timedelta, time, date
from apps.api.utils.time import utc_now
from typing import List, Optional, Dict, Any

try:
    from apps.api import db
except ImportError:
    from apps.api import db

from apps.api.models.special_status import UserSpecialStatus
from apps.api.utils.constants import STUDENT_STATUS_EXPIRY_DAYS


def get_active_special_statuses(user_id: int) -> List[str]:
    """
    Get list of active special status types for a user.

    Args:
        user_id: The user's ID

    Returns:
        List of active status types (e.g., ['student', 'pwd'])
    """
    statuses = UserSpecialStatus.query.filter_by(
        user_id=user_id,
        status='approved'
    ).all()

    active = []
    for status in statuses:
        if status.is_active():
            active.append(status.status_type)

    return active


def get_user_special_statuses(user_id: int, include_inactive: bool = False) -> List[UserSpecialStatus]:
    """
    Get all special status records for a user.

    Args:
        user_id: The user's ID
        include_inactive: If True, include expired/revoked statuses

    Returns:
        List of UserSpecialStatus objects
    """
    query = UserSpecialStatus.query.filter_by(user_id=user_id)

    if not include_inactive:
        query = query.filter(UserSpecialStatus.status.in_(['pending', 'approved']))

    return query.order_by(UserSpecialStatus.created_at.desc()).all()


def has_active_status(user_id: int, status_type: str) -> bool:
    """
    Check if user has an active status of a specific type.

    Args:
        user_id: The user's ID
        status_type: The type of status to check ('student', 'pwd', 'senior')

    Returns:
        True if user has an active status of the specified type
    """
    return status_type in get_active_special_statuses(user_id)


def get_pending_status(user_id: int, status_type: str) -> Optional[UserSpecialStatus]:
    """
    Get pending status application of a specific type for a user.

    Args:
        user_id: The user's ID
        status_type: The type of status to check

    Returns:
        Pending UserSpecialStatus object or None
    """
    return UserSpecialStatus.query.filter_by(
        user_id=user_id,
        status_type=status_type,
        status='pending'
    ).first()


def get_approved_status(user_id: int, status_type: str) -> Optional[UserSpecialStatus]:
    """
    Get approved (and possibly active) status of a specific type for a user.

    Args:
        user_id: The user's ID
        status_type: The type of status to check

    Returns:
        Approved UserSpecialStatus object or None
    """
    return UserSpecialStatus.query.filter_by(
        user_id=user_id,
        status_type=status_type,
        status='approved'
    ).first()


def calculate_student_expiry(semester_end: Optional[date] = None) -> datetime:
    """
    Calculate the expiry date for a student status.

    If semester_end is provided, expire at the end of that date.
    Otherwise, fall back to a fixed window from now.

    Returns:
        Datetime object representing the expiry date
    """
    if semester_end:
        return datetime.combine(semester_end, time.max)
    return utc_now() + timedelta(days=STUDENT_STATUS_EXPIRY_DAYS)


def expire_student_statuses() -> int:
    """
    Background job to expire student statuses that have passed their expiry date.

    Returns:
        Number of statuses expired
    """
    now = utc_now()

    expired_statuses = UserSpecialStatus.query.filter(
        UserSpecialStatus.status_type == 'student',
        UserSpecialStatus.status == 'approved',
        UserSpecialStatus.expires_at.isnot(None),
        UserSpecialStatus.expires_at < now
    ).all()

    count = 0
    for status in expired_statuses:
        status.status = 'expired'
        count += 1

    if count > 0:
        db.session.commit()

    return count


def approve_special_status(
    status: UserSpecialStatus,
    admin_user_id: int,
    expiry_date: Optional[datetime] = None
) -> UserSpecialStatus:
    """
    Approve a special status application.

    Args:
        status: The UserSpecialStatus object to approve
        admin_user_id: The ID of the admin approving
        expiry_date: Optional custom expiry date (defaults to semester end or fallback)

    Returns:
        Updated UserSpecialStatus object
    """
    status.status = 'approved'
    status.approved_by_id = admin_user_id
    status.approved_at = utc_now()

    # Set expiry for students
    if status.status_type == 'student':
        status.expires_at = expiry_date or calculate_student_expiry(status.semester_end)

    db.session.commit()
    return status


def reject_special_status(
    status: UserSpecialStatus,
    admin_user_id: int,
    reason: str
) -> UserSpecialStatus:
    """
    Reject a special status application.

    Args:
        status: The UserSpecialStatus object to reject
        admin_user_id: The ID of the admin rejecting
        reason: Reason for rejection

    Returns:
        Updated UserSpecialStatus object
    """
    status.status = 'rejected'
    status.approved_by_id = admin_user_id  # Reusing for tracking who handled it
    status.rejection_reason = reason

    db.session.commit()
    return status


def revoke_special_status(
    status: UserSpecialStatus,
    admin_user_id: int,
    reason: str
) -> UserSpecialStatus:
    """
    Revoke a previously approved special status.

    Args:
        status: The UserSpecialStatus object to revoke
        admin_user_id: The ID of the admin revoking
        reason: Reason for revocation

    Returns:
        Updated UserSpecialStatus object
    """
    status.status = 'revoked'
    status.revoked_by_id = admin_user_id
    status.revoked_at = utc_now()
    status.revoked_reason = reason

    db.session.commit()
    return status


def can_apply_for_status(user_id: int, status_type: str) -> Dict[str, Any]:
    """
    Check if a user can apply for a specific status type.

    Args:
        user_id: The user's ID
        status_type: The type of status to apply for

    Returns:
        Dict with 'can_apply' boolean and 'reason' if not allowed
    """
    # Check for pending application
    pending = get_pending_status(user_id, status_type)
    if pending:
        return {
            'can_apply': False,
            'reason': f'You already have a pending {status_type} status application'
        }

    # Check for active status
    approved = get_approved_status(user_id, status_type)
    if approved and approved.is_active():
        return {
            'can_apply': False,
            'reason': f'You already have an active {status_type} status'
        }

    # For students, allow renewal if expired
    if approved and status_type == 'student' and not approved.is_active():
        return {
            'can_apply': True,
            'is_renewal': True,
            'previous_status_id': approved.id
        }

    return {'can_apply': True}


def get_status_summary(user_id: int) -> Dict[str, Any]:
    """
    Get a summary of all special statuses for a user.

    Args:
        user_id: The user's ID

    Returns:
        Dict with status information for each type
    """
    statuses = get_user_special_statuses(user_id, include_inactive=True)

    summary = {
        'student': {'active': False, 'pending': False, 'expired': False, 'status': None},
        'pwd': {'active': False, 'pending': False, 'status': None},
        'senior': {'active': False, 'pending': False, 'status': None},
        'active_types': []
    }

    for status in statuses:
        st = status.status_type
        if status.status == 'pending':
            summary[st]['pending'] = True
            summary[st]['status'] = status.to_dict()
        elif status.status == 'approved':
            if status.is_active():
                summary[st]['active'] = True
                summary[st]['status'] = status.to_dict()
                summary['active_types'].append(st)
            elif st == 'student':
                summary[st]['expired'] = True
                summary[st]['status'] = status.to_dict()

    return summary
