"""
Integration tests for resident ID/selfie privacy hardening features.

Tests cover:
- Permission-based access control for viewing ID documents
- Audit logging of all ID/selfie views
- Path traversal protection in file serving
- Open redirect protection for Supabase URLs
- Municipality scope enforcement
"""
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from apps.api.app import create_app
from apps.api.config import Config
from apps.api import db
from apps.api.models.province import Province
from apps.api.models.municipality import Municipality
from apps.api.models.user import User
from apps.api.models.admin_audit_log import AdminAuditLog, AuditAction
from flask_jwt_extended import create_access_token


class PrivacyTestConfig(Config):
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_ENGINE_OPTIONS = {}
    TESTING = True
    JWT_SECRET_KEY = 'test-secret'
    RATELIMIT_ENABLED = False


def test_id_view_permission_required():
    """Test that residents:id_view permission is required to view ID documents."""
    app = create_app(PrivacyTestConfig)
    client = app.test_client()

    with app.app_context():
        db.create_all()

        # Create test data
        province = Province(id=6, name='Zambales', slug='zambales', psgc_code='037100000')
        muni = Municipality(id=112, name='Iba', slug='iba', province_id=province.id, psgc_code='037112000')

        # Resident with ID documents
        resident = User(
            username='resident',
            email='resident@example.com',
            password_hash='test',
            first_name='John',
            last_name='Doe',
            role='resident',
            email_verified=True,
            admin_verified=True,
            municipality_id=muni.id,
            valid_id_front='verification/user_1/id_front.jpg',
            valid_id_back='verification/user_1/id_back.jpg',
            selfie_with_id='verification/user_1/selfie.jpg',
        )

        # Admin WITHOUT residents:id_view permission
        admin_no_perm = User(
            username='admin_no_view',
            email='admin_no_view@example.com',
            password_hash='test',
            first_name='Admin',
            last_name='NoView',
            role='municipal_admin',
            email_verified=True,
            admin_verified=True,
            admin_municipality_id=muni.id,
            permissions=['residents:approve'],  # Has approve but NOT id_view
        )

        # Admin WITH residents:id_view permission
        admin_with_perm = User(
            username='admin_with_view',
            email='admin_with_view@example.com',
            password_hash='test',
            first_name='Admin',
            last_name='WithView',
            role='municipal_admin',
            email_verified=True,
            admin_verified=True,
            admin_municipality_id=muni.id,
            permissions=['residents:approve', 'residents:id_view'],
        )

        db.session.add_all([province, muni, resident, admin_no_perm, admin_with_perm])
        db.session.commit()

        resident_id = resident.id
        admin_no_perm_id = admin_no_perm.id
        admin_with_perm_id = admin_with_perm.id

        # Create tokens within app context
        token_no_perm = create_access_token(identity=str(admin_no_perm_id), additional_claims={'role': 'municipal_admin'})
        token_with_perm = create_access_token(identity=str(admin_with_perm_id), additional_claims={'role': 'municipal_admin'})

        # Test 1: Admin WITHOUT permission should be denied
        response = client.get(
            f'/api/admin/residents/{resident_id}/documents/id_front',
            query_string={'reason': 'Initial verification review'},
            headers={'Authorization': f'Bearer {token_no_perm}'}
        )
        assert response.status_code == 403
        assert b'residents:id_view required' in response.data

        # Test 2: Admin WITH permission but no reason should be denied
        response = client.get(
            f'/api/admin/residents/{resident_id}/documents/id_front',
            headers={'Authorization': f'Bearer {token_with_perm}'}
        )
        assert response.status_code == 400
        assert b'Reason parameter required' in response.data


def test_audit_logging_on_id_view():
    """Test that viewing ID documents creates audit log entries."""
    app = create_app(PrivacyTestConfig)
    client = app.test_client()

    with app.app_context():
        db.create_all()

        province = Province(id=6, name='Zambales', slug='zambales', psgc_code='037100000')
        muni = Municipality(id=112, name='Iba', slug='iba', province_id=province.id, psgc_code='037112000')

        resident = User(
            username='resident',
            email='resident@example.com',
            password_hash='test',
            first_name='John',
            last_name='Doe',
            role='resident',
            email_verified=True,
            admin_verified=True,
            municipality_id=muni.id,
            valid_id_front='http://example.com/fake_id.jpg',  # Use HTTP URL to test redirect path
        )

        admin = User(
            username='admin',
            email='admin@example.com',
            password_hash='test',
            first_name='Admin',
            last_name='User',
            role='superadmin',
            email_verified=True,
            admin_verified=True,
            permissions=['*'],
        )

        db.session.add_all([province, muni, resident, admin])
        db.session.commit()

        resident_id = resident.id
        admin_id = admin.id

        # Verify no audit logs exist initially
        assert AdminAuditLog.query.count() == 0

        token = create_access_token(identity=str(admin_id), additional_claims={'role': 'superadmin'})

        # Attempt to view ID (will fail because URL domain not in ALLOWED_FILE_DOMAINS, but should still log)
        response = client.get(
            f'/api/admin/residents/{resident_id}/documents/id_front',
            query_string={'reason': 'Initial verification review'},
            headers={'Authorization': f'Bearer {token}'}
        )

        # Check audit log was created
        audit_logs = AdminAuditLog.query.all()
        assert len(audit_logs) == 1

        log = audit_logs[0]
        assert log.action == AuditAction.RESIDENT_ID_VIEWED
        assert log.admin_id == admin_id
        assert log.admin_email == 'admin@example.com'
        assert log.resource_type == 'resident'
        assert log.resource_id == resident_id
        assert log.details['document_type'] == 'id_front'
        assert log.details['reason'] == 'Initial verification review'
        assert log.details['municipality_id'] == muni.id


def test_path_traversal_protection():
    """Test that path traversal attempts are blocked when serving local files."""
    app = create_app(PrivacyTestConfig)
    client = app.test_client()

    with app.app_context():
        db.create_all()

        province = Province(id=6, name='Zambales', slug='zambales', psgc_code='037100000')
        muni = Municipality(id=112, name='Iba', slug='iba', province_id=province.id, psgc_code='037112000')

        # Resident with malicious file path (path traversal attempt)
        resident = User(
            username='resident',
            email='resident@example.com',
            password_hash='test',
            first_name='John',
            last_name='Doe',
            role='resident',
            email_verified=True,
            admin_verified=True,
            municipality_id=muni.id,
            valid_id_front='../../etc/passwd',  # Path traversal attempt
        )

        admin = User(
            username='admin',
            email='admin@example.com',
            password_hash='test',
            first_name='Admin',
            last_name='User',
            role='superadmin',
            email_verified=True,
            admin_verified=True,
            permissions=['*'],
        )

        db.session.add_all([province, muni, resident, admin])
        db.session.commit()

        resident_id = resident.id
        admin_id = admin.id

        token = create_access_token(identity=str(admin_id), additional_claims={'role': 'superadmin'})

        # Attempt to access file (should be blocked by path traversal protection)
        response = client.get(
            f'/api/admin/residents/{resident_id}/documents/id_front',
            query_string={'reason': 'Test path traversal'},
            headers={'Authorization': f'Bearer {token}'}
        )

        assert response.status_code == 403
        assert b'Invalid file path' in response.data


def test_municipality_scope_enforcement():
    """Test that admins can only view documents from residents in their municipality."""
    app = create_app(PrivacyTestConfig)
    client = app.test_client()

    with app.app_context():
        db.create_all()

        province = Province(id=6, name='Zambales', slug='zambales', psgc_code='037100000')
        muni_1 = Municipality(id=112, name='Iba', slug='iba', province_id=province.id, psgc_code='037112000')
        muni_2 = Municipality(id=109, name='Cabangan', slug='cabangan', province_id=province.id, psgc_code='037109000')

        # Resident in Municipality 1
        resident_muni_1 = User(
            username='resident1',
            email='resident1@example.com',
            password_hash='test',
            first_name='John',
            last_name='Doe',
            role='resident',
            email_verified=True,
            admin_verified=True,
            municipality_id=muni_1.id,
            valid_id_front='verification/user_1/id_front.jpg',
        )

        # Admin in Municipality 2 (should NOT access resident in Municipality 1)
        admin_muni_2 = User(
            username='admin2',
            email='admin2@example.com',
            password_hash='test',
            first_name='Admin',
            last_name='Two',
            role='municipal_admin',
            email_verified=True,
            admin_verified=True,
            admin_municipality_id=muni_2.id,  # Different municipality!
            permissions=['residents:approve', 'residents:id_view'],
        )

        db.session.add_all([province, muni_1, muni_2, resident_muni_1, admin_muni_2])
        db.session.commit()

        resident_id = resident_muni_1.id
        admin_id = admin_muni_2.id

        token = create_access_token(identity=str(admin_id), additional_claims={'role': 'municipal_admin'})

        # Admin from Municipality 2 tries to access resident from Municipality 1
        response = client.get(
            f'/api/admin/residents/{resident_id}/documents/id_front',
            query_string={'reason': 'Cross-municipality test'},
            headers={'Authorization': f'Bearer {token}'}
        )

        assert response.status_code == 403
        assert b'not in your municipality' in response.data


def test_superadmin_cross_municipality_access():
    """Test that superadmins CAN access documents across municipalities."""
    app = create_app(PrivacyTestConfig)
    client = app.test_client()

    with app.app_context():
        db.create_all()

        province = Province(id=6, name='Zambales', slug='zambales', psgc_code='037100000')
        muni = Municipality(id=112, name='Iba', slug='iba', province_id=province.id, psgc_code='037112000')

        resident = User(
            username='resident',
            email='resident@example.com',
            password_hash='test',
            first_name='John',
            last_name='Doe',
            role='resident',
            email_verified=True,
            admin_verified=True,
            municipality_id=muni.id,
            valid_id_front='http://trusted.example.com/id.jpg',
        )

        superadmin = User(
            username='superadmin',
            email='super@example.com',
            password_hash='test',
            first_name='Super',
            last_name='Admin',
            role='superadmin',
            email_verified=True,
            admin_verified=True,
            admin_municipality_id=None,  # No specific municipality
            permissions=['*'],
        )

        db.session.add_all([province, muni, resident, superadmin])
        db.session.commit()

        resident_id = resident.id
        superadmin_id = superadmin.id

        token = create_access_token(identity=str(superadmin_id), additional_claims={'role': 'superadmin'})

        # Superadmin should be able to access resident documents from any municipality
        response = client.get(
            f'/api/admin/residents/{resident_id}/documents/id_front',
            query_string={'reason': 'Superadmin audit review'},
            headers={'Authorization': f'Bearer {token}'}
        )

        # Should NOT be blocked by municipality scope (but may be blocked by domain validation)
        # The key is that we don't get a "not in your municipality" error
        assert response.status_code != 403 or b'not in your municipality' not in response.data


def test_document_type_validation():
    """Test that only valid document types are accepted."""
    app = create_app(PrivacyTestConfig)
    client = app.test_client()

    with app.app_context():
        db.create_all()

        province = Province(id=6, name='Zambales', slug='zambales', psgc_code='037100000')
        muni = Municipality(id=112, name='Iba', slug='iba', province_id=province.id, psgc_code='037112000')

        resident = User(
            username='resident',
            email='resident@example.com',
            password_hash='test',
            first_name='John',
            last_name='Doe',
            role='resident',
            email_verified=True,
            admin_verified=True,
            municipality_id=muni.id,
        )

        admin = User(
            username='admin',
            email='admin@example.com',
            password_hash='test',
            first_name='Admin',
            last_name='User',
            role='superadmin',
            email_verified=True,
            admin_verified=True,
            permissions=['*'],
        )

        db.session.add_all([province, muni, resident, admin])
        db.session.commit()

        resident_id = resident.id
        admin_id = admin.id

        token = create_access_token(identity=str(admin_id), additional_claims={'role': 'superadmin'})

        # Valid document types: id_front, id_back, selfie
        valid_types = ['id_front', 'id_back', 'selfie']
        for doc_type in valid_types:
            response = client.get(
                f'/api/admin/residents/{resident_id}/documents/{doc_type}',
                query_string={'reason': 'Type validation test'},
                headers={'Authorization': f'Bearer {token}'}
            )
            # May fail for other reasons, but NOT because of invalid type
            assert response.status_code != 400 or b'Invalid document type' not in response.data

        # Invalid document types (avoid path separators which Flask routes handle differently)
        invalid_types = ['password_hash', 'profile_picture', 'admin_notes', 'random']
        for doc_type in invalid_types:
            response = client.get(
                f'/api/admin/residents/{resident_id}/documents/{doc_type}',
                query_string={'reason': 'Type validation test'},
                headers={'Authorization': f'Bearer {token}'}
            )
            assert response.status_code == 400, f'Expected 400 for {doc_type}, got {response.status_code}: {response.data.decode()}'
            assert b'Invalid document type' in response.data
