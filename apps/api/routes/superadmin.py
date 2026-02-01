"""
MunLink Zambales - SuperAdmin Routes
Super admin operations for managing admin accounts

SCOPE: Zambales province only, excluding Olongapo City.
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_, desc
from __init__ import db
from models.user import User
from models.municipality import Municipality, Barangay
from models.admin_audit_log import AdminAuditLog

superadmin_bp = Blueprint('superadmin', __name__, url_prefix='/api/superadmin')


@superadmin_bp.before_request
def handle_preflight():
    """Handle CORS preflight requests explicitly."""
    if request.method == 'OPTIONS':
        response = current_app.make_default_options_response()
        return response


@superadmin_bp.route('/debug/all-users', methods=['GET'])
@jwt_required()
def debug_all_users():
    """Debug endpoint to see all users and their roles."""
    try:
        admin = require_superadmin()
        if not admin:
            return jsonify({'error': 'Unauthorized - super admin access required'}), 403

        # Get ALL users
        all_users = User.query.all()
        current_app.logger.info(f"Total users in database: {len(all_users)}")

        user_info = []
        for user in all_users:
            user_info.append({
                'id': user.id,
                'username': user.username,
                'role': user.role,
                'admin_municipality_id': user.admin_municipality_id
            })

        return jsonify({
            'total_users': len(all_users),
            'users': user_info
        }), 200

    except Exception as e:
        current_app.logger.error(f"Debug endpoint error: {str(e)}")
        import traceback
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500


@superadmin_bp.route('/admins', methods=['GET'])
@jwt_required()
def list_admins():
    """
    List all admin accounts (admin, municipal_admin, barangay_admin, provincial_admin, superadmin).
    """
    try:
        admin = require_superadmin()
        if not admin:
            return jsonify({'error': 'Unauthorized - super admin access required'}), 403

        # Pagination params (small default to avoid timeouts)
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 10, type=int), 100)
        if per_page < 1:
            per_page = 10

        # Query all admin users (include legacy 'admin' role)
        admin_roles = ['admin', 'municipal_admin', 'barangay_admin', 'provincial_admin', 'superadmin']

        # First, log total user count for debugging
        total_users = User.query.count()
        print(f"[SUPERADMIN DEBUG] Total users in database: {total_users}")
        current_app.logger.info(f"Total users in database: {total_users}")

        # Log the query we're about to run
        print(f"[SUPERADMIN DEBUG] Querying for roles: {admin_roles}")
        current_app.logger.info(f"Querying for roles: {admin_roles}")

        # Try with order_by first, fallback to no ordering if created_at doesn't exist
        try:
            print(f"[SUPERADMIN DEBUG] Attempting query with order_by")
            query = User.query.filter(User.role.in_(admin_roles)).order_by(User.created_at.desc())
            print(f"[SUPERADMIN DEBUG] Query with order_by succeeded")
        except Exception as order_error:
            print(f"[SUPERADMIN DEBUG] Order by failed: {str(order_error)}")
            current_app.logger.warning(f"Order by created_at failed, fetching without ordering: {str(order_error)}")
            query = User.query.filter(User.role.in_(admin_roles))
            print(f"[SUPERADMIN DEBUG] Query without order_by succeeded")

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        admins = pagination.items

        print(f"[SUPERADMIN DEBUG] Found {pagination.total} admin users out of {total_users} total users")
        current_app.logger.info(f"Found {pagination.total} admin users out of {total_users} total users")

        # Build response with municipality and barangay names
        admin_list = []
        for admin in admins:
            try:
                admin_data = {
                    'id': admin.id,
                    'username': admin.username,
                    'email': admin.email,
                    'first_name': admin.first_name or '',
                    'middle_name': admin.middle_name or '',
                    'last_name': admin.last_name or '',
                    'role': admin.role,
                    'admin_municipality_id': admin.admin_municipality_id,
                    'admin_barangay_id': admin.admin_barangay_id,
                    'created_at': admin.created_at.isoformat() if hasattr(admin, 'created_at') and admin.created_at else None,
                }

                # Add municipality name
                if admin.admin_municipality_id:
                    try:
                        municipality = Municipality.query.get(admin.admin_municipality_id)
                        if municipality:
                            admin_data['municipality_name'] = municipality.name
                    except Exception as muni_error:
                        current_app.logger.warning(f"Failed to fetch municipality {admin.admin_municipality_id}: {str(muni_error)}")

                # Add barangay name
                if admin.admin_barangay_id:
                    try:
                        barangay = Barangay.query.get(admin.admin_barangay_id)
                        if barangay:
                            admin_data['barangay_name'] = barangay.name
                    except Exception as brgy_error:
                        current_app.logger.warning(f"Failed to fetch barangay {admin.admin_barangay_id}: {str(brgy_error)}")

                admin_list.append(admin_data)
            except Exception as admin_error:
                current_app.logger.error(f"Error processing admin {admin.id}: {str(admin_error)}")
                continue

        current_app.logger.info(f"Returning {len(admin_list)} admins to client")
        return jsonify({
            'admins': admin_list,
            'pagination': {
                'page': pagination.page,
                'per_page': pagination.per_page,
                'total': pagination.total,
                'pages': pagination.pages,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev,
                'next_page': pagination.next_num,
                'prev_page': pagination.prev_num
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"List admins error: {str(e)}")
        import traceback
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': f'Failed to fetch admins: {str(e)}'}), 500


# =============================================================================
# AUDIT LOG ENDPOINTS (JWT Protected)
# =============================================================================

def require_superadmin():
    """Decorator helper to verify user is a super admin."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or user.role != 'superadmin':
        return None
    return user


@superadmin_bp.route('/audit-log', methods=['GET'])
@jwt_required()
def get_audit_log():
    """
    Get admin audit log entries (super admin only).

    Query parameters:
        - page: Page number (default: 1)
        - per_page: Items per page (default: 50, max: 100)
        - action: Filter by action type (optional)
        - start_date: Filter by start date ISO format (optional)
        - end_date: Filter by end date ISO format (optional)
        - search: Search in admin_email or details (optional)

    Returns:
        - audit_logs: List of audit log entries
        - pagination: Pagination metadata
    """
    try:
        # Verify super admin
        admin = require_superadmin()
        if not admin:
            return jsonify({'error': 'Unauthorized - super admin access required'}), 403

        # Parse query parameters
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 50, type=int), 100)
        action_filter = request.args.get('action', '').strip()
        start_date = request.args.get('start_date', '').strip()
        end_date = request.args.get('end_date', '').strip()
        search = request.args.get('search', '').strip()

        # Build query
        query = AdminAuditLog.query

        # Apply filters
        if action_filter:
            query = query.filter(AdminAuditLog.action == action_filter)

        if start_date:
            try:
                from datetime import datetime
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query = query.filter(AdminAuditLog.created_at >= start_dt)
            except ValueError:
                pass

        if end_date:
            try:
                from datetime import datetime
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query = query.filter(AdminAuditLog.created_at <= end_dt)
            except ValueError:
                pass

        if search:
            search_pattern = f'%{search}%'
            query = query.filter(
                or_(
                    AdminAuditLog.admin_email.ilike(search_pattern),
                    AdminAuditLog.resource_type.ilike(search_pattern)
                )
            )

        # Order by most recent first
        query = query.order_by(desc(AdminAuditLog.created_at))

        # Paginate
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        # Build response
        audit_logs = [log.to_dict() for log in pagination.items]

        return jsonify({
            'audit_logs': audit_logs,
            'pagination': {
                'page': pagination.page,
                'per_page': pagination.per_page,
                'total': pagination.total,
                'pages': pagination.pages,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev
            }
        }), 200

    except Exception as e:
        current_app.logger.error(f"Get audit log error: {str(e)}")
        import traceback
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': 'Failed to fetch audit log'}), 500


@superadmin_bp.route('/audit-log/actions', methods=['GET'])
@jwt_required()
def get_audit_actions():
    """
    Get list of available audit action types for filtering.

    Returns:
        - actions: List of unique action types in the audit log
    """
    try:
        # Verify super admin
        admin = require_superadmin()
        if not admin:
            return jsonify({'error': 'Unauthorized - super admin access required'}), 403

        # Get distinct action types
        actions = db.session.query(AdminAuditLog.action).distinct().all()
        action_list = [a[0] for a in actions if a[0]]

        return jsonify({'actions': sorted(action_list)}), 200

    except Exception as e:
        current_app.logger.error(f"Get audit actions error: {str(e)}")
        return jsonify({'error': 'Failed to fetch action types'}), 500


@superadmin_bp.route('/audit-log/export', methods=['GET'])
@jwt_required()
def export_audit_log():
    """
    Export audit log to CSV format (super admin only).

    Query parameters:
        - start_date: Filter by start date ISO format (optional)
        - end_date: Filter by end date ISO format (optional)
        - action: Filter by action type (optional)

    Returns:
        - CSV file download
    """
    try:
        # Verify super admin
        admin = require_superadmin()
        if not admin:
            return jsonify({'error': 'Unauthorized - super admin access required'}), 403

        from flask import Response
        import csv
        from io import StringIO
        from datetime import datetime

        # Parse filters
        action_filter = request.args.get('action', '').strip()
        start_date = request.args.get('start_date', '').strip()
        end_date = request.args.get('end_date', '').strip()

        # Build query
        query = AdminAuditLog.query

        if action_filter:
            query = query.filter(AdminAuditLog.action == action_filter)

        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query = query.filter(AdminAuditLog.created_at >= start_dt)
            except ValueError:
                pass

        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query = query.filter(AdminAuditLog.created_at <= end_dt)
            except ValueError:
                pass

        # Order by most recent first
        query = query.order_by(desc(AdminAuditLog.created_at))

        # Limit to last 10,000 entries for performance
        logs = query.limit(10000).all()

        # Create CSV
        output = StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([
            'ID', 'Timestamp', 'Admin Email', 'Action',
            'Resource Type', 'Resource ID', 'IP Address', 'Details'
        ])

        # Data rows
        for log in logs:
            details_str = ''
            if log.details:
                import json
                try:
                    details_str = json.dumps(log.details)
                except:
                    details_str = str(log.details)

            writer.writerow([
                log.id,
                log.created_at.isoformat() if log.created_at else '',
                log.admin_email,
                log.action,
                log.resource_type or '',
                log.resource_id or '',
                log.ip_address or '',
                details_str
            ])

        # Build response
        output.seek(0)
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        filename = f'audit_log_{timestamp}.csv'

        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={
                'Content-Disposition': f'attachment; filename={filename}',
                'Content-Type': 'text/csv; charset=utf-8'
            }
        )

    except Exception as e:
        current_app.logger.error(f"Export audit log error: {str(e)}")
        import traceback
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': 'Failed to export audit log'}), 500
