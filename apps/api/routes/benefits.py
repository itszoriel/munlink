"""Public/resident Benefits routes (programs and applications).

SCOPE: Zambales province only, excluding Olongapo City.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta

from __init__ import db
from sqlalchemy import or_, and_
from models.benefit import BenefitProgram, BenefitApplication
from models.user import User
from models.municipality import Municipality
from utils import (
    validate_required_fields,
    ValidationError,
    fully_verified_required,
    save_benefit_document,
)
from utils.zambales_scope import (
    ZAMBALES_MUNICIPALITY_IDS,
    is_valid_zambales_municipality,
)


benefits_bp = Blueprint('benefits', __name__, url_prefix='/api/benefits')


@benefits_bp.route('/programs', methods=['GET'])
def list_programs():
    """
    Public list of active benefit programs with municipality scoping.
    
    Rules:
    - Logged-in users: Only see programs from their registered municipality
    - Guests: Can browse by province or municipality (discovery mode)
    """
    try:
        from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
        
        # Check if user is authenticated
        is_authenticated = False
        user_municipality_id = None
        user_barangay_id = None
        try:
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            if user_id:
                user = User.query.get(user_id)
                if user and user.municipality_id:
                    is_authenticated = True
                    user_municipality_id = user.municipality_id
                    user_barangay_id = user.barangay_id
        except Exception:
            pass
        
        # Get query parameters
        requested_municipality_id = request.args.get('municipality_id', type=int)
        province_id = request.args.get('province_id', type=int)
        program_type = request.args.get('type')

        query = BenefitProgram.query.filter_by(is_active=True)
        
        # ZAMBALES SCOPE: Always filter to Zambales municipalities only (excluding Olongapo)
        query = query.filter(
            (BenefitProgram.municipality_id.in_(ZAMBALES_MUNICIPALITY_IDS)) |
            (BenefitProgram.municipality_id.is_(None))  # Include province-wide programs
        )
        
        # Apply municipality/province filtering based on authentication
        if is_authenticated:
            # LOGGED-IN USER: Only show programs from their registered municipality and restricted by barangay
            # Verify user is in Zambales first
            if user_municipality_id and is_valid_zambales_municipality(user_municipality_id):
                query = query.filter(
                    or_(
                        BenefitProgram.municipality_id.is_(None),  # Province-wide
                        and_(
                            BenefitProgram.municipality_id == user_municipality_id,
                            or_(
                                BenefitProgram.barangay_id.is_(None),  # Municipality-wide
                                BenefitProgram.barangay_id == user_barangay_id  # Barangay-specific
                            )
                        )
                    )
                )
        else:
            # GUEST: Allow municipality filtering for discovery (Zambales only)
            if requested_municipality_id and is_valid_zambales_municipality(requested_municipality_id):
                # Filter by specific municipality (guest browsing)
                query = query.filter(
                    (BenefitProgram.municipality_id == requested_municipality_id) | 
                    (BenefitProgram.municipality_id.is_(None))
                )
        
        if program_type:
            query = query.filter(BenefitProgram.program_type == program_type)

        programs = query.order_by(BenefitProgram.created_at.desc()).all()

        # Auto-complete expired programs before returning
        now = datetime.utcnow()
        changed = False
        for p in programs:
            try:
                if p.is_active and p.duration_days and p.created_at:
                    if p.created_at + timedelta(days=int(p.duration_days)) <= now:
                        p.is_active = False
                        p.is_accepting_applications = False
                        p.completed_at = now
                        changed = True
            except Exception:
                pass
        if changed:
            db.session.commit()
            # Filter out programs that were just set inactive
            programs = [p for p in programs if p.is_active]
        # Compute beneficiaries as count of approved applications per program (public view)
        try:
            ids = [p.id for p in programs] or []
            if ids:
                rows = (
                    db.session.query(
                        BenefitApplication.program_id,
                        db.func.count(BenefitApplication.id)
                    )
                    .filter(
                        BenefitApplication.program_id.in_(ids),
                        BenefitApplication.status == 'approved'
                    )
                    .group_by(BenefitApplication.program_id)
                    .all()
                )
                counts = {pid: int(cnt) for pid, cnt in rows}
                for p in programs:
                    try:
                        p.current_beneficiaries = counts.get(p.id, 0)
                    except Exception:
                        pass
        except Exception:
            pass

        return jsonify({'programs': [p.to_dict() for p in programs], 'count': len(programs)}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get programs', 'details': str(e)}), 500


@benefits_bp.route('/programs/<int:program_id>', methods=['GET'])
def get_program(program_id: int):
    """
    Get a single program by ID with municipality scoping.
    
    Rules:
    - Logged-in users: Can only access programs from their municipality
    - Guests: Can view any active program (discovery mode)
    """
    try:
        from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
        
        program = BenefitProgram.query.get(program_id)
        if not program or not program.is_active:
            return jsonify({'error': 'Program not found'}), 404
        
        # Check if user is authenticated
        try:
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            if user_id:
                user = User.query.get(user_id)
                if user and user.municipality_id:
                    # LOGGED-IN USER: Check municipality match
                    # Allow if program is province-wide (None) or matches user's municipality
                    if program.municipality_id is not None and program.municipality_id != user.municipality_id:
                        return jsonify({'error': 'Program not available in your municipality'}), 403
        except Exception:
            pass
        
        return jsonify(program.to_dict()), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get program', 'details': str(e)}), 500


@benefits_bp.route('/applications', methods=['POST'])
@jwt_required()
@fully_verified_required
def create_application():
    """Create a benefit application for the current user."""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json() or {}
        required = ['program_id']
        validate_required_fields(data, required)

        program = BenefitProgram.query.get(int(data['program_id']))
        if not program or not program.is_active:
            return jsonify({'error': 'Invalid program'}), 400

        # Municipality scoping: allow province-wide (None) or user's municipality
        if program.municipality_id and user.municipality_id != program.municipality_id:
            return jsonify({'error': 'Program not available for your municipality'}), 403

        # Tag-based eligibility validation
        if program.eligibility_criteria:
            import json
            criteria = program.eligibility_criteria
            if isinstance(criteria, str):
                try:
                    criteria = json.loads(criteria)
                except:
                    criteria = {}
            
            # Only validate if criteria is a dict (tag-based format)
            if isinstance(criteria, dict) and criteria:
                # Age Tag Validation
                if 'age_min' in criteria:
                    if not user.date_of_birth:
                        return jsonify({'error': 'Date of birth is required to verify age eligibility'}), 400
                    
                    today = datetime.utcnow().date()
                    age = today.year - user.date_of_birth.year
                    if (today.month, today.day) < (user.date_of_birth.month, user.date_of_birth.day):
                        age -= 1
                    
                    min_age = int(criteria.get('age_min', 0))
                    max_age = criteria.get('age_max')
                    
                    if max_age is not None:
                        max_age = int(max_age)
                        if age < min_age or age > max_age:
                            return jsonify({'error': f'You must be between {min_age} and {max_age} years old to apply for this program. You are currently {age} years old.'}), 403
                    else:
                        if age < min_age:
                            return jsonify({'error': f'You must be at least {min_age} years old to apply for this program. You are currently {age} years old.'}), 403
                
                # Location Tag Validation
                if criteria.get('location_required') is True:
                    if not user.municipality_id:
                        return jsonify({'error': 'You must be registered in a municipality to apply for this program'}), 403
                    
                    # Check if program is municipality-specific and user matches
                    if program.municipality_id and user.municipality_id != program.municipality_id:
                        return jsonify({'error': 'This program is only available for residents of the assigned municipality'}), 403
        
        # Validate required documents are provided (check if program has requirements)
        # Note: Documents are uploaded after application creation, so we check during review
        # But we can validate that the user understands they need to upload documents

        # Generate application number
        count = BenefitApplication.query.count() + 1
        app_number = f"APP-{user.municipality_id}-{user_id}-{count}"

        app = BenefitApplication(
            application_number=app_number,
            user_id=user_id,
            program_id=program.id,
            application_data=data.get('application_data') or {},
            supporting_documents=[],
            status='pending',
        )
        db.session.add(app)
        db.session.commit()

        return jsonify({'message': 'Application created successfully', 'application': app.to_dict()}), 201
    except ValidationError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create application', 'details': str(e)}), 500


@benefits_bp.route('/my-applications', methods=['GET'])
@jwt_required()
def my_applications():
    try:
        user_id = get_jwt_identity()
        apps = BenefitApplication.query.filter_by(user_id=user_id).order_by(BenefitApplication.created_at.desc()).all()
        return jsonify({'applications': [a.to_dict() for a in apps], 'count': len(apps)}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get applications', 'details': str(e)}), 500


@benefits_bp.route('/applications/<int:application_id>/upload', methods=['POST'])
@jwt_required()
@fully_verified_required
def upload_application_doc(application_id: int):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        app = BenefitApplication.query.get(application_id)
        if not app:
            return jsonify({'error': 'Application not found'}), 404
        if app.user_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403

        # Handle multiple files
        files = request.files.getlist('file')
        if not files or len(files) == 0:
            return jsonify({'error': 'No files uploaded'}), 400

        municipality = Municipality.query.get(user.municipality_id)
        municipality_slug = municipality.slug if municipality else 'unknown'

        existing = app.supporting_documents or []
        uploaded_paths = []
        
        for file in files:
            if file.filename:
                rel_path = save_benefit_document(file, app.id, municipality_slug)
                existing.append(rel_path)
                uploaded_paths.append(rel_path)
        
        app.supporting_documents = existing
        db.session.commit()

        return jsonify({'message': f'{len(uploaded_paths)} file(s) uploaded', 'paths': uploaded_paths, 'application': app.to_dict()}), 200
    except ValidationError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to upload file', 'details': str(e)}), 500


