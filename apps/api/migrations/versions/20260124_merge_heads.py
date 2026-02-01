"""Merge multiple heads after parallel location and admin changes

Revision ID: 20260124_merge_heads
Revises: 20260119_add_user_permissions, 20260120_document_locality, 20260124_fix_san_antonio_slug
Create Date: 2026-01-24

This merge brings together:
- admin/security chain ending at 20260119_add_user_permissions
- document locality scope 20260120_document_locality
- San Antonio slug fix 20260124_fix_san_antonio_slug
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = '20260124_merge_heads'
down_revision = ('20260119_add_user_permissions', '20260120_document_locality', '20260124_fix_san_antonio_slug')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
