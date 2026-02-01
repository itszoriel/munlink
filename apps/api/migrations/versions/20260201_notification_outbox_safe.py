"""Ensure notification_outbox exists and SMS columns are present

Revision ID: 20260201_outbox_safe
Revises: 20260125_document_type_overrides
Create Date: 2026-02-01
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260201_outbox_safe"
down_revision = "20260125_document_type_overrides"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Ensure user SMS fields exist (idempotent)
    user_columns = {col["name"] for col in inspector.get_columns("users")}
    with op.batch_alter_table("users") as batch_op:
        if "mobile_number" not in user_columns:
            batch_op.add_column(sa.Column("mobile_number", sa.String(length=20), nullable=True))
        if "notify_email_enabled" not in user_columns:
            batch_op.add_column(
                sa.Column(
                    "notify_email_enabled",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.text("TRUE"),
                )
            )
        if "notify_sms_enabled" not in user_columns:
            batch_op.add_column(
                sa.Column(
                    "notify_sms_enabled",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.text("FALSE"),
                )
            )

    # Create notification_outbox if missing
    if not inspector.has_table("notification_outbox"):
        op.create_table(
            "notification_outbox",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("resident_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("channel", sa.String(length=10), nullable=False),
            sa.Column("event_type", sa.String(length=100), nullable=False),
            sa.Column("entity_id", sa.Integer(), nullable=True),
            sa.Column("payload", sa.JSON(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
            sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
            sa.Column(
                "next_attempt_at",
                sa.DateTime(),
                nullable=True,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.Column("last_error", sa.Text(), nullable=True),
            sa.Column("dedupe_key", sa.String(length=255), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.UniqueConstraint("dedupe_key", name="uq_notification_outbox_dedupe"),
        )
        op.create_index(
            "ix_notification_outbox_status_next",
            "notification_outbox",
            ["status", "next_attempt_at"],
        )
        op.create_index("ix_notification_outbox_event", "notification_outbox", ["event_type"])
        op.create_index("ix_notification_outbox_resident", "notification_outbox", ["resident_id"])
    else:
        # Ensure indexes exist if the table was created manually
        existing_indexes = {idx["name"] for idx in inspector.get_indexes("notification_outbox")}
        if "ix_notification_outbox_status_next" not in existing_indexes:
            op.execute(
                "CREATE INDEX IF NOT EXISTS ix_notification_outbox_status_next "
                "ON notification_outbox (status, next_attempt_at)"
            )
        if "ix_notification_outbox_event" not in existing_indexes:
            op.execute(
                "CREATE INDEX IF NOT EXISTS ix_notification_outbox_event "
                "ON notification_outbox (event_type)"
            )
        if "ix_notification_outbox_resident" not in existing_indexes:
            op.execute(
                "CREATE INDEX IF NOT EXISTS ix_notification_outbox_resident "
                "ON notification_outbox (resident_id)"
            )
        # Ensure unique constraint on dedupe_key
        existing_unique = {uc["name"] for uc in inspector.get_unique_constraints("notification_outbox")}
        if "uq_notification_outbox_dedupe" not in existing_unique:
            op.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_outbox_dedupe "
                "ON notification_outbox (dedupe_key)"
            )


def downgrade():
    # Drop indexes and table if present
    op.execute("DROP INDEX IF EXISTS ix_notification_outbox_resident")
    op.execute("DROP INDEX IF EXISTS ix_notification_outbox_event")
    op.execute("DROP INDEX IF EXISTS ix_notification_outbox_status_next")
    op.execute("DROP INDEX IF EXISTS uq_notification_outbox_dedupe")
    op.execute("DROP TABLE IF EXISTS notification_outbox")

    # Drop SMS-related user columns if they exist
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    user_columns = {col["name"] for col in inspector.get_columns("users")}
    with op.batch_alter_table("users") as batch_op:
        if "notify_sms_enabled" in user_columns:
            batch_op.drop_column("notify_sms_enabled")
        if "notify_email_enabled" in user_columns:
            batch_op.drop_column("notify_email_enabled")
        if "mobile_number" in user_columns:
            batch_op.drop_column("mobile_number")
