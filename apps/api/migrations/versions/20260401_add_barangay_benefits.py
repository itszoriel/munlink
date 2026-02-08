"""add barangay_id to benefit_programs

Revision ID: 20260401_barangay_benefits
Revises: 20260312_notifications
Create Date: 2026-04-01

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = '20260401_barangay_benefits'
down_revision = '20260312_notifications'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_cols = {c['name'] for c in inspector.get_columns('benefit_programs')}
    existing_fks = {fk.get('name') for fk in inspector.get_foreign_keys('benefit_programs')}

    with op.batch_alter_table('benefit_programs', schema=None) as batch_op:
        if 'barangay_id' not in existing_cols:
            batch_op.add_column(sa.Column('barangay_id', sa.Integer(), nullable=True))
        if 'fk_benefit_programs_barangay' not in existing_fks:
            # Use batch_op to create FK if supported, else op
            batch_op.create_foreign_key('fk_benefit_programs_barangay', 'barangays', ['barangay_id'], ['id'])


def downgrade():
    with op.batch_alter_table('benefit_programs', schema=None) as batch_op:
        batch_op.drop_constraint('fk_benefit_programs_barangay', type_='foreignkey')
        batch_op.drop_column('barangay_id')
