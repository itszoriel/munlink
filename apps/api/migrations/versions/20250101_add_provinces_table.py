"""add provinces table and update municipalities

Revision ID: 20250101_add_provinces
Revises: 20251029_add_audit_logs
Create Date: 2025-01-01
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250101_add_provinces'
down_revision = '7e00b3f22e71'  # Revises the latest migration (external_url to announcements)
branch_labels = None
depends_on = None


def upgrade():
    # Check if provinces table already exists (from db.create_all())
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    tables = inspector.get_table_names()
    
    # Create provinces table if it doesn't exist
    if 'provinces' not in tables:
        op.create_table(
            'provinces',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('slug', sa.String(length=100), nullable=False),
        sa.Column('psgc_code', sa.String(length=20), nullable=False),
        sa.Column('region_code', sa.String(length=10), nullable=False, server_default='03'),
        sa.Column('region_name', sa.String(length=100), nullable=False, server_default='Central Luzon'),
        sa.Column('contact_email', sa.String(length=120), nullable=True),
        sa.Column('contact_phone', sa.String(length=15), nullable=True),
        sa.Column('address', sa.String(length=200), nullable=True),
        sa.Column('logo_url', sa.String(length=255), nullable=True),
        sa.Column('seal_url', sa.String(length=255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('population', sa.Integer(), nullable=True),
        sa.Column('land_area', sa.Float(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='1'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_provinces_slug', 'provinces', ['slug'], unique=True)
        op.create_index('ix_provinces_psgc_code', 'provinces', ['psgc_code'], unique=True)
        op.create_index('ix_provinces_name', 'provinces', ['name'], unique=True)
    
    # Create default Zambales province for existing data (if it doesn't exist)
    from sqlalchemy import text
    result = conn.execute(text("SELECT COUNT(*) as cnt FROM provinces WHERE slug = 'zambales'"))
    row = result.fetchone()
    count = row[0] if row else 0
    if count == 0:
        conn.execute(text("""
            INSERT INTO provinces (name, slug, psgc_code, region_code, region_name, description, is_active, created_at, updated_at)
            VALUES ('Zambales', 'zambales', '037100000', '03', 'Central Luzon', 'Province in Region 3 (Central Luzon)', 1, datetime('now'), datetime('now'))
        """))
        conn.commit()
    
    # Check if province_id column exists in municipalities table
    municipalities_columns = [col['name'] for col in inspector.get_columns('municipalities')]
    
    # Add province_id column to municipalities table if it doesn't exist
    if 'province_id' not in municipalities_columns:
        op.add_column('municipalities', sa.Column('province_id', sa.Integer(), nullable=True))
    
    # Assign existing municipalities to Zambales province (id=1)
    # Note: SQLite doesn't support ALTER COLUMN to change nullable, so we'll keep it nullable
    # but ensure all existing records have a province_id
    conn.execute(text("""
        UPDATE municipalities 
        SET province_id = (SELECT id FROM provinces WHERE slug = 'zambales' LIMIT 1)
        WHERE province_id IS NULL
    """))
    conn.commit()
    
    # Create foreign key constraint (if it doesn't exist)
    # SQLite has limited FK support, so we'll create it if possible
    try:
        op.create_foreign_key(
            'fk_municipalities_province_id',
            'municipalities', 'provinces',
            ['province_id'], ['id']
        )
    except Exception:
        # Foreign key might already exist or SQLite might not support it
        pass
    
    # Create index on province_id for better query performance (if it doesn't exist)
    try:
        op.create_index('ix_municipalities_province_id', 'municipalities', ['province_id'])
    except Exception:
        # Index might already exist
        pass


def downgrade():
    # Drop index and foreign key
    op.drop_index('ix_municipalities_province_id', table_name='municipalities')
    op.drop_constraint('fk_municipalities_province_id', 'municipalities', type_='foreignkey')
    
    # Remove province_id column
    op.drop_column('municipalities', 'province_id')
    
    # Drop provinces table
    op.drop_index('ix_provinces_name', table_name='provinces')
    op.drop_index('ix_provinces_psgc_code', table_name='provinces')
    op.drop_index('ix_provinces_slug', table_name='provinces')
    op.drop_table('provinces')

