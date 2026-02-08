"""Document types and requests routes.

SCOPE: Zambales province only, excluding Olongapo City.
"""
import os
import mimetypes
import secrets
from pathlib import Path
from io import BytesIO
from urllib.parse import urlparse
from apps.api.utils.time import utc_now
from datetime import datetime
from flask import Blueprint, jsonify, request, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
import requests

from apps.api import db
from apps.api.models.document import DocumentType, DocumentRequest
from apps.api.models.user import User
from apps.api.models.municipality import Municipality, Barangay
from apps.api.utils import (
    validate_required_fields,
    ValidationError,
    save_document_request_file,
    fully_verified_required,
)
from apps.api.utils.notifications import queue_document_request_created
from apps.api.utils.zambales_scope import (
    ZAMBALES_MUNICIPALITY_IDS,
    is_valid_zambales_municipality,
)
from apps.api.utils.fee_calculator import calculate_document_fee, get_fee_preview, are_requirements_submitted
from apps.api.utils.stripe_payment import (
    create_payment_intent,
    confirm_payment_for_request,
    get_payment_config,
    is_stripe_configured,
)
from apps.api.utils.manual_payment import (
    generate_payment_id,
    hash_payment_id,
    verify_payment_id,
    send_payment_id_email,
)
from apps.api.utils.validators import (
    validate_file_extension,
    validate_file_size,
    ValidationError,
)
from apps.api.utils.security import ALLOWED_DOCUMENT_MIMES, validate_file_mime_type
from apps.api.utils.supabase_storage import (
    upload_file_to_path,
    get_signed_url,
    generate_unique_filename,
)
from apps.api.utils.storage_handler import get_file_url as get_storage_file_url
from werkzeug.utils import secure_filename
from apps.api import limiter
from apps.api.config import BASE_DIR


documents_bp = Blueprint('documents', __name__, url_prefix='/api/documents')


def _limit(limit_string: str):
    """Apply rate limit if limiter is available."""
    def decorator(f):
        if limiter:
            return limiter.limit(limit_string)(f)
        return f
    return decorator


def _manual_bucket() -> str:
    return (
        current_app.config.get('SUPABASE_PRIVATE_BUCKET')
        or os.getenv('SUPABASE_PRIVATE_BUCKET')
        or 'munlinkprivate-files'
    )


def _resolve_manual_qr_path() -> str | None:
    raw = (current_app.config.get('MANUAL_QR_IMAGE_PATH') or '').strip()
    if not raw:
        return None
    if os.path.isabs(raw):
        return raw
    return str(BASE_DIR / raw)


def _build_manual_storage_path(user_id: int, request_id: int, filename: str) -> str:
    return f"manual-payments/user_{user_id}/request_{request_id}/{filename}"


def _save_manual_payment_proof(file, user, req) -> str:
    if not file:
        raise ValueError("No file provided")

    original_name = getattr(file, 'filename', None) or 'proof'
    safe_name = secure_filename(original_name)

    # Validate extension + size + mime
    allowed = {'jpg', 'jpeg', 'png', 'pdf'}
    ext = validate_file_extension(safe_name, allowed)
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    validate_file_size(file_size, max_size_mb=10)
    try:
        validate_file_mime_type(file, ALLOWED_DOCUMENT_MIMES, ext)
    except Exception:
        # Best-effort: if mime validation fails, treat as invalid
        raise ValueError("Invalid file type")

    unique_name = generate_unique_filename(safe_name)
    storage_path = _build_manual_storage_path(user.id, req.id, unique_name)

    # Primary: Supabase private bucket
    try:
        upload_file_to_path(
            file=file,
            storage_path=storage_path,
            content_type=getattr(file, 'content_type', None),
            max_size_mb=10,
            bucket=_manual_bucket(),
        )
        return storage_path
    except Exception as exc:
        # Dev/local fallback when Supabase is unavailable or misconfigured.
        try:
            current_app.logger.warning(
                "Manual payment proof upload fell back to local storage: %s",
                exc,
            )
        except Exception:
            pass

    upload_root = Path(current_app.config.get('UPLOAD_FOLDER') or 'uploads')
    local_rel_path = Path(storage_path.replace('\\', '/'))
    local_full_path = upload_root / local_rel_path
    local_full_path.parent.mkdir(parents=True, exist_ok=True)

    file.seek(0)
    if hasattr(file, 'save'):
        file.save(str(local_full_path))
    else:
        with open(local_full_path, 'wb') as f:
            f.write(file.read())

    return str(local_rel_path).replace('\\', '/')


def _manual_proof_signed_url(storage_path: str) -> str | None:
    if not storage_path:
        return None
    try:
        return get_signed_url(storage_path, expires_in=3600, bucket=_manual_bucket())
    except Exception:
        try:
            return get_storage_file_url(storage_path)
        except Exception:
            return None


def _generate_request_number(user_id: int) -> str:
    """Generate a collision-resistant request number."""
    for _ in range(5):
        stamp = utc_now().strftime('%Y%m%d%H%M%S')
        rand = secrets.token_hex(4).upper()
        candidate = f"REQ-{stamp}-{int(user_id)}-{rand}"
        exists = DocumentRequest.query.filter_by(request_number=candidate).first()
        if not exists:
            return candidate
    raise RuntimeError("Unable to generate unique request number")


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

    normalized = str(file_ref).replace('\\', '/')
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

    # Support DB values that store storage paths instead of absolute URLs.
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


@documents_bp.route('/types', methods=['GET'])
def list_document_types():
    """Public list of active document types."""
    try:
        municipality_id = request.args.get('municipality_id', type=int)
        barangay_id = request.args.get('barangay_id', type=int)

        # Resolve municipality from barangay if only barangay is provided
        if barangay_id and not municipality_id:
            try:
                brgy = db.session.get(Barangay, barangay_id)
                if brgy:
                    municipality_id = brgy.municipality_id
            except Exception:
                municipality_id = municipality_id

        query = DocumentType.query.filter_by(is_active=True)

        if barangay_id:
            query = query.filter(
                or_(
                    DocumentType.barangay_id == barangay_id,
                    DocumentType.municipality_id == municipality_id,
                    DocumentType.barangay_id.is_(None)
                )
            )
        elif municipality_id:
            query = query.filter(
                or_(
                    DocumentType.municipality_id == municipality_id,
                    DocumentType.municipality_id.is_(None)
                )
            )

        types = query.all()
        return jsonify({
            'types': [t.to_dict() for t in types],
            'count': len(types)
        }), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get document types', 'details': str(e)}), 500


@documents_bp.route('/requests', methods=['POST'])
@jwt_required()
@fully_verified_required
def create_document_request():
    """Create a new document request for the current user."""
    try:
        user_id = get_jwt_identity()
        user = db.session.get(User, user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json()
        required = ['document_type_id', 'municipality_id', 'delivery_method', 'purpose', 'civil_status']
        validate_required_fields(data, required)

        # Enforce municipality scoping: residents may only request in their registered municipality
        if not user.municipality_id or int(user.municipality_id) != int(data['municipality_id']):
            return jsonify({'error': 'You can only request documents in your registered municipality'}), 403
        
        # ZAMBALES SCOPE: Verify municipality is in Zambales (excluding Olongapo)
        if not is_valid_zambales_municipality(int(data['municipality_id'])):
            return jsonify({'error': 'Municipality is not available in this system'}), 403

        # Validate delivery rules against selected document type
        dt = db.session.get(DocumentType, int(data['document_type_id']))
        if not dt or not dt.is_active:
            return jsonify({'error': 'Selected document type is not available'}), 400

        # Enforce locality: municipal scope and optional barangay scope
        target_muni_id = int(data['municipality_id'])
        if dt.municipality_id and int(dt.municipality_id) != target_muni_id:
            return jsonify({'error': 'This document is not available in the selected municipality'}), 400

        target_brgy_id = data.get('barangay_id') or getattr(user, 'barangay_id', None)
        if (dt.authority_level or '').lower() == 'barangay':
            if not target_brgy_id:
                return jsonify({'error': 'This document requires a barangay to be selected'}), 400
            if dt.barangay_id and int(dt.barangay_id) != int(target_brgy_id):
                try:
                    brgy = db.session.get(Barangay, dt.barangay_id)
                    brgy_name = brgy.name if brgy else 'this barangay'
                except Exception:
                    brgy_name = 'this barangay'
                return jsonify({'error': f'This document is only available in {brgy_name}'}), 400

        # Digital is allowed only when the type supports digital
        requested_method = (data.get('delivery_method') or '').lower()
        digital_allowed = bool(dt.supports_digital)
        if requested_method == 'digital' and not digital_allowed:
            return jsonify({'error': 'This document can only be requested for in-person pickup'}), 400

        # Require barangay on profile for all requests (guided pickup uses profile location)
        if not getattr(user, 'barangay_id', None):
            return jsonify({'error': 'Please complete your barangay details in your Profile before requesting documents.'}), 400

        # Create request
        # Normalize and capture extended fields
        remarks = data.get('remarks') or data.get('additional_notes') or data.get('additional_details')
        additional_details = data.get('additional_details')
        civil_status = data.get('civil_status')
        age = data.get('age')
        request_level = data.get('request_level')
        pickup_location = (data.get('pickup_location') or 'municipal').lower()

        # New enhanced fields
        purpose_type = data.get('purpose_type')
        purpose_other = data.get('purpose_other')
        business_type = data.get('business_type')

        requirements_submitted = are_requirements_submitted(
            dt,
            data.get('supporting_documents') or []
        )
        if data.get('requirements_submitted') is True:
            requirements_submitted = True

        # Calculate fees with exemptions
        fee_calc = calculate_document_fee(
            document_type=dt,
            user_id=user_id,
            purpose_type=purpose_type,
            business_type=business_type,
            requirements_submitted=requirements_submitted
        )
        final_fee = fee_calc.get('final_fee', 0)

        # Build derived pickup address and barangay selection
        pickup_address = None
        if requested_method == 'pickup':
            muni_name = getattr(getattr(user, 'municipality', None), 'name', data.get('municipality_id'))
            if pickup_location == 'barangay' and getattr(user, 'barangay', None):
                pickup_address = f"Barangay {getattr(user.barangay, 'name', '')} Hall, {muni_name}"
            else:
                pickup_address = f"Municipal Hall - {muni_name}"

        selected_barangay_id = None
        if pickup_location == 'barangay':
            selected_barangay_id = getattr(user, 'barangay_id', None)

        # Build resident_input snapshot for auditability
        try:
            resident_input = {
                'purpose': data.get('purpose'),
                'remarks': remarks,
                'civil_status': civil_status,
                'age': age,
                'delivery_method': requested_method,
                'pickup_location': pickup_location,
                'document_type_id': data.get('document_type_id'),
                'purpose_type': purpose_type,
                'purpose_other': purpose_other,
                'business_type': business_type,
                'fee_calculation': fee_calc,
            }
        except Exception:
            resident_input = None

        # Determine payment status based on delivery method and fee
        if float(final_fee or 0) == 0:
            payment_status = 'waived'
        elif requested_method == 'digital':
            payment_status = 'pending'  # Will need to pay online after approval
        else:
            payment_status = 'pending'  # Pay at office pickup

        # Select default payment method for digital paid requests
        payment_method = None
        manual_payment_status = None
        if requested_method == 'digital' and float(final_fee or 0) > 0:
            payment_method = 'stripe' if is_stripe_configured() else 'manual_qr'
            if payment_method == 'manual_qr':
                manual_payment_status = 'not_started'

        req = DocumentRequest(
            request_number=_generate_request_number(user_id),
            user_id=user_id,
            document_type_id=data['document_type_id'],
            municipality_id=data['municipality_id'],
            barangay_id= selected_barangay_id if requested_method == 'pickup' else (data.get('barangay_id') or getattr(user, 'barangay_id', None)),
            delivery_method=requested_method,
            # Derive pickup location string from selection; no free-text input
            delivery_address= pickup_address if requested_method == 'pickup' else data.get('delivery_address'),
            purpose=data['purpose'],
            additional_notes=(remarks or None),
            supporting_documents=data.get('supporting_documents') or [],
            status='pending',
            # Enhanced fields
            purpose_type=purpose_type,
            purpose_other=purpose_other,
            business_type=business_type,
            # Fee tracking
            original_fee=fee_calc.get('original_fee'),
            applied_exemption=fee_calc.get('exemption_type'),
            final_fee=final_fee,
            payment_status=payment_status,
            payment_method=payment_method,
            manual_payment_status=manual_payment_status,
        )

        # Gracefully set new fields if columns exist
        try:
            if hasattr(req, 'civil_status') and civil_status is not None:
                setattr(req, 'civil_status', civil_status)
            if hasattr(req, 'request_level') and request_level is not None:
                setattr(req, 'request_level', request_level)
            # Backward-safe: only set resident_input if column exists in DB
            try:
                if hasattr(req, 'resident_input') and resident_input is not None:
                    setattr(req, 'resident_input', resident_input)
            except Exception:
                pass
        except Exception:
            pass

        db.session.add(req)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            req.request_number = _generate_request_number(user_id)
            db.session.add(req)
            db.session.commit()

        try:
            queue_document_request_created(user, req, dt.name if dt else 'Document')
            db.session.commit()
        except Exception as notify_exc:
            db.session.rollback()
            try:
                current_app.logger.warning("Failed to queue document request notification: %s", notify_exc)
            except Exception:
                pass

        return jsonify({'message': 'Request created successfully', 'request': req.to_dict()}), 201

    except ValidationError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create document request', 'details': str(e)}), 500


@documents_bp.route('/my-requests', methods=['GET'])
@jwt_required()
def get_my_requests():
    """Get current user's document requests."""
    try:
        user_id = get_jwt_identity()
        requests_q = (
            DocumentRequest.query.options(
                selectinload(DocumentRequest.document_type),
                selectinload(DocumentRequest.municipality),
                selectinload(DocumentRequest.barangay),
            )
            .filter_by(user_id=user_id)
            .order_by(DocumentRequest.created_at.desc())
            .all()
        )
        return jsonify({
            'count': len(requests_q),
            'requests': [r.to_dict() for r in requests_q]
        }), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get document requests', 'details': str(e)}), 500


@documents_bp.route('/requests/<int:request_id>', methods=['GET'])
@jwt_required()
def get_request_detail(request_id: int):
    """Get a specific request detail (owned by user)."""
    try:
        user_id = get_jwt_identity()
        r = db.session.get(DocumentRequest, request_id)
        if not r or r.user_id != int(user_id):
            return jsonify({'error': 'Request not found'}), 404
        return jsonify({'request': r.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get request', 'details': str(e)}), 500


@documents_bp.route('/requests/<int:request_id>/claim-ticket', methods=['GET'])
@jwt_required()
def get_claim_ticket(request_id: int):
    """Return current claim ticket info for the owner (pickup requests).

    Reuses qr_code (relative path) and qr_data (JSON) fields.
    """
    try:
        user_id = get_jwt_identity()
        r = db.session.get(DocumentRequest, request_id)
        if not r or r.user_id != int(user_id):
            return jsonify({'error': 'Request not found'}), 404
        if (r.delivery_method or '').lower() not in ('physical', 'pickup'):
            return jsonify({'error': 'Not a pickup request'}), 400
        data = r.qr_data or {}
        # Optional reveal of plaintext code for owner only
        reveal = (request.args.get('reveal') or '').strip() not in ('', '0', 'false', 'False')
        code_plain = None
        if reveal:
            try:
                from apps.api.utils.qr_utils import decrypt_code
                enc = (data or {}).get('code_enc')
                if enc:
                    code_plain = decrypt_code(enc)
            except Exception:
                code_plain = None
        # Build public URL to QR image if stored
        qr_url = None
        if r.qr_code:
            qr_url = f"/api/documents/requests/{r.id}/claim-ticket/qr"
        # Resolve names
        muni_name = getattr(getattr(r, 'municipality', None), 'name', None)
        doc_name = getattr(getattr(r, 'document_type', None), 'name', None)
        return jsonify({
            'request_id': r.id,
            'request_number': r.request_number,
            'qr_url': qr_url,
            'code_masked': data.get('code_masked'),
            'code_plain': code_plain,
            'window_start': data.get('window_start'),
            'window_end': data.get('window_end'),
            'doc_name': doc_name,
            'muni_name': muni_name,
        }), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get claim ticket', 'details': str(e)}), 500


@documents_bp.route('/verify/<string:request_number>', methods=['GET'])
def public_verify_document(request_number: str):
    """Public verification endpoint for digital documents via request_number.

    Returns validity and limited non-sensitive details.
    """
    try:
        r = DocumentRequest.query.filter_by(request_number=request_number).first()
        if not r:
            return jsonify({'valid': False, 'reason': 'not_found'}), 200
        if (r.delivery_method or '').lower() != 'digital':
            return jsonify({'valid': False, 'reason': 'not_digital'}), 200
        if not r.document_file:
            return jsonify({'valid': False, 'reason': 'no_file'}), 200
        status = (r.status or '').lower()
        if status not in ('ready', 'completed'):
            return jsonify({'valid': False, 'reason': f'status_{status}'}), 200
        muni_name = getattr(getattr(r, 'municipality', None), 'name', None)
        doc_name = getattr(getattr(r, 'document_type', None), 'name', None)
        issued_at = r.ready_at.isoformat() if getattr(r, 'ready_at', None) else None
        return jsonify({
            'valid': True,
            'request_number': r.request_number,
            'status': r.status,
            'muni_name': muni_name,
            'doc_name': doc_name,
            'issued_at': issued_at,
        }), 200
    except Exception as e:
        current_app.logger.error("Public document verification failed for %s: %s", request_number, e)
        return jsonify({'valid': False, 'error': 'verification_failed'}), 500


@documents_bp.route('/requests/<int:request_id>/download', methods=['GET'])
@jwt_required()
def download_my_document(request_id: int):
    """Stream the generated document for the owning resident."""
    try:
        user_id = get_jwt_identity()
        r = db.session.get(DocumentRequest, request_id)
        if not r or r.user_id != int(user_id):
            return jsonify({'error': 'Request not found'}), 404
        if not r.document_file:
            return jsonify({'error': 'No generated document available'}), 404
        status = (r.status or '').lower()
        if status not in {'ready', 'completed'}:
            return jsonify({'error': 'Document is not ready'}), 400

        filename = f"{r.request_number or 'document'}.pdf"
        return _stream_storage_file(r.document_file, download_name=filename)
    except PermissionError:
        return jsonify({'error': 'File access denied'}), 403
    except FileNotFoundError:
        return jsonify({'error': 'File not found'}), 404
    except requests.RequestException:
        return jsonify({'error': 'Failed to fetch document from storage'}), 502
    except Exception as e:
        current_app.logger.error("Resident document download failed: %s", e)
        return jsonify({'error': 'Failed to download document'}), 500


@documents_bp.route('/requests/<int:request_id>/claim-ticket/qr', methods=['GET'])
@jwt_required()
def get_claim_ticket_qr(request_id: int):
    """Stream claim ticket QR image for the owning resident."""
    try:
        user_id = get_jwt_identity()
        r = db.session.get(DocumentRequest, request_id)
        if not r or r.user_id != int(user_id):
            return jsonify({'error': 'Request not found'}), 404
        if not r.qr_code:
            return jsonify({'error': 'Claim QR is not available'}), 404

        filename = f"{r.request_number or 'claim'}-qr.png"
        return _stream_storage_file(r.qr_code, download_name=filename)
    except PermissionError:
        return jsonify({'error': 'File access denied'}), 403
    except FileNotFoundError:
        return jsonify({'error': 'File not found'}), 404
    except requests.RequestException:
        return jsonify({'error': 'Failed to fetch QR from storage'}), 502
    except Exception as e:
        current_app.logger.error("Claim QR download failed: %s", e)
        return jsonify({'error': 'Failed to download claim QR'}), 500


@documents_bp.route('/requests/<int:request_id>/upload', methods=['POST'])
@jwt_required()
@fully_verified_required
def upload_request_files(request_id: int):
    """Upload supporting documents to a request (owned by user). Accepts multiple 'file' parts."""
    try:
        user_id = get_jwt_identity()
        r = db.session.get(DocumentRequest, request_id)
        if not r or r.user_id != int(user_id):
            return jsonify({'error': 'Request not found'}), 404

        if not request.files:
            return jsonify({'error': 'No files uploaded'}), 400

        # Determine municipality slug from request
        municipality_slug = r.municipality.slug if getattr(r, 'municipality', None) else 'unknown'

        saved = []
        requirement_labels = request.form.getlist('requirement') or []

        # Preferred: repeated 'file' parts with matching 'requirement' fields
        files_list = request.files.getlist('file') if 'file' in request.files else []
        if files_list:
            for idx, f in enumerate(files_list):
                rel = save_document_request_file(f, r.id, municipality_slug)
                req_label = requirement_labels[idx] if idx < len(requirement_labels) else None
                if req_label:
                    saved.append({'path': rel, 'requirement': req_label})
                else:
                    saved.append(rel)
        else:
            # Fallback: accept multiple named fields
            for key in request.files:
                files = request.files.getlist(key)
                for f in files:
                    rel = save_document_request_file(f, r.id, municipality_slug)
                    # If the field name hints the requirement, capture it
                    if key and key not in ('file',):
                        saved.append({'path': rel, 'requirement': key})
                    else:
                        saved.append(rel)

        existing = r.supporting_documents or []
        r.supporting_documents = existing + saved

        # Recalculate fees once requirements are submitted
        doc_type = r.document_type or db.session.get(DocumentType, r.document_type_id)
        if doc_type:
            requirements_submitted = are_requirements_submitted(doc_type, r.supporting_documents or [])
            fee_calc = calculate_document_fee(
                document_type=doc_type,
                user_id=r.user_id,
                purpose_type=getattr(r, 'purpose_type', None),
                business_type=getattr(r, 'business_type', None),
                requirements_submitted=requirements_submitted
            )
            prev_fee = float(r.final_fee or 0)
            r.original_fee = fee_calc.get('original_fee')
            r.applied_exemption = fee_calc.get('exemption_type')
            r.final_fee = fee_calc.get('final_fee')
            new_fee = float(r.final_fee or 0)
            if new_fee == 0:
                if getattr(r, 'payment_status', None) != 'paid':
                    r.payment_status = 'waived'
                # Reset manual state if fee becomes zero
                if getattr(r, 'payment_method', None) == 'manual_qr' and getattr(r, 'payment_status', None) != 'paid':
                    r.manual_payment_status = 'not_started'
                    r.manual_payment_proof_path = None
                    r.manual_payment_id_hash = None
                    r.manual_payment_id_last4 = None
                    r.manual_payment_id_sent_at = None
                    r.manual_payment_submitted_at = None
                    r.manual_reviewed_by = None
                    r.manual_reviewed_at = None
                    r.manual_review_notes = None
            else:
                if getattr(r, 'payment_status', None) == 'waived':
                    r.payment_status = 'pending'
                # Invalidate manual proof if fee changed mid-flow
                if prev_fee != new_fee and getattr(r, 'payment_method', None) == 'manual_qr':
                    if getattr(r, 'manual_payment_status', None) in {'proof_uploaded', 'id_sent', 'submitted'}:
                        r.manual_payment_status = 'rejected'
                        r.manual_review_notes = 'Fee changed. Please repay the exact new amount and resubmit proof.'
                        r.manual_payment_id_hash = None
                        r.manual_payment_id_last4 = None
                        r.manual_payment_id_sent_at = None
                        r.manual_payment_submitted_at = None

        db.session.commit()

        return jsonify({'message': 'Files uploaded', 'files': saved, 'request': r.to_dict()}), 200
    except ValidationError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to upload files', 'details': str(e)}), 500


@documents_bp.route('/calculate-fee', methods=['GET'])
@jwt_required()
def calculate_fee_endpoint():
    """Calculate fee for a document request with exemption preview.

    Query params:
        document_type_id: Required - ID of the document type
        purpose_type: Optional - educational, employment, legal, personal, business, travel, other
        business_type: Optional - big_business, small_business, banca_tricycle
    """
    try:
        user_id = get_jwt_identity()

        document_type_id = request.args.get('document_type_id', type=int)
        if not document_type_id:
            return jsonify({'error': 'document_type_id is required'}), 400

        purpose_type = request.args.get('purpose_type')
        business_type = request.args.get('business_type')
        requirements_flag = request.args.get('requirements_submitted')
        requirements_submitted = None
        if requirements_flag is not None:
            requirements_submitted = str(requirements_flag).lower() in ('1', 'true', 'yes', 'y')

        result = get_fee_preview(
            document_type_id=document_type_id,
            user_id=user_id,
            purpose_type=purpose_type,
            business_type=business_type,
            requirements_submitted=requirements_submitted
        )

        if 'error' in result:
            return jsonify({'error': result['error']}), 404

        return jsonify(result), 200

    except Exception as e:
        return jsonify({'error': 'Failed to calculate fee', 'details': str(e)}), 500


@documents_bp.route('/types/<int:type_id>', methods=['GET'])
def get_document_type(type_id: int):
    """Get a single document type by ID."""
    try:
        dt = db.session.get(DocumentType, type_id)
        if not dt or not dt.is_active:
            return jsonify({'error': 'Document type not found'}), 404
        return jsonify({'type': dt.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get document type', 'details': str(e)}), 500


@documents_bp.route('/payment-config', methods=['GET'])
@jwt_required()
def get_payment_configuration():
    """Get payment configuration for frontend (authenticated)."""
    stripe_cfg = get_payment_config()
    manual_qr_path = _resolve_manual_qr_path()
    manual_available = bool(manual_qr_path)
    return jsonify({
        'stripe': stripe_cfg,
        'manual_qr': {
            'available': manual_available,
            'qr_image_url': '/api/documents/manual-qr-image' if manual_available else None,
            'instructions': current_app.config.get('MANUAL_PAYMENT_INSTRUCTIONS'),
            'pay_to_name': current_app.config.get('MANUAL_PAY_TO_NAME') or None,
            'pay_to_number': current_app.config.get('MANUAL_PAY_TO_NUMBER') or None,
        },
    }), 200


@documents_bp.route('/manual-qr-image', methods=['GET'])
@jwt_required()
@fully_verified_required
def get_manual_qr_image():
    """Serve the manual QR image to verified residents."""
    path = _resolve_manual_qr_path()
    if not path or not os.path.exists(path):
        return jsonify({'error': 'Manual QR image not configured'}), 404
    return send_file(path, mimetype='image/jpeg', conditional=True)


@documents_bp.route('/requests/<int:request_id>/payment-method', methods=['POST'])
@jwt_required()
def set_payment_method(request_id: int):
    """Set the payment method for an eligible request."""
    try:
        user_id = get_jwt_identity()
        r = db.session.get(DocumentRequest, request_id)
        if not r or r.user_id != int(user_id):
            return jsonify({'error': 'Request not found'}), 404

        data = request.get_json(silent=True) or {}
        method = (data.get('payment_method') or '').lower()
        if method not in {'stripe', 'manual_qr'}:
            return jsonify({'error': 'Invalid payment_method'}), 400

        if method == 'stripe' and not is_stripe_configured():
            return jsonify({'error': 'Stripe is unavailable right now'}), 400

        # Eligible only for digital paid requests not yet paid/waived
        if (r.delivery_method or '').lower() != 'digital':
            return jsonify({'error': 'Payment method selection is only for digital requests'}), 400
        if float(getattr(r, 'final_fee', 0) or 0) <= 0:
            return jsonify({'error': 'No payment required for this request'}), 400
        if (r.payment_status or '') in ('paid', 'waived'):
            return jsonify({'error': 'Payment is already settled'}), 400

        # Prevent switching away from manual if already submitted
        if (r.payment_method or '') == 'manual_qr' and method == 'stripe':
            if (r.manual_payment_status or '') == 'submitted':
                return jsonify({'error': 'Manual payment already submitted. Please wait for review.'}), 400

        r.payment_method = method

        if method == 'manual_qr':
            if not r.manual_payment_status or r.manual_payment_status == 'rejected':
                r.manual_payment_status = 'not_started'
        else:
            # Switching to Stripe clears manual in-progress data
            if r.manual_payment_status not in (None, 'not_started'):
                r.manual_payment_status = 'not_started'
            r.manual_payment_proof_path = None
            r.manual_payment_id_hash = None
            r.manual_payment_id_last4 = None
            r.manual_payment_id_sent_at = None
            r.manual_payment_submitted_at = None
            r.manual_review_notes = None

        r.updated_at = utc_now()
        db.session.commit()

        return jsonify({'message': 'Payment method updated', 'request': r.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update payment method', 'details': str(e)}), 500


@documents_bp.route('/requests/<int:request_id>/payment-intent', methods=['POST'])
@jwt_required()
def create_payment_intent_endpoint(request_id: int):
    """Create a Stripe PaymentIntent for a document request.

    Only allowed for digital delivery requests with pending payment.
    """
    try:
        user_id = get_jwt_identity()
        r = db.session.get(DocumentRequest, request_id)

        if not r or r.user_id != int(user_id):
            return jsonify({'error': 'Request not found'}), 404

        # Verify this is a digital request with pending payment
        if (r.delivery_method or '').lower() != 'digital':
            return jsonify({'error': 'Payment is only required for digital delivery'}), 400

        if r.payment_status == 'paid':
            return jsonify({'error': 'Request is already paid'}), 400

        if r.payment_method and r.payment_method != 'stripe':
            return jsonify({'error': 'Payment method is set to manual QR'}), 400

        if r.payment_status == 'waived':
            return jsonify({'error': 'No payment required for this request'}), 400

        if not r.final_fee or float(r.final_fee) <= 0:
            return jsonify({'error': 'No fee to pay for this request'}), 400

        # Ensure payment method is Stripe
        if r.payment_method and r.payment_method != 'stripe':
            return jsonify({'error': 'Payment method is set to manual QR'}), 400
        if not r.payment_method:
            r.payment_method = 'stripe'
            db.session.commit()

        # Stripe availability check
        if not is_stripe_configured():
            return jsonify({
                'error': 'stripe_unavailable',
                'stripe_status': 'maintenance',
                'fallback': 'manual_qr',
                'message': 'Card payments are temporarily unavailable. Please try again later or choose Manual QR.'
            }), 503

        # Allow payment only after admin approval
        allowed_statuses = {'approved', 'processing', 'ready', 'completed'}
        if (r.status or '').lower() not in allowed_statuses:
            return jsonify({'error': 'Payment is available after admin approval'}), 400

        # Get user email
        user = db.session.get(User, user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Get document type name
        doc_type_name = 'Document'
        if r.document_type:
            doc_type_name = r.document_type.name

        # Create PaymentIntent
        result = create_payment_intent(
            amount_pesos=float(r.final_fee),
            document_request_id=r.id,
            user_email=user.email,
            document_type_name=doc_type_name,
            request_number=r.request_number
        )

        if not result.get('success'):
            return jsonify({
                'error': 'stripe_unavailable',
                'stripe_status': 'maintenance',
                'fallback': 'manual_qr',
                'message': result.get('error', 'Card payments are temporarily unavailable.')
            }), 503

        return jsonify(result), 200

    except Exception as e:
        return jsonify({'error': 'Failed to create payment', 'details': str(e)}), 500


@documents_bp.route('/requests/<int:request_id>/confirm-payment', methods=['POST'])
@jwt_required()
def confirm_payment_endpoint(request_id: int):
    """Confirm payment for a document request after Stripe payment.

    Body: { "payment_intent_id": "pi_xxx" }
    """
    try:
        user_id = get_jwt_identity()
        r = db.session.get(DocumentRequest, request_id)

        if not r or r.user_id != int(user_id):
            return jsonify({'error': 'Request not found'}), 404

        if (r.delivery_method or '').lower() != 'digital':
            return jsonify({'error': 'Payment is only required for digital delivery'}), 400

        if r.payment_status == 'paid':
            return jsonify({
                'message': 'Payment already confirmed',
                'request': r.to_dict(),
                'receipt_url': None
            }), 200

        if r.payment_status == 'waived':
            return jsonify({'error': 'No payment required for this request'}), 400

        if not r.final_fee or float(r.final_fee) <= 0:
            return jsonify({'error': 'No fee to pay for this request'}), 400

        if r.payment_method and r.payment_method != 'stripe':
            return jsonify({'error': 'Payment method is set to manual QR'}), 400

        allowed_statuses = {'approved', 'processing', 'ready', 'completed'}
        if (r.status or '').lower() not in allowed_statuses:
            return jsonify({'error': 'Payment is available after admin approval'}), 400

        data = request.get_json(silent=True) or {}
        payment_intent_id = str(data.get('payment_intent_id') or '').strip()

        if not payment_intent_id:
            return jsonify({'error': 'payment_intent_id is required'}), 400

        # Confirm payment
        result = confirm_payment_for_request(r, payment_intent_id)

        if not result.get('success'):
            return jsonify({'error': result.get('error', 'Payment confirmation failed')}), 400

        return jsonify({
            'message': 'Payment confirmed successfully',
            'request': r.to_dict(),
            'receipt_url': result.get('receipt_url')
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to confirm payment', 'details': str(e)}), 500


@documents_bp.route('/requests/<int:request_id>/manual-payment/proof', methods=['POST'])
@jwt_required()
@fully_verified_required
@_limit("5 per hour")
def upload_manual_payment_proof(request_id: int):
    """Upload manual payment proof and send Payment ID to email."""
    try:
        user_id = get_jwt_identity()
        r = db.session.get(DocumentRequest, request_id)
        if not r or r.user_id != int(user_id):
            return jsonify({'error': 'Request not found'}), 404

        if (r.delivery_method or '').lower() != 'digital':
            return jsonify({'error': 'Manual payment is only for digital requests'}), 400
        if float(getattr(r, 'final_fee', 0) or 0) <= 0:
            return jsonify({'error': 'No fee to pay for this request'}), 400
        if (r.payment_status or '') in ('paid', 'waived'):
            return jsonify({'error': 'Payment already settled'}), 400
        allowed_statuses = {'approved', 'processing', 'ready', 'completed'}
        if (r.status or '').lower() not in allowed_statuses:
            return jsonify({'error': 'Payment is available after admin approval'}), 400

        if (r.payment_method or '') not in ('manual_qr', ''):
            return jsonify({'error': 'Payment method is set to Stripe'}), 400
        r.payment_method = 'manual_qr'

        if (r.manual_payment_status or '') == 'submitted':
            return jsonify({'error': 'Manual payment already submitted'}), 400

        if 'file' not in request.files:
            return jsonify({'error': 'No proof file uploaded'}), 400
        proof_file = request.files.get('file')

        # Load user
        user = db.session.get(User, user_id)
        if not user or not user.email:
            return jsonify({'error': 'User email not found'}), 400

        # Save proof to private storage
        try:
            storage_path = _save_manual_payment_proof(proof_file, user, r)
        except (ValueError, ValidationError) as ve:
            return jsonify({'error': str(ve)}), 400

        payment_id = generate_payment_id(user.last_name)
        r.manual_payment_proof_path = storage_path
        r.manual_payment_status = 'proof_uploaded'
        r.manual_payment_id_hash = hash_payment_id(payment_id)
        r.manual_payment_id_last4 = payment_id[-4:]
        r.manual_payment_id_sent_at = utc_now()
        r.manual_payment_status = 'id_sent'
        r.manual_payment_submitted_at = None
        r.manual_reviewed_by = None
        r.manual_reviewed_at = None
        r.manual_review_notes = None

        send_payment_id_email(
            to_email=user.email,
            first_name=user.first_name,
            request_number=getattr(r, 'request_number', None),
            payment_id=payment_id,
            amount=float(getattr(r, 'final_fee', 0) or 0),
            instructions=current_app.config.get('MANUAL_PAYMENT_INSTRUCTIONS'),
            pay_to_number=current_app.config.get('MANUAL_PAY_TO_NUMBER'),
        )

        db.session.commit()

        return jsonify({
            'message': 'Proof uploaded. Payment ID sent.',
            'manual_payment_status': r.manual_payment_status,
            'manual_payment_id_last4': r.manual_payment_id_last4,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to upload proof', 'details': str(e)}), 500


@documents_bp.route('/requests/<int:request_id>/manual-payment/resend-id', methods=['POST'])
@jwt_required()
@fully_verified_required
@_limit("3 per hour")
def resend_manual_payment_id(request_id: int):
    """Resend (regenerate) the manual Payment ID."""
    try:
        user_id = get_jwt_identity()
        r = db.session.get(DocumentRequest, request_id)
        if not r or r.user_id != int(user_id):
            return jsonify({'error': 'Request not found'}), 404

        if (r.payment_method or '') != 'manual_qr':
            return jsonify({'error': 'Payment method is not manual QR'}), 400
        if not r.manual_payment_proof_path:
            return jsonify({'error': 'No proof uploaded yet'}), 400
        allowed_statuses = {'approved', 'processing', 'ready', 'completed'}
        if (r.status or '').lower() not in allowed_statuses:
            return jsonify({'error': 'Payment is available after admin approval'}), 400
        if (r.manual_payment_status or '') not in {'proof_uploaded', 'id_sent'}:
            return jsonify({'error': 'Cannot resend Payment ID at this stage'}), 400

        user = db.session.get(User, user_id)
        if not user or not user.email:
            return jsonify({'error': 'User email not found'}), 400

        payment_id = generate_payment_id(user.last_name)
        r.manual_payment_id_hash = hash_payment_id(payment_id)
        r.manual_payment_id_last4 = payment_id[-4:]
        r.manual_payment_id_sent_at = utc_now()
        r.manual_payment_status = 'id_sent'

        send_payment_id_email(
            to_email=user.email,
            first_name=user.first_name,
            request_number=getattr(r, 'request_number', None),
            payment_id=payment_id,
            amount=float(getattr(r, 'final_fee', 0) or 0),
            instructions=current_app.config.get('MANUAL_PAYMENT_INSTRUCTIONS'),
            pay_to_number=current_app.config.get('MANUAL_PAY_TO_NUMBER'),
        )

        db.session.commit()
        return jsonify({
            'message': 'Payment ID resent.',
            'manual_payment_status': r.manual_payment_status,
            'manual_payment_id_last4': r.manual_payment_id_last4,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to resend Payment ID', 'details': str(e)}), 500


@documents_bp.route('/requests/<int:request_id>/manual-payment/submit', methods=['POST'])
@jwt_required()
@fully_verified_required
@_limit("5 per hour")
def submit_manual_payment(request_id: int):
    """Submit manual payment using the emailed Payment ID."""
    try:
        user_id = get_jwt_identity()
        r = db.session.get(DocumentRequest, request_id)
        if not r or r.user_id != int(user_id):
            return jsonify({'error': 'Request not found'}), 404

        if (r.payment_method or '') != 'manual_qr':
            return jsonify({'error': 'Payment method is not manual QR'}), 400
        if not r.manual_payment_proof_path:
            return jsonify({'error': 'No proof uploaded yet'}), 400
        allowed_statuses = {'approved', 'processing', 'ready', 'completed'}
        if (r.status or '').lower() not in allowed_statuses:
            return jsonify({'error': 'Payment is available after admin approval'}), 400
        if (r.manual_payment_status or '') in {'approved'}:
            return jsonify({'error': 'Payment already approved'}), 400
        if (r.manual_payment_status or '') not in {'proof_uploaded', 'id_sent'}:
            return jsonify({'error': 'Payment ID not sent yet'}), 400

        data = request.get_json(silent=True) or {}
        payment_id = (data.get('payment_id') or '').strip()
        if not payment_id:
            return jsonify({'error': 'payment_id is required'}), 400

        if not r.manual_payment_id_hash:
            return jsonify({'error': 'Payment ID not issued yet'}), 400

        if not verify_payment_id(payment_id, r.manual_payment_id_hash):
            return jsonify({'error': 'Invalid Payment ID'}), 400

        r.manual_payment_status = 'submitted'
        r.manual_payment_submitted_at = utc_now()
        r.manual_review_notes = None
        db.session.commit()

        return jsonify({
            'message': 'Manual payment submitted for review.',
            'manual_payment_status': r.manual_payment_status,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to submit manual payment', 'details': str(e)}), 500


@documents_bp.route('/requests/<int:request_id>/manual-payment/proof', methods=['GET'])
@jwt_required()
def get_manual_payment_proof(request_id: int):
    """Stream the resident's own manual payment proof."""
    try:
        user_id = get_jwt_identity()
        r = db.session.get(DocumentRequest, request_id)
        if not r or r.user_id != int(user_id):
            return jsonify({'error': 'Request not found'}), 404
        if (r.payment_method or '') != 'manual_qr':
            return jsonify({'error': 'Payment method is not manual QR'}), 400
        if not r.manual_payment_proof_path:
            return jsonify({'error': 'No proof uploaded'}), 404

        source = r.manual_payment_proof_path
        if not str(source).startswith(('http://', 'https://')):
            signed = _manual_proof_signed_url(source)
            source = signed or source
        return _stream_storage_file(source, download_name=f"{r.request_number or 'proof'}-manual-proof")
    except PermissionError:
        return jsonify({'error': 'File access denied'}), 403
    except FileNotFoundError:
        return jsonify({'error': 'File not found'}), 404
    except requests.RequestException:
        return jsonify({'error': 'Failed to fetch proof from storage'}), 502
    except Exception as e:
        current_app.logger.error("Resident manual proof download failed: %s", e)
        return jsonify({'error': 'Failed to get proof'}), 500
