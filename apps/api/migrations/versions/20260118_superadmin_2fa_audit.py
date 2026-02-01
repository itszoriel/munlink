"""Add super admin 2FA and audit log tables

Revision ID: 20260118_superadmin_2fa_audit
Revises: 20260312_notifications
Create Date: 2026-01-18

Adds:
- email_verification_codes table for 2FA codes
- admin_audit_logs table for tracking super admin actions
- created_via column on users table
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260118_superadmin_2fa_audit'
down_revision = '20260312_notifications'
branch_labels = None
depends_on = None


def upgrade():
    # Email verification codes table (for 2FA)
    op.create_table(
        'email_verification_codes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('code', sa.String(length=6), nullable=False),
        sa.Column('purpose', sa.String(length=50), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')),
        sa.Column('session_id', sa.String(length=64), nullable=True),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('idx_verification_code_user', 'email_verification_codes', ['user_id'])
    op.create_index('idx_verification_code_session', 'email_verification_codes', ['session_id'], unique=True)
    op.create_index('idx_verification_code_lookup', 'email_verification_codes', ['code', 'used'])

    # Admin audit logs table
    op.create_table(
        'admin_audit_logs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('admin_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('admin_email', sa.String(length=255), nullable=False),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('resource_type', sa.String(length=50), nullable=True),
        sa.Column('resource_id', sa.Integer(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('idx_admin_audit_admin', 'admin_audit_logs', ['admin_id'])
    op.create_index('idx_admin_audit_action', 'admin_audit_logs', ['action'])
    op.create_index('idx_admin_audit_created', 'admin_audit_logs', ['created_at'])
    op.create_index('idx_admin_audit_resource', 'admin_audit_logs', ['resource_type', 'resource_id'])

    # Add created_via column to users table
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('created_via', sa.String(length=50), nullable=True))


def downgrade():
    # Remove created_via from users
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('created_via')

    # Drop admin_audit_logs table
    op.drop_index('idx_admin_audit_resource', table_name='admin_audit_logs')
    op.drop_index('idx_admin_audit_created', table_name='admin_audit_logs')
    op.drop_index('idx_admin_audit_action', table_name='admin_audit_logs')
    op.drop_index('idx_admin_audit_admin', table_name='admin_audit_logs')
    op.drop_table('admin_audit_logs')

    # Drop email_verification_codes table
    op.drop_index('idx_verification_code_lookup', table_name='email_verification_codes')
    op.drop_index('idx_verification_code_session', table_name='email_verification_codes')
    op.drop_index('idx_verification_code_user', table_name='email_verification_codes')
    op.drop_table('email_verification_codes')
