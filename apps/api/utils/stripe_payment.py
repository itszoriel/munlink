"""
Stripe Payment Integration for Document Requests

Handles:
- Creating PaymentIntents for document requests
- Verifying payment status
- Updating document request payment status

Configuration (via environment variables):
- STRIPE_SECRET_KEY: Stripe secret key
- STRIPE_PUBLISHABLE_KEY: Stripe publishable key (for frontend)
"""
import os
from apps.api.utils.time import utc_now
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

try:
    import stripe
    STRIPE_AVAILABLE = True
except ImportError:
    STRIPE_AVAILABLE = False

from flask import current_app

logger = logging.getLogger(__name__)


def _peso_to_centavos(amount: Any) -> int:
    """Convert peso amount to centavos using decimal-safe rounding."""
    try:
        peso_value = Decimal(str(amount or 0)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        centavos_value = (peso_value * Decimal('100')).to_integral_value(rounding=ROUND_HALF_UP)
        return int(centavos_value)
    except (InvalidOperation, TypeError, ValueError):
        return 0


def _extract_receipt_url(intent: Any) -> Optional[str]:
    """Get receipt URL from a PaymentIntent across Stripe API shapes."""
    # Preferred shape (newer APIs): latest_charge (expanded object or charge id)
    try:
        latest_charge = getattr(intent, 'latest_charge', None)
        if latest_charge:
            if isinstance(latest_charge, str):
                charge = stripe.Charge.retrieve(latest_charge)
            else:
                charge = latest_charge
            if hasattr(charge, 'get'):
                return charge.get('receipt_url')
            return getattr(charge, 'receipt_url', None)
    except Exception as exc:
        logger.warning("Unable to extract receipt from latest_charge: %s", exc)

    # Backward-compatible shape: intent.charges.data[0]
    try:
        charges = getattr(intent, 'charges', None)
        data = getattr(charges, 'data', None)
        if data:
            first_charge = data[0]
            if hasattr(first_charge, 'get'):
                return first_charge.get('receipt_url')
            return getattr(first_charge, 'receipt_url', None)
    except Exception as exc:
        logger.warning("Unable to extract receipt from charges list: %s", exc)

    return None


def _get_stripe_secret_key() -> Optional[str]:
    """Get Stripe secret key from config or environment."""
    return (
        current_app.config.get('STRIPE_SECRET_KEY') or
        os.getenv('STRIPE_SECRET_KEY')
    )


def _get_stripe_publishable_key() -> Optional[str]:
    """Get Stripe publishable key from config or environment."""
    return (
        current_app.config.get('STRIPE_PUBLISHABLE_KEY') or
        os.getenv('STRIPE_PUBLISHABLE_KEY')
    )


def is_stripe_configured(require_publishable: bool = True) -> bool:
    """Check if Stripe is properly configured."""
    if not STRIPE_AVAILABLE:
        return False
    if not _get_stripe_secret_key():
        return False
    if require_publishable and not _get_stripe_publishable_key():
        return False
    return True


def get_stripe_publishable_key() -> Optional[str]:
    """Get the publishable key for frontend use."""
    return _get_stripe_publishable_key()


def create_payment_intent(
    amount_pesos: float,
    document_request_id: int,
    user_email: str,
    document_type_name: str,
    request_number: str
) -> Dict[str, Any]:
    """
    Create a Stripe PaymentIntent for a document request.

    Args:
        amount_pesos: Amount in Philippine Pesos
        document_request_id: ID of the document request
        user_email: Email of the paying user
        document_type_name: Name of the document type (for description)
        request_number: Request number (for reference)

    Returns:
        Dict with:
        - success: bool
        - client_secret: str (for Stripe Elements)
        - payment_intent_id: str
        - error: str (if failed)
    """
    if not is_stripe_configured():
        return {
            'success': False,
            'error': 'Payment processing is not configured'
        }

    amount_centavos = _peso_to_centavos(amount_pesos)
    if amount_centavos <= 0:
        return {
            'success': False,
            'error': 'Invalid payment amount'
        }

    try:
        stripe.api_key = _get_stripe_secret_key()

        # Create PaymentIntent
        intent = stripe.PaymentIntent.create(
            amount=amount_centavos,
            currency='php',
            receipt_email=user_email,
            description=f"Document Request: {document_type_name} ({request_number})",
            metadata={
                'document_request_id': str(document_request_id),
                'request_number': request_number,
                'document_type': document_type_name,
                'platform': 'MunLink Zambales'
            }
        )

        logger.info(f"PaymentIntent created: {intent.id} for request {document_request_id}")

        return {
            'success': True,
            'client_secret': intent.client_secret,
            'payment_intent_id': intent.id,
            'amount': amount_centavos / 100,
            'currency': 'PHP'
        }

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error creating PaymentIntent: {e}")
        return {
            'success': False,
            'error': str(e.user_message if hasattr(e, 'user_message') else e)
        }
    except Exception as e:
        logger.error(f"Error creating PaymentIntent: {e}")
        return {
            'success': False,
            'error': 'Payment processing error'
        }


def verify_payment(payment_intent_id: str) -> Dict[str, Any]:
    """
    Verify a payment's status.

    Args:
        payment_intent_id: Stripe PaymentIntent ID

    Returns:
        Dict with:
        - success: bool
        - status: str (Stripe payment status)
        - paid: bool (True if payment succeeded)
        - error: str (if failed)
    """
    if not is_stripe_configured():
        return {
            'success': False,
            'error': 'Payment processing is not configured'
        }

    if not payment_intent_id:
        return {
            'success': False,
            'error': 'Payment intent ID is required'
        }

    try:
        stripe.api_key = _get_stripe_secret_key()

        intent = stripe.PaymentIntent.retrieve(
            payment_intent_id,
            expand=['latest_charge']
        )
        receipt_url = _extract_receipt_url(intent)

        return {
            'success': True,
            'payment_intent_id': intent.id,
            'status': intent.status,
            'paid': intent.status == 'succeeded',
            'amount': intent.amount / 100,  # Convert back to pesos
            'amount_centavos': intent.amount,
            'amount_received_centavos': getattr(intent, 'amount_received', None),
            'currency': (intent.currency or '').upper(),
            'receipt_url': receipt_url,
            'metadata': dict(getattr(intent, 'metadata', {}) or {}),
        }

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error verifying payment: {e}")
        return {
            'success': False,
            'error': str(e.user_message if hasattr(e, 'user_message') else e)
        }
    except Exception as e:
        logger.error(f"Error verifying payment: {e}")
        return {
            'success': False,
            'error': 'Payment verification error'
        }


def confirm_payment_for_request(document_request, payment_intent_id: str) -> Dict[str, Any]:
    """
    Confirm payment and update document request.

    Args:
        document_request: DocumentRequest object
        payment_intent_id: Stripe PaymentIntent ID

    Returns:
        Dict with success status and updated request info
    """
    try:
        from apps.api import db

        # Verify payment status
        verification = verify_payment(payment_intent_id)
        if not verification.get('success'):
            return verification

        if not verification.get('paid'):
            return {
                'success': False,
                'error': f"Payment not completed. Status: {verification.get('status')}"
            }

        # Require stable intent mapping to this exact request.
        metadata = verification.get('metadata') or {}
        metadata_request_id = str(metadata.get('document_request_id') or '').strip()
        expected_request_id = str(getattr(document_request, 'id', '')).strip()
        if not metadata_request_id or metadata_request_id != expected_request_id:
            return {
                'success': False,
                'error': 'Payment intent does not match this request'
            }

        # Prevent swapping an already-linked request to a different intent.
        existing_intent_id = (getattr(document_request, 'payment_intent_id', None) or '').strip()
        if existing_intent_id and existing_intent_id != payment_intent_id:
            return {
                'success': False,
                'error': 'This request is already linked to a different payment intent'
            }

        # Validate amount and currency against server-side request fee.
        expected_amount_centavos = _peso_to_centavos(getattr(document_request, 'final_fee', 0))
        if expected_amount_centavos <= 0:
            return {
                'success': False,
                'error': 'No payable fee found for this request'
            }

        if (verification.get('currency') or '').upper() != 'PHP':
            return {
                'success': False,
                'error': 'Invalid payment currency'
            }

        intent_amount_centavos = int(verification.get('amount_centavos') or 0)
        if intent_amount_centavos != expected_amount_centavos:
            return {
                'success': False,
                'error': 'Payment amount does not match request fee'
            }

        amount_received_centavos = verification.get('amount_received_centavos')
        if amount_received_centavos is not None and int(amount_received_centavos) < expected_amount_centavos:
            return {
                'success': False,
                'error': 'Payment amount received is lower than the request fee'
            }

        # Update document request
        document_request.payment_intent_id = payment_intent_id
        document_request.payment_method = 'stripe'
        document_request.payment_status = 'paid'
        document_request.paid_at = utc_now()

        db.session.commit()

        logger.info(f"Payment confirmed for request {document_request.id}")

        return {
            'success': True,
            'message': 'Payment confirmed',
            'payment_status': 'paid',
            'paid_at': document_request.paid_at.isoformat(),
            'receipt_url': verification.get('receipt_url')
        }

    except Exception as e:
        logger.error(f"Error confirming payment: {e}")
        return {
            'success': False,
            'error': 'Failed to confirm payment'
        }


def get_payment_config() -> Dict[str, Any]:
    """
    Get Stripe configuration for frontend.

    Returns:
        Dict with publishable key and configuration status
    """
    configured = is_stripe_configured()
    return {
        'available': configured,
        'publishable_key': _get_stripe_publishable_key() if configured else None,
        'status': 'ok' if configured else 'unavailable',
        'currency': 'PHP'
    }
