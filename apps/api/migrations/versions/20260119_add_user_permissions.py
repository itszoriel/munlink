"""add user permissions

Revision ID: 20260119_add_user_permissions
Revises: 20260118_sa_security
Create Date: 2026-01-19

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = '20260119_add_user_permissions'
down_revision = '20260118_sa_security'
branch_labels = None
depends_on = None


def upgrade():
    """Add permissions column to users table and grant default permissions."""
    # Add permissions JSON column
    op.add_column('users',
        sa.Column('permissions', sa.JSON(), nullable=True)
    )

    # Grant default permissions to existing admins
    connection = op.get_bind()

    # Grant permissions to municipal_admin, provincial_admin, barangay_admin
    connection.execute(text("""
        UPDATE users
        SET permissions = '["residents:approve", "residents:id_view"]'::json
        WHERE role IN ('municipal_admin', 'provincial_admin', 'barangay_admin')
    """))

    # Grant all permissions to superadmin
    connection.execute(text("""
        UPDATE users
        SET permissions = '["*"]'::json
        WHERE role = 'superadmin'
    """))


def downgrade():
    """Remove permissions column from users table."""
    op.drop_column('users', 'permissions')
