"""Update admin roles: rename lgu_super_admin to provincial_admin

Revision ID: 20260118_update_admin_roles
Revises: 20260118_superadmin_2fa_audit
Create Date: 2026-01-18

This migration updates the role system:
1. Renames 'lgu_super_admin' role to 'provincial_admin' (keeping superadmin separate)
2. Provincial admins can create province-wide announcements
3. Superadmin is platform-level only (creates all admin types, manages system)
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260118_update_admin_roles'
down_revision = '20260118_superadmin_2fa_audit'
branch_labels = None
depends_on = None


def upgrade():
    # Update any existing lgu_super_admin users to provincial_admin
    op.execute("""
        UPDATE users
        SET role = 'provincial_admin'
        WHERE role = 'lgu_super_admin'
    """)


def downgrade():
    # Revert provincial_admin back to lgu_super_admin
    op.execute("""
        UPDATE users
        SET role = 'lgu_super_admin'
        WHERE role = 'provincial_admin'
    """)
