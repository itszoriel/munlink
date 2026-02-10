"""Public/resident Benefits routes (programs and applications).

SCOPE: Zambales province only, excluding Olongapo City.
"""
import json
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse
import mimetypes
import requests
from flask import Blueprint, jsonify, request, current_app, send_file
from apps.api.utils.time import utc_now, utc_today
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta

from apps.api import db
from sqlalchemy import or_, and_
from apps.api.models.benefit import BenefitProgram, BenefitApplication
from apps.api.models.user import User
from apps.api.models.municipality import Municipality
from apps.api.utils import (
    validate_required_fields,
    ValidationError,
    fully_verified_required,
    save_benefit_document,
)
from apps.api.utils.supabase_storage import get_signed_url
from apps.api.utils.zambales_scope import (
    ZAMBALES_MUNICIPALITY_IDS,
    is_valid_zambales_municipality,
)


benefits_bp = Blueprint('benefits', __name__, url_prefix='/api/benefits')


def _as_list(value):
    """Normalize JSON/list/string values into a list."""
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return []
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass
        return [raw]
    return []


def _remote_content_allowed(url: str) -> bool:
    allowed = current_app.config.get('ALLOWED_FILE_DOMAINS') or []
    if not allowed:
        return True
    parsed = urlparse(url)
    return parsed.netloc in allowed


def _stream_storage_file(file_ref: str, download_name: str = 'document') -> object:
    """Stream a stored file by URL or local path."""
    if not file_ref:
        raise FileNotFoundError("Missing file reference")

    normalized = str(file_ref).replace('\\', '/').lstrip('/')
    if normalized.startswith(('http://', 'https://')):
        if not _remote_content_allowed(normalized):
            raise PermissionError("Untrusted file domain")
        resp = requests.get(normalized, timeout=15)
        resp.raise_for_status()
        content_type = resp.headers.get('Content-Type') or mimetypes.guess_type(download_name)[0] or 'application/octet-stream'
        return send_file(
            BytesIO(resp.content),
            mimetype=content_type,
            as_attachment=False,
            download_name=download_name,
        )

    upload_root = Path(current_app.config.get('UPLOAD_FOLDER') or 'uploads').resolve()
    local_path = (upload_root / normalized).resolve()
    if not str(local_path).startswith(str(upload_root)):
        raise PermissionError("Invalid file path")

    if local_path.exists():
        content_type = mimetypes.guess_type(str(local_path))[0] or 'application/octet-stream'
        return send_file(
            str(local_path),
            mimetype=content_type,
            as_attachment=False,
            download_name=download_name,
        )

    try:
        signed = get_signed_url(normalized, expires_in=300)
        if signed and _remote_content_allowed(signed):
            resp = requests.get(signed, timeout=15)
            resp.raise_for_status()
            content_type = resp.headers.get('Content-Type') or mimetypes.guess_type(download_name)[0] or 'application/octet-stream'
            return send_file(
                BytesIO(resp.content),
                mimetype=content_type,
                as_attachment=False,
                download_name=download_name,
            )
    except Exception:
        pass

    raise FileNotFoundError("File not found")


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
                user = db.session.get(User, user_id)
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

        # ZAMBALES SCOPE: programs must belong to a Zambales municipality.
        query = query.filter(BenefitProgram.municipality_id.in_(ZAMBALES_MUNICIPALITY_IDS))
        
        # Apply municipality/province filtering based on authentication
        if is_authenticated:
            # LOGGED-IN USER: only programs from their municipality and barangay scope.
            if user_municipality_id and is_valid_zambales_municipality(user_municipality_id):
                query = query.filter(
                    and_(
                        BenefitProgram.municipality_id == user_municipality_id,
                        or_(
                            BenefitProgram.barangay_id.is_(None),  # Municipality-wide
                            BenefitProgram.barangay_id == user_barangay_id  # Barangay-specific
                        )
                    )
                )
            else:
                query = query.filter(BenefitProgram.id == -1)
        else:
            # GUEST: Allow municipality filtering for discovery (Zambales only)
            if requested_municipality_id and is_valid_zambales_municipality(requested_municipality_id):
                # Filter by specific municipality (guest browsing)
                query = query.filter(BenefitProgram.municipality_id == requested_municipality_id)
        
        if program_type:
            query = query.filter(BenefitProgram.program_type == program_type)

        programs = query.order_by(BenefitProgram.created_at.desc()).all()

        # Auto-complete expired programs before returning
        now = utc_now()
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
        
        program = db.session.get(BenefitProgram, program_id)
        if not program or not program.is_active:
            return jsonify({'error': 'Program not found'}), 404
        if not is_valid_zambales_municipality(program.municipality_id):
            return jsonify({'error': 'Program not found'}), 404
        
        # Check if user is authenticated
        try:
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            if user_id:
                user = db.session.get(User, user_id)
                if user and user.municipality_id:
                    # LOGGED-IN USER: program must match user municipality and barangay scope.
                    if program.municipality_id != user.municipality_id:
                        return jsonify({'error': 'Program not available in your municipality'}), 403
                    if program.barangay_id and program.barangay_id != user.barangay_id:
                        return jsonify({'error': 'Program not available in your barangay'}), 403
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
        try:
            user_id = int(get_jwt_identity())
        except (TypeError, ValueError):
            return jsonify({'error': 'Authentication required'}), 401
        user = db.session.get(User, user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json() or {}
        required = ['program_id']
        validate_required_fields(data, required)

        program = db.session.get(BenefitProgram, int(data['program_id']))
        if not program or not program.is_active:
            return jsonify({'error': 'Invalid program'}), 400
        if not program.is_accepting_applications:
            return jsonify({'error': 'This program is not accepting applications right now'}), 400
        if not is_valid_zambales_municipality(program.municipality_id):
            return jsonify({'error': 'Program not available for your municipality'}), 403

        # Municipality scoping
        if user.municipality_id != program.municipality_id:
            return jsonify({'error': 'Program not available for your municipality'}), 403
        if program.barangay_id and user.barangay_id != program.barangay_id:
            return jsonify({'error': 'Program not available for your barangay'}), 403

        # Tag-based eligibility validation
        if program.eligibility_criteria:
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
                    
                    today = utc_today()
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
        try:
            user_id = int(get_jwt_identity())
        except (TypeError, ValueError):
            return jsonify({'error': 'Authentication required'}), 401
        apps = BenefitApplication.query.filter_by(user_id=user_id).order_by(BenefitApplication.created_at.desc()).all()
        return jsonify({'applications': [a.to_dict() for a in apps], 'count': len(apps)}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get applications', 'details': str(e)}), 500


@benefits_bp.route('/applications/<int:application_id>/upload', methods=['POST'])
@jwt_required()
@fully_verified_required
def upload_application_doc(application_id: int):
    try:
        try:
            user_id = int(get_jwt_identity())
        except (TypeError, ValueError):
            return jsonify({'error': 'Authentication required'}), 401
        user = db.session.get(User, user_id)
        app = db.session.get(BenefitApplication, application_id)
        if not app:
            return jsonify({'error': 'Application not found'}), 404
        if app.user_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403

        # Handle multiple files
        files = request.files.getlist('file')
        if not files or len(files) == 0:
            return jsonify({'error': 'No files uploaded'}), 400

        municipality = db.session.get(Municipality, user.municipality_id)
        municipality_slug = municipality.slug if municipality else 'unknown'

        existing = list(app.supporting_documents or [])
        updated_documents = list(existing)
        uploaded_paths = []
        
        for file in files:
            if file.filename:
                rel_path = save_benefit_document(file, app.id, municipality_slug)
                updated_documents.append(rel_path)
                uploaded_paths.append(rel_path)
        
        app.supporting_documents = updated_documents
        db.session.commit()

        return jsonify({'message': f'{len(uploaded_paths)} file(s) uploaded', 'paths': uploaded_paths, 'application': app.to_dict()}), 200
    except ValidationError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to upload file', 'details': str(e)}), 500


@benefits_bp.route('/applications/<int:application_id>/documents/<int:doc_index>', methods=['GET'])
@jwt_required()
def download_application_doc(application_id: int, doc_index: int):
    """Download one supporting document for the authenticated resident."""
    try:
        try:
            user_id = int(get_jwt_identity())
        except (TypeError, ValueError):
            return jsonify({'error': 'Authentication required'}), 401

        app = db.session.get(BenefitApplication, application_id)
        if not app:
            return jsonify({'error': 'Application not found'}), 404
        if app.user_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403

        docs = app.supporting_documents or []
        if isinstance(docs, str):
            try:
                parsed = json.loads(docs)
                docs = parsed if isinstance(parsed, list) else []
            except Exception:
                docs = []
        if not isinstance(docs, list):
            docs = []

        if doc_index < 0 or doc_index >= len(docs):
            return jsonify({'error': 'Document not found'}), 404

        entry = docs[doc_index]
        source = entry.get('path') if isinstance(entry, dict) else entry
        if not source:
            return jsonify({'error': 'Document path missing'}), 404

        ext_source = str(source)
        if ext_source.startswith(('http://', 'https://')):
            ext_source = urlparse(ext_source).path
        ext = os.path.splitext(ext_source)[1]
        safe_ext = ext if ext and len(ext) <= 10 else ''
        filename = f"{app.application_number or app.id}-support-{doc_index + 1}{safe_ext}"
        return _stream_storage_file(source, download_name=filename)
    except FileNotFoundError:
        return jsonify({'error': 'Document file not found'}), 404
    except PermissionError:
        return jsonify({'error': 'Access denied'}), 403
    except requests.RequestException as e:
        current_app.logger.error(
            "Failed to fetch benefit document from remote storage for application %s index %s: %s",
            application_id,
            doc_index,
            e,
        )
        return jsonify({'error': 'Failed to fetch document from storage'}), 502
    except Exception as e:
        current_app.logger.error(
            "Failed to stream benefit document for application %s index %s: %s",
            application_id,
            doc_index,
            e,
        )
        return jsonify({'error': 'Failed to download document'}), 500


@benefits_bp.route('/applications/<int:application_id>/resubmit', methods=['POST'])
@jwt_required()
@fully_verified_required
def resubmit_application(application_id: int):
    """Allow residents to resubmit incomplete/rejected applications after uploading missing docs."""
    try:
        try:
            user_id = int(get_jwt_identity())
        except (TypeError, ValueError):
            return jsonify({'error': 'Authentication required'}), 401

        app = db.session.get(BenefitApplication, application_id)
        if not app:
            return jsonify({'error': 'Application not found'}), 404
        if app.user_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403

        program = db.session.get(BenefitProgram, app.program_id)
        if not program:
            return jsonify({'error': 'Program not found'}), 404
        if not program.is_active or not program.is_accepting_applications:
            return jsonify({'error': 'This program is not accepting resubmissions right now'}), 400

        required_documents = _as_list(program.required_documents)
        supporting_documents = _as_list(app.supporting_documents)
        missing_required = max(0, len(required_documents) - len(supporting_documents))
        if missing_required > 0:
            suffix = '' if missing_required == 1 else 's'
            return jsonify({
                'error': f'Please upload {missing_required} more required document{suffix} before resubmitting.',
                'missing_required_documents': missing_required,
            }), 400

        current_status = (app.status or 'pending').lower()
        if current_status == 'approved':
            return jsonify({'error': 'Approved applications cannot be resubmitted'}), 400

        app.status = 'pending'
        app.rejection_reason = None
        app.admin_notes = None
        app.reviewed_by_id = None
        app.reviewed_at = None
        app.approved_at = None
        app.updated_at = utc_now()
        db.session.commit()

        return jsonify({'message': 'Application resubmitted successfully', 'application': app.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to resubmit application', 'details': str(e)}), 500
