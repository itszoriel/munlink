"""Province routes for Zambales.

SCOPE: Zambales province only. Other provinces in Region 3 are retained
in the database for compatibility but are NOT exposed to users.
"""
from flask import Blueprint, jsonify, request
from models.province import Province
from models.municipality import Municipality
from __init__ import db
from utils.db_retry import with_db_retry
from utils.zambales_scope import (
    ZAMBALES_PROVINCE_ID,
    ZAMBALES_PROVINCE_SLUG,
    ZAMBALES_MUNICIPALITY_IDS,
)

provinces_bp = Blueprint('provinces', __name__, url_prefix='/api/provinces')


@provinces_bp.route('', methods=['GET'])
@with_db_retry(max_retries=3, initial_delay=0.5)
def list_provinces():
    """Get list of provinces - returns only Zambales.
    
    Note: This platform is scoped to Zambales province only.
    Region 3 data is retained internally for compatibility.
    """
    try:
        # ZAMBALES SCOPE: Only return Zambales province
        province = Province.query.filter_by(id=ZAMBALES_PROVINCE_ID, is_active=True).first()
        
        if not province:
            return jsonify({
                'count': 0,
                'provinces': [],
                'message': 'Zambales province not found'
            }), 200
        
        include_municipalities = request.args.get('include_municipalities', 'false').lower() == 'true'
        
        province_data = province.to_dict(include_municipalities=False)
        
        # If including municipalities, filter to exclude Olongapo
        if include_municipalities:
            municipalities = Municipality.query.filter(
                Municipality.province_id == ZAMBALES_PROVINCE_ID,
                Municipality.id.in_(ZAMBALES_MUNICIPALITY_IDS),
                Municipality.is_active == True
            ).all()
            province_data['municipalities'] = [m.to_dict() for m in municipalities]
        
        return jsonify({
            'count': 1,
            'provinces': [province_data]
        }), 200
    
    except Exception as e:
        return jsonify({'error': 'Failed to get provinces', 'details': str(e)}), 500


@provinces_bp.route('/<int:province_id>', methods=['GET'])
def get_province(province_id):
    """Get details of a specific province.
    
    Note: Only Zambales province (ID=6) is accessible.
    """
    try:
        # ZAMBALES SCOPE: Only allow access to Zambales
        if province_id != ZAMBALES_PROVINCE_ID:
            return jsonify({'error': 'Province not available'}), 404
        
        province = Province.query.get(province_id)
        
        if not province:
            return jsonify({'error': 'Province not found'}), 404
        
        include_municipalities = request.args.get('include_municipalities', 'false').lower() == 'true'
        
        province_data = province.to_dict(include_municipalities=False)
        
        # If including municipalities, filter to exclude Olongapo
        if include_municipalities:
            municipalities = Municipality.query.filter(
                Municipality.province_id == ZAMBALES_PROVINCE_ID,
                Municipality.id.in_(ZAMBALES_MUNICIPALITY_IDS),
                Municipality.is_active == True
            ).all()
            province_data['municipalities'] = [m.to_dict() for m in municipalities]
        
        return jsonify(province_data), 200
    
    except Exception as e:
        return jsonify({'error': 'Failed to get province', 'details': str(e)}), 500


@provinces_bp.route('/slug/<slug>', methods=['GET'])
def get_province_by_slug(slug):
    """Get province by slug.
    
    Note: Only 'zambales' slug is accessible.
    """
    try:
        # ZAMBALES SCOPE: Only allow access to Zambales
        if slug.lower() != ZAMBALES_PROVINCE_SLUG:
            return jsonify({'error': 'Province not available'}), 404
        
        province = Province.query.filter_by(slug=slug).first()
        
        if not province:
            return jsonify({'error': 'Province not found'}), 404
        
        include_municipalities = request.args.get('include_municipalities', 'false').lower() == 'true'
        
        province_data = province.to_dict(include_municipalities=False)
        
        # If including municipalities, filter to exclude Olongapo
        if include_municipalities:
            municipalities = Municipality.query.filter(
                Municipality.province_id == ZAMBALES_PROVINCE_ID,
                Municipality.id.in_(ZAMBALES_MUNICIPALITY_IDS),
                Municipality.is_active == True
            ).all()
            province_data['municipalities'] = [m.to_dict() for m in municipalities]
        
        return jsonify(province_data), 200
    
    except Exception as e:
        return jsonify({'error': 'Failed to get province', 'details': str(e)}), 500


@provinces_bp.route('/<int:province_id>/municipalities', methods=['GET'])
def list_province_municipalities(province_id):
    """Get list of municipalities in Zambales province.
    
    Note: Only Zambales municipalities are returned (excluding Olongapo).
    """
    try:
        # ZAMBALES SCOPE: Only allow access to Zambales
        if province_id != ZAMBALES_PROVINCE_ID:
            return jsonify({'error': 'Province not available'}), 404
        
        province = Province.query.get(province_id)
        
        if not province:
            return jsonify({'error': 'Province not found'}), 404
        
        # Filter to Zambales municipalities only (excluding Olongapo)
        municipalities = Municipality.query.filter(
            Municipality.province_id == ZAMBALES_PROVINCE_ID,
            Municipality.id.in_(ZAMBALES_MUNICIPALITY_IDS),
            Municipality.is_active == True
        ).all()
        
        include_barangays = request.args.get('include_barangays', 'false').lower() == 'true'
        
        return jsonify({
            'province': province.name,
            'count': len(municipalities),
            'municipalities': [m.to_dict(include_barangays=include_barangays, include_province=False) for m in municipalities]
        }), 200
    
    except Exception as e:
        return jsonify({'error': 'Failed to get municipalities', 'details': str(e)}), 500






