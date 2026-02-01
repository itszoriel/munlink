# CLAUDE.md - MunLink Agent Operating Manual

**READ THIS FIRST before making ANY changes to the MunLink codebase.**

This is the strict operating manual for AI coding agents working on the MunLink monorepo. Violating these rules will result in messy, inconsistent, or broken changes.

---

## Project Overview

**MunLink Zambales** is a municipal digital governance platform built as a Turborepo monorepo:

### Repository Structure
```
apps/
  api/          Flask 3 + SQLAlchemy 2 backend (JWT auth, rate limiting, SMTP/SendGrid)
  web/          React 19 + TypeScript public site (resident experience)
  admin/        React 19 + TypeScript admin dashboard (municipal staff)
packages/
  ui/           Shared React component library
scripts/        PowerShell dev/startup helpers (use these, don't invent new commands)
data/           Region 3 reference data (JSON/Excel for compatibility)
public/         Static assets (logos, landmarks, templates)
uploads/        Runtime file storage (gitignored)
```

### Tech Stack
- **Backend**: Flask 3, SQLAlchemy 2, JWT (access + httpOnly refresh cookies), bcrypt, Flask-Limiter, ReportLab (PDF generation); PostgreSQL via Supabase (both dev and prod - DATABASE_URL required in .env)
- **Email**: SendGrid API (production) or SMTP (development with Gmail); supports PDF attachments
- **Frontend**: React 19, TypeScript, Vite, Tailwind, React Router, Zustand (with auth bootstrapping), Axios (with token refresh interceptor)
- **Tooling**: Turborepo, npm workspaces, Docker/Docker Compose

### Key Workflows

1. **Resident Workflow** (`apps/web`):
   - Register/login → select municipality/barangay
   - Request documents → receive QR code → claim at office
   - Use marketplace (buy/sell/donate/lend items)
   - Report problems → track status
   - Apply for benefit programs

2. **Admin Workflow** (`apps/admin`):
   - Login as municipal staff (roles: `superadmin`, `provincial_admin`, `municipal_admin`, `barangay_admin`)
   - Verify residents → approve/reject registrations with privacy-hardened ID review (watermarked images, audit logging)
   - Process document requests → generate PDFs + claim tickets with QR codes
   - Validate QR codes/tickets at claim time
   - Moderate marketplace listings
   - Triage problem reports
   - Manage benefit programs with image uploads
   - Create scoped announcements with multiple image uploads, pinning, publish/expire scheduling, and cross-municipality sharing
   - View reports/transactions and audit logs

3. **Super Admin Workflow** (`apps/admin` at `/superadmin`):
   - Login with email/password + email 2FA verification (6-digit code)
   - Create and manage admin accounts (provincial_admin, municipal_admin, barangay_admin)
   - New admins receive welcome email with professional PDF document containing terms of service, privacy policy, and legal framework (RA 10173, RA 3019, Revised Penal Code)
   - View comprehensive audit log tracking all admin actions and ID/selfie views
   - Export audit logs to CSV for compliance reviews

4. **Document Verification** (public):
   - Route: `GET /verify/<request_number>` (see `apps/api/app.py`)
   - Public page to verify QR codes on documents

---

## NON-NEGOTIABLE GUARDRAILS

### 1. Zambales-Only Scope (CRITICAL)
**The platform exposes ONLY Zambales province to users. Olongapo City is EXPLICITLY EXCLUDED.**

- **Province ID**: 6 (Zambales)
- **Excluded Municipality ID**: 130 (Olongapo City)
- **Valid Municipalities**: 13 Zambales municipalities only (IDs 108-120, excluding 130)

#### Enforcement Locations (DO NOT bypass these):
- **Backend**: `apps/api/utils/zambales_scope.py`
  - All API routes MUST use filters from this module
  - Never expose Region 3 data via API responses
  - Use `validate_municipality_in_zambales()` for incoming data
  - Use `apply_zambales_municipality_filter()` for queries

- **Frontend Web**: `apps/web/src/lib/locations.ts`
  - PROVINCES array contains only Zambales
  - getMunicipalities() returns only Zambales municipalities
  - isValidZambalesMunicipality() enforces exclusions

- **Frontend Admin**: `apps/admin/src/lib/locations.ts`
  - Same constraints as web app
  - Admin cannot select non-Zambales locations

#### What You CAN'T Do:
- Expose Region 3 provinces (Aurora, Bataan, Bulacan, Nueva Ecija, Pampanga, Tarlac) to users
- Allow Olongapo City in dropdowns, filters, or API responses
- Bypass zambales_scope.py filters in new API routes
- Add "all provinces" or "Region 3" options to UI

#### What You CAN Do:
- Keep Region 3 data in database/files (it's there for compatibility)
- Reference Region 3 in internal scripts (just don't expose it)
- Do not use emoji and use plain text when creating script
   Example:
       '✅': '[OK]',
       '❌': '[FAIL]',
       '⚠️': '[WARN]',
- Expand scope in the future by relaxing these guards (with approval)

### 2. Database Context
- Region 3 location data EXISTS in the database for future expansion
- Scripts may load full Region 3 data (see `scripts/seed_data.py`)
- APIs/UIs MUST filter to Zambales before returning data to users

### 3. Critical Implementation Details

#### User Model Fields
- **Resident fields**: `municipality_id`, `barangay_id` (where user lives)
- **Admin fields**: `admin_municipality_id`, `admin_barangay_id` (where admin works)
- **CRITICAL**: Always use `user.admin_barangay_id` for admin barangay assignment, NOT `user.barangay_id`
- See `apps/api/models/user.py` for the complete User model

#### Auth Bootstrapping (Frontend)
- **Problem**: Page refresh causes race condition - components try to fetch data before auth tokens are restored from sessionStorage
- **Solution**: Zustand store has `isAuthBootstrapped` flag
- **Usage**: Components MUST check `isAuthBootstrapped` before fetching protected resources
- **Example**: `useCachedFetch(..., { enabled: shouldFetch && isAuthBootstrapped })`
- See `apps/web/src/lib/store.ts` and `apps/web/src/pages/AnnouncementsPage.tsx` for implementation

#### FormData Handling (API)
- **Image uploads**: Announcements and benefit programs support multiple image uploads
- **Content-Type**: Must handle both JSON and `multipart/form-data`
- **Pattern**: Check `request.content_type` for 'multipart/form-data', then use `request.form.to_dict()` + `request.files.getlist('images')`
- **Boolean conversion**: FormData sends strings ('true', 'false') - convert to Python booleans
- See `apps/api/routes/admin.py` announcement endpoints for implementation

#### Email System
- **Providers**: SendGrid API (production) or SMTP (development)
- **Auto-selection**: If `SENDGRID_API_KEY` exists, use SendGrid; else use SMTP
- **PDF Attachments**: Both providers support PDF attachments (base64 for SendGrid, MIME for SMTP)
- **Usage**: `send_admin_welcome_email()` sends welcome email with terms PDF to new admins
- See `apps/api/utils/email_sender.py` and `apps/api/utils/pdf_generator.py`

#### Password Verification
- **Hybrid system**: Supports both bcrypt and Werkzeug hash formats for backward compatibility
- **Helper**: Use `verify_password(stored_hash, password)` from `apps/api/utils/auth.py`
- **Never**: Use `check_password_hash()` directly - always use the helper

#### Admin Roles and Scoping
- **superadmin**: Platform-level access, can create all announcement types, manage all admins
- **provincial_admin**: Province-wide announcements only (Zambales)
- **municipal_admin**: Municipality-specific announcements and services
- **barangay_admin**: Barangay-level announcements only
- **Field naming**: Use `admin_barangay_id` for admin assignments, not `barangay_id`

---

## Repo Hygiene Rules (STRICT)

### Where New Code Belongs
**Always add code to the correct location. DO NOT create random files.**

| Type | Location | Examples |
|------|----------|----------|
| API routes | `apps/api/routes/*.py` | `auth.py`, `admin.py`, `announcements.py`, `superadmin.py` |
| API models | `apps/api/models/*.py` | `user.py`, `announcement.py`, `admin_audit_log.py` |
| API utilities | `apps/api/utils/*.py` | `zambales_scope.py`, `email_sender.py`, `pdf_generator.py`, `auth.py` |
| Web pages | `apps/web/src/pages/*.tsx` | `HomePage.tsx`, `AnnouncementsPage.tsx` |
| Web components | `apps/web/src/components/*.tsx` | `Navbar.tsx`, `Footer.tsx`, `BarangaySelect.tsx` |
| Admin pages | `apps/admin/src/pages/*.tsx` | `SuperAdminLoginPage.tsx`, `SuperAdminPanel.tsx` |
| Admin components | `apps/admin/src/components/*.tsx` | `UserVerificationList.tsx`, `WatermarkedImageViewer.tsx` |
| Shared UI | `packages/ui/src/*.tsx` | `Button.tsx`, `Card.tsx` |
| Dev scripts | `scripts/*.ps1` or `apps/api/scripts/*.py` | `start_project.ps1`, `create_superadmin.py` |

### File Discipline
1. **Prefer editing existing files** over creating new ones
2. **Never create files in repo root** unless they're config/docs (like this file)
3. **Never commit**:
   - Build artifacts (`dist/`, `build/`, `.next/`)
   - Dependencies (`node_modules/`, `venv/`, `__pycache__/`)
   - IDE files (`.vscode/`, `.idea/`, `*.swp`)
   - Environment files (`.env`, `.env.local`)
   - Runtime uploads (`uploads/`)
   - OS junk (`.DS_Store`, `Thumbs.db`)
4. **Use existing patterns**:
   - Look at similar files before creating new ones
   - Match naming conventions (kebab-case for files, PascalCase for components)
   - Follow existing import patterns

---

## Important Code Patterns

### API Route Pattern: Staff Context
When creating admin-only API routes, use the `_get_staff_context()` pattern:

```python
def _get_staff_context():
    """Return the current admin user and scoped identifiers."""
    user = get_jwt_identity()
    # ... validation ...
    return {
        'user': user,
        'role': user.role,
        'municipality_id': user.admin_municipality_id,  # Use admin_ prefix!
        'barangay_id': user.admin_barangay_id,  # Use admin_ prefix!
    }

@admin_bp.route('/some-endpoint', methods=['POST'])
@jwt_required()
def some_endpoint():
    ctx = _get_staff_context()
    if not ctx:
        return jsonify({'error': 'Admin access required'}), 403
    # Use ctx['municipality_id'], ctx['barangay_id'], etc.
```

### API Route Pattern: FormData + JSON Support
For endpoints that accept image uploads, support both FormData and JSON:

```python
@admin_bp.route('/endpoint', methods=['POST'])
@jwt_required()
def endpoint():
    # Handle both JSON and FormData
    is_multipart = request.content_type and 'multipart/form-data' in request.content_type
    if is_multipart:
        data = request.form.to_dict()
        # Convert string booleans
        if 'some_bool' in data:
            data['some_bool'] = data['some_bool'].lower() in ('true', '1', 'yes')
    else:
        data = request.get_json() or {}

    # Handle file uploads if present
    if is_multipart and 'images' in request.files:
        image_files = request.files.getlist('images')
        # Process images...
```

### Frontend Pattern: Auth Bootstrapping Check
Components that fetch protected data MUST wait for auth bootstrap:

```typescript
export default function SomePage() {
  const isAuthBootstrapped = useAppStore((s) => s.isAuthBootstrapped)
  const user = useAppStore((s) => s.user)

  const { data, loading } = useCachedFetch(
    CACHE_KEYS.SOME_DATA,
    () => someApi.fetch(),
    {
      dependencies: [user?.id],
      enabled: isAuthBootstrapped  // CRITICAL: Wait for auth
    }
  )
```

### Frontend Pattern: Location Filtering
Always use location helpers from `locations.ts`:

```typescript
import { isValidZambalesMunicipality, ZAMBALES_MUNICIPALITY_IDS } from '@/lib/locations'

// Validate municipality is in Zambales
if (!isValidZambalesMunicipality(municipalityId)) {
  return // Invalid
}

// Filter to Zambales municipalities only
const validMunicipalities = allMunicipalities.filter(m =>
  ZAMBALES_MUNICIPALITY_IDS.includes(m.id)
)
```

---

## One-Time Script Policy (CRITICAL)

**If you create a temporary script, YOU MUST delete it before finishing.**

### What Counts as Temporary:
- Debug/test scripts (e.g., `test_api.py`, `debug_barangays.py`)
- One-off migrations (e.g., `fix_user_ids.py`, `update_timestamps.py`)
- Exploratory scripts (e.g., `check_database.py`, `inspect_*.py`)
- Scratch notebooks or analysis files

### What You CAN Keep:
- **Maintained utilities** in `scripts/` with clear purpose and documentation
- **Reusable API scripts** in `apps/api/scripts/` that are part of the workflow (e.g., `seed_data.py`, `init_db.py`)
- **Documentation** (if explicitly requested by user)

### Process:
1. Create temp script in appropriate location (e.g., `apps/api/scripts/temp_fix.py`)
2. Run it, verify results
3. **DELETE the script** before your final response
4. Document what you did in commit message or response to user

### Example - WRONG:
```
✗ Create scripts/test_municipality_filter.py
✗ Run it to verify Zambales scope
✗ Leave it in the repo  ← NO!
```

### Example - CORRECT:
```
✓ Create apps/api/scripts/verify_zambales_scope.py
✓ Run it to test filtering logic
✓ Delete apps/api/scripts/verify_zambales_scope.py
✓ Tell user: "Verified Zambales scope is working correctly"
```

---

## README Update Rule (MANDATORY)

**For EVERY new feature or meaningful change, you MUST update the root `README.md`.**

### What Requires README Updates:
1. **New API routes/endpoints** → Add to Features section or API documentation
2. **New web/admin features** → Add to Features section with description
3. **New dependencies** → Update Tech Stack or note in Quick Start
4. **Deployment changes** → Update Deployment section
5. **Environment variable changes** → Note in Development Notes or Quick Start
6. **Workflow changes** → Update relevant workflow description
7. **Behavior modifications** → Update affected feature descriptions

### What Doesn't Require README Updates:
- Bug fixes (unless they change behavior significantly)
- Internal refactoring (no user-visible changes)
- Style/formatting changes
- Dependency version bumps (minor)

### How to Update:
1. Locate the relevant section in `README.md`
2. Add/modify description concisely (2-3 sentences max)
3. Keep formatting consistent with existing content
4. If adding a major feature, consider adding a new subsection

### Example Updates:

**New Feature - SMS Notifications:**
```markdown
## Features
- Residents: document requests with QR verification, marketplace, problem reporting,
  benefit program applications, SMS notifications for document status, dashboards and profiles.
```

**New API Endpoint:**
```markdown
## Development Notes
- API CORS and URLs are driven by `.env` (see `env.example.txt`).
- Document status notifications sent via SMS (configure `TWILIO_*` env vars).
```

**This rule also appears in the "Before Finishing" checklist below.**

---

## Development Commands (DO NOT INVENT)

**Use commands from existing scripts. DO NOT make up commands.**

### From `package.json`:
```bash
npm install              # Install root + workspace dependencies
npm run dev              # Run all apps in dev mode (uses Turbo)
npm run build            # Build all apps
npm run lint             # Lint all apps
npm run clean            # Clean build artifacts
```

### From `scripts/` (Windows PowerShell):
```powershell
.\scripts\start_project.ps1   # Start API + web with network helpers
.\scripts\start_servers.ps1   # Alternative startup script
```

### Backend Setup (from `README.md`):
```bash
cd apps/api
python -m venv venv
.\venv\Scripts\activate       # Windows
source venv/bin/activate      # macOS/Linux
pip install -r requirements.txt
flask db upgrade
python scripts/seed_data.py
```

### If You Need a New Script:
1. Check if existing script can be modified
2. Place it in `scripts/` (PowerShell) or `apps/api/scripts/` (Python)
3. Add clear header documentation
4. Add to this CLAUDE.md or README if it's meant to be reused
5. **DELETE if it's one-time** (see One-Time Script Policy above)

---

## Checklists for Agents

### Before Coding
- [ ] Read root `README.md` to understand project structure
- [ ] Read this `CLAUDE.md` file completely
- [ ] Identify where new code belongs (see "Where New Code Belongs")
- [ ] Check `apps/api/utils/zambales_scope.py` if working with location data
- [ ] Review existing similar files for patterns
- [ ] Verify you won't leak Region 3 data or expose Olongapo

### During Changes
- [ ] Use Zambales scope filters in all new API routes
- [ ] Import from `zambales_scope.py` for location filtering
- [ ] Test that Olongapo (ID 130) is excluded
- [ ] Use `admin_barangay_id` and `admin_municipality_id` for admin fields (NOT `barangay_id` or `municipality_id`)
- [ ] For endpoints with image uploads, support both JSON and FormData
- [ ] For frontend data fetching, check `isAuthBootstrapped` before fetching
- [ ] Use `verify_password()` helper for password verification
- [ ] Add audit logging for sensitive operations (ID viewing, admin actions)
- [ ] Match existing code style and conventions
- [ ] Avoid creating unnecessary files
- [ ] Don't add features not requested by user
- [ ] Keep solutions simple (no over-engineering)

### Before Finishing (MANDATORY)
- [ ] **Update root `README.md`** if you added/modified features (see README Update Rule)
- [ ] Delete any temporary scripts you created
- [ ] Verify Zambales-only scope is intact (if you touched location logic)
- [ ] Check git status - ensure no build artifacts, `node_modules/`, `.env`, or junk committed
- [ ] Remove any debug code or console.logs
- [ ] Test that your changes work in context
- [ ] Verify you didn't break existing functionality

---

## Security Checklist

- [ ] Never commit secrets, API keys, or credentials
- [ ] Use environment variables for sensitive config (see `env.example.txt`)
- [ ] Validate user input (especially municipality IDs against zambales_scope)
- [ ] Don't expose internal errors to users (log them instead)
- [ ] Use parameterized queries (SQLAlchemy ORM handles this)
- [ ] Verify JWT tokens and check user roles/permissions
- [ ] Sanitize file uploads (check types, sizes, scan content)
- [ ] Rate limit sensitive endpoints (auth, uploads, submissions)
- [ ] Use `verify_password()` helper for password checking (supports bcrypt + Werkzeug)
- [ ] For ID/selfie viewing, ensure permission checks (`residents:id_view`) and audit logging
- [ ] Watermark sensitive images (ID/selfie) before displaying to admins
- [ ] Use `admin_barangay_id` and `admin_municipality_id` for admin scope checks
- [ ] Validate admin roles before allowing scoped operations (announcements, resident access)
- [ ] Log all sensitive operations to `admin_audit_logs` table
- [ ] For super admin auth, require both password + 2FA email verification

---

## Common Mistakes to AVOID

1. **Creating scripts without cleanup**
   - ✗ Leave `test_*.py` or `debug_*.py` files
   - ✓ Delete temporary scripts before finishing

2. **Bypassing Zambales scope**
   - ✗ Query all municipalities without filtering
   - ✓ Use `apply_zambales_municipality_filter()`

3. **Exposing Olongapo**
   - ✗ Return municipality ID 130 in API responses
   - ✓ Filter using `ZAMBALES_MUNICIPALITY_IDS`

4. **Inventing commands**
   - ✗ Tell user to run `npm start api` (doesn't exist)
   - ✓ Reference actual scripts: `npm run dev` or `.\scripts\start_project.ps1`

5. **File sprawl**
   - ✗ Create new component when existing one can be edited
   - ✓ Edit existing files whenever possible

6. **Committing build artifacts**
   - ✗ Add `dist/`, `node_modules/`, `venv/` to git
   - ✓ Check `.gitignore` and keep it clean

7. **Skipping README updates**
   - ✗ Add new feature without documenting it
   - ✓ Update root README.md for every meaningful change

8. **Over-engineering**
   - ✗ Add abstraction layers, feature flags, complex config for simple changes
   - ✓ Make minimal changes that solve the immediate problem

9. **Wrong admin field names**
   - ✗ Use `user.barangay_id` for admin's assigned barangay
   - ✓ Use `user.admin_barangay_id` for admin assignments

10. **Forgetting auth bootstrap check**
   - ✗ Fetch data immediately on component mount
   - ✓ Wait for `isAuthBootstrapped` flag before fetching

11. **Missing FormData support**
   - ✗ Only accept JSON on endpoints that need image uploads
   - ✓ Support both JSON and FormData with proper boolean conversion

12. **Not handling PDF generation errors**
   - ✗ Let PDF generation errors break email sending
   - ✓ Catch PDF errors and send email without attachment if generation fails

---

## When in Doubt

1. **Check existing code first** - look at similar files for patterns
2. **Read `zambales_scope.py`** - if working with locations
3. **Read `README.md`** - for project structure and commands
4. **Ask the user** - if requirements are unclear
5. **Keep it simple** - minimal changes, avoid abstraction
6. **Clean up after yourself** - delete temp files, update docs

---

## Scope Expansion (Future)

When MunLink expands beyond Zambales:

1. Relax filters in `zambales_scope.py`
2. Update frontend `locations.ts` files to expose more provinces
3. Add province selector to registration/settings
4. Update branding (PLATFORM_FULL_NAME, PLATFORM_REGION_NAME)
5. Test that Region 3 data flows correctly (it's already in DB)

**DO NOT do this proactively. It requires explicit approval.**

---

## Final Reminder

**This file (`CLAUDE.md`) is the source of truth for how to work on MunLink cleanly and correctly. If you're unsure about anything, re-read the relevant section. If you violate these rules, you WILL create technical debt and frustrate the maintainers.**

Keep the codebase clean. Keep it Zambales-only. Keep it simple. Document your changes. Delete your temp files. Update the README.

---

## Quick Reference: Key Files

### Backend Core
- `apps/api/app.py` - Flask app setup, CORS, routes registration
- `apps/api/config.py` - Configuration from environment variables
- `apps/api/models/user.py` - User model with admin/resident fields
- `apps/api/models/announcement.py` - Announcement model with scoping
- `apps/api/models/admin_audit_log.py` - Audit log for admin actions

### Backend Routes
- `apps/api/routes/auth.py` - Authentication (login, register, token refresh)
- `apps/api/routes/admin.py` - Admin operations (residents, documents, announcements, programs)
- `apps/api/routes/superadmin.py` - Super admin operations (admin management, 2FA, audit logs)
- `apps/api/routes/announcements.py` - Public announcement viewing

### Backend Utils
- `apps/api/utils/zambales_scope.py` - **CRITICAL**: Zambales-only filtering
- `apps/api/utils/email_sender.py` - Email sending (SendGrid/SMTP with PDF attachments)
- `apps/api/utils/pdf_generator.py` - PDF generation (claim tickets, admin terms)
- `apps/api/utils/auth.py` - Password verification helper
- `apps/api/utils/admin_audit.py` - Audit logging helper

### Frontend Web (Residents)
- `apps/web/src/lib/store.ts` - Zustand store with auth bootstrapping
- `apps/web/src/lib/api.ts` - Axios setup with token refresh interceptor
- `apps/web/src/lib/locations.ts` - **CRITICAL**: Zambales-only location filtering
- `apps/web/src/pages/AnnouncementsPage.tsx` - Example of auth bootstrap usage

### Frontend Admin
- `apps/admin/src/lib/store.ts` - Admin Zustand store
- `apps/admin/src/lib/locations.ts` - **CRITICAL**: Zambales-only location filtering
- `apps/admin/src/pages/SuperAdminLoginPage.tsx` - Super admin login with 2FA
- `apps/admin/src/pages/SuperAdminPanel.tsx` - Admin management interface
- `apps/admin/src/components/WatermarkedImageViewer.tsx` - Secure ID/selfie viewer

### Scripts
- `apps/api/scripts/create_superadmin.py` - Create first super admin account
- `apps/api/scripts/cleanup_verification_images.py` - ID/selfie retention cleanup
- `apps/api/scripts/notification_worker.py` - Background notification processor
- `scripts/start_project.ps1` - Windows dev startup script

### Configuration
- `env.example.txt` - **START HERE**: Environment variable template
- `README.md` - Project documentation (keep updated!)
- `CLAUDE.md` - **THIS FILE**: Agent operating manual

---

*For technical support, contact Princhprays :>*