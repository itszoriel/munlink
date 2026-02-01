"""Transaction audit logging and guard helpers.

Lightweight utilities used by marketplace routes to ensure
status transitions are enforced consistently and every action
is recorded in the audit trail.
"""

from datetime import datetime
from typing import Iterable, Optional, Dict, Any

from __init__ import db
from models.marketplace import Transaction, Item, TransactionAuditLog


class TransitionError(Exception):
    pass


def assert_status(transaction: Transaction, allowed: Iterable[str]) -> None:
    """Ensure the transaction is currently in one of the allowed statuses."""
    if transaction.status not in set(allowed):
        raise TransitionError(f'Transaction cannot transition from {transaction.status}')


def require_tx_role(transaction: Transaction, user_id: int, role: str) -> None:
    """Guard that the user is the buyer or seller of the transaction."""
    if role == 'buyer' and int(transaction.buyer_id) != int(user_id):
        raise TransitionError('Only the buyer can perform this action')
    if role == 'seller' and int(transaction.seller_id) != int(user_id):
        raise TransitionError('Only the seller can perform this action')


def log_tx_action(
    transaction: Transaction,
    *,
    actor_id: Optional[int],
    actor_role: Optional[str],
    action: str,
    from_status: Optional[str],
    to_status: Optional[str],
    notes: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> TransactionAuditLog:
    """Append an audit log row to the transaction.

    Commit is not performed here; caller should commit within their
    request transaction to keep changes atomic.
    """
    log = TransactionAuditLog(
        transaction_id=transaction.id,
        actor_id=actor_id,
        actor_role=actor_role,
        action=action,
        from_status=from_status,
        to_status=to_status,
        notes=notes,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata_json=metadata or {},
        created_at=datetime.utcnow(),
    )
    db.session.add(log)
    return log


