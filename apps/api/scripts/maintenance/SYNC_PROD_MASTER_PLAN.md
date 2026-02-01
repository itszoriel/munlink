# MASTER PLAN: Sync PROD to Match DEV

**Date Created:** 2026-01-25
**Objective:** Sync PROD database schema to match DEV, clear all PROD data, and copy superadmin account.

---

## PRE-FLIGHT CHECKLIST

Before you start, ensure:

- [ ] You have access to Supabase PROD dashboard
- [ ] You have `.env` file configured (will be updated for each step)
- [ ] You understand this will DELETE all PROD data except locations
- [ ] You have reviewed the database comparison report

---

## EXECUTION ORDER (STRICT - DO NOT SKIP STEPS)

### PHASE 1: SAFETY & VERIFICATION (5-10 minutes)

#### Step 1.1: Verify PROD Backup Exists

```bash
python apps/api/scripts/maintenance/verify_prod_backup.py
```

**Expected Output:** Confirmation prompt
**Action:** Verify backup in Supabase dashboard, then type `yes`

**CRITICAL:** If no backup exists:
1. Go to https://xzkhavrjfaxsqxyptbgm.supabase.co
2. Settings > Database > Backups
3. Click "Create Backup"
4. Wait for completion, then proceed

---

#### Step 1.2: Check Migration Status

```bash
python apps/api/scripts/maintenance/check_migration_status.py
```

**Expected Output:**
- List of migrations in DEV vs PROD
- Critical migrations that are missing in PROD

**What You'll See:**
- `20260118_superadmin_2fa_audit` - Missing in PROD
- `20260118_sa_security` - Missing in PROD
- `20260119_add_user_permissions` - Missing in PROD
- `20260117_sharing` - Missing in PROD
- `20260120_document_locality` - Missing in PROD
- `20260306_scoped_announcements` - Missing in PROD

---

#### Step 1.3: Compare Database Schemas

```bash
python apps/api/scripts/maintenance/compare_databases.py
```

**Expected Output:**
- 4 new tables in DEV
- Column differences in 3 tables
- Index and FK differences

**Review Output:** Ensure this matches what you expect

---

### PHASE 2: APPLY MIGRATIONS TO PROD (10-15 minutes)

#### Step 2.1: Update .env to Point to PROD

**CRITICAL:** Edit `.env` file and set:

```env
DATABASE_URL=postgresql://postgres.xzkhavrjfaxsqxyptbgm:rufhDbKRzavxO0M9@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```

**Verify:**
```bash
# Check that DATABASE_URL is correct
type .env | findstr DATABASE_URL
```

Expected output should show PROD URL (xzkhavrjfaxsqxyptbgm)

---

#### Step 2.2: Run Flask DB Upgrade

```bash
cd apps/api
flask db upgrade
```

**Expected Output:**
- Alembic will apply migrations one by one
- You should see:
  - Creating table `admin_audit_logs`
  - Creating table `email_verification_codes`
  - Creating table `superadmin_sessions`
  - Creating table `superadmin_ip_allowlist`
  - Adding columns to `users` table
  - Adding columns to `announcements` table
  - Adding columns to `document_types` table
  - Creating indexes and foreign keys

**Duration:** 30-60 seconds

**If Error Occurs:**
- Read error message carefully
- Check if migration already partially applied
- DO NOT proceed to next step if this fails
- Contact developer for troubleshooting

---

#### Step 2.3: Verify Migrations Applied

```bash
python apps/api/scripts/maintenance/check_migration_status.py
```

**Expected Output:**
- "[OK] PROD is up to date with DEV migrations!"
- All critical migrations should show `[OK]` for both DEV and PROD

---

### PHASE 3: CLEAR PROD DATA (5 minutes)

**WARNING:** This will DELETE data. Ensure backup exists before proceeding.

#### Step 3.1: Clear Service Data (Dry Run First)

```bash
python apps/api/scripts/maintenance/clear_service_data.py --dry-run
```

**Expected Output:**
- Shows how many rows will be deleted from each table
- No actual deletion happens (dry run)

**Review:** Ensure counts look reasonable

---

#### Step 3.2: Clear Service Data (REAL)

```bash
python apps/api/scripts/maintenance/clear_service_data.py --confirm
```

**What This Deletes:**
- All document requests and types
- All issues and categories
- All benefit applications and programs
- All marketplace items and transactions
- All announcements

**What This KEEPS:**
- Users (all accounts)
- Provinces, municipalities, barangays
- Location reference data

**Expected Output:**
- "Deletion complete (rows removed)"
- "Users and location tables were left intact."

---

#### Step 3.3: Clear User Data (Dry Run First)

```bash
python apps/api/scripts/maintenance/clear_users.py --dry-run
```

**Expected Output:**
- Shows how many users and user-linked records will be deleted
- No actual deletion happens (dry run)

---

#### Step 3.4: Clear User Data (REAL)

```bash
python apps/api/scripts/maintenance/clear_users.py --confirm
```

**Interactive Prompt:**
- You'll need to type: `DELETE USERS`

**What This Deletes:**
- ALL users (residents, admins, superadmins)
- All user sessions, tokens, notifications
- All user-created content (announcements, requests, etc.)
- Audit logs

**What This KEEPS:**
- Provinces, municipalities, barangays
- Reference data (document types, issue categories, benefit programs)

**Expected Output:**
- "Deletion complete (rows removed)"
- "Location tables (provinces, municipalities, barangays) were not touched."

**Result:** PROD database is now CLEAN with only location/reference data

---

### PHASE 4: COPY SUPERADMIN FROM DEV (2 minutes)

#### Step 4.1: Copy Superadmin (Dry Run First)

```bash
python apps/api/scripts/maintenance/copy_superadmin_to_prod.py --dry-run
```

**Expected Output:**
- Shows superadmin details from DEV
- "[DRY RUN] Would copy superadmin but not executing."

**Review:**
- Verify email matches your expected superadmin
- Verify permissions include `["*"]` or similar

---

#### Step 4.2: Copy Superadmin (REAL)

```bash
python apps/api/scripts/maintenance/copy_superadmin_to_prod.py --confirm
```

**Interactive Prompt:**
- You'll need to type: `COPY SUPERADMIN`

**Expected Output:**
- "[OK] Superadmin created in PROD!"
- Shows user ID and email

**Result:** PROD now has a working superadmin account matching DEV

---

### PHASE 5: VALIDATION & SMOKE TESTS (5 minutes)

#### Step 5.1: Run Automated Validation

```bash
python apps/api/scripts/maintenance/validate_prod_sync.py
```

**Expected Output:**
- `[1] Checking critical tables...` - All should be `[OK]`
- `[2] Checking users table columns...` - All should be `[OK]`
- `[3] Checking announcements table columns...` - All should be `[OK]`
- `[4] Validating superadmin account...` - `[OK]`
- `[5] Validating location data...` - `[OK]`
- `[6] Checking user count...` - `[OK] Only superadmin exists (1 total user)`
- `[SUCCESS] All validation checks passed!`

**If ANY check fails:**
- DO NOT proceed
- Review error messages
- Fix issues before continuing

---

#### Step 5.2: Manual Login Test (Admin Portal)

1. Update `.env` to use PROD:
   ```env
   VITE_API_URL=https://xzkhavrjfaxsqxyptbgm.supabase.co
   ```

2. Start admin frontend:
   ```bash
   cd apps/admin
   npm run dev
   ```

3. Navigate to: `http://localhost:5174/superadmin/login`

4. Test login with superadmin credentials from DEV

5. Expected flow:
   - Enter email + password
   - Receive 2FA email
   - Enter 6-digit code
   - Successfully log in to SuperAdmin Panel

**If login fails:**
- Check email/password
- Verify 2FA email is sent (check SMTP/SendGrid logs)
- Check browser console for errors

---

#### Step 5.3: Test SuperAdmin Functions

In the SuperAdmin Panel, verify:

- [ ] Can view admin management page
- [ ] Can view audit logs (should be empty)
- [ ] Dashboard loads without errors
- [ ] No console errors in browser dev tools

---

### PHASE 6: CLEANUP (1 minute)

#### Step 6.1: Verify .env Settings

Ensure your `.env` is configured for your normal workflow:

```env
# For local development with PROD backend
DATABASE_URL=postgresql://postgres.xzkhavrjfaxsqxyptbgm:rufhDbKRzavxO0M9@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres

# OR for local development with DEV backend
DATABASE_URL=postgresql://postgres.lapooogulvdbhbvvycbe:wYpI9oteCratyw7C@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```

Update based on your workflow preference.

---

## ROLLBACK PLAN (IF SOMETHING GOES WRONG)

If any step fails and you need to restore:

### Option 1: Restore from Supabase Backup

1. Go to https://xzkhavrjfaxsqxyptbgm.supabase.co
2. Settings > Database > Backups
3. Select your backup from before the migration
4. Click "Restore"
5. Wait for restoration to complete

### Option 2: Point in Time Recovery (if PITR enabled)

1. Go to https://xzkhavrjfaxsqxyptbgm.supabase.co
2. Settings > Database > Point in Time Recovery
3. Select timestamp before you started (check your notes)
4. Initiate recovery

---

## POST-SYNC TASKS

After successful sync:

1. **Update Documentation:**
   - Note the sync date
   - Document superadmin credentials securely
   - Update team on PROD status

2. **Seed Reference Data (if needed):**
   ```bash
   # Point to PROD
   DATABASE_URL=postgresql://postgres.xzkhavrjfaxsqxyptbgm:rufhDbKRzavxO0M9@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres

   # Run seed script
   python apps/api/scripts/seed_data.py
   ```

3. **Create Additional Admins (if needed):**
   - Use SuperAdmin Panel to create municipal/barangay admins
   - They'll receive welcome emails with credentials

4. **Configure IP Allowlist (if required):**
   - If `require_ip_allowlist = true` for superadmin
   - Add your IP addresses via SuperAdmin Panel

---

## EXPECTED FINAL STATE

After completing all phases:

### Database Schema:
✅ PROD matches DEV exactly
✅ All 4 new tables created
✅ All new columns added
✅ All indexes and foreign keys created

### Data:
✅ All user data cleared (except superadmin)
✅ All service data cleared
✅ Location data intact (provinces, municipalities, barangays)
✅ Reference data intact
✅ 1 superadmin account exists

### Functionality:
✅ Superadmin can log in with 2FA
✅ SuperAdmin Panel accessible
✅ Audit logging enabled
✅ IP allowlist configured (if enabled)
✅ Email verification working

---

## TROUBLESHOOTING

### Migration fails with "relation already exists"
- Some migration already partially applied
- Check migration history: `flask db current`
- May need to manually mark migration as applied: `flask db stamp <revision>`

### Superadmin login fails
- Verify password hash was copied correctly
- Check 2FA email is being sent
- Verify email_verification_codes table exists
- Check superadmin_sessions table exists

### Validation fails on table checks
- Re-run migrations: `flask db upgrade`
- Check Supabase dashboard for table existence
- Verify DATABASE_URL is correct

### No location data after sync
- Run seed script: `python apps/api/scripts/seed_data.py`
- Verify provinces, municipalities, barangays tables have data

---

## CONTACT

If you encounter issues not covered here:
- Check error logs carefully
- Review migration files in `apps/api/migrations/versions/`
- Consult CLAUDE.md for codebase patterns
- Contact developer: Princhprays :>

---

**END OF MASTER PLAN**
