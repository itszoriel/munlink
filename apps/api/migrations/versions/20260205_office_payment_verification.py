"""Add office payment verification fields to document requests.

Revision ID: 20260205_office_payment_ver
Revises: 20260202_student_semester_dates
Create Date: 2026-02-05
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260205_office_payment_ver"
down_revision = "20260202_student_semester_dates"
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

    add_column("office_payment_code_hash", sa.Column("office_payment_code_hash", sa.String(length=255), nullable=True))
    add_column("office_payment_status", sa.Column("office_payment_status", sa.String(length=50), nullable=True))
    add_column("office_payment_verified_at", sa.Column("office_payment_verified_at", sa.DateTime(), nullable=True))
    add_column("office_payment_verified_by", sa.Column("office_payment_verified_by", sa.Integer(), nullable=True))

    # Add index on office_payment_status for faster queries
    existing_indexes = {idx["name"] for idx in inspector.get_indexes("document_requests")}
    if "idx_office_payment_status" not in existing_indexes:
        op.execute(
            "CREATE INDEX IF NOT EXISTS idx_office_payment_status "
            "ON document_requests (office_payment_status)"
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("document_requests"):
        return

    columns = {col["name"] for col in inspector.get_columns("document_requests")}

    def drop_column(name):
        if name in columns:
            op.drop_column("document_requests", name)

    op.execute("DROP INDEX IF EXISTS idx_office_payment_status")
    drop_column("office_payment_verified_by")
    drop_column("office_payment_verified_at")
    drop_column("office_payment_status")
    drop_column("office_payment_code_hash")
