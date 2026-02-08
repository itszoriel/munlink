"""Add semester dates to student special statuses.

Revision ID: 20260202_student_semester_dates
Revises: 20260202_manual_qr_payments
Create Date: 2026-02-02
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260202_student_semester_dates"
down_revision = "20260202_manual_qr_payments"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("user_special_statuses"):
        return

    columns = {col["name"] for col in inspector.get_columns("user_special_statuses")}

    def add_column(name, column):
        if name not in columns:
            op.add_column("user_special_statuses", column)

    add_column("semester_start", sa.Column("semester_start", sa.Date(), nullable=True))
    add_column("semester_end", sa.Column("semester_end", sa.Date(), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("user_special_statuses"):
        return

    columns = {col["name"] for col in inspector.get_columns("user_special_statuses")}

    def drop_column(name):
        if name in columns:
            op.drop_column("user_special_statuses", name)

    drop_column("semester_end")
    drop_column("semester_start")