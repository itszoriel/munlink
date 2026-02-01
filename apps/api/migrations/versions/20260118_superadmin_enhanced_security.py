"""Add super admin enhanced security features

Revision ID: 20260118_sa_security
Revises: 20260118_update_admin_roles
Create Date: 2026-01-18

Adds:
- superadmin_sessions table for active session tracking
- ip_allowlist table for superadmin IP restrictions
- last_ip, last_user_agent on users table
- login_attempts tracking on users table
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260118_sa_security'
down_revision = '20260118_update_admin_roles'
branch_labels = None
depends_on = None


def upgrade():
    # SuperAdmin active sessions table
    op.create_table(
        'superadmin_sessions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('session_token', sa.String(length=255), nullable=False, unique=True),
        sa.Column('ip_address', sa.String(length=45), nullable=False),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('last_activity', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('revoked', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')),
    )
    op.create_index('idx_superadmin_session_token', 'superadmin_sessions', ['session_token'], unique=True)
    op.create_index('idx_superadmin_session_user', 'superadmin_sessions', ['user_id'])
    op.create_index('idx_superadmin_session_active', 'superadmin_sessions', ['expires_at', 'revoked'])

    # IP allowlist table for superadmins
    op.create_table(
        'superadmin_ip_allowlist',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('TRUE')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('idx_ip_allowlist_user', 'superadmin_ip_allowlist', ['user_id'])
    op.create_index('idx_ip_allowlist_ip', 'superadmin_ip_allowlist', ['ip_address'])

    # Add security tracking columns to users table
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('last_ip', sa.String(length=45), nullable=True))
        batch_op.add_column(sa.Column('last_user_agent', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('account_locked_until', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('require_ip_allowlist', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')))


def downgrade():
    # Remove security tracking columns from users
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('require_ip_allowlist')
        batch_op.drop_column('account_locked_until')
        batch_op.drop_column('failed_login_attempts')
        batch_op.drop_column('last_user_agent')
        batch_op.drop_column('last_ip')

    # Drop IP allowlist table
    op.drop_index('idx_ip_allowlist_ip', table_name='superadmin_ip_allowlist')
    op.drop_index('idx_ip_allowlist_user', table_name='superadmin_ip_allowlist')
    op.drop_table('superadmin_ip_allowlist')

    # Drop superadmin sessions table
    op.drop_index('idx_superadmin_session_active', table_name='superadmin_sessions')
    op.drop_index('idx_superadmin_session_user', table_name='superadmin_sessions')
    op.drop_index('idx_superadmin_session_token', table_name='superadmin_sessions')
    op.drop_table('superadmin_sessions')
