"""add public_viewable flag to announcements

Revision ID: 20260201_public_viewable
Revises: 20260401_barangay_benefits
Create Date: 2026-02-01
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260201_public_viewable'
down_revision = '20260401_barangay_benefits'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('announcements', schema=None) as batch_op:
        batch_op.add_column(sa.Column('public_viewable', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')))
        batch_op.create_index('idx_announcement_public_viewable', ['public_viewable'])

    # Drop the server default after backfill so future inserts rely on ORM defaults
    try:
        with op.batch_alter_table('announcements', schema=None) as batch_op:
            batch_op.alter_column('public_viewable', server_default=None)
    except Exception:
        # SQLite batch_alter may not support altering server_default; safe to ignore
        pass


def downgrade():
    try:
        with op.batch_alter_table('announcements', schema=None) as batch_op:
            batch_op.drop_index('idx_announcement_public_viewable')
            batch_op.drop_column('public_viewable')
    except Exception:
        pass
