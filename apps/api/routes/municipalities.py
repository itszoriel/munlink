"""Municipality and Barangay routes for Zambales.

SCOPE: Zambales province only, excluding Olongapo City.
Other municipalities in Region 3 are retained in the database
for compatibility but are NOT exposed to users.
"""
from flask import Blueprint, jsonify, request
from models.municipality import Municipality, Barangay
from models.province import Province
from __init__ import db
from utils.zambales_scope import (
    ZAMBALES_PROVINCE_ID,
    ZAMBALES_MUNICIPALITY_IDS,
    OLONGAPO_MUNICIPALITY_ID,
    is_valid_zambales_municipality,
)

municipalities_bp = Blueprint('municipalities', __name__, url_prefix='/api/municipalities')


@municipalities_bp.route('', methods=['GET'])
def list_municipalities():
    """Get list of municipalities in Zambales province (excluding Olongapo).
    
    Note: This platform is scoped to Zambales only.
    Province filter parameters are accepted but only Zambales is returned.
    """
    try:
        # ZAMBALES SCOPE: Only return Zambales municipalities (excluding Olongapo)
        query = Municipality.query.filter(
            Municipality.province_id == ZAMBALES_PROVINCE_ID,
            Municipality.id.in_(ZAMBALES_MUNICIPALITY_IDS),
            Municipality.is_active == True
        )
        
        municipalities = query.all()
        
        include_province = request.args.get('include_province', 'false').lower() == 'true'
        include_barangays = request.args.get('include_barangays', 'false').lower() == 'true'
        
        return jsonify({
            'count': len(municipalities),
            'municipalities': [m.to_dict(include_barangays=include_barangays, include_province=include_province) for m in municipalities]
        }), 200
    
    except Exception as e:
        return jsonify({'error': 'Failed to get municipalities', 'details': str(e)}), 500


@municipalities_bp.route('/<int:municipality_id>', methods=['GET'])
def get_municipality(municipality_id):
    """Get details of a specific municipality.
    
    Note: Only Zambales municipalities (excluding Olongapo) are accessible.
    """
    try:
        # ZAMBALES SCOPE: Only allow access to Zambales municipalities (excluding Olongapo)
        if not is_valid_zambales_municipality(municipality_id):
            return jsonify({'error': 'Municipality not available'}), 404
        
        municipality = Municipality.query.get(municipality_id)
        
        if not municipality:
            return jsonify({'error': 'Municipality not found'}), 404
        
        include_barangays = request.args.get('include_barangays', 'false').lower() == 'true'
        include_province = request.args.get('include_province', 'false').lower() == 'true'
        
        return jsonify(municipality.to_dict(include_barangays=include_barangays, include_province=include_province)), 200
    
    except Exception as e:
        return jsonify({'error': 'Failed to get municipality', 'details': str(e)}), 500


@municipalities_bp.route('/slug/<slug>', methods=['GET'])
def get_municipality_by_slug(slug):
    """Get municipality by slug.
    
    Note: Only Zambales municipalities (excluding Olongapo) are accessible.
    """
    try:
        # ZAMBALES SCOPE: Block Olongapo access
        if slug.lower() == 'city-of-olongapo':
            return jsonify({'error': 'Municipality not available'}), 404
        
        municipality = Municipality.query.filter_by(slug=slug).first()
        
        if not municipality:
            return jsonify({'error': 'Municipality not found'}), 404
        
        # Verify municipality is in Zambales (excluding Olongapo)
        if not is_valid_zambales_municipality(municipality.id):
            return jsonify({'error': 'Municipality not available'}), 404
        
        include_barangays = request.args.get('include_barangays', 'false').lower() == 'true'
        include_province = request.args.get('include_province', 'false').lower() == 'true'
        
        return jsonify(municipality.to_dict(include_barangays=include_barangays, include_province=include_province)), 200
    
    except Exception as e:
        return jsonify({'error': 'Failed to get municipality', 'details': str(e)}), 500


@municipalities_bp.route('/<int:municipality_id>/barangays', methods=['GET'])
def list_barangays(municipality_id):
    """Get list of barangays in a municipality.
    
    Note: Only Zambales municipalities (excluding Olongapo) are accessible.
    """
    try:
        # ZAMBALES SCOPE: Only allow access to Zambales municipalities (excluding Olongapo)
        if not is_valid_zambales_municipality(municipality_id):
            return jsonify({'error': 'Municipality not available'}), 404
        
        municipality = Municipality.query.get(municipality_id)
        
        if not municipality:
            return jsonify({'error': 'Municipality not found'}), 404
        
        barangays = Barangay.query.filter_by(
            municipality_id=municipality_id,
            is_active=True
        ).all()
        
        return jsonify({
            'municipality': municipality.name,
            'count': len(barangays),
            'barangays': [b.to_dict() for b in barangays]
        }), 200
    
    except Exception as e:
        return jsonify({'error': 'Failed to get barangays', 'details': str(e)}), 500


@municipalities_bp.route('/barangays/<int:barangay_id>', methods=['GET'])
def get_barangay(barangay_id):
    """Get details of a specific barangay.
    
    Note: Only barangays in Zambales municipalities (excluding Olongapo) are accessible.
    """
    try:
        barangay = Barangay.query.get(barangay_id)
        
        if not barangay:
            return jsonify({'error': 'Barangay not found'}), 404
        
        # ZAMBALES SCOPE: Verify parent municipality is valid
        if not is_valid_zambales_municipality(barangay.municipality_id):
            return jsonify({'error': 'Barangay not available'}), 404
        
        data = barangay.to_dict()
        data['municipality'] = barangay.municipality.to_dict()
        
        return jsonify(data), 200
    
    except Exception as e:
        return jsonify({'error': 'Failed to get barangay', 'details': str(e)}), 500
