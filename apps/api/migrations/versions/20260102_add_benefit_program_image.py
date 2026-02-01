"""add image_path to benefit_programs

Revision ID: 20260102_bp_img
Revises: 20250101_add_provinces
Create Date: 2026-01-02

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260102_bp_img'
down_revision = '20250101_add_provinces'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('benefit_programs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('image_path', sa.String(length=255), nullable=True))


def downgrade():
    with op.batch_alter_table('benefit_programs', schema=None) as batch_op:
        batch_op.drop_column('image_path')


