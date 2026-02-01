"""add scoped announcements with pinning

Revision ID: 20260306_scoped_announcements
Revises: 20260102_bp_img
Create Date: 2026-03-06
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260306_scoped_announcements'
down_revision = '20260102_bp_img'
branch_labels = None
depends_on = None


def upgrade():
    # Add scoped columns and indexes
    with op.batch_alter_table('announcements', schema=None) as batch_op:
        batch_op.add_column(sa.Column('scope', sa.String(length=20), nullable=False, server_default='MUNICIPALITY'))
        batch_op.alter_column('municipality_id', existing_type=sa.Integer(), nullable=True)
        batch_op.add_column(sa.Column('barangay_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('pinned', sa.Boolean(), nullable=False, server_default=sa.text('FALSE')))
        batch_op.add_column(sa.Column('pinned_until', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('status', sa.String(length=20), nullable=False, server_default='DRAFT'))
        batch_op.add_column(sa.Column('publish_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('expire_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('created_by_staff_id', sa.Integer(), nullable=True))
        batch_op.create_index('idx_announcement_scope', ['scope'])
        batch_op.create_index('idx_announcement_barangay', ['barangay_id'])
        batch_op.create_index('idx_announcement_status', ['status'])
        batch_op.create_index('idx_announcement_pinned', ['pinned'])
        batch_op.create_index('idx_announcement_publish', ['publish_at'])

    # Create foreign keys (best-effort for SQLite compatibility)
    try:
        op.create_foreign_key('fk_announcements_barangay', 'announcements', 'barangays', ['barangay_id'], ['id'])
    except Exception:
        pass
    try:
        op.create_foreign_key('fk_announcements_created_by_staff', 'announcements', 'users', ['created_by_staff_id'], ['id'])
    except Exception:
        pass

    # Backfill existing records
    conn = op.get_bind()
    meta = sa.MetaData()
    announcements = sa.Table('announcements', meta, autoload_with=conn)
    publish_expr = sa.case((announcements.c.is_active == True, announcements.c.created_at), else_=None)
    conn.execute(
        announcements.update().values(
            scope='MUNICIPALITY',
            status=sa.case((announcements.c.is_active == True, 'PUBLISHED'), else_='DRAFT'),
            publish_at=publish_expr,
            created_by_staff_id=announcements.c.created_by
        )
    )

    # Drop server defaults after data migration
    with op.batch_alter_table('announcements', schema=None) as batch_op:
        batch_op.alter_column('scope', server_default=None)
        batch_op.alter_column('status', server_default=None)
        batch_op.alter_column('pinned', server_default=None)


def downgrade():
    try:
        op.drop_constraint('fk_announcements_barangay', 'announcements', type_='foreignkey')
    except Exception:
        pass
    try:
        op.drop_constraint('fk_announcements_created_by_staff', 'announcements', type_='foreignkey')
    except Exception:
        pass
    # Remove indexes and columns in reverse order
    with op.batch_alter_table('announcements', schema=None) as batch_op:
        batch_op.drop_index('idx_announcement_publish')
        batch_op.drop_index('idx_announcement_pinned')
        batch_op.drop_index('idx_announcement_status')
        batch_op.drop_index('idx_announcement_barangay')
        batch_op.drop_index('idx_announcement_scope')
        batch_op.drop_column('created_by_staff_id')
        batch_op.drop_column('expire_at')
        batch_op.drop_column('publish_at')
        batch_op.drop_column('status')
        batch_op.drop_column('pinned_until')
        batch_op.drop_column('pinned')
        batch_op.drop_column('barangay_id')
        batch_op.alter_column('municipality_id', existing_type=sa.Integer(), nullable=False)
        batch_op.drop_column('scope')
