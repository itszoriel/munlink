import os
import logging
from typing import Optional, Tuple

from flask import Blueprint, current_app, jsonify, request

from apps.api import db
from apps.api.models.document import DocumentRequest
from apps.api.utils.time import utc_now

try:
    import stripe
    STRIPE_AVAILABLE = True
except ImportError:
    STRIPE_AVAILABLE = False


logger = logging.getLogger(__name__)

stripe_webhook_bp = Blueprint('stripe_webhook', __name__, url_prefix='/api/stripe')


def _get_webhook_secret() -> Optional[str]:
    return (
        current_app.config.get('STRIPE_WEBHOOK_SECRET')
        or os.getenv('STRIPE_WEBHOOK_SECRET')
    )


def _mark_request_paid(
    request_id: Optional[int],
    payment_intent_id: Optional[str]
) -> Tuple[bool, str]:
    req = None
    if request_id is not None:
        req = db.session.get(DocumentRequest, int(request_id))
    if not req and payment_intent_id:
        req = DocumentRequest.query.filter_by(payment_intent_id=payment_intent_id).first()
    if not req:
        return False, 'request_not_found'

    if req.payment_status == 'paid':
        return True, 'already_paid'

    if payment_intent_id:
        req.payment_intent_id = payment_intent_id
    req.payment_status = 'paid'
    req.paid_at = utc_now()
    db.session.commit()
    return True, 'updated'


@stripe_webhook_bp.route('/webhook', methods=['POST'])
def stripe_webhook():
    if not STRIPE_AVAILABLE:
        logger.error("stripe.webhook.unavailable: stripe library not installed")
        return jsonify({'error': 'Stripe library not installed'}), 503

    secret = _get_webhook_secret()
    if not secret:
        logger.error("stripe.webhook.unavailable: STRIPE_WEBHOOK_SECRET not configured")
        return jsonify({'error': 'Stripe webhook secret not configured'}), 500

    payload = request.get_data(cache=False, as_text=False)
    sig_header = request.headers.get('Stripe-Signature', '')

    logger.info(
        "stripe.webhook.received",
        extra={
            'signature_present': bool(sig_header),
            'payload_bytes': len(payload or b''),
        }
    )

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, secret)
    except Exception as exc:
        logger.warning("stripe.webhook.verify_failed: %s", exc)
        return jsonify({'error': 'Invalid signature'}), 400

    event_type = event.get('type')
    obj = (event.get('data') or {}).get('object') or {}
    logger.info("stripe.webhook.verified: %s", event_type)

    try:
        if event_type == 'payment_intent.succeeded':
            payment_intent_id = obj.get('id')
            request_id = (obj.get('metadata') or {}).get('document_request_id')
            ok, status = _mark_request_paid(request_id=int(request_id) if request_id else None,
                                            payment_intent_id=payment_intent_id)
            logger.info("stripe.webhook.payment_intent.succeeded: %s", status)
        elif event_type == 'checkout.session.completed':
            payment_intent_id = obj.get('payment_intent')
            request_id = (obj.get('metadata') or {}).get('document_request_id')
            if request_id or payment_intent_id:
                ok, status = _mark_request_paid(request_id=int(request_id) if request_id else None,
                                                payment_intent_id=payment_intent_id)
                logger.info("stripe.webhook.checkout.session.completed: %s", status)
            else:
                logger.info("stripe.webhook.checkout.session.completed: no request mapping")
        else:
            logger.info("stripe.webhook.unhandled: %s", event_type)
    except Exception as exc:
        logger.error("stripe.webhook.handler_failed: %s", exc)
        return jsonify({'error': 'Webhook handler error'}), 500

    return jsonify({'received': True}), 200
