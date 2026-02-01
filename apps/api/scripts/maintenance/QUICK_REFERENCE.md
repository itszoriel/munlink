# QUICK REFERENCE: PROD Sync Commands

## STEP-BY-STEP COMMANDS (Copy & Paste)

### 1. Verify Backup
```bash
python apps/api/scripts/maintenance/verify_prod_backup.py
```

### 2. Check Migration Status
```bash
python apps/api/scripts/maintenance/check_migration_status.py
```

### 3. Compare Schemas
```bash
python apps/api/scripts/maintenance/compare_databases.py
```

### 4. Update .env to PROD
Edit `.env` and set:
```
DATABASE_URL=postgresql://postgres.xzkhavrjfaxsqxyptbgm:rufhDbKRzavxO0M9@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```

### 5. Apply Migrations
```bash
cd apps/api
flask db upgrade
```

### 6. Clear Service Data
```bash
# Dry run first
python apps/api/scripts/maintenance/clear_service_data.py --dry-run

# Real execution
python apps/api/scripts/maintenance/clear_service_data.py --confirm
```

### 7. Clear Users
```bash
# Dry run first
python apps/api/scripts/maintenance/clear_users.py --dry-run

# Real execution (type DELETE USERS when prompted)
python apps/api/scripts/maintenance/clear_users.py --confirm
```

### 8. Copy Superadmin
```bash
# Dry run first
python apps/api/scripts/maintenance/copy_superadmin_to_prod.py --dry-run

# Real execution (type COPY SUPERADMIN when prompted)
python apps/api/scripts/maintenance/copy_superadmin_to_prod.py --confirm
```

### 9. Validate
```bash
python apps/api/scripts/maintenance/validate_prod_sync.py
```

---

## Critical Database URLs

### DEV
```
postgresql://postgres.lapooogulvdbhbvvycbe:wYpI9oteCratyw7C@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```

### PROD
```
postgresql://postgres.xzkhavrjfaxsqxyptbgm:rufhDbKRzavxO0M9@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```

---

## Rollback Commands

If something goes wrong, restore from Supabase dashboard:
1. Go to: https://xzkhavrjfaxsqxyptbgm.supabase.co
2. Settings > Database > Backups
3. Click "Restore" on your pre-sync backup

---

## Time Estimates

- Backup verification: 2 minutes
- Checking status: 3 minutes
- Applying migrations: 2 minutes
- Clearing data: 5 minutes
- Copying superadmin: 2 minutes
- Validation: 3 minutes
- Manual testing: 5 minutes

**Total: ~20-25 minutes**
