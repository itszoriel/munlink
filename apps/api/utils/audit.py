"""Generic audit logging utilities for admin/system actions."""

from datetime import datetime
from typing import Optional, Any, Dict

from __init__ import db
from models.audit import AuditLog


def log_action(
    *,
    user_id: Optional[int],
    municipality_id: int,
    entity_type: str,
    entity_id: Optional[int],
    action: str,
    actor_role: Optional[str] = 'admin',
    old_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None,
    notes: Optional[str] = None,
) -> AuditLog:
    log = AuditLog(
        user_id=user_id,
        municipality_id=municipality_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        actor_role=actor_role,
        old_values=old_values,
        new_values=new_values,
        notes=notes,
        created_at=datetime.utcnow(),
    )
    db.session.add(log)
    return log


