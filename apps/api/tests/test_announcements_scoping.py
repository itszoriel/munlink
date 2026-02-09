from datetime import datetime, timedelta, timezone

from apps.api.app import create_app
from apps.api.config import Config
from apps.api import db
from apps.api.models.province import Province
from apps.api.models.municipality import Municipality, Barangay
from apps.api.models.user import User
from apps.api.models.announcement import Announcement
from flask_jwt_extended import create_access_token


class ScopedTestConfig(Config):
  SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
  SQLALCHEMY_ENGINE_OPTIONS = {}
  TESTING = True
  JWT_SECRET_KEY = 'test-secret'
  RATELIMIT_ENABLED = False


def build_app_with_announcements():
  app = create_app(ScopedTestConfig)
  with app.app_context():
    db.create_all()
    province = Province(id=6, name='Zambales', slug='zambales', psgc_code='037100000')
    muni = Municipality(id=112, name='Iba', slug='iba', province_id=province.id, psgc_code='037112000')
    other_muni = Municipality(id=109, name='Cabangan', slug='cabangan', province_id=province.id, psgc_code='037109000')
    brgy = Barangay(id=5001, name='Barangay 1', slug='barangay-1', municipality_id=muni.id, psgc_code='037112001')
    other_brgy = Barangay(id=5002, name='Barangay 2', slug='barangay-2', municipality_id=other_muni.id, psgc_code='037109001')
    user = User(
      username='resident',
      email='res@example.com',
      password_hash='test',
      first_name='Test',
      last_name='User',
      role='resident',
      email_verified=True,
      admin_verified=True,
      municipality_id=muni.id,
      barangay_id=brgy.id,
    )
    db.session.add_all([province, muni, other_muni, brgy, other_brgy, user])
    db.session.flush()

    now = datetime.now(timezone.utc)
    ann_province = Announcement(
      title='Province Update',
      content='Zambales-wide notice',
      scope='PROVINCE',
      municipality_id=None,
      created_by=user.id,
      priority='medium',
      status='PUBLISHED',
      publish_at=now,
      pinned=True,
      pinned_until=now + timedelta(days=2),
      is_active=True,
    )
    ann_muni = Announcement(
      title='Municipality Update',
      content='Iba notice',
      scope='MUNICIPALITY',
      municipality_id=muni.id,
      created_by=user.id,
      priority='low',
      status='PUBLISHED',
      publish_at=now,
      is_active=True,
    )
    ann_other_muni = Announcement(
      title='Other Municipality',
      content='Cabangan notice',
      scope='MUNICIPALITY',
      municipality_id=other_muni.id,
      created_by=user.id,
      priority='low',
      status='PUBLISHED',
      publish_at=now,
      is_active=True,
    )
    ann_brgy = Announcement(
      title='Barangay Update',
      content='Barangay specific',
      scope='BARANGAY',
      municipality_id=muni.id,
      barangay_id=brgy.id,
      created_by=user.id,
      priority='high',
      status='PUBLISHED',
      publish_at=now,
      is_active=True,
    )
    ann_other_brgy = Announcement(
      title='Other Barangay',
      content='Not yours',
      scope='BARANGAY',
      municipality_id=other_muni.id,
      barangay_id=other_brgy.id,
      created_by=user.id,
      priority='medium',
      status='PUBLISHED',
      publish_at=now,
      is_active=True,
    )
    db.session.add_all([ann_province, ann_muni, ann_other_muni, ann_brgy, ann_other_brgy])
    db.session.commit()
    return app, user.id, {
      'province': ann_province.id,
      'municipality': ann_muni.id,
      'barangay': ann_brgy.id,
      'other_municipality': ann_other_muni.id,
      'other_barangay': ann_other_brgy.id,
      'municipality_id': muni.id,
      'other_municipality_id': other_muni.id,
      'barangay_id': brgy.id,
      'other_barangay_id': other_brgy.id,
    }


def test_verified_resident_scoping():
  app, user_id, ids = build_app_with_announcements()
  client = app.test_client()
  with app.app_context():
    token = create_access_token(identity=str(user_id), additional_claims={'role': 'resident'})
  resp = client.get('/api/announcements', headers={'Authorization': f'Bearer {token}'})
  assert resp.status_code == 200
  data = resp.get_json()
  returned_ids = [a['id'] for a in data.get('announcements', [])]
  assert ids['province'] in returned_ids
  assert ids['municipality'] in returned_ids
  assert ids['barangay'] in returned_ids
  assert ids['other_municipality'] not in returned_ids
  assert ids['other_barangay'] not in returned_ids
  # pinned announcement should sort first
  assert data.get('announcements', [])[0].get('pinned') is True


def test_verified_resident_can_browse_other_municipality_scope():
  app, user_id, ids = build_app_with_announcements()
  client = app.test_client()
  with app.app_context():
    token = create_access_token(identity=str(user_id), additional_claims={'role': 'resident'})
  resp = client.get('/api/announcements', headers={'Authorization': f'Bearer {token}'}, query_string={
    'browse': 'true',
    'municipality_id': ids['other_municipality_id'],
  })
  assert resp.status_code == 200
  data = resp.get_json()
  returned_ids = {a['id'] for a in data.get('announcements', [])}
  # Province + selected municipality should be visible
  assert ids['province'] in returned_ids
  assert ids['other_municipality'] in returned_ids
  # Home municipality/barangay scoped posts are not mixed in
  assert ids['municipality'] not in returned_ids
  assert ids['barangay'] not in returned_ids
  assert ids['other_barangay'] not in returned_ids


def test_verified_resident_can_open_other_scope_details_when_browsing():
  app, user_id, ids = build_app_with_announcements()
  client = app.test_client()
  with app.app_context():
    token = create_access_token(identity=str(user_id), additional_claims={'role': 'resident'})

  muni_detail = client.get(
    f"/api/announcements/{ids['other_municipality']}",
    headers={'Authorization': f'Bearer {token}'},
    query_string={
      'browse': 'true',
      'municipality_id': ids['other_municipality_id'],
    },
  )
  assert muni_detail.status_code == 200

  barangay_detail = client.get(
    f"/api/announcements/{ids['other_barangay']}",
    headers={'Authorization': f'Bearer {token}'},
    query_string={
      'browse': 'true',
      'municipality_id': ids['other_municipality_id'],
      'barangay_id': ids['other_barangay_id'],
    },
  )
  assert barangay_detail.status_code == 200


def test_guest_only_sees_province_announcements():
  app, _user_id, ids = build_app_with_announcements()
  client = app.test_client()
  resp = client.get('/api/announcements')
  assert resp.status_code == 200
  data = resp.get_json()
  returned_ids = [a['id'] for a in data.get('announcements', [])]
  assert returned_ids == [ids['province']]


def test_guest_can_browse_municipality_scope():
  app, _user_id, ids = build_app_with_announcements()
  client = app.test_client()
  resp = client.get('/api/announcements', query_string={
    'browse': 'true',
    'municipality_id': ids['municipality_id'],
  })
  assert resp.status_code == 200
  data = resp.get_json()
  returned_ids = {a['id'] for a in data.get('announcements', [])}
  # Province + municipality visible
  assert ids['province'] in returned_ids
  assert ids['municipality'] in returned_ids
  # Barangay requires exact barangay filter
  assert ids['barangay'] not in returned_ids
  # Other municipality/barangay are not shown
  assert ids['other_municipality'] not in returned_ids
  assert ids['other_barangay'] not in returned_ids


def test_guest_can_open_barangay_detail_with_exact_filter():
  app, _user_id, ids = build_app_with_announcements()
  client = app.test_client()
  resp = client.get(f"/api/announcements/{ids['barangay']}", query_string={
    'browse': 'true',
    'municipality_id': ids['municipality_id'],
    'barangay_id': ids['barangay_id'],
  })
  assert resp.status_code == 200


def test_guest_browse_other_municipality_returns_that_scope():
  app, _user_id, ids = build_app_with_announcements()
  client = app.test_client()
  resp = client.get('/api/announcements', query_string={
    'browse': 'true',
    'municipality_id': ids['other_municipality_id'],
  })
  assert resp.status_code == 200
  data = resp.get_json()
  returned_ids = {a['id'] for a in data.get('announcements', [])}
  assert returned_ids == {ids['province'], ids['other_municipality']}
