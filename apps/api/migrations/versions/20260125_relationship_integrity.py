"""Strengthen audit log FKs and add request indexes

Revision ID: 20260125_relationship_integrity
Revises: 20260124_merge_heads
Create Date: 2026-01-25
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260125_relationship_integrity'
down_revision = '20260124_merge_heads'
branch_labels = None
depends_on = None


def upgrade():
    # Add FK constraints to audit_logs and supporting index
    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        try:
            batch_op.create_foreign_key(
                'fk_audit_logs_user',
                'users',
                ['user_id'],
                ['id'],
                ondelete='SET NULL'
            )
        except Exception:
            pass

        try:
            batch_op.create_foreign_key(
                'fk_audit_logs_municipality',
                'municipalities',
                ['municipality_id'],
                ['id'],
                ondelete='CASCADE'
            )
        except Exception:
            pass

        try:
            batch_op.create_index('idx_audit_user', ['user_id'], unique=False)
        except Exception:
            pass

    # Index document request creation timestamps for faster sorting/filtering
    try:
        op.create_index('idx_doc_request_created_at', 'document_requests', ['created_at'], unique=False)
    except Exception:
        pass


def downgrade():
    try:
        op.drop_index('idx_doc_request_created_at', table_name='document_requests')
    except Exception:
        pass

    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        try:
            batch_op.drop_constraint('fk_audit_logs_user', type_='foreignkey')
        except Exception:
            pass
        try:
            batch_op.drop_constraint('fk_audit_logs_municipality', type_='foreignkey')
        except Exception:
            pass
        try:
            batch_op.drop_index('idx_audit_user')
        except Exception:
            pass
