"""Add manual QR payment fields to document_requests.

Revision ID: 20260202_manual_qr_payments
Revises: 20260202_password_reset_tokens
Create Date: 2026-02-02
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260202_manual_qr_payments"
down_revision = "20260202_password_reset_tokens"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("document_requests"):
        return

    columns = {col["name"] for col in inspector.get_columns("document_requests")}

    def add_column(name, column):
        if name not in columns:
            op.add_column("document_requests", column)

    add_column("payment_method", sa.Column("payment_method", sa.String(20), nullable=True))
    add_column("manual_payment_status", sa.Column("manual_payment_status", sa.String(30), nullable=True))
    add_column("manual_payment_proof_path", sa.Column("manual_payment_proof_path", sa.String(255), nullable=True))
    add_column("manual_payment_id_hash", sa.Column("manual_payment_id_hash", sa.String(255), nullable=True))
    add_column("manual_payment_id_last4", sa.Column("manual_payment_id_last4", sa.String(10), nullable=True))
    add_column("manual_payment_id_sent_at", sa.Column("manual_payment_id_sent_at", sa.DateTime(), nullable=True))
    add_column("manual_payment_submitted_at", sa.Column("manual_payment_submitted_at", sa.DateTime(), nullable=True))
    add_column("manual_reviewed_by", sa.Column("manual_reviewed_by", sa.Integer(), nullable=True))
    add_column("manual_reviewed_at", sa.Column("manual_reviewed_at", sa.DateTime(), nullable=True))
    add_column("manual_review_notes", sa.Column("manual_review_notes", sa.Text(), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("document_requests"):
        return

    columns = {col["name"] for col in inspector.get_columns("document_requests")}

    def drop_column(name):
        if name in columns:
            op.drop_column("document_requests", name)

    drop_column("manual_review_notes")
    drop_column("manual_reviewed_at")
    drop_column("manual_reviewed_by")
    drop_column("manual_payment_submitted_at")
    drop_column("manual_payment_id_sent_at")
    drop_column("manual_payment_id_last4")
    drop_column("manual_payment_id_hash")
    drop_column("manual_payment_proof_path")
    drop_column("manual_payment_status")
    drop_column("payment_method")
