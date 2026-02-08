"""Add special status system and enhanced document request fields.

Revision ID: special_status_docs_001
Revises: 20260201_public_viewable_announcements
Create Date: 2026-02-01

This migration adds:
1. user_special_statuses table for Student/PWD/Senior status tracking
2. fee_tiers and exemption_rules columns to document_types
3. Enhanced fields to document_requests for purpose, civil status, fees, and payments
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'special_status_docs_001'
down_revision = '20260201_public_viewable'
branch_labels = None
depends_on = None


def upgrade():
    # Create user_special_statuses table
    op.create_table(
        'user_special_statuses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('status_type', sa.String(20), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('id_number', sa.String(50), nullable=True),
        # Student-specific
        sa.Column('school_name', sa.String(200), nullable=True),
        sa.Column('student_id_path', sa.String(255), nullable=True),
        sa.Column('cor_path', sa.String(255), nullable=True),
        # PWD-specific
        sa.Column('pwd_id_path', sa.String(255), nullable=True),
        sa.Column('disability_type', sa.String(100), nullable=True),
        # Senior-specific
        sa.Column('senior_id_path', sa.String(255), nullable=True),
        # Approval tracking
        sa.Column('approved_by_id', sa.Integer(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        # Rejection/Revocation
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('revoked_reason', sa.Text(), nullable=True),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('revoked_by_id', sa.Integer(), nullable=True),
        # Timestamps
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['approved_by_id'], ['users.id']),
        sa.ForeignKeyConstraint(['revoked_by_id'], ['users.id']),
    )

    # Create indexes for user_special_statuses
    op.create_index('idx_special_status_user', 'user_special_statuses', ['user_id'])
    op.create_index('idx_special_status_type', 'user_special_statuses', ['status_type'])
    op.create_index('idx_special_status_status', 'user_special_statuses', ['status'])
    op.create_index('idx_special_status_expires', 'user_special_statuses', ['expires_at'])

    # Add fee_tiers and exemption_rules to document_types
    op.add_column('document_types', sa.Column('fee_tiers', sa.JSON(), nullable=True))
    op.add_column('document_types', sa.Column('exemption_rules', sa.JSON(), nullable=True))

    # Add enhanced fields to document_requests
    op.add_column('document_requests', sa.Column('purpose_type', sa.String(50), nullable=True))
    op.add_column('document_requests', sa.Column('purpose_other', sa.String(200), nullable=True))
    op.add_column('document_requests', sa.Column('civil_status', sa.String(30), nullable=True))
    op.add_column('document_requests', sa.Column('business_type', sa.String(50), nullable=True))

    # Add fee tracking to document_requests
    op.add_column('document_requests', sa.Column('original_fee', sa.Numeric(10, 2), nullable=True))
    op.add_column('document_requests', sa.Column('applied_exemption', sa.String(30), nullable=True))
    op.add_column('document_requests', sa.Column('final_fee', sa.Numeric(10, 2), nullable=True))

    # Add payment fields to document_requests
    op.add_column('document_requests', sa.Column('payment_status', sa.String(20), nullable=True))
    op.add_column('document_requests', sa.Column('payment_intent_id', sa.String(100), nullable=True))
    op.add_column('document_requests', sa.Column('paid_at', sa.DateTime(), nullable=True))


def downgrade():
    # Remove payment fields from document_requests
    op.drop_column('document_requests', 'paid_at')
    op.drop_column('document_requests', 'payment_intent_id')
    op.drop_column('document_requests', 'payment_status')

    # Remove fee tracking from document_requests
    op.drop_column('document_requests', 'final_fee')
    op.drop_column('document_requests', 'applied_exemption')
    op.drop_column('document_requests', 'original_fee')

    # Remove enhanced fields from document_requests
    op.drop_column('document_requests', 'business_type')
    op.drop_column('document_requests', 'civil_status')
    op.drop_column('document_requests', 'purpose_other')
    op.drop_column('document_requests', 'purpose_type')

    # Remove columns from document_types
    op.drop_column('document_types', 'exemption_rules')
    op.drop_column('document_types', 'fee_tiers')

    # Drop indexes for user_special_statuses
    op.drop_index('idx_special_status_expires', table_name='user_special_statuses')
    op.drop_index('idx_special_status_status', table_name='user_special_statuses')
    op.drop_index('idx_special_status_type', table_name='user_special_statuses')
    op.drop_index('idx_special_status_user', table_name='user_special_statuses')

    # Drop user_special_statuses table
    op.drop_table('user_special_statuses')
