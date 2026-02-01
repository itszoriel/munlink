"""add announcement sharing across municipalities

Revision ID: 20260117_sharing
Revises: 7a529873d424
Create Date: 2026-01-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260117_sharing'
down_revision = '7a529873d424'
branch_labels = None
depends_on = None


def upgrade():
    # Add shared_with_municipalities column as JSON array
    with op.batch_alter_table('announcements', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('shared_with_municipalities',
                     sa.JSON(),
                     nullable=True)
        )

    # Add GIN index for PostgreSQL (must be outside batch_alter_table)
    # GIN indexes support JSON column queries efficiently
    try:
        op.create_index(
            'idx_announcement_sharing',
            'announcements',
            ['shared_with_municipalities'],
            postgresql_using='gin'
        )
    except Exception:
        # Skip index creation if not supported (SQLite)
        pass


def downgrade():
    with op.batch_alter_table('announcements', schema=None) as batch_op:
        try:
            batch_op.drop_index('idx_announcement_sharing')
        except Exception:
            pass
        batch_op.drop_column('shared_with_municipalities')
