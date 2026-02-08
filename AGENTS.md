# AGENTS.md - MunLink Zambales (Region 3 Data-Ready)

This is the handoff guide for AI agents working in this repo. It reflects the current codebase layout and behavior.

## Project Snapshot
- Monorepo using Turborepo + npm workspaces.
- Apps:
  - `apps/api`: Flask 3 + SQLAlchemy 2 API.
  - `apps/web`: Resident/public React app.
  - `apps/admin`: Admin/superadmin React app.
  - `packages/ui`: Shared UI components.
- User-facing scope is **Zambales only**.
- Region 3 data is still seeded internally for compatibility and future rollout.

## Read First
- `CLAUDE.md` (repo operating manual and guardrails).
- `README.md` (setup and feature overview).
- `PERMISSIONS_MATRIX.md` (role/scope matrix).
- `design-system.md` and `docs/frontend-ui-guide/` (frontend patterns).

## Non-Negotiable Constraints
- **Zambales-only scope is mandatory.**
  - Province ID: `6`.
  - Olongapo City is excluded: municipality ID `130`, slug `city-of-olongapo`.
- Do not expose non-Zambales provinces/municipalities in API or UI.
- Scope guards must remain enforced:
  - Backend: `apps/api/utils/zambales_scope.py`
  - Web: `apps/web/src/lib/locations.ts`
  - Admin: `apps/admin/src/lib/locations.ts`
- Admin scoping must use admin fields:
  - `admin_municipality_id`
  - `admin_barangay_id`
  - Do not use resident location fields for admin authorization scope.
- Frontend auth bootstrapping is required before protected fetches:
  - Gate on `isAuthBootstrapped`.
  - Keep session flag logic (`HAS_SESSION_KEY`) in API layers.
- Upload-capable endpoints should handle JSON and `multipart/form-data` where relevant.
- Sensitive admin actions must be auditable:
  - `apps/api/utils/admin_audit.py`
  - `apps/api/utils/audit.py`
- Never commit: `.env`, `venv/`, `node_modules/`, `dist/`, runtime uploads.

## Repo Map
- `apps/api/`: Flask API, models, migrations, scripts, utilities.
- `apps/web/`: Resident/public frontend.
- `apps/admin/`: Admin frontend (municipal, barangay, provincial, superadmin flows).
- `packages/ui/`: Shared UI components + Tailwind preset.
- `scripts/`: Root Windows helper scripts.
- `data/`: Region 3 reference data.
- `public/`: Static assets, including payment assets.
- `uploads/`: Runtime file storage (gitignored).

## Backend Architecture (`apps/api`)
- App entry/factory: `apps/api/app.py`
  - Registers all blueprints, CORS, security headers, health checks, `/verify/<request_number>`.
- Config: `apps/api/config.py`
  - Env-driven config, DB URL normalization, Supabase/Postgres tuning, SQLite fallback for health startup.
  - JWT cookie configuration and payment/env toggles.
- Blueprints:
  - `auth.py`
  - `admin.py`
  - `superadmin.py`
  - `provinces.py`, `municipalities.py`
  - `announcements.py`, `documents.py`, `issues.py`, `benefits.py`, `marketplace.py`
  - `special_status.py`, `stripe_webhook.py`
- Key models include:
  - `User`, `Province`, `Municipality`, `Barangay`
  - `Announcement`, `DocumentType`, `DocumentRequest`
  - `Issue`, `BenefitProgram`, `BenefitApplication`
  - `Transaction`, `TransferRequest`
  - `UserSpecialStatus`, `PasswordResetToken`, `AdminAuditLog`, `NotificationOutbox`

## Frontend Architecture
### Web (`apps/web`)
- Routing: `apps/web/src/App.tsx`
  - Includes public pages, resident protected pages, `forgot-password`, `reset-password`, and `/verify/:requestNumber`.
- Auth/API layer: `apps/web/src/lib/api.ts`
- Store/bootstrap: `apps/web/src/lib/store.ts`
- Static location scope: `apps/web/src/lib/locations.ts`

### Admin (`apps/admin`)
- Routing: `apps/admin/src/App.tsx`
  - Role selector + routes for municipal/barangay/provincial/superadmin, plus password reset pages.
- Auth/API layer: `apps/admin/src/lib/api.ts`
- Store/bootstrap: `apps/admin/src/lib/store.ts`
- Static location scope: `apps/admin/src/lib/locations.ts`

### Shared UI
- `packages/ui/src/`
- `packages/ui/tailwind.preset.cjs`

## Current Core Features (Code-Backed)
- Announcements:
  - Scope-aware (`PROVINCE`, `MUNICIPALITY`, `BARANGAY`).
  - Cross-municipality sharing via `shared_with_municipalities`.
  - Guest visibility control via `public_viewable`.
- Documents:
  - Request lifecycle + claim/verification.
  - Fee calculation (`apps/api/utils/fee_calculator.py`).
  - Payment flows: Stripe + manual QR + office verification code handling.
- Special status module:
  - Resident apply/renew for student, PWD, senior.
  - Admin approve/reject/revoke endpoints.
- Superadmin:
  - Email/password + email 2FA flow.
  - Audit log endpoints and export.
- Privacy/auditing:
  - Sensitive resident ID document viewing is permissioned and audited.

## Storage and Uploads
- Central handler: `apps/api/utils/storage_handler.py`
- Supabase helpers: `apps/api/utils/supabase_storage.py`
- Local dev uploads default to `uploads/region3`.
- Manual payment proofs use private storage/bucket configuration.

## Notifications
- Email: SendGrid or SMTP (`apps/api/utils/email_sender.py`).
- SMS: PhilSMS integration (`apps/api/utils/sms_provider.py`).
- Outbox queue worker: `apps/api/scripts/notification_worker.py`.

## Environment
- Start from `env.example.txt`.
- Required in production:
  - `DATABASE_URL`
  - `SECRET_KEY`
  - `JWT_SECRET_KEY`
  - `ADMIN_SECRET_KEY`
- Common optional integrations:
  - `SENDGRID_API_KEY`, `FROM_EMAIL`, `SMTP_*`
  - `PHILSMS_*`, `SMS_PROVIDER`
  - `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY`
  - `STRIPE_*`, `MANUAL_QR_*`

## Core Commands (Do Not Invent)
From root `package.json`:
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run clean`
- `npm run setup`
- `npm run setup:all`

From `scripts/`:
- `./scripts/start_project.ps1`
- `./scripts/start_project.bat`
- `./scripts/start_servers.ps1`
- `./scripts/run_project.bat`
- `./scripts/check_status.ps1`

Backend setup (from repo docs):
- `cd apps/api`
- `python -m venv venv`
- `./venv/Scripts/activate`
- `pip install -r requirements.txt`
- `flask db upgrade`
- `python scripts/seed_data.py`

## Operational Scripts (`apps/api/scripts`)
- `create_superadmin.py` - create initial superadmin account.
- `cleanup_verification_images.py` - verification image retention cleanup.
- `notification_worker.py` - send queued notifications.
- `run_migrations.py` - helper for migration execution.
- `seed_data.py` - seed Region 3 location/reference data.

## Tests
- Backend tests: `apps/api/tests/`
- Root runner: `npm run test`

## Deployment
- Railway is primary:
  - `railway.toml`
  - `apps/api/railway.toml`
  - `apps/web/railway.toml`
  - `apps/admin/railway.toml`
- Docker is supported (`docker-compose.yml`, `Dockerfile.*`).
- Render config is legacy (`render.yaml.bak`).

## Agent Working Rules (Condensed)
- Follow existing patterns and file placement.
- Prefer editing existing files over adding new files.
- Remove one-off temporary scripts before finishing.
- Update `README.md` for user-visible behavior changes.
- Preserve Zambales-only constraints unless explicitly asked to expand scope.

## Useful Deep-Dive Docs
- `PROJECT_ASSESSMENT.md`
- `PROJECT_ERROR_CHECKLIST.md`
- `PRODUCTION_READINESS_REPORT.md`
- `SMS_NOTIFICATION_GUIDE.md`
- `SMS_FINAL_VERIFICATION.md`
- `DUAL_PAYMENT_VERIFICATION_REPORT.md`
- `RAILWAY_DEPLOYMENT.md`
