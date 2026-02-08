"""Add password reset tokens table

Revision ID: 20260202_password_reset_tokens
Revises: 20260201_outbox_safe, special_status_docs_001
Create Date: 2026-02-02
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260202_password_reset_tokens"
down_revision = ("20260201_outbox_safe", "special_status_docs_001")
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("password_reset_tokens"):
        op.create_table(
            "password_reset_tokens",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("token_hash", sa.String(length=64), nullable=False, unique=True),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("used_at", sa.DateTime(), nullable=True),
            sa.Column("request_ip", sa.String(length=45), nullable=True),
            sa.Column("user_agent", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        )
        op.create_index("idx_password_reset_user", "password_reset_tokens", ["user_id"])
        op.create_index("idx_password_reset_token", "password_reset_tokens", ["token_hash"])
        op.create_index("idx_password_reset_expires", "password_reset_tokens", ["expires_at"])
    else:
        existing_indexes = {idx["name"] for idx in inspector.get_indexes("password_reset_tokens")}
        if "idx_password_reset_user" not in existing_indexes:
            op.execute(
                "CREATE INDEX IF NOT EXISTS idx_password_reset_user "
                "ON password_reset_tokens (user_id)"
            )
        if "idx_password_reset_token" not in existing_indexes:
            op.execute(
                "CREATE INDEX IF NOT EXISTS idx_password_reset_token "
                "ON password_reset_tokens (token_hash)"
            )
        if "idx_password_reset_expires" not in existing_indexes:
            op.execute(
                "CREATE INDEX IF NOT EXISTS idx_password_reset_expires "
                "ON password_reset_tokens (expires_at)"
            )


def downgrade():
    op.execute("DROP INDEX IF EXISTS idx_password_reset_expires")
    op.execute("DROP INDEX IF EXISTS idx_password_reset_token")
    op.execute("DROP INDEX IF EXISTS idx_password_reset_user")
    op.execute("DROP TABLE IF EXISTS password_reset_tokens")
