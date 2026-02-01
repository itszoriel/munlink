"""Add locality scoping to document_types

Revision ID: 20260120_document_locality
Revises: 20260117_sharing
Create Date: 2026-01-20

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260120_document_locality'
down_revision = '20260117_sharing'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('document_types', schema=None) as batch_op:
        batch_op.add_column(sa.Column('municipality_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('barangay_id', sa.Integer(), nullable=True))

    # Add indexes separately to avoid SQLite limitations inside batch
    try:
        op.create_index('idx_document_type_municipality', 'document_types', ['municipality_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_document_type_barangay', 'document_types', ['barangay_id'])
    except Exception:
        pass
    try:
        op.create_index('idx_document_type_authority_level', 'document_types', ['authority_level'])
    except Exception:
        pass

    # Add foreign key constraints (skipped on SQLite)
    try:
        op.create_foreign_key(
            'fk_document_types_municipality',
            source_table='document_types',
            referent_table='municipalities',
            local_cols=['municipality_id'],
            remote_cols=['id'],
            ondelete='SET NULL'
        )
    except Exception:
        pass
    try:
        op.create_foreign_key(
            'fk_document_types_barangay',
            source_table='document_types',
            referent_table='barangays',
            local_cols=['barangay_id'],
            remote_cols=['id'],
            ondelete='SET NULL'
        )
    except Exception:
        pass


def downgrade():
    # Drop foreign keys first
    try:
        op.drop_constraint('fk_document_types_municipality', 'document_types', type_='foreignkey')
    except Exception:
        pass
    try:
        op.drop_constraint('fk_document_types_barangay', 'document_types', type_='foreignkey')
    except Exception:
        pass

    # Drop indexes
    for idx in ('idx_document_type_authority_level', 'idx_document_type_barangay', 'idx_document_type_municipality'):
        try:
            op.drop_index(idx, table_name='document_types')
        except Exception:
            pass

    with op.batch_alter_table('document_types', schema=None) as batch_op:
        batch_op.drop_column('municipality_id')
        batch_op.drop_column('barangay_id')
