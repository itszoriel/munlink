# PROJECT_ERROR_CHECKLIST.md
# MunLink Zambales - Comprehensive QA & Verification Checklist

**Version:** 1.0.0
**Last Updated:** 2026-01-20
**Platform:** MunLink Zambales (Region 3 Ready)

---

## Table of Contents

1. [How to Use This Checklist](#0-how-to-use-this-checklist)
2. [Preflight Health Checks](#1-preflight-health-checks)
3. [Automated Quality Gates](#2-automated-quality-gates)
4. [System Map Derived from Code](#3-system-map-derived-from-code)
5. [Role & Permission Matrix](#4-role--permission-matrix)
6. [Zambales-Only + Olongapo Exclusion](#5-zambales-only--olongapo-exclusion)
7. [Authentication & Session Lifecycle](#6-authentication--session-lifecycle)
8. [Resident Web E2E Functional Checks](#7-resident-web-e2e-functional-checks)
9. [Admin App E2E Checks](#8-admin-app-e2e-checks)
10. [SuperAdmin Portal Checks](#9-superadmin-portal-checks)
11. [API Contract & Integration Checks](#10-api-contract--integration-checks)
12. [Jobs, Schedulers & Scripts](#11-jobs-schedulers--scripts)
13. [Security, Privacy & Compliance](#12-security-privacy--compliance)
14. [Performance & UX Reliability](#13-performance--ux-reliability)
15. [Release & Deployment Smoke Checklist](#14-release--deployment-smoke-checklist)

---

## 0. How to Use This Checklist

### Execution Order

1. **Preflight** (Section 1) - Run before any testing session
2. **Automated Gates** (Section 2) - Must all pass before proceeding
3. **Scope Guards** (Section 5) - Zambales-only and Olongapo exclusion first
4. **Auth Lifecycle** (Section 6) - Authentication must work before E2E tests
5. **E2E Flows** (Sections 7-9) - Resident, Admin, SuperAdmin in order
6. **Integration** (Section 10) - API contracts after UI tests confirm flows
7. **Jobs & Scripts** (Section 11) - Background processes
8. **Security** (Section 12) - Privacy and compliance regression
9. **Performance** (Section 13) - Smoke tests for UX
10. **Deployment** (Section 14) - Only for release validation

### Environment Prerequisites

- **Database**: PostgreSQL via Supabase (verify `DATABASE_URL` in `.env`)
- **Node.js**: v20.x with npm >= 9.0.0
- **Python**: 3.11+ with venv activated for `apps/api`
- **Required `.env` variables**: See `env.example.txt` for full list
- **Seeded data**: `flask db upgrade && python scripts/seed_data.py`

### Stop-the-Line Issues

If any of these fail, **STOP testing** and fix immediately:

1. **ZAM-xxx tests fail** (Zambales scope breach)
2. **AUTH-xxx tests fail** (authentication broken)
3. **SEC-xxx tests fail** (security vulnerability detected)
4. **Olongapo City (ID 130) appears anywhere** in responses/UI

### Evidence Capture Standards

- **Screenshots**: Save as `evidence/{TEST_ID}_{timestamp}.png`
- **API Responses**: Save as `evidence/{TEST_ID}_{timestamp}.json`
- **Logs**: Include relevant log snippets in evidence
- **Grep outputs**: Full command and output in evidence file

---

## 1. Preflight Health Checks

### ENV-001: Environment Variables Present
**ID:** ENV-001
**Area:** Infrastructure
**Role(s):** All
**Type:** Automatable

**Preconditions:** Access to `.env` file

**Steps:**
1. Check `.env` exists in project root
2. Verify required variables are set (not placeholder values)

**Expected:**
- `DATABASE_URL` - Valid PostgreSQL connection string
- `SECRET_KEY` - 32+ character random value
- `JWT_SECRET_KEY` - 32+ character random value
- `ADMIN_SECRET_KEY` - Set for admin registration
- `WEB_URL` / `ADMIN_URL` / `BASE_URL` - Valid URLs

**Evidence to capture:** List of env vars (redacted values)
**Where in code:** `env.example.txt`, `apps/api/config.py`
**Failure signals:** App crashes on startup, "KeyError" in logs

---

### ENV-002: Database Connectivity
**ID:** ENV-002
**Area:** Infrastructure
**Role(s):** All
**Type:** Automatable

**Preconditions:** `.env` configured

**Steps:**
1. Run: `cd apps/api && python -c "from apps.api import db; print('DB OK')"`
2. Or start API and check health endpoint

**Expected:** "DB OK" or API health returns 200

**Evidence to capture:** Console output, health response
**Where in code:** `apps/api/__init__.py`, `apps/api/app.py:health`
**Failure signals:** `OperationalError`, connection refused

---

### ENV-003: Migrations Applied
**ID:** ENV-003
**Area:** Infrastructure
**Role(s):** All
**Type:** Automatable

**Preconditions:** Database accessible

**Steps:**
1. Run: `cd apps/api && flask db current`
2. Verify head matches latest migration

**Expected:** Shows latest migration (check `apps/api/migrations/versions/`)

**Evidence to capture:** Migration head output
**Where in code:** `apps/api/migrations/versions/`
**Failure signals:** "Target database is not up to date"

---

### ENV-004: Seed Data Present
**ID:** ENV-004
**Area:** Infrastructure
**Role(s):** All
**Type:** Automatable

**Preconditions:** Migrations applied

**Steps:**
1. Run: `cd apps/api && python scripts/inspect_database.py`
2. Or query: Check municipalities table has 13 Zambales municipalities

**Expected:**
- 13 Zambales municipalities (IDs 108-120, no 130)
- Issue categories populated
- Document types populated

**Evidence to capture:** Municipality count, sample IDs
**Where in code:** `apps/api/scripts/seed_data.py`
**Failure signals:** Empty tables, missing reference data

---

### ENV-005: Node Dependencies Installed
**ID:** ENV-005
**Area:** Infrastructure
**Role(s):** All
**Type:** Automatable

**Preconditions:** Node.js v20.x

**Steps:**
1. Run from root: `npm install`
2. Verify `node_modules` created in root and apps

**Expected:** No npm errors, all workspaces resolved

**Evidence to capture:** `npm ls --depth=0` output
**Where in code:** `package.json`, `apps/web/package.json`, `apps/admin/package.json`
**Failure signals:** peer dependency warnings, missing modules

---

### ENV-006: Python Dependencies Installed
**ID:** ENV-006
**Area:** Infrastructure
**Role(s):** All
**Type:** Automatable

**Preconditions:** Python 3.11+, venv activated

**Steps:**
1. Run: `cd apps/api && pip install -r requirements.txt`
2. Verify key packages: flask, sqlalchemy, flask-jwt-extended

**Expected:** All packages installed without errors

**Evidence to capture:** `pip freeze` output
**Where in code:** `apps/api/requirements.txt`
**Failure signals:** Import errors on startup

---

## 2. Automated Quality Gates

### LINT-001: TypeScript Lint (Web)
**ID:** LINT-001
**Area:** web
**Role(s):** N/A (CI)
**Type:** Automatable

**Preconditions:** Node modules installed

**Steps:**
1. Run from root: `npm run lint`
2. Or: `cd apps/web && npx eslint src`

**Expected:** Zero errors (warnings acceptable)

**Evidence to capture:** Lint output
**Where in code:** `apps/web/`, `package.json` scripts
**Failure signals:** ESLint error count > 0

---

### LINT-002: TypeScript Lint (Admin)
**ID:** LINT-002
**Area:** admin
**Role(s):** N/A (CI)
**Type:** Automatable

**Preconditions:** Node modules installed

**Steps:**
1. Run from root: `npm run lint`
2. Or: `cd apps/admin && npx eslint src`

**Expected:** Zero errors

**Evidence to capture:** Lint output
**Where in code:** `apps/admin/`
**Failure signals:** ESLint error count > 0

---

### BUILD-001: TypeScript Build (Web)
**ID:** BUILD-001
**Area:** web
**Role(s):** N/A (CI)
**Type:** Automatable

**Preconditions:** Lint passes

**Steps:**
1. Run: `cd apps/web && npm run build`
2. Verify `dist/` folder created

**Expected:** Build completes with no TypeScript errors

**Evidence to capture:** Build output, dist folder exists
**Where in code:** `apps/web/vite.config.ts`
**Failure signals:** TS2xxx errors, "Build failed"

---

### BUILD-002: TypeScript Build (Admin)
**ID:** BUILD-002
**Area:** admin
**Role(s):** N/A (CI)
**Type:** Automatable

**Preconditions:** Lint passes

**Steps:**
1. Run: `cd apps/admin && npm run build`
2. Verify `dist/` folder created

**Expected:** Build completes with no TypeScript errors

**Evidence to capture:** Build output
**Where in code:** `apps/admin/vite.config.ts`
**Failure signals:** TS2xxx errors

---

### BUILD-003: Full Turborepo Build
**ID:** BUILD-003
**Area:** All
**Role(s):** N/A (CI)
**Type:** Automatable

**Preconditions:** All lint passes

**Steps:**
1. Run from root: `npm run build`

**Expected:** All apps build successfully

**Evidence to capture:** Turbo build summary
**Where in code:** `turbo.json`, `package.json`
**Failure signals:** Any task exit code non-zero

---

### TEST-001: Python API Tests (if exist)
**ID:** TEST-001
**Area:** api
**Role(s):** N/A (CI)
**Type:** Automatable

**Preconditions:** Python venv, test data

**Steps:**
1. Run: `cd apps/api && python -m pytest tests/ -v` (if tests exist)
2. Check `apps/api/tests/` for test files

**Expected:** All tests pass

**Evidence to capture:** pytest output
**Where in code:** `apps/api/tests/`
**Failure signals:** AssertionError, failed tests

**TODO:** Verify test runner is configured. Check `apps/api/tests/` for pytest.ini or setup.cfg.

---

## 3. System Map Derived from Code

### 3.1 Application Structure

| App | Path | Tech | Port (Dev) | Purpose |
|-----|------|------|------------|---------|
| API | `apps/api/` | Flask 3, SQLAlchemy 2 | 5000 | Backend REST API |
| Web | `apps/web/` | React 19, Vite, Zustand | 5173 | Resident portal |
| Admin | `apps/admin/` | React 19, Vite, Zustand | 3001 | Staff dashboard |
| UI | `packages/ui/` | React components | N/A | Shared components |

### 3.2 API Routes (from code inspection)

| Blueprint | Prefix | File | Key Endpoints |
|-----------|--------|------|---------------|
| auth | `/api/auth` | `routes/auth.py` | login, register, refresh, logout, profile, verification-docs, superadmin/* |
| admin | `/api/admin` | `routes/admin.py` | users/*, announcements/*, documents/*, marketplace/*, issues/*, benefits/* |
| superadmin | `/api/superadmin` | `routes/superadmin.py` | admins, audit-log, audit-log/actions, audit-log/export |
| announcements | `/api/announcements` | `routes/announcements.py` | GET list, GET detail |
| documents | `/api/documents` | `routes/documents.py` | types, requests, verify |
| marketplace | `/api/marketplace` | `routes/marketplace.py` | items, transactions |
| issues | `/api/issues` | `routes/issues.py` | list, create, categories |
| benefits | `/api/benefits` | `routes/benefits.py` | programs, applications |
| provinces | `/api/provinces` | `routes/provinces.py` | list, detail |
| municipalities | `/api/municipalities` | `routes/municipalities.py` | list, detail, barangays |

### 3.3 Frontend Routes (from code inspection)

**Web App (`apps/web/src/App.tsx`):**
- `/` - HomePage
- `/announcements` - AnnouncementsPage
- `/announcements/:id` - AnnouncementDetailPage
- `/login`, `/register` - Authentication
- `/verify-email` - Email verification
- `/upload-id` - ID document upload (protected: resident)
- `/dashboard` - DashboardPage (protected: resident)
- `/profile` - ProfilePage (protected: resident)
- `/marketplace`, `/marketplace/:id`, `/my-marketplace` - Marketplace
- `/documents`, `/dashboard/requests/:id` - Documents
- `/problems` - ProblemsPage
- `/programs` - ProgramsPage
- `/verify/:requestNumber` - Public document verification
- `/terms-of-service`, `/privacy-policy`, `/about` - Static pages

**Admin App (`apps/admin/src/App.tsx`):**
- `/` - RoleSelector (landing)
- `/login` - AdminLoginPage (municipal admin)
- `/dashboard` - Dashboard (municipal admin)
- `/residents`, `/programs`, `/requests`, `/marketplace`, `/problems`, `/announcements`, `/reports` - Municipal admin pages
- `/superadmin/login` - SuperAdminLoginPage (2FA)
- `/superadmin` - SuperAdminPanel
- `/superadmin/audit` - SuperAdminAuditLog
- `/provincial/login`, `/provincial/dashboard`, `/provincial/announcements`, `/provincial/reports` - Provincial admin
- `/barangay/login`, `/barangay/dashboard`, `/barangay/announcements`, `/barangay/reports` - Barangay admin

### 3.4 Key Scope Helper Locations

| Location | File | Purpose |
|----------|------|---------|
| Backend | `apps/api/utils/zambales_scope.py` | All Zambales filtering functions |
| Web Frontend | `apps/web/src/lib/locations.ts` | Frontend Zambales-only data |
| Admin Frontend | `apps/admin/src/lib/locations.ts` | Admin Zambales-only data |
| User Model | `apps/api/models/user.py` | `admin_municipality_id`, `admin_barangay_id` fields |

---

## 4. Role & Permission Matrix

### 4.1 Role Definitions

| Role | Code Value | Login Portal | 2FA Required |
|------|------------|--------------|--------------|
| SuperAdmin | `superadmin` | `/superadmin/login` | Yes (email) |
| Provincial Admin | `provincial_admin` | `/provincial/login` | No |
| Municipal Admin | `municipal_admin` | `/login` | No |
| Barangay Admin | `barangay_admin` | `/barangay/login` | No |
| Resident | `resident` | Web `/login` | No |
| Public/Guest | `public` | N/A | N/A |

### 4.2 Permission Matrix Derived from Code

| Feature | SuperAdmin | Provincial | Municipal | Barangay | Resident | Public |
|---------|------------|------------|-----------|----------|----------|--------|
| **User Management** |
| Create admins | Yes | No | No | No | No | No |
| View all admins | Yes | No | No | No | No | No |
| Verify residents | No | No | Yes (own muni) | No | No | No |
| View resident ID/selfie | Via permission | No | Yes (`residents:id_view`) | No | No | No |
| **Announcements** |
| Create PROVINCE scope | No | Yes | No | No | No | No |
| Create MUNICIPALITY scope | No | No | Yes (own muni) | No | No | No |
| Create BARANGAY scope | No | No | No | Yes (own brgy) | No | No |
| View province announcements | N/A | Yes | Yes | Yes | Yes | Yes |
| View muni announcements | N/A | Yes | Yes (own) | Yes (if in muni) | Yes (selected) | No |
| View brgy announcements | N/A | Yes | Yes (own muni) | Yes (own) | Yes (own) | No |
| **Document Requests** |
| Process requests | No | No | Yes (own muni) | No | No | No |
| Generate PDFs | No | No | Yes (own muni) | No | No | No |
| Request documents | No | No | No | No | Yes | No |
| **Marketplace** |
| Moderate listings | No | No | Yes (own muni) | No | No | No |
| Create listings | No | No | No | No | Yes | No |
| View listings | N/A | N/A | Yes (own muni) | N/A | Yes | Yes (limited) |
| **Problem Reports** |
| Triage reports | No | No | Yes (own muni) | No | No | No |
| Submit reports | No | No | No | No | Yes | No |
| **Audit Logs** |
| View platform audit | Yes | No | No | No | No | No |
| Export audit CSV | Yes | No | No | No | No | No |

### 4.3 Role-Scoping Test Cases

---

#### ROLE-001: Municipal Admin Cannot Create Province Announcements
**ID:** ROLE-001
**Area:** admin
**Role(s):** municipal_admin
**Type:** Manual

**Preconditions:** Logged in as municipal_admin

**Steps:**
1. Navigate to Announcements page
2. Attempt to create announcement with scope=PROVINCE

**Expected:** UI should not offer PROVINCE scope option, or API returns 403

**Evidence to capture:** Screenshot of scope options, API response if attempted
**Where in code:** `apps/api/routes/admin.py:_enforce_scope_permission()`
**Failure signals:** 200 response, announcement created with PROVINCE scope

---

#### ROLE-002: Provincial Admin Cannot Verify Residents
**ID:** ROLE-002
**Area:** admin
**Role(s):** provincial_admin
**Type:** Manual

**Preconditions:** Logged in as provincial_admin

**Steps:**
1. Navigate to Residents page (if visible)
2. Attempt to verify a resident

**Expected:** No access to residents verification, or API returns 403

**Evidence to capture:** Screenshot, API response
**Where in code:** `apps/api/routes/admin.py`, PERMISSIONS_MATRIX.md
**Failure signals:** Can access resident verification

---

#### ROLE-003: Barangay Admin Scoped to Own Barangay
**ID:** ROLE-003
**Area:** admin
**Role(s):** barangay_admin
**Type:** Manual

**Preconditions:** Logged in as barangay_admin with assigned barangay

**Steps:**
1. Navigate to Announcements
2. Create announcement - verify only own barangay selectable
3. Attempt to view announcements from other barangays

**Expected:** Only own barangay available for creation, cannot see other barangays

**Evidence to capture:** Screenshot of barangay selection, announcement list
**Where in code:** `apps/api/routes/admin.py:_announcement_query_for_staff()`
**Failure signals:** Can see/create for other barangays

---

#### ROLE-004: Resident Cannot Access Admin Routes
**ID:** ROLE-004
**Area:** api
**Role(s):** resident
**Type:** Automatable

**Preconditions:** Valid resident JWT token

**Steps:**
1. Make authenticated request to `/api/admin/users/pending`
2. Check response

**Expected:** 403 Forbidden with `code: ROLE_MISMATCH`

**Evidence to capture:** HTTP response status and body
**Where in code:** `apps/api/routes/admin.py:enforce_admin_role()`
**Failure signals:** 200 response or user data returned

---

#### ROLE-005: Public Cannot Access Protected Routes
**ID:** ROLE-005
**Area:** api
**Role(s):** public (no token)
**Type:** Automatable

**Preconditions:** No JWT token

**Steps:**
1. Make request to `/api/auth/profile` without Authorization header
2. Make request to `/api/admin/announcements` without Authorization header

**Expected:** 401 Unauthorized

**Evidence to capture:** HTTP response status
**Where in code:** JWT middleware
**Failure signals:** 200 response

---

## 5. Zambales-Only + Olongapo Exclusion

### Critical Guardrails

These tests are **STOP-THE-LINE**. Any failure means immediate fix required.

---

#### ZAM-001: Backend Zambales Municipality Filter
**ID:** ZAM-001
**Area:** api
**Role(s):** All
**Type:** Automatable

**Preconditions:** API running

**Steps:**
1. GET `/api/municipalities`
2. Verify response contains only IDs 108-120 (13 municipalities)
3. Verify ID 130 (Olongapo) is NOT present

**Expected:**
- Exactly 13 municipalities
- All IDs in: [108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120]
- ID 130 absent

**Evidence to capture:** Full JSON response
**Where in code:** `apps/api/routes/municipalities.py`, `apps/api/utils/zambales_scope.py`
**Failure signals:** Count != 13, ID 130 present, IDs outside range

---

#### ZAM-002: Backend Province Filter
**ID:** ZAM-002
**Area:** api
**Role(s):** All
**Type:** Automatable

**Preconditions:** API running

**Steps:**
1. GET `/api/provinces`
2. Verify response contains only Zambales (ID 6)

**Expected:**
- Single province: Zambales
- ID = 6
- No other Region 3 provinces

**Evidence to capture:** Full JSON response
**Where in code:** `apps/api/routes/provinces.py`
**Failure signals:** Multiple provinces, non-Zambales provinces

---

#### ZAM-003: Frontend Web Municipalities Dropdown
**ID:** ZAM-003
**Area:** web
**Role(s):** All
**Type:** Manual

**Preconditions:** Web app running

**Steps:**
1. Navigate to registration page or header location selector
2. Check municipality dropdown options
3. Search for "Olongapo"

**Expected:**
- 13 municipalities visible
- Olongapo NOT in list
- Only Zambales municipalities

**Evidence to capture:** Screenshot of dropdown
**Where in code:** `apps/web/src/lib/locations.ts`, `apps/web/src/components/MunicipalitySelect.tsx`
**Failure signals:** Olongapo visible, >13 municipalities

---

#### ZAM-004: Frontend Admin Municipalities Dropdown
**ID:** ZAM-004
**Area:** admin
**Role(s):** All admin
**Type:** Manual

**Preconditions:** Admin app running, logged in

**Steps:**
1. Navigate to any page with municipality filter
2. Check municipality dropdown options

**Expected:** Same as ZAM-003

**Evidence to capture:** Screenshot of dropdown
**Where in code:** `apps/admin/src/lib/locations.ts`
**Failure signals:** Olongapo visible

---

#### ZAM-005: Registration Rejects Non-Zambales Municipality
**ID:** ZAM-005
**Area:** api
**Role(s):** public
**Type:** Automatable

**Preconditions:** API running

**Steps:**
1. POST `/api/auth/register` with `municipality_slug: "city-of-olongapo"`
2. POST `/api/auth/register` with `municipality_slug: "bataan"` (another R3 province)

**Expected:** 400 error: "Registration is only available for Zambales municipalities"

**Evidence to capture:** API response for both
**Where in code:** `apps/api/routes/auth.py:register()`
**Failure signals:** 201 success, user created

---

#### ZAM-006: Announcement Rejects Olongapo Municipality
**ID:** ZAM-006
**Area:** api
**Role(s):** municipal_admin
**Type:** Automatable

**Preconditions:** Admin JWT, API running

**Steps:**
1. POST `/api/admin/announcements` with `municipality_id: 130`

**Expected:** 400/403 error about invalid municipality

**Evidence to capture:** API response
**Where in code:** `apps/api/routes/admin.py:_validate_target_location()`
**Failure signals:** Announcement created with municipality_id=130

---

#### ZAM-007: Transfer Request Rejects Non-Zambales Target
**ID:** ZAM-007
**Area:** api
**Role(s):** resident
**Type:** Automatable

**Preconditions:** Resident JWT, API running

**Steps:**
1. POST `/api/auth/transfer` with `to_municipality_id: 130`
2. POST `/api/auth/transfer` with `to_municipality_id: 999` (non-existent)

**Expected:** 400 error: "Transfers are only available to Zambales municipalities"

**Evidence to capture:** API response
**Where in code:** `apps/api/routes/auth.py:request_transfer()`
**Failure signals:** Transfer request created

---

#### ZAM-008: Announcements List Filtered to Zambales
**ID:** ZAM-008
**Area:** api
**Role(s):** All
**Type:** Automatable

**Preconditions:** Announcements exist in DB (some may be seeded outside Zambales for testing)

**Steps:**
1. GET `/api/announcements`
2. Verify all returned announcements have `municipality_id` in valid Zambales range or scope=PROVINCE

**Expected:** No announcement with municipality_id=130 or outside 108-120

**Evidence to capture:** Full response, grep for municipality_id
**Where in code:** `apps/api/routes/announcements.py:list_announcements()`
**Failure signals:** Announcement with non-Zambales municipality

---

#### ZAM-009: zambales_scope.py Constants Correct
**ID:** ZAM-009
**Area:** api
**Role(s):** N/A
**Type:** Automatable

**Preconditions:** Code accessible

**Steps:**
1. Verify `ZAMBALES_PROVINCE_ID = 6`
2. Verify `OLONGAPO_MUNICIPALITY_ID = 130`
3. Verify `ZAMBALES_MUNICIPALITY_IDS` has exactly 13 entries
4. Verify 130 NOT in `ZAMBALES_MUNICIPALITY_IDS`

**Expected:** Constants match specification

**Evidence to capture:** Grep output of constants
**Where in code:** `apps/api/utils/zambales_scope.py`
**Failure signals:** Wrong constants

```bash
# Verification command
grep -E "(ZAMBALES_PROVINCE_ID|OLONGAPO_MUNICIPALITY_ID|ZAMBALES_MUNICIPALITY_IDS)" apps/api/utils/zambales_scope.py
```

---

#### ZAM-010: Frontend locations.ts Constants Correct
**ID:** ZAM-010
**Area:** web, admin
**Role(s):** N/A
**Type:** Automatable

**Preconditions:** Code accessible

**Steps:**
1. Verify both `apps/web/src/lib/locations.ts` and `apps/admin/src/lib/locations.ts` have:
   - `ZAMBALES_PROVINCE_ID = 6`
   - `EXCLUDED_MUNICIPALITY_IDS = [130]`
   - `MUNICIPALITIES` array length = 13

**Expected:** Constants match in both files

**Evidence to capture:** Grep output from both files
**Where in code:** `apps/web/src/lib/locations.ts`, `apps/admin/src/lib/locations.ts`
**Failure signals:** Mismatch between files, wrong values

---

## 6. Authentication & Session Lifecycle

### 6.1 Resident Authentication

---

#### AUTH-001: Resident Registration Flow
**ID:** AUTH-001
**Area:** web, api
**Role(s):** public
**Type:** Semi-automatable

**Preconditions:** Gmail account for verification

**Steps:**
1. Navigate to `/register`
2. Fill all required fields with valid data
3. Select Zambales municipality
4. Submit registration
5. Check email for verification link

**Expected:**
- 201 response
- User created with role=`resident`
- Email verification sent
- `email_verified=false` initially

**Evidence to capture:** API response, email screenshot
**Where in code:** `apps/api/routes/auth.py:register()`
**Failure signals:** Registration fails, no email, wrong role

---

#### AUTH-002: Resident Login
**ID:** AUTH-002
**Area:** web, api
**Role(s):** resident
**Type:** Automatable

**Preconditions:** Registered resident account

**Steps:**
1. POST `/api/auth/login` with username/email and password

**Expected:**
- 200 response
- `access_token` in response
- Refresh token in httpOnly cookie
- User data with role=`resident`

**Evidence to capture:** Response structure (token redacted)
**Where in code:** `apps/api/routes/auth.py:login()`
**Failure signals:** 401, no tokens

---

#### AUTH-003: Token Refresh
**ID:** AUTH-003
**Area:** api
**Role(s):** resident, admin
**Type:** Automatable

**Preconditions:** Valid session with refresh cookie

**Steps:**
1. POST `/api/auth/refresh` with refresh cookie

**Expected:**
- 200 response
- New `access_token`
- New refresh cookie (rotation)

**Evidence to capture:** Response, new token present
**Where in code:** `apps/api/routes/auth.py:refresh()`
**Failure signals:** 401, no new token

---

#### AUTH-004: Token Reuse Detection
**ID:** AUTH-004
**Area:** api
**Role(s):** All
**Type:** Semi-automatable

**Preconditions:** Valid refresh token

**Steps:**
1. POST `/api/auth/refresh` - get new token
2. POST `/api/auth/refresh` with OLD refresh token again

**Expected:**
- Second request returns 401
- `code: TOKEN_REUSE_DETECTED`
- Session family invalidated

**Evidence to capture:** Both responses
**Where in code:** `apps/api/routes/auth.py:refresh()`, `apps/api/models/refresh_token.py`
**Failure signals:** Second request succeeds

---

#### AUTH-005: Logout Blacklists Token
**ID:** AUTH-005
**Area:** api
**Role(s):** All
**Type:** Automatable

**Preconditions:** Valid session

**Steps:**
1. POST `/api/auth/logout`
2. Attempt to use old access token for protected endpoint

**Expected:**
- Logout returns 200
- Subsequent requests with old token return 401

**Evidence to capture:** Both responses
**Where in code:** `apps/api/routes/auth.py:logout()`
**Failure signals:** Old token still works

---

### 6.2 Admin Authentication

---

#### AUTH-006: Municipal Admin Login
**ID:** AUTH-006
**Area:** admin, api
**Role(s):** municipal_admin
**Type:** Manual

**Preconditions:** Municipal admin account exists

**Steps:**
1. Navigate to admin app `/login`
2. Enter credentials
3. Verify redirect to `/dashboard`

**Expected:**
- Login succeeds
- Token stored in localStorage
- User has `role: municipal_admin`

**Evidence to capture:** Screenshot of dashboard, localStorage values
**Where in code:** `apps/api/routes/auth.py:admin_login()`, `apps/admin/src/pages/AdminLoginPage.tsx`
**Failure signals:** Login fails, wrong role

---

#### AUTH-007: SuperAdmin 2FA Login Flow
**ID:** AUTH-007
**Area:** admin, api
**Role(s):** superadmin
**Type:** Manual

**Preconditions:** SuperAdmin account exists

**Steps:**
1. Navigate to `/superadmin/login`
2. Enter email and password
3. Receive 2FA code via email
4. Enter 6-digit code
5. Verify redirect to `/superadmin`

**Expected:**
- Step 1: Returns `session_id`
- Step 2: 2FA code email received
- Step 3: Tokens issued on valid code
- Access to SuperAdmin panel

**Evidence to capture:** Each step response, email screenshot
**Where in code:** `apps/api/routes/auth.py:superadmin_login()`, `superadmin_verify_2fa()`
**Failure signals:** No 2FA email, wrong session flow

---

#### AUTH-008: SuperAdmin 2FA Rate Limiting
**ID:** AUTH-008
**Area:** api
**Role(s):** superadmin
**Type:** Automatable

**Preconditions:** SuperAdmin account

**Steps:**
1. POST `/api/auth/superadmin/login` more than 5 times in 15 minutes

**Expected:** Rate limit error after 5 attempts

**Evidence to capture:** Response showing rate limit
**Where in code:** `apps/api/routes/auth.py:@_limit("5 per 15 minutes")`
**Failure signals:** No rate limiting

---

### 6.3 Frontend Auth Bootstrap

---

#### AUTH-009: isAuthBootstrapped Check
**ID:** AUTH-009
**Area:** web
**Role(s):** resident
**Type:** Manual

**Preconditions:** Logged in resident session

**Steps:**
1. Refresh page on protected route (e.g., `/dashboard`)
2. Open browser DevTools Network tab
3. Check for race condition - protected API calls should wait for auth

**Expected:**
- No 401 errors on page load
- `isAuthBootstrapped` becomes true before data fetches
- Session restored from sessionStorage/cookie

**Evidence to capture:** Network timeline, console logs
**Where in code:** `apps/web/src/lib/store.ts:isAuthBootstrapped`, `apps/web/src/App.tsx`
**Failure signals:** 401 on initial load, data fetch before auth

---

#### AUTH-010: Admin Store Auth Bootstrap
**ID:** AUTH-010
**Area:** admin
**Role(s):** All admin
**Type:** Manual

**Preconditions:** Logged in admin session

**Steps:**
1. Refresh page on admin dashboard
2. Check localStorage for `admin:access_token`
3. Verify no race conditions

**Expected:**
- Session restored from localStorage
- No 401 errors on protected routes

**Evidence to capture:** localStorage values, network calls
**Where in code:** `apps/admin/src/lib/store.ts`
**Failure signals:** Redirect to login on refresh

---

## 7. Resident Web E2E Functional Checks

### 7.1 Registration & Verification

---

#### WEB-001: Complete Registration with ID Upload
**ID:** WEB-001
**Area:** web
**Role(s):** public → resident
**Type:** Manual

**Preconditions:** Fresh test account

**Steps:**
1. Register new account at `/register`
2. Verify email via link
3. Upload ID documents at `/upload-id`
4. Check profile shows pending verification

**Expected:**
- Registration succeeds
- Email verification works
- Documents uploaded
- Status shows "pending admin review"

**Evidence to capture:** Screenshots of each step
**Where in code:** `apps/web/src/pages/RegisterPage.tsx`, `UploadIdPage.tsx`
**Failure signals:** Any step fails

---

#### WEB-002: Multipart Form Registration
**ID:** WEB-002
**Area:** api
**Role(s):** public
**Type:** Automatable

**Preconditions:** N/A

**Steps:**
1. POST `/api/auth/register` with `Content-Type: multipart/form-data`
2. Include profile_picture, valid_id_front, valid_id_back files

**Expected:**
- Files saved correctly
- User created with file paths

**Evidence to capture:** Response with file paths
**Where in code:** `apps/api/routes/auth.py:register()` - multipart handling
**Failure signals:** Files not saved, 400 error

---

### 7.2 Announcements

---

#### WEB-003: Guest Sees Province Announcements Only
**ID:** WEB-003
**Area:** web
**Role(s):** public
**Type:** Manual

**Preconditions:** Province announcements exist

**Steps:**
1. Visit `/announcements` without logging in
2. Check visible announcements

**Expected:**
- Only PROVINCE-scoped announcements visible
- Message indicates "Login as verified resident..."

**Evidence to capture:** Screenshot, API response
**Where in code:** `apps/api/routes/announcements.py:list_announcements()`
**Failure signals:** Municipality/barangay announcements visible to guest

---

#### WEB-004: Verified Resident Sees Scoped Announcements
**ID:** WEB-004
**Area:** web
**Role(s):** resident (admin_verified=true)
**Type:** Manual

**Preconditions:** Verified resident in specific municipality/barangay

**Steps:**
1. Login as verified resident
2. Visit `/announcements`
3. Check visible announcements

**Expected:**
- PROVINCE announcements visible
- Own MUNICIPALITY announcements visible
- Own BARANGAY announcements visible
- Other municipality/barangay announcements NOT visible

**Evidence to capture:** Screenshot with scope indicators
**Where in code:** `apps/api/routes/announcements.py:list_announcements()`
**Failure signals:** Sees other locations' announcements

---

### 7.3 Documents

---

#### WEB-005: Create Document Request
**ID:** WEB-005
**Area:** web
**Role(s):** resident (verified)
**Type:** Manual

**Preconditions:** Verified resident, document types seeded

**Steps:**
1. Navigate to `/documents`
2. Select document type
3. Fill required fields
4. Submit request

**Expected:**
- Request created with status `pending`
- Request number generated
- Visible in "My Requests"

**Evidence to capture:** Screenshot, request number
**Where in code:** `apps/web/src/pages/DocumentsPage.tsx`, `apps/api/routes/documents.py`
**Failure signals:** Request fails, no request number

---

#### WEB-006: View Document Request Details
**ID:** WEB-006
**Area:** web
**Role(s):** resident
**Type:** Manual

**Preconditions:** Existing document request

**Steps:**
1. Navigate to `/dashboard/requests/:id`
2. Check request details displayed

**Expected:**
- Request details visible
- Status shown
- Supporting documents section

**Evidence to capture:** Screenshot
**Where in code:** `apps/web/src/pages/DocumentRequestPage.tsx`
**Failure signals:** 404, wrong data

---

### 7.4 Marketplace

---

#### WEB-007: Create Marketplace Listing
**ID:** WEB-007
**Area:** web
**Role(s):** resident (verified)
**Type:** Manual

**Preconditions:** Verified resident

**Steps:**
1. Navigate to `/marketplace`
2. Create new listing
3. Fill details, upload image
4. Submit

**Expected:**
- Listing created with status `pending`
- Image uploaded
- Visible in "My Listings"

**Evidence to capture:** Screenshot, listing ID
**Where in code:** `apps/api/routes/marketplace.py`
**Failure signals:** Listing fails

---

#### WEB-008: Marketplace Age Gate
**ID:** WEB-008
**Area:** web, api
**Role(s):** resident
**Type:** Semi-automatable

**Preconditions:** Under-18 and over-18 test accounts

**Steps:**
1. Login as under-18 user
2. Attempt to create transaction
3. Login as over-18 user
4. Complete transaction

**Expected:**
- Under-18: Transaction blocked
- Over-18: Transaction allowed

**Evidence to capture:** API responses
**Where in code:** `apps/api/models/user.py:is_under_18()`, marketplace routes
**Failure signals:** Under-18 can transact

---

### 7.5 Problems/Issues

---

#### WEB-009: Submit Problem Report
**ID:** WEB-009
**Area:** web
**Role(s):** resident
**Type:** Manual

**Preconditions:** Logged in resident

**Steps:**
1. Navigate to `/problems`
2. Create new report
3. Select category
4. Submit

**Expected:**
- Report created
- Visible in "My Reports"
- Status is `pending`

**Evidence to capture:** Screenshot, report ID
**Where in code:** `apps/api/routes/issues.py`
**Failure signals:** Report fails

---

### 7.6 Benefit Programs

---

#### WEB-010: View and Apply for Program
**ID:** WEB-010
**Area:** web
**Role(s):** resident
**Type:** Manual

**Preconditions:** Active benefit program exists, verified resident

**Steps:**
1. Navigate to `/programs`
2. View program details
3. Apply for program

**Expected:**
- Programs listed by municipality
- Can view details
- Application submitted

**Evidence to capture:** Screenshot
**Where in code:** `apps/api/routes/benefits.py`
**Failure signals:** Can't apply, wrong municipality programs

---

## 8. Admin App E2E Checks

### 8.1 Resident Verification

---

#### ADMIN-001: View Pending Verifications
**ID:** ADMIN-001
**Area:** admin
**Role(s):** municipal_admin
**Type:** Manual

**Preconditions:** Pending residents exist, logged in as municipal_admin

**Steps:**
1. Navigate to `/residents`
2. Filter by "Pending"
3. Check listed residents

**Expected:**
- Only residents from own municipality shown
- Pending verification tab works

**Evidence to capture:** Screenshot with municipality filter
**Where in code:** `apps/admin/src/pages/Residents.tsx`
**Failure signals:** Residents from other municipalities visible

---

#### ADMIN-002: View Resident ID with Audit Logging
**ID:** ADMIN-002
**Area:** admin, api
**Role(s):** municipal_admin
**Type:** Manual

**Preconditions:** Admin with `residents:id_view` permission, pending resident

**Steps:**
1. Click to view resident's ID document
2. Select viewing reason
3. Confirm view

**Expected:**
- Watermarked image displayed
- Audit log entry created with action `RESIDENT_ID_VIEWED`
- Reason recorded

**Evidence to capture:** Screenshot of watermarked image, audit log entry
**Where in code:** `apps/api/routes/admin.py`, `apps/admin/src/components/WatermarkedImageViewer.tsx`
**Failure signals:** No watermark, no audit log, no reason required

---

#### ADMIN-003: Approve Resident
**ID:** ADMIN-003
**Area:** admin, api
**Role(s):** municipal_admin
**Type:** Manual

**Preconditions:** Pending resident exists

**Steps:**
1. View resident details
2. Click "Approve"
3. Confirm

**Expected:**
- Resident status changes to `admin_verified=true`
- Status email sent to resident
- Audit log entry

**Evidence to capture:** API response, email screenshot
**Where in code:** `apps/api/routes/admin.py`
**Failure signals:** Verification fails

---

#### ADMIN-004: Reject Resident with Reason
**ID:** ADMIN-004
**Area:** admin, api
**Role(s):** municipal_admin
**Type:** Manual

**Preconditions:** Pending resident exists

**Steps:**
1. View resident details
2. Click "Reject"
3. Enter rejection reason
4. Confirm

**Expected:**
- Reason required
- Rejection saved
- Email sent to resident

**Evidence to capture:** API response with reason
**Where in code:** `apps/api/routes/admin.py`
**Failure signals:** Can reject without reason

---

### 8.2 Document Processing

---

#### ADMIN-005: View Document Requests
**ID:** ADMIN-005
**Area:** admin
**Role(s):** municipal_admin
**Type:** Manual

**Preconditions:** Document requests exist

**Steps:**
1. Navigate to `/requests`
2. Filter by status
3. View request details

**Expected:**
- Only requests from own municipality shown
- Status filters work
- Can view details

**Evidence to capture:** Screenshot with filters
**Where in code:** `apps/admin/src/pages/Requests.tsx`
**Failure signals:** Cross-municipality requests visible

---

#### ADMIN-006: Generate Document PDF
**ID:** ADMIN-006
**Area:** admin, api
**Role(s):** municipal_admin
**Type:** Manual

**Preconditions:** Approved document request

**Steps:**
1. View request details
2. Click "Generate PDF"
3. Download PDF

**Expected:**
- PDF generated with correct data
- QR code embedded
- File accessible

**Evidence to capture:** PDF file, API response
**Where in code:** `apps/api/utils/pdf_generator.py`, `apps/api/routes/admin.py`
**Failure signals:** PDF generation fails

---

#### ADMIN-007: Ready for Pickup with Claim Token
**ID:** ADMIN-007
**Area:** admin, api
**Role(s):** municipal_admin
**Type:** Manual

**Preconditions:** Processing document request

**Steps:**
1. Set status to "Ready for Pickup"
2. Optionally set pickup window
3. Generate claim token/QR

**Expected:**
- Status updated
- Claim token generated
- QR code available
- Notification sent to resident

**Evidence to capture:** API response with claim data
**Where in code:** `apps/api/routes/admin.py:ready_for_pickup()`
**Failure signals:** No claim token generated

---

### 8.3 Announcements Management

---

#### ADMIN-008: Create Municipality Announcement
**ID:** ADMIN-008
**Area:** admin, api
**Role(s):** municipal_admin
**Type:** Manual

**Preconditions:** Logged in as municipal_admin

**Steps:**
1. Navigate to `/announcements`
2. Click "Create"
3. Fill title, content
4. Scope should default to MUNICIPALITY
5. Upload images
6. Submit

**Expected:**
- Announcement created with correct scope
- Images uploaded
- Visible to municipality residents

**Evidence to capture:** Screenshot, API response
**Where in code:** `apps/api/routes/admin.py:create_announcement()`
**Failure signals:** Wrong scope, images fail

---

#### ADMIN-009: Upload Multiple Announcement Images
**ID:** ADMIN-009
**Area:** api
**Role(s):** All admin
**Type:** Automatable

**Preconditions:** Existing announcement

**Steps:**
1. POST `/api/admin/announcements/{id}/uploads` with multiple files
2. Use `Content-Type: multipart/form-data`

**Expected:**
- Multiple images saved
- Paths returned in response

**Evidence to capture:** API response with paths
**Where in code:** `apps/api/routes/admin.py`
**Failure signals:** Only one image saved

---

#### ADMIN-010: Announcement Pinning
**ID:** ADMIN-010
**Area:** admin, api
**Role(s):** All admin
**Type:** Manual

**Preconditions:** Existing announcement

**Steps:**
1. Edit announcement
2. Enable "Pinned"
3. Set optional pinned_until date
4. View public announcements

**Expected:**
- Pinned announcement appears at top
- Un-pins after pinned_until date

**Evidence to capture:** Screenshots showing order
**Where in code:** `apps/api/routes/announcements.py:list_announcements()` order_by
**Failure signals:** Pinned not at top

---

### 8.4 Marketplace Moderation

---

#### ADMIN-011: Approve Marketplace Listing
**ID:** ADMIN-011
**Area:** admin
**Role(s):** municipal_admin
**Type:** Manual

**Preconditions:** Pending marketplace listing exists

**Steps:**
1. Navigate to `/marketplace`
2. View pending listings
3. Approve listing

**Expected:**
- Listing status changes to `approved`
- Visible to public

**Evidence to capture:** API response
**Where in code:** `apps/api/routes/admin.py`
**Failure signals:** Listing still pending

---

#### ADMIN-012: Reject Marketplace Listing with Reason
**ID:** ADMIN-012
**Area:** admin
**Role(s):** municipal_admin
**Type:** Manual

**Preconditions:** Pending marketplace listing

**Steps:**
1. View pending listing
2. Click "Reject"
3. Enter reason

**Expected:**
- Reason required
- Listing rejected
- Seller notified

**Evidence to capture:** API response
**Where in code:** `apps/api/routes/admin.py`
**Failure signals:** Can reject without reason

---

### 8.5 Problem Reports Triage

---

#### ADMIN-013: Update Problem Status
**ID:** ADMIN-013
**Area:** admin
**Role(s):** municipal_admin
**Type:** Manual

**Preconditions:** Pending problem report

**Steps:**
1. Navigate to `/problems`
2. View report
3. Update status (e.g., "In Progress", "Resolved")
4. Add admin comment

**Expected:**
- Status updated
- Comment saved
- Reporter notified

**Evidence to capture:** Screenshot, API response
**Where in code:** `apps/api/routes/admin.py`
**Failure signals:** Status not saved

---

### 8.6 Benefit Programs

---

#### ADMIN-014: Create Benefit Program with Images
**ID:** ADMIN-014
**Area:** admin, api
**Role(s):** municipal_admin
**Type:** Manual

**Preconditions:** Logged in as municipal_admin

**Steps:**
1. Navigate to `/programs`
2. Click "Create Program"
3. Fill details
4. Upload images via FormData

**Expected:**
- Program created for admin's municipality
- Images saved
- Visible to residents

**Evidence to capture:** API response, screenshot
**Where in code:** `apps/api/routes/admin.py`, `benefitsAdminApi`
**Failure signals:** Wrong municipality, images fail

---

## 9. SuperAdmin Portal Checks

---

#### SUPER-001: Access SuperAdmin Panel
**ID:** SUPER-001
**Area:** admin
**Role(s):** superadmin
**Type:** Manual

**Preconditions:** SuperAdmin logged in via 2FA

**Steps:**
1. After 2FA login, navigate to `/superadmin`
2. Verify panel loads

**Expected:**
- Admin Management section visible
- Audit Log menu visible
- No regular admin pages (Dashboard, Residents, etc.)

**Evidence to capture:** Screenshot of panel
**Where in code:** `apps/admin/src/pages/SuperAdminPanel.tsx`
**Failure signals:** Panel doesn't load, regular admin pages visible

---

#### SUPER-002: List All Admins
**ID:** SUPER-002
**Area:** admin, api
**Role(s):** superadmin
**Type:** Manual

**Preconditions:** Admin accounts exist

**Steps:**
1. View Admin Management section
2. Check admin list

**Expected:**
- All admin roles visible
- Municipality/barangay assignments shown
- Can filter by role

**Evidence to capture:** Screenshot of admin list
**Where in code:** `apps/api/routes/superadmin.py:list_admins()`
**Failure signals:** Missing admins, wrong data

---

#### SUPER-003: Create New Admin Account
**ID:** SUPER-003
**Area:** admin, api
**Role(s):** superadmin
**Type:** Manual

**Preconditions:** SuperAdmin logged in

**Steps:**
1. Click "Create Admin"
2. Select role (provincial, municipal, barangay)
3. Fill details
4. Submit

**Expected:**
- Admin created
- Welcome email sent with Terms PDF
- Appears in admin list

**Evidence to capture:** API response, email screenshot
**Where in code:** `apps/api/routes/auth.py:admin_register()`, `apps/api/utils/email_sender.py`
**Failure signals:** Admin not created, no email

---

#### SUPER-004: View Audit Log
**ID:** SUPER-004
**Area:** admin, api
**Role(s):** superadmin
**Type:** Manual

**Preconditions:** Actions have been logged

**Steps:**
1. Navigate to `/superadmin/audit`
2. View audit entries
3. Filter by action type
4. Search by admin email

**Expected:**
- Audit entries displayed
- Filters work
- Search works
- Pagination works

**Evidence to capture:** Screenshot with filters
**Where in code:** `apps/api/routes/superadmin.py:get_audit_log()`
**Failure signals:** Missing entries, broken filters

---

#### SUPER-005: Export Audit Log CSV
**ID:** SUPER-005
**Area:** api
**Role(s):** superadmin
**Type:** Manual

**Preconditions:** Audit entries exist

**Steps:**
1. Click "Export CSV"
2. Download file

**Expected:**
- CSV file downloads
- Contains audit data
- Proper headers

**Evidence to capture:** CSV file
**Where in code:** `apps/api/routes/superadmin.py:export_audit_log()`
**Failure signals:** Download fails, empty file

---

#### SUPER-006: Non-SuperAdmin Cannot Access SuperAdmin Routes
**ID:** SUPER-006
**Area:** api
**Role(s):** municipal_admin, provincial_admin
**Type:** Automatable

**Preconditions:** Non-superadmin JWT token

**Steps:**
1. GET `/api/superadmin/admins` with municipal_admin token
2. GET `/api/superadmin/audit-log` with provincial_admin token

**Expected:** 403 Forbidden for both

**Evidence to capture:** API responses
**Where in code:** `apps/api/routes/superadmin.py:require_superadmin()`
**Failure signals:** 200 response, data returned

---

## 10. API Contract & Integration Checks

### 10.1 Request/Response Format

---

#### API-001: Error Response Structure
**ID:** API-001
**Area:** api
**Role(s):** All
**Type:** Automatable

**Preconditions:** N/A

**Steps:**
1. Make requests that trigger various errors (400, 401, 403, 404, 500)
2. Check response structure

**Expected:**
- All errors have `{ error: "message" }` or `{ msg: "message" }`
- 401/403 include `code` field where applicable
- No stack traces in production

**Evidence to capture:** Sample error responses
**Where in code:** All route files
**Failure signals:** Inconsistent structure, exposed stack traces

---

#### API-002: Pagination Structure
**ID:** API-002
**Area:** api
**Role(s):** All
**Type:** Automatable

**Preconditions:** Data exists

**Steps:**
1. GET `/api/announcements?page=1&per_page=5`
2. Check pagination structure

**Expected:**
```json
{
  "announcements": [...],
  "count": 5,
  "pagination": {
    "page": 1,
    "per_page": 5,
    "total": 100,
    "pages": 20
  }
}
```

**Evidence to capture:** Response structure
**Where in code:** Various list endpoints
**Failure signals:** Missing pagination fields

---

### 10.2 FormData vs JSON Handling

---

#### API-003: Endpoints Accept Both JSON and FormData
**ID:** API-003
**Area:** api
**Role(s):** All
**Type:** Automatable

**Preconditions:** Auth token

**Steps:**
1. POST to announcement creation with `Content-Type: application/json`
2. POST to same endpoint with `Content-Type: multipart/form-data`

**Expected:** Both succeed (FormData for file uploads)

**Evidence to capture:** Both responses
**Where in code:** `apps/api/routes/admin.py` - check for `is_multipart` handling
**Failure signals:** One content type fails

---

#### API-004: Boolean Conversion in FormData
**ID:** API-004
**Area:** api
**Role(s):** All
**Type:** Automatable

**Preconditions:** Auth token

**Steps:**
1. POST with FormData containing `pinned: "true"` (string)
2. Check boolean is correctly parsed

**Expected:** Boolean fields work with string values ("true", "false", "1", "0")

**Evidence to capture:** Created record with correct boolean
**Where in code:** `apps/api/routes/admin.py` - boolean conversion
**Failure signals:** String stored instead of boolean

---

### 10.3 CORS Configuration

---

#### API-005: CORS Preflight
**ID:** API-005
**Area:** api
**Role(s):** All
**Type:** Automatable

**Preconditions:** API running

**Steps:**
1. Send OPTIONS request to API endpoints
2. Check CORS headers

**Expected:**
- `Access-Control-Allow-Origin` present
- `Access-Control-Allow-Credentials: true`
- `Access-Control-Allow-Methods` includes required methods

**Evidence to capture:** Response headers
**Where in code:** `apps/api/app.py` CORS setup
**Failure signals:** Missing headers, preflight fails

---

### 10.4 Status Codes

---

#### API-006: Correct Status Codes
**ID:** API-006
**Area:** api
**Role(s):** All
**Type:** Automatable

**Preconditions:** N/A

**Steps:**
Verify these return correct status codes:
- Create resource → 201
- Success → 200
- Validation error → 400
- Unauthorized → 401
- Forbidden → 403
- Not found → 404
- Rate limit → 429

**Expected:** Consistent status codes

**Evidence to capture:** Response status codes
**Where in code:** All route files
**Failure signals:** Wrong status codes

---

## 11. Jobs, Schedulers & Scripts

### 11.1 Notification Worker

---

#### JOB-001: Notification Worker Processes Queue
**ID:** JOB-001
**Area:** api
**Role(s):** System
**Type:** Semi-automatable

**Preconditions:** Outbox has pending notifications

**Steps:**
1. Run: `python -m apps.api.scripts.notification_worker --once`
2. Check outbox table for processed notifications

**Expected:**
- Pending notifications processed
- Status updated to "sent" or "failed"
- Email/SMS delivered

**Evidence to capture:** Console output, outbox records
**Where in code:** `apps/api/scripts/notification_worker.py`
**Failure signals:** Notifications stuck in pending

---

### 11.2 ID Retention Cleanup

---

#### JOB-002: Cleanup Verification Images
**ID:** JOB-002
**Area:** api
**Role(s):** System
**Type:** Semi-automatable

**Preconditions:** Old verification images exist

**Steps:**
1. Run: `python apps/api/scripts/cleanup_verification_images.py --dry-run`
2. Verify files identified for deletion
3. Run without --dry-run to actually delete

**Expected:**
- Only files past retention period (ID_RETENTION_DAYS) identified
- Verified users' files deleted after grace period
- Audit log references preserved

**Evidence to capture:** Dry-run output
**Where in code:** `apps/api/scripts/cleanup_verification_images.py`
**Failure signals:** Wrong files identified, active users' files deleted

---

### 11.3 SuperAdmin Creation

---

#### JOB-003: Create SuperAdmin Script
**ID:** JOB-003
**Area:** api
**Role(s):** System
**Type:** Manual

**Preconditions:** No superadmin exists (first-time setup)

**Steps:**
1. Run: `python apps/api/scripts/create_superadmin.py`
2. Follow prompts for email/password
3. Verify account created

**Expected:**
- SuperAdmin account created
- role=`superadmin`
- Can login via 2FA flow

**Evidence to capture:** Script output
**Where in code:** `apps/api/scripts/create_superadmin.py`
**Failure signals:** Script fails, wrong role

---

### 11.4 Database Scripts

---

#### JOB-004: Seed Data Script
**ID:** JOB-004
**Area:** api
**Role(s):** System
**Type:** Manual

**Preconditions:** Empty database

**Steps:**
1. Run: `python apps/api/scripts/seed_data.py`
2. Verify seeded data

**Expected:**
- Provinces, municipalities, barangays seeded
- Document types seeded
- Issue categories seeded

**Evidence to capture:** Record counts
**Where in code:** `apps/api/scripts/seed_data.py`
**Failure signals:** Missing reference data

---

## 12. Security, Privacy & Compliance

### 12.1 Password Security

---

#### SEC-001: Password Hashing
**ID:** SEC-001
**Area:** api
**Role(s):** All
**Type:** Automatable

**Preconditions:** User account exists

**Steps:**
1. Check database for password_hash field
2. Verify hash format (bcrypt or werkzeug)

**Expected:**
- Passwords stored as hash, never plaintext
- Hash starts with `$2b$` (bcrypt) or `scrypt:`/`pbkdf2:` (werkzeug)

**Evidence to capture:** Hash format (not actual hash)
**Where in code:** `apps/api/models/user.py`, `apps/api/routes/auth.py`
**Failure signals:** Plaintext passwords

---

#### SEC-002: Hybrid Password Verification
**ID:** SEC-002
**Area:** api
**Role(s):** All
**Type:** Automatable

**Preconditions:** Accounts with both bcrypt and werkzeug hashes

**Steps:**
1. Login with bcrypt-hashed password
2. Login with werkzeug-hashed password

**Expected:** Both succeed via `verify_password()` helper

**Evidence to capture:** Login success for both
**Where in code:** `apps/api/routes/auth.py:verify_password()`
**Failure signals:** One hash type fails

---

### 12.2 JWT Security

---

#### SEC-003: Token Expiration
**ID:** SEC-003
**Area:** api
**Role(s):** All
**Type:** Automatable

**Preconditions:** Valid token

**Steps:**
1. Decode JWT token
2. Check exp claim
3. Wait for expiration
4. Attempt use

**Expected:**
- Access token expires in 1 hour
- Refresh token expires in 30 days
- Expired tokens return 401

**Evidence to capture:** Token exp times, 401 response
**Where in code:** `apps/api/routes/auth.py`
**Failure signals:** Tokens don't expire

---

#### SEC-004: Token Blacklisting
**ID:** SEC-004
**Area:** api
**Role(s):** All
**Type:** Automatable

**Preconditions:** Valid session

**Steps:**
1. Note current token JTI
2. Logout
3. Check TokenBlacklist table

**Expected:** Token JTI added to blacklist

**Evidence to capture:** Blacklist entry
**Where in code:** `apps/api/models/token_blacklist.py`
**Failure signals:** Token not blacklisted

---

### 12.3 ID/Selfie Privacy

---

#### SEC-005: ID View Requires Permission
**ID:** SEC-005
**Area:** api
**Role(s):** municipal_admin
**Type:** Automatable

**Preconditions:** Admin without `residents:id_view` permission

**Steps:**
1. Remove `residents:id_view` from admin's permissions
2. Attempt to view resident ID document

**Expected:** 403 Forbidden

**Evidence to capture:** API response
**Where in code:** `apps/api/routes/admin.py`
**Failure signals:** Can view without permission

---

#### SEC-006: ID View Creates Audit Log
**ID:** SEC-006
**Area:** api
**Role(s):** municipal_admin
**Type:** Manual

**Preconditions:** Admin with permission

**Steps:**
1. View resident ID document
2. Check admin_audit_logs table

**Expected:**
- Audit entry with action `RESIDENT_ID_VIEWED`
- Contains: admin_id, admin_email, resident_id, document_type, reason, IP, timestamp

**Evidence to capture:** Audit log entry
**Where in code:** `apps/api/utils/admin_audit.py`
**Failure signals:** No audit entry, missing fields

---

#### SEC-007: ID Images Watermarked
**ID:** SEC-007
**Area:** admin
**Role(s):** municipal_admin
**Type:** Manual

**Preconditions:** Resident with ID uploaded

**Steps:**
1. View resident ID in admin panel
2. Check for watermark overlay

**Expected:**
- Watermark shows: admin name, timestamp, "CONFIDENTIAL"
- Watermark baked into canvas (not CSS)

**Evidence to capture:** Screenshot showing watermark
**Where in code:** `apps/admin/src/components/WatermarkedImageViewer.tsx`
**Failure signals:** No watermark, CSS-only watermark

---

### 12.4 Admin Scoping Fields

---

#### SEC-008: Correct Admin Field Usage
**ID:** SEC-008
**Area:** api
**Role(s):** All admin
**Type:** Code Review

**Preconditions:** Access to codebase

**Steps:**
1. Grep for `user.barangay_id` in admin context
2. Grep for `user.municipality_id` in admin context
3. Verify these use `admin_` prefix versions

**Expected:**
- Admin scope uses `user.admin_municipality_id` and `user.admin_barangay_id`
- `user.municipality_id` / `user.barangay_id` only for resident's residence

**Evidence to capture:** Grep results
**Where in code:** `apps/api/routes/admin.py`, `apps/api/utils/zambales_scope.py`
**Failure signals:** Using non-admin fields for admin scoping

```bash
# Verification commands
grep -n "\.municipality_id" apps/api/routes/admin.py | grep -v admin_municipality
grep -n "\.barangay_id" apps/api/routes/admin.py | grep -v admin_barangay
```

---

### 12.5 Rate Limiting

---

#### SEC-009: Login Rate Limiting
**ID:** SEC-009
**Area:** api
**Role(s):** All
**Type:** Automatable

**Preconditions:** Flask-Limiter configured

**Steps:**
1. Make 11+ login attempts to `/api/auth/login` in 1 minute

**Expected:** 429 Too Many Requests after limit

**Evidence to capture:** 429 response
**Where in code:** `apps/api/routes/auth.py:@_limit("10 per minute")`
**Failure signals:** No rate limiting

---

#### SEC-010: SuperAdmin Login Rate Limiting
**ID:** SEC-010
**Area:** api
**Role(s):** superadmin
**Type:** Automatable

**Preconditions:** SuperAdmin account

**Steps:**
1. Make 6+ login attempts to `/api/auth/superadmin/login` in 15 minutes

**Expected:** 429 after 5 attempts

**Evidence to capture:** 429 response
**Where in code:** `apps/api/routes/auth.py:@_limit("5 per 15 minutes")`
**Failure signals:** No rate limiting

---

### 12.6 Input Validation

---

#### SEC-011: SQL Injection Prevention
**ID:** SEC-011
**Area:** api
**Role(s):** All
**Type:** Automatable

**Preconditions:** N/A

**Steps:**
1. Submit SQL injection payloads in various inputs:
   - Login: `username: "admin'; DROP TABLE users;--"`
   - Search: `?q='; DELETE FROM users;--`
2. Verify no SQL executed

**Expected:** Payloads sanitized, no SQL errors, data intact

**Evidence to capture:** Responses, database unchanged
**Where in code:** SQLAlchemy ORM throughout
**Failure signals:** SQL errors, data modified

---

#### SEC-012: XSS Prevention
**ID:** SEC-012
**Area:** web, admin
**Role(s):** All
**Type:** Manual

**Preconditions:** N/A

**Steps:**
1. Create announcement with content: `<script>alert('XSS')</script>`
2. View announcement in web app

**Expected:** Script not executed, rendered as text

**Evidence to capture:** Rendered output
**Where in code:** React components (automatic escaping)
**Failure signals:** Script executes

---

## 13. Performance & UX Reliability

### 13.1 Cold Start Handling

---

#### PERF-001: Keep-Alive Ping
**ID:** PERF-001
**Area:** web
**Role(s):** All
**Type:** Manual

**Preconditions:** Web app running

**Steps:**
1. Open web app
2. Check network tab for `/health` pings
3. Verify interval

**Expected:**
- Health ping on initial load
- Ping every 10 minutes while visible
- Ping on tab focus return

**Evidence to capture:** Network timeline
**Where in code:** `apps/web/src/lib/api.ts:startKeepAlive()`
**Failure signals:** No pings, wrong interval

---

### 13.2 Loading States

---

#### PERF-002: Protected Route Loading
**ID:** PERF-002
**Area:** web, admin
**Role(s):** All
**Type:** Manual

**Preconditions:** Logged in

**Steps:**
1. Navigate to protected route
2. Refresh page
3. Observe loading behavior

**Expected:**
- Loading indicator shown during auth bootstrap
- No flash of unauthorized content
- Smooth transition to content

**Evidence to capture:** Screenshot/video of load
**Where in code:** `ProtectedRoute` components
**Failure signals:** Flash of wrong content, stuck loading

---

### 13.3 Error Handling

---

#### PERF-003: API Error Display
**ID:** PERF-003
**Area:** web, admin
**Role(s):** All
**Type:** Manual

**Preconditions:** N/A

**Steps:**
1. Cause various errors (network, validation, auth)
2. Check error display

**Expected:**
- User-friendly error messages
- No technical jargon
- Clear recovery path

**Evidence to capture:** Screenshots of error states
**Where in code:** `handleApiError()` in api files
**Failure signals:** Cryptic errors, no recovery option

---

## 14. Release & Deployment Smoke Checklist

### 14.1 Pre-Deployment

---

#### DEPLOY-001: All Builds Pass
**ID:** DEPLOY-001
**Area:** All
**Role(s):** N/A (CI)
**Type:** Automatable

**Preconditions:** N/A

**Steps:**
1. Run `npm run build` from root
2. Verify all apps build

**Expected:** Zero build errors

**Evidence to capture:** Build output
**Where in code:** `turbo.json`
**Failure signals:** Build fails

---

#### DEPLOY-002: Migrations Ready
**ID:** DEPLOY-002
**Area:** api
**Role(s):** N/A
**Type:** Manual

**Preconditions:** N/A

**Steps:**
1. Review pending migrations
2. Verify backward compatibility

**Expected:**
- Migrations safe to run
- No data loss
- Rollback plan exists

**Evidence to capture:** Migration files reviewed
**Where in code:** `apps/api/migrations/versions/`
**Failure signals:** Breaking migrations

---

### 14.2 Post-Deployment

---

#### DEPLOY-003: Health Check
**ID:** DEPLOY-003
**Area:** api
**Role(s):** N/A
**Type:** Automatable

**Preconditions:** Deployed

**Steps:**
1. GET `{API_URL}/health`

**Expected:** 200 response

**Evidence to capture:** Response
**Where in code:** `apps/api/app.py`
**Failure signals:** Non-200 response

---

#### DEPLOY-004: Database Connection
**ID:** DEPLOY-004
**Area:** api
**Role(s):** N/A
**Type:** Automatable

**Preconditions:** Deployed

**Steps:**
1. Make authenticated API call
2. Verify data returned

**Expected:** Successful database query

**Evidence to capture:** Response with data
**Where in code:** Any data endpoint
**Failure signals:** Database connection errors

---

#### DEPLOY-005: Critical User Flows
**ID:** DEPLOY-005
**Area:** All
**Role(s):** Various
**Type:** Manual

**Preconditions:** Production deployment

**Steps:**
1. Resident login →
2. View announcements →
3. Admin login →
4. View dashboard →
5. SuperAdmin 2FA login (if applicable) →

**Expected:** All critical flows work

**Evidence to capture:** Screenshot of each step
**Where in code:** N/A (integration)
**Failure signals:** Any flow broken

---

#### DEPLOY-006: Email Delivery
**ID:** DEPLOY-006
**Area:** api
**Role(s):** N/A
**Type:** Manual

**Preconditions:** SendGrid configured

**Steps:**
1. Trigger email (e.g., registration verification)
2. Check email delivery

**Expected:** Email received within minutes

**Evidence to capture:** Email screenshot
**Where in code:** `apps/api/utils/email_sender.py`
**Failure signals:** No email, delayed delivery

---

#### DEPLOY-007: File Uploads Work
**ID:** DEPLOY-007
**Area:** api
**Role(s):** resident, admin
**Type:** Manual

**Preconditions:** Supabase storage configured

**Steps:**
1. Upload profile picture
2. Upload announcement image
3. Verify files accessible

**Expected:** Files uploaded and accessible

**Evidence to capture:** File URLs
**Where in code:** `apps/api/utils/storage_handler.py`
**Failure signals:** Upload fails, files not accessible

---

## Appendix A: Quick Reference Commands

### Development Startup

```bash
# Root
npm install
npm run dev

# API only
cd apps/api
source venv/bin/activate  # or .\venv\Scripts\activate on Windows
flask run

# Web only
cd apps/web
npm run dev

# Admin only
cd apps/admin
npm run dev
```

### Database Commands

```bash
cd apps/api

# Apply migrations
flask db upgrade

# Seed data
python scripts/seed_data.py

# Inspect database
python scripts/inspect_database.py
```

### Testing Commands

```bash
# Full lint
npm run lint

# Full build
npm run build

# Python tests (if configured)
cd apps/api && python -m pytest tests/ -v
```

### Scripts Location Reference

| Script | Path | Purpose |
|--------|------|---------|
| Start project | `scripts/start_project.ps1` | Start API + web (Windows) |
| Create superadmin | `apps/api/scripts/create_superadmin.py` | First-time superadmin setup |
| Seed data | `apps/api/scripts/seed_data.py` | Populate reference data |
| Cleanup images | `apps/api/scripts/cleanup_verification_images.py` | ID retention cleanup |
| Notification worker | `apps/api/scripts/notification_worker.py` | Process notification queue |

---

## Appendix B: Evidence Checklist Summary

For each testing session, capture evidence for:

- [ ] ENV-xxx: Environment checks passed
- [ ] ZAM-xxx: All Zambales scope tests passed
- [ ] AUTH-xxx: All authentication tests passed
- [ ] ROLE-xxx: Role permissions verified
- [ ] SEC-xxx: Security checks passed
- [ ] WEB-xxx: Resident flows work
- [ ] ADMIN-xxx: Admin flows work
- [ ] SUPER-xxx: SuperAdmin flows work
- [ ] API-xxx: API contracts verified
- [ ] DEPLOY-xxx: (If deploying) Deployment smoke tests passed

---

*End of PROJECT_ERROR_CHECKLIST.md*
