"""
Fee Calculator for Document Requests

Calculates document fees with support for:
- Base fees from document type
- Business type fee tiers (for business clearance)
- Special status exemptions (Student, PWD, Senior)

Exemption Logic:
- Student: Only exempts if purpose_type matches rule (e.g., "educational")
- PWD: Full exemption if rule is True
- Senior: Full exemption if rule is True
"""
from typing import Dict, Any, Optional, List
from decimal import Decimal
from apps.api import db

from apps.api.models.document import DocumentType
from apps.api.utils.special_status import get_active_special_statuses


def are_requirements_submitted(document_type: DocumentType, supporting_documents: Optional[List[Any]] = None) -> bool:
    """
    Determine if required documents have been submitted for a document type.

    Supports:
    - supporting_documents as a list of strings (file paths)
    - supporting_documents as a list of dicts with {'path', 'requirement'}
    """
    requirements = document_type.requirements or []
    if not requirements:
        return True

    if not supporting_documents:
        return False

    normalized_requirements = [
        str(r).strip().lower()
        for r in requirements
        if str(r).strip()
    ]
    if not normalized_requirements:
        return True

    provided = set()
    for doc in supporting_documents:
        if isinstance(doc, dict):
            label = str(doc.get('requirement') or '').strip().lower()
            if label:
                provided.add(label)

    if provided:
        return all(req in provided for req in normalized_requirements)

    # Fallback: treat count as a proxy when requirement labels are absent
    return len(supporting_documents) >= len(normalized_requirements)


def calculate_document_fee(
    document_type: DocumentType,
    user_id: int,
    purpose_type: Optional[str] = None,
    business_type: Optional[str] = None,
    requirements_submitted: Optional[bool] = None
) -> Dict[str, Any]:
    """
    Calculate the fee for a document request, applying exemptions if applicable.

    Args:
        document_type: The DocumentType object
        user_id: The requesting user's ID
        purpose_type: The purpose of the document (educational, employment, etc.)
        business_type: For business clearance, the type of business

    Returns:
        Dict with fee calculation details:
        {
            'original_fee': Decimal,
            'exemption_type': str or None,
            'exemption_reason': str or None,
            'final_fee': Decimal,
            'is_exempted': bool
        }
    """
    # Determine base fee
    base_fee = Decimal(str(document_type.fee or 0))

    # Check for business fee tiers
    if business_type and document_type.fee_tiers:
        tier_fee = document_type.fee_tiers.get(business_type)
        if tier_fee is not None:
            base_fee = Decimal(str(tier_fee))

    requirements_required = bool(document_type.requirements)
    requirements_ok = (not requirements_required) or (requirements_submitted is not False)

    result = {
        'original_fee': float(base_fee),
        'exemption_type': None,
        'exemption_reason': None,
        'final_fee': float(base_fee),
        'is_exempted': False,
        'requirements_required': requirements_required,
        'requirements_submitted': requirements_ok
    }

    # If fee is 0, no need to check exemptions
    if base_fee <= 0:
        result['final_fee'] = 0.0
        return result

    # Only allow exemptions after required documents are submitted
    if not requirements_ok:
        return result

    # Get exemption rules for this document type
    exemption_rules = document_type.exemption_rules or {}

    if not exemption_rules:
        return result

    # Get user's active special statuses
    active_statuses = get_active_special_statuses(user_id)

    if not active_statuses:
        return result

    # Check exemptions in priority order: student, pwd, senior
    for status_type in ['student', 'pwd', 'senior']:
        if status_type not in active_statuses:
            continue

        rule = exemption_rules.get(status_type)
        if not rule:
            continue

        # Check if exemption applies
        exemption_applies = False
        reason = None

        if isinstance(rule, bool) and rule:
            # Simple exemption: True means always exempt
            exemption_applies = True
            reason = _get_exemption_reason(status_type)

        elif isinstance(rule, dict):
            # Conditional exemption based on purpose
            required_purpose = rule.get('requires_purpose')
            if required_purpose and purpose_type == required_purpose:
                exemption_applies = True
                reason = f"{_get_status_label(status_type)} ({purpose_type} purpose)"

        if exemption_applies:
            result['exemption_type'] = status_type
            result['exemption_reason'] = reason
            result['final_fee'] = 0.0
            result['is_exempted'] = True
            break  # Use first matching exemption

    return result


def _get_exemption_reason(status_type: str) -> str:
    """Get human-readable exemption reason for a status type."""
    reasons = {
        'student': 'Student discount',
        'pwd': 'PWD exemption',
        'senior': 'Senior Citizen exemption'
    }
    return reasons.get(status_type, 'Special exemption')


def _get_status_label(status_type: str) -> str:
    """Get human-readable label for a status type."""
    labels = {
        'student': 'Student',
        'pwd': 'Person with Disability',
        'senior': 'Senior Citizen'
    }
    return labels.get(status_type, status_type.title())


def get_fee_preview(
    document_type_id: int,
    user_id: int,
    purpose_type: Optional[str] = None,
    business_type: Optional[str] = None,
    requirements_submitted: Optional[bool] = None
) -> Dict[str, Any]:
    """
    Get a fee preview for UI display before submitting a request.

    Args:
        document_type_id: The ID of the document type
        user_id: The requesting user's ID
        purpose_type: The purpose of the document
        business_type: For business clearance, the type of business

    Returns:
        Dict with fee preview and user's applicable exemptions
    """
    document_type = db.session.get(DocumentType, document_type_id)
    if not document_type:
        return {'error': 'Document type not found'}

    # Get fee calculation
    fee_calc = calculate_document_fee(
        document_type=document_type,
        user_id=user_id,
        purpose_type=purpose_type,
        business_type=business_type,
        requirements_submitted=requirements_submitted
    )

    # Get user's active statuses for display
    active_statuses = get_active_special_statuses(user_id)

    # Check what exemptions are available for this document type
    available_exemptions = []
    exemption_rules = document_type.exemption_rules or {}

    for status_type, rule in exemption_rules.items():
        if rule:
            exemption_info = {
                'type': status_type,
                'label': _get_status_label(status_type),
                'user_has_status': status_type in active_statuses
            }

            if isinstance(rule, dict) and rule.get('requires_purpose'):
                exemption_info['requires_purpose'] = rule.get('requires_purpose')
                exemption_info['condition'] = f"Requires {rule.get('requires_purpose')} purpose"
            else:
                exemption_info['condition'] = None

            available_exemptions.append(exemption_info)

    # Get fee tiers for display (if applicable)
    fee_tiers = None
    if document_type.fee_tiers:
        fee_tiers = [
            {'type': k, 'label': _format_business_type(k), 'fee': float(v)}
            for k, v in document_type.fee_tiers.items()
        ]

    return {
        'document_type': {
            'id': document_type.id,
            'name': document_type.name,
            'base_fee': float(document_type.fee or 0)
        },
        'fee_calculation': fee_calc,
        'user_active_statuses': active_statuses,
        'available_exemptions': available_exemptions,
        'fee_tiers': fee_tiers
    }


def _format_business_type(business_type: str) -> str:
    """Format business type for display."""
    labels = {
        'big_business': 'Big Business',
        'small_business': 'Small Business',
        'banca_tricycle': 'Banca/Tricycle'
    }
    return labels.get(business_type, business_type.replace('_', ' ').title())


def check_exemption_eligibility(
    user_id: int,
    document_type: DocumentType,
    purpose_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Check which exemptions a user is eligible for on a document type.

    Args:
        user_id: The user's ID
        document_type: The DocumentType object
        purpose_type: The purpose of the document

    Returns:
        List of eligible exemptions with details
    """
    eligible = []
    active_statuses = get_active_special_statuses(user_id)
    exemption_rules = document_type.exemption_rules or {}

    for status_type, rule in exemption_rules.items():
        if status_type not in active_statuses:
            continue

        if not rule:
            continue

        is_eligible = False
        condition_met = None

        if isinstance(rule, bool) and rule:
            is_eligible = True
            condition_met = 'Always eligible'

        elif isinstance(rule, dict):
            required_purpose = rule.get('requires_purpose')
            if required_purpose:
                if purpose_type == required_purpose:
                    is_eligible = True
                    condition_met = f'Purpose is {required_purpose}'
                else:
                    condition_met = f'Requires {required_purpose} purpose (you selected: {purpose_type or "none"})'

        eligible.append({
            'status_type': status_type,
            'label': _get_status_label(status_type),
            'is_eligible': is_eligible,
            'condition': condition_met
        })

    return eligible
