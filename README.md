# MunLink Zambales (Region 3 Ready)

> Municipal digital governance platform built for Region 3 (Central Luzon), currently scoped to Zambales while keeping full Region 3 data ready for expansion.

## Overview
- Multi-tenant platform for municipal services (documents, marketplace, problem reporting, benefit programs).
- User-facing scope is Zambales only; Region 3 locations are seeded in the database for future rollout.
- Olongapo City is intentionally excluded from the Zambales scope; expansion just requires relaxing the scope guards and exposing additional provinces.

## Current Scope
- Province exposed to users: **Zambales** (IDs/slugs enforced in API and frontends).
- Data retained: full Region 3 locations in `data/locations` and seeded via API scripts for compatibility.
- Default assets and uploads live under `uploads/region3`; QR/document verification remains enabled.

## Technology Stack
- **Backend**: Flask 3, SQLAlchemy 2, JWT (access + refresh cookies), bcrypt, Flask-Limiter, SendGrid/SMTP, ReportLab (PDF generation); PostgreSQL 15+ via Supabase (both dev and prod).
- **Frontends**: React 19 + TypeScript + Vite + Tailwind; React Router; Zustand state with auth bootstrapping; shared UI in `packages/ui`.
- **Infra/Tooling**: Turborepo monorepo, npm workspaces, Docker/Docker Compose, env via `.env`, deployment templates for Render/Railway.

## Project Structure
```
apps/
  api/      Flask API (Zambales scope enforced in routes/utils)
  web/      Public site (resident experience)
  admin/    Admin dashboard (municipal staff)
packages/ui/ Shared component library
scripts/     Dev/startup helpers (see scripts/README.md)
docs/        Documentation and guides
  frontend-ui-guide/  Responsive design patterns and best practices
data/        Region 3 reference data (JSON/Excel)
public/      Logos, landmarks, templates
uploads/     Runtime file storage (gitignored)
```

## Quick Start (dev)
```bash
# Install root JS deps
npm install

# Backend setup
cd apps/api
python -m venv venv
./venv/Scripts/activate  # or source venv/bin/activate
pip install -r requirements.txt

# IMPORTANT: Set up .env file with required credentials
# Copy env.example.txt to .env and configure:
#   - DATABASE_URL (Supabase PostgreSQL connection)
#   - SECRET_KEY and JWT_SECRET_KEY (generate with: python -c "import secrets; print(secrets.token_hex(32))")
#   - SENDGRID_API_KEY and FROM_EMAIL (for production) OR SMTP_* vars (for development)
#   - ADMIN_SECRET_KEY (required for creating admin accounts)

# Seed data (Region 3 loaded; UI still Zambales-only)
flask db upgrade
python scripts/seed_data.py

# Frontends
cd ../web && npm install
cd ../admin && npm install

# Run everything from root
cd ../..
npm run dev
```

## Development Notes
- API CORS and URLs are driven by `.env` (see `env.example.txt`). CORS uses explicit origins (never wildcard) to support credentialed requests (`withCredentials: true`).
- Zambales-only filters live in `apps/api/utils/zambales_scope.py` and `apps/web/src/lib/locations.ts` / `apps/admin/src/lib/locations.ts`.
- Use `scripts/start_project.ps1` (Windows) to launch API + web with network helpers; archived one-off tools are in `scripts/archive/`.
- Run `flask db upgrade` to apply migrations including scoped announcements (`20260306_scoped_announcements`), cross-municipality sharing (`20260117_sharing`), notification outbox/mobile fields (`20260312_notifications`), and super admin 2FA/audit tables (`20260118_superadmin_2fa_audit`).
- **Auth Bootstrapping**: Frontend apps use `isAuthBootstrapped` flag to prevent race conditions when restoring authentication state from sessionStorage on page load. Components check this flag before fetching protected resources. Both web and admin apps use a `HAS_SESSION_KEY` flag to track if a user has ever logged in, preventing unnecessary token refresh attempts and 401 errors on fresh page loads. The admin app implements resilient bootstrap logic that:
  - Restores cached user from localStorage first for immediate UX
  - Attempts token refresh only if a session has existed before
  - Prevents logout redirects during the bootstrap phase
  - Falls back to cached user data if profile fetch fails (network issues, temporary backend unavailability)
  - Only clears authentication if truly no valid session exists
- **Frontend UI Guide**: See `docs/frontend-ui-guide/` for responsive design patterns, mobile FAB implementation, table-to-card conversion, and reusable component snippets.

## Super Admin Setup
- **First-time setup**: Run `python apps/api/scripts/create_superadmin.py` to create the super admin account (email + password). This is a one-time setup script.
- **Login flow**: Super admins use `/superadmin/login` which requires email/password authentication followed by email 2FA verification (6-digit code sent to email).
- **Dedicated portal**: SuperAdmin has a separate interface accessible at `/superadmin` with its own layout and navigation (Admin Management, Audit Log). SuperAdmins do not access regular admin pages (Dashboard, Residents, etc.).
- **Admin Management**: Create and manage admin accounts (municipal_admin, barangay_admin) with province/municipality/barangay filtering. Includes CSV export functionality.
- **Admin onboarding**: New admins receive a welcome email with a professional PDF document containing terms of service, privacy policy, and legal framework (Data Privacy Act RA 10173, Anti-Graft Act RA 3019, Revised Penal Code). The PDF outlines administrative responsibilities, code of conduct, data protection requirements, and consequences of violations. Email supports both SMTP (Gmail dev) and SendGrid (production) with PDF attachments.
- **Audit logging**: All super admin logins and admin actions are logged to the audit log, accessible via the "Audit Log" menu item (super admin only) at `/superadmin/audit`.
- **Rate limiting**: Super admin auth endpoints are rate-limited (5 login attempts per 15 minutes, 10 2FA verifications per 15 minutes, 3 code resends per hour).
- **Testing connection**: Run `.\scripts\test_backend_connection.ps1` to verify the backend is running and CORS is properly configured.

## Notifications

### Email Notifications
- **Providers**: SendGrid API (production, works on Render free tier) or SMTP (development with Gmail)
- **Configuration**: Set `SENDGRID_API_KEY` + `FROM_EMAIL` (production) or `SMTP_SERVER` + `SMTP_USERNAME` + `SMTP_PASSWORD` (development)
- **Attachments**: Supports PDF attachments (used for admin welcome emails with terms document)
- **Use cases**: Email verification, admin welcome, document status updates, announcement notifications

### SMS Notifications
- **Provider config**: `SMS_PROVIDER` (`philsms` | `console` | `disabled`), `PHILSMS_API_KEY` (required), `PHILSMS_SENDER_ID` (default: "PhilSMS"), optional `PHILSMS_BASE_URL`
- **Mobile numbers**: Optional for residents and admins; add during registration or in Profile page (PH numbers normalized server-side)
- **SMS capability**: Uses PhilSMS API v3; sends skipped when API key not configured or network errors occur
- **⚠️ Carrier limitation**: PhilSMS currently delivers to **Globe/TM/GOMO networks only**. Smart/TNT users will not receive SMS (verified via testing). Email notifications work for all users regardless of carrier.
- **Resident preferences**: Email ON by default, **SMS OFF by default** - users must enable SMS in Profile page. Both email and SMS require valid contact information.
- **Cross-municipality sharing**: When announcements are shared with other municipalities (via `shared_with_municipalities`), residents from ALL shared municipalities receive notifications.

### Notification Worker
- **Queue system**: Notification outbox queues announcement publishes (province/municipality/barangay), benefit program creation, document request submissions, and document status changes
- **Worker process**: Run as long-running process (`python scripts/notification_worker.py`) or single batch (`--once`)
- **Deployment**: Deploy as Render/Railway worker using the same command with retry/backoff logic
- **Setup guide**: See `SMS_NOTIFICATION_GUIDE.md` for comprehensive setup, testing, and troubleshooting steps

## ID/Selfie Security & Privacy

### Permission-Based Access
- **Separate permissions**: Viewing ID/selfie images requires `residents:id_view` permission, distinct from `residents:approve`
- **Admin roles**: By default, all admin roles have both permissions. Superadmins can revoke `id_view` for specific admins if needed
- **Graceful degradation**: Admins without `id_view` can still approve/reject residents based on other verification criteria
- **Consistent enforcement**: All admin interfaces (UserVerificationList, Residents page) enforce the same privacy controls - no viewing without reason + audit logging

### Audit Logging
- Every ID/selfie view is logged to `admin_audit_logs` with:
  - Staff identity (name, email, role)
  - Municipality context
  - Document type (ID front/back, selfie)
  - Viewing reason (selected from predefined list)
  - Timestamp and IP address
- Audit logs accessible via SuperAdmin panel at `/superadmin/audit`
- Filter by action type `RESIDENT_ID_VIEWED` for privacy compliance reviews

### Watermarked Display
- ID/selfie images displayed with embedded watermarks showing:
  - Staff name and municipality
  - View timestamp
  - Resident ID
  - "CONFIDENTIAL" diagonal overlay
- Watermarks baked into canvas rendering (not CSS overlay)
- Prevents unauthorized screenshot redistribution

### Retention & Auto-Delete
- ID/selfie files automatically deleted after verification decision + grace period
- Configurable via `ID_RETENTION_DAYS` env var (default: 30 days)
- Cleanup runs via `python apps/api/scripts/cleanup_verification_images.py`
- Deploy as daily cron job (2am UTC recommended)
- Verification status and audit logs retained indefinitely
- Use `--dry-run` flag for testing: `python apps/api/scripts/cleanup_verification_images.py --dry-run`

### Location Filtering
- **Header Location Selector**: Municipality and Barangay dropdowns in the header allow users to filter content by location (available to all users including guests). Province is auto-selected to Zambales and hidden from the UI.
- **Filtered Sections**: Announcements and Problems pages support location-based filtering:
  - **Announcements**: Filters by province, municipality, and barangay. Province-wide announcements are always visible to all users (including guests). Municipality and barangay announcements require verified residency.
  - **Problems**: Filters by province and municipality. Barangay-level filtering is planned for future development.
  - **Programs**: Filters by municipality only (programs are municipality-scoped, not barangay-scoped).
  - **Documents**: Shows public document types catalog (no location filtering); "My Requests" tab shows only the authenticated user's private requests (no location browsing for privacy).
- **Privacy Boundary**: Document requests are private and resident-scoped. Location selection does not enable browsing other residents' document requests.

## Announcements
- **Scoped audiences**: province-wide (Zambales), municipality, or barangay; Olongapo and non-Zambales locations remain excluded.
- **Cross-municipality sharing**: municipality and barangay announcements can be shared with other Zambales municipalities, allowing residents of shared municipalities to view them alongside their own local announcements.
- **Image uploads**: Announcements support multiple image uploads via FormData (multipart/form-data); images are stored in municipality-scoped directories and displayed in announcement feeds.
- **Resident feed**: relies on verified residency (province + their municipality + their barangay); guests only see province-wide posts; verified residents see their own municipality's announcements plus any shared with them.
- **Roles**: `superadmin` (platform-level, can create all announcement types); `provincial_admin` (province-wide announcements only); `municipal_admin` (municipality announcements only); `barangay_admin` (barangay announcements only).
- **Pinned announcements**: stay at the top of feeds (until `pinned_until` if set) and respect publish/expire windows.
- **Migrations**: Run `flask db upgrade` to apply announcements migrations including scoped announcements (`20260306_scoped_announcements`) and cross-municipality sharing (`20260117_add_announcement_sharing`) after pulling new changes.

## Deployment

### Railway (Recommended)
The project is configured for Railway deployment with three services:
- **API Service**: Flask backend (uses root `railway.toml`)
- **Web Service**: Public site (uses `apps/web/railway.toml`)
- **Admin Service**: Admin dashboard (uses `apps/admin/railway.toml`)

**Setup Steps:**
1. Create Railway project and connect GitHub repository
2. Create 3 services, each with root directory set to `.`
3. Set environment variables in Railway Dashboard for each service:

**API Service:**
- `FLASK_ENV=production`, `DEBUG=False`
- `SECRET_KEY`, `JWT_SECRET_KEY`, `ADMIN_SECRET_KEY` (generate with `python -c "import secrets; print(secrets.token_hex(32))"`)
- `DATABASE_URL` (Supabase connection string)
- `WEB_URL`, `ADMIN_URL`, `BASE_URL` (your Railway service URLs)
- `SENDGRID_API_KEY`, `FROM_EMAIL`
- `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY`

**Web Service:**
- `VITE_API_URL` (API service Railway URL)
- `VITE_APP_NAME=Serbisyo Zambaleano`

**Admin Service:**
- `VITE_API_URL` (API service Railway URL)
- `VITE_APP_NAME=Serbisyo Zambaleano Admin`
- `VITE_PUBLIC_SITE_URL` (Web service Railway URL)

### Docker
- Local development: `docker-compose up -d` for API + frontends

### Render (Legacy)
- Configuration backed up in `render.yaml.bak` for reference

## Database migrations
- Local/dev: `cd apps/api && FLASK_APP=app:create_app flask db upgrade` (or run `python scripts/run_migrations.py`).
- Railway prod: Migrations run automatically on startup (Gunicorn process handles database initialization).
- Both environments use `DATABASE_URL` set in the dashboard environment variables.
- Back up Supabase prod (or enable PITR) before shipping migration-heavy releases.

### Scheduled Jobs
- **ID Retention Cleanup**: Run `python apps/api/scripts/cleanup_verification_images.py` daily
  - **Configuration**: Set `ID_RETENTION_DAYS` env var (default: 30 days)
  - **Testing**: Use `--dry-run` flag to preview deletions without executing
  - **Render**: Add as cron job in `render.yaml` or via dashboard
  - **Railway**: Use cron plugin or external scheduler (GitHub Actions)
  - **Example cron**: `0 2 * * * cd /app && python apps/api/scripts/cleanup_verification_images.py`
  - **Manual run**: `cd apps/api && python scripts/cleanup_verification_images.py --dry-run`

## Features

### Residents
- **Document requests**: Request official documents with QR code verification and claim ticket generation
- **Marketplace**: Buy, sell, donate, or lend items with age-gated transactions; resident listings publish immediately (no admin pre-approval)
- **Problem reporting**: Report municipal issues with status tracking and admin triage
- **Benefit programs**: Apply for municipal benefit programs with eligibility checking
- **Announcements**: View province-wide, municipal, and barangay announcements with image support
- **Notifications**: Email and SMS notifications (configurable) for document status and announcements
- **Profile management**: Update personal information, notification preferences, and view verification status; mobile number entered during registration is automatically copied to both phone and mobile fields for convenience

### Admins (Municipal/Barangay)
- **Resident verification**: Review and approve/reject resident registrations with privacy-hardened ID viewing (watermarked display, audit logging, permission-based access). ID images are fetched server-side and returned as blob data to prevent CORS issues and avoid exposing storage URLs
- **Document processing**: Generate PDFs with QR codes, create claim tickets, validate QR codes at claim time
- **Marketplace moderation**: Monitor and moderate live marketplace listings (resident posts publish immediately)
- **Problem triage**: Review and categorize problem reports, update status and resolution
- **Benefit program management**: Create and manage municipal benefit programs with image uploads
- **Announcements**: Create scoped announcements (municipality or barangay) with multiple image uploads, pinning, publish/expire scheduling, and cross-municipality sharing
- **Reports and analytics**: View transaction history, resident statistics, and activity reports

### Provincial Admin
- **Province-wide announcements**: Create and manage announcements visible to all Zambales residents
- **Communications**: Broadcast important province-level information and updates

### Super Admin
- **Secure authentication**: Email/password login with email 2FA verification (6-digit code)
- **Admin account management**: Create and manage admin accounts (provincial_admin, municipal_admin, barangay_admin) with automatic welcome email and terms PDF
- **Audit log**: Comprehensive audit trail tracking all admin logins, actions, and sensitive data access with filtering, search, and CSV export
- **System oversight**: Platform-level access to all announcement types and administrative functions

## Security
- **Authentication**: JWT with access/refresh tokens, token blacklisting, refresh tokens in httpOnly cookies (optional CSRF protection)
- **Password security**: Bcrypt hashing with salt rounds; hybrid password verification supporting both bcrypt and Werkzeug formats
- **Rate limiting**: Auth routes protected with Flask-Limiter (5 login attempts per 15 minutes for super admin, 10 2FA verifications per 15 minutes)
- **Super admin protection**: Email/password + mandatory email 2FA verification; all admin actions logged to audit trail
- **ID/Selfie privacy**: Permission-based access (`residents:id_view`), watermarked display, audit logging of every view, automatic retention cleanup after configurable grace period
- **Geographic isolation**: Municipality isolation and Zambales-only enforcement via scope guards
- **Transaction safety**: Age gates for marketplace transactions, marketplace listing moderation
- **Data privacy compliance**: Philippine Data Privacy Act (RA 10173) compliance with audit trails and retention policies

## Support
For technical support, contact Princhprays :>.
