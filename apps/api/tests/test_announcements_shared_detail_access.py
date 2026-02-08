from datetime import datetime, timezone

from apps.api.app import create_app
from apps.api.config import Config
from apps.api import db
from apps.api.models.province import Province
from apps.api.models.municipality import Municipality, Barangay
from apps.api.models.user import User
from apps.api.models.announcement import Announcement
from flask_jwt_extended import create_access_token


class SharedAnnouncementConfig(Config):
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SQLALCHEMY_ENGINE_OPTIONS = {}
    TESTING = True
    JWT_SECRET_KEY = 'test-secret'
    RATELIMIT_ENABLED = False


def test_shared_barangay_announcement_detail_matches_feed_for_shared_muni_resident():
    """
    Regression for: shared announcement appears in feed but detail returns not found.

    Scenario:
    - BARANGAY announcement created in Municipality A and shared to Municipality B
    - Verified resident of Municipality B (with no barangay_id set) should:
      - see it in /api/announcements
      - open it via /api/announcements/<id>
    """
    app = create_app(SharedAnnouncementConfig)
    client = app.test_client()

    with app.app_context():
        db.create_all()
        province = Province(id=6, name='Zambales', slug='zambales', psgc_code='037100000')
        muni_a = Municipality(id=109, name='Cabangan', slug='cabangan', province_id=province.id, psgc_code='037109000')
        muni_b = Municipality(id=112, name='Iba', slug='iba', province_id=province.id, psgc_code='037112000')
        brgy_a = Barangay(id=5002, name='Barangay A', slug='barangay-a', municipality_id=muni_a.id, psgc_code='037109001')

        resident_b = User(
            username='resident_b',
            email='resident_b@example.com',
            password_hash='test',
            first_name='Res',
            last_name='B',
            role='resident',
            email_verified=True,
            admin_verified=True,
            municipality_id=muni_b.id,
            barangay_id=None,  # critical for reproducing the mismatch
        )
        creator = User(
            username='creator',
            email='creator@example.com',
            password_hash='test',
            first_name='Creator',
            last_name='User',
            role='resident',
            email_verified=True,
            admin_verified=True,
            municipality_id=muni_a.id,
            barangay_id=brgy_a.id,
        )
        db.session.add_all([province, muni_a, muni_b, brgy_a, resident_b, creator])
        db.session.flush()

        now = datetime.now(timezone.utc)
        ann = Announcement(
            title='Shared Barangay Notice',
            content='Shared to another municipality',
            scope='BARANGAY',
            municipality_id=muni_a.id,
            barangay_id=brgy_a.id,
            created_by=creator.id,
            priority='medium',
            status='PUBLISHED',
            publish_at=now,
            shared_with_municipalities=[muni_b.id],
            is_active=True,
        )
        db.session.add(ann)
        db.session.commit()
        ann_id = ann.id

        token = create_access_token(identity=str(resident_b.id), additional_claims={'role': 'resident'})

    # Feed includes shared announcements for the resident's municipality
    resp = client.get('/api/announcements', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    data = resp.get_json() or {}
    ids = [a.get('id') for a in data.get('announcements', [])]
    assert ann_id in ids

    # Detail must be accessible (matches feed rules)
    resp = client.get(f'/api/announcements/{ann_id}', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 200
    detail = resp.get_json() or {}
    assert detail.get('id') == ann_id


def test_unshared_resident_cannot_open_shared_barangay_announcement_detail():
    app = create_app(SharedAnnouncementConfig)
    client = app.test_client()

    with app.app_context():
        db.create_all()
        province = Province(id=6, name='Zambales', slug='zambales', psgc_code='037100000')
        muni_a = Municipality(id=109, name='Cabangan', slug='cabangan', province_id=province.id, psgc_code='037109000')
        muni_b = Municipality(id=112, name='Iba', slug='iba', province_id=province.id, psgc_code='037112000')
        muni_c = Municipality(id=110, name='Candelaria', slug='candelaria', province_id=province.id, psgc_code='037110000')
        brgy_a = Barangay(id=5002, name='Barangay A', slug='barangay-a', municipality_id=muni_a.id, psgc_code='037109001')

        resident_c = User(
            username='resident_c',
            email='resident_c@example.com',
            password_hash='test',
            first_name='Res',
            last_name='C',
            role='resident',
            email_verified=True,
            admin_verified=True,
            municipality_id=muni_c.id,
            barangay_id=None,
        )
        creator = User(
            username='creator2',
            email='creator2@example.com',
            password_hash='test',
            first_name='Creator',
            last_name='Two',
            role='resident',
            email_verified=True,
            admin_verified=True,
            municipality_id=muni_a.id,
            barangay_id=brgy_a.id,
        )
        db.session.add_all([province, muni_a, muni_b, muni_c, brgy_a, resident_c, creator])
        db.session.flush()

        now = datetime.now(timezone.utc)
        ann = Announcement(
            title='Shared Barangay Notice',
            content='Shared to Iba only',
            scope='BARANGAY',
            municipality_id=muni_a.id,
            barangay_id=brgy_a.id,
            created_by=creator.id,
            priority='medium',
            status='PUBLISHED',
            publish_at=now,
            shared_with_municipalities=[muni_b.id],  # not shared to muni_c
            is_active=True,
        )
        db.session.add(ann)
        db.session.commit()
        ann_id = ann.id

        token = create_access_token(identity=str(resident_c.id), additional_claims={'role': 'resident'})

    resp = client.get(f'/api/announcements/{ann_id}', headers={'Authorization': f'Bearer {token}'})
    assert resp.status_code == 404
