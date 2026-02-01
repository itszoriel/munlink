"""add notification outbox and mobile numbers

Revision ID: 20260312_notifications
Revises: 20260117_sharing
Create Date: 2026-03-12

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260312_notifications'
down_revision = '20260117_sharing'
branch_labels = None
depends_on = None


def upgrade():
    # Users: optional mobile + notification preferences
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('mobile_number', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('notify_email_enabled', sa.Boolean(), server_default=sa.text('TRUE'), nullable=False))
        batch_op.add_column(sa.Column('notify_sms_enabled', sa.Boolean(), server_default=sa.text('FALSE'), nullable=False))

    # Notification outbox table
    op.create_table(
        'notification_outbox',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('resident_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('channel', sa.String(length=10), nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('payload', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('next_attempt_at', sa.DateTime(), nullable=True, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('dedupe_key', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.UniqueConstraint('dedupe_key', name='uq_notification_outbox_dedupe'),
    )
    op.create_index('ix_notification_outbox_status_next', 'notification_outbox', ['status', 'next_attempt_at'])
    op.create_index('ix_notification_outbox_event', 'notification_outbox', ['event_type'])
    op.create_index('ix_notification_outbox_resident', 'notification_outbox', ['resident_id'])

    # Backfill defaults for existing users
    conn = op.get_bind()
    conn.execute(sa.text("UPDATE users SET notify_email_enabled = TRUE WHERE notify_email_enabled IS NULL"))
    conn.execute(sa.text("UPDATE users SET notify_sms_enabled = FALSE WHERE notify_sms_enabled IS NULL"))

    # Remove server defaults after migration for cleaner application control
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column('notify_email_enabled', server_default=None)
        batch_op.alter_column('notify_sms_enabled', server_default=None)


def downgrade():
    op.drop_index('ix_notification_outbox_resident', table_name='notification_outbox')
    op.drop_index('ix_notification_outbox_event', table_name='notification_outbox')
    op.drop_index('ix_notification_outbox_status_next', table_name='notification_outbox')
    op.drop_table('notification_outbox')

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('notify_sms_enabled')
        batch_op.drop_column('notify_email_enabled')
        batch_op.drop_column('mobile_number')
