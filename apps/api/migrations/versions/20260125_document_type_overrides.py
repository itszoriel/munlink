"""Document type overrides per municipality and barangay

Revision ID: 20260125_document_type_overrides
Revises: 20260125_relationship_integrity
Create Date: 2026-01-25
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260125_document_type_overrides'
down_revision = '20260125_relationship_integrity'
branch_labels = None
depends_on = None


def upgrade():
    # Base document types: fee policy (avoid hardcoding "free by law"; allow "varies_by_ordinance")
    with op.batch_alter_table('document_types', schema=None) as batch_op:
        try:
            batch_op.add_column(
                sa.Column(
                    'fee_policy',
                    sa.String(length=30),
                    nullable=False,
                    server_default='varies_by_ordinance',
                )
            )
        except Exception:
            pass

    # Municipality-level overrides
    op.create_table(
        'municipality_document_type_overrides',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('document_type_id', sa.Integer(), nullable=False),
        sa.Column('municipality_id', sa.Integer(), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('fee_policy', sa.String(length=30), nullable=True),
        sa.Column('fee', sa.Numeric(10, 2), nullable=True),
        sa.Column('requirements_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['document_type_id'], ['document_types.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['municipality_id'], ['municipalities.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('document_type_id', 'municipality_id', name='uq_muni_doc_type_override'),
    )
    try:
        op.create_index(
            'idx_muni_doc_type_override_muni',
            'municipality_document_type_overrides',
            ['municipality_id'],
        )
    except Exception:
        pass
    try:
        op.create_index(
            'idx_muni_doc_type_override_doc',
            'municipality_document_type_overrides',
            ['document_type_id'],
        )
    except Exception:
        pass

    # Barangay-level overrides
    op.create_table(
        'barangay_document_type_overrides',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('document_type_id', sa.Integer(), nullable=False),
        sa.Column('barangay_id', sa.Integer(), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('fee_policy', sa.String(length=30), nullable=True),
        sa.Column('fee', sa.Numeric(10, 2), nullable=True),
        sa.Column('requirements_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['document_type_id'], ['document_types.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['barangay_id'], ['barangays.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('document_type_id', 'barangay_id', name='uq_brgy_doc_type_override'),
    )
    try:
        op.create_index(
            'idx_brgy_doc_type_override_brgy',
            'barangay_document_type_overrides',
            ['barangay_id'],
        )
    except Exception:
        pass
    try:
        op.create_index(
            'idx_brgy_doc_type_override_doc',
            'barangay_document_type_overrides',
            ['document_type_id'],
        )
    except Exception:
        pass


def downgrade():
    # Drop override tables first (depend on document_types)
    try:
        op.drop_index('idx_brgy_doc_type_override_doc', table_name='barangay_document_type_overrides')
    except Exception:
        pass
    try:
        op.drop_index('idx_brgy_doc_type_override_brgy', table_name='barangay_document_type_overrides')
    except Exception:
        pass
    try:
        op.drop_table('barangay_document_type_overrides')
    except Exception:
        pass

    try:
        op.drop_index('idx_muni_doc_type_override_doc', table_name='municipality_document_type_overrides')
    except Exception:
        pass
    try:
        op.drop_index('idx_muni_doc_type_override_muni', table_name='municipality_document_type_overrides')
    except Exception:
        pass
    try:
        op.drop_table('municipality_document_type_overrides')
    except Exception:
        pass

    with op.batch_alter_table('document_types', schema=None) as batch_op:
        try:
            batch_op.drop_column('fee_policy')
        except Exception:
            pass
