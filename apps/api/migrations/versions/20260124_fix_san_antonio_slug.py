"""Align San Antonio slug with frontend constant

Revision ID: 20260124_fix_san_antonio_slug
Revises: 20260312_notifications
Create Date: 2026-01-24

This migration renames the municipality slug from 'san-antonio' to
'san-antonio-zambales' to match the frontend/admin location constants.
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '20260124_fix_san_antonio_slug'
down_revision = '20260312_notifications'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        UPDATE municipalities
        SET slug = 'san-antonio-zambales'
        WHERE slug = 'san-antonio' AND province_id = 6
        """
    )


def downgrade():
    op.execute(
        """
        UPDATE municipalities
        SET slug = 'san-antonio'
        WHERE slug = 'san-antonio-zambales' AND province_id = 6
        """
    )
