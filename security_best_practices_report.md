# Security Best Practices Report

Date: 2026-02-08  
Scope reviewed: `apps/api`, `apps/web`, `apps/admin`, root operational scripts/files

## Executive Summary

The codebase has **6 security findings** relevant to production readiness:

- **1 Critical**
- **1 High**
- **3 Medium**
- **1 Low**

The most urgent issue is plaintext and predictable admin credential handling in tracked files and seeding scripts.

---

## Critical Findings

### SEC-001
- Rule ID: `SECRETS-HANDLING-001`
- Severity: **Critical**
- Location: `admin_credentials.txt:14`, `admin_credentials.txt:17`
- Evidence:
  - The file includes a credential table with a **Password** column.
  - Multiple entries include plaintext credentials.
- Impact:
  - If this repository is shared/cloned/backed up, admin accounts can be immediately compromised.
  - If any of these credentials were ever used in staging/production, compromise extends beyond source exposure.
- Fix:
  - Remove `admin_credentials.txt` from the repository and history.
  - Immediately rotate all affected admin passwords and invalidate active sessions/refresh token families.
  - Add a hard `.gitignore` rule for this file pattern and enforce secret scanning in CI.
- Mitigation:
  - Restrict admin onboarding to one-time secrets delivered out-of-band with forced password reset at first login.
- False positive notes:
  - If all listed credentials are fake and never used, impact is reduced but the pattern remains unsafe.

---

## High Findings

### SEC-002
- Rule ID: `AUTH-CREDENTIAL-GENERATION-001`
- Severity: **High**
- Location: `apps/api/scripts/seed_all_admins.py:59`, `apps/api/scripts/seed_all_admins.py:89`, `apps/api/scripts/seed_all_admins.py:129`, `apps/api/scripts/seed_all_admins.py:185`, `apps/api/scripts/seed_all_admins.py:280`, `apps/api/scripts/seed_all_admins.py:283`, `apps/api/scripts/clear_and_repopulate.py:182`, `apps/api/scripts/clear_and_repopulate.py:238`, `apps/api/scripts/seed_locations_and_admins.py:82`, `apps/api/scripts/seed_locations_and_admins.py:174`
- Evidence:
  - Admin passwords are deterministically generated from municipality slug/name plus a known suffix.
  - Scripts print and export generated passwords to `admin_credentials.txt`.
- Impact:
  - Attackers can predict admin passwords from publicly known municipality names/slugs.
  - Large-scale admin account takeover is possible if seeded accounts remain unchanged.
- Fix:
  - Replace deterministic generation with cryptographically random per-account temporary passwords.
  - Enforce password reset on first login for all seeded/admin-created accounts.
  - Remove plaintext password export behavior from all seeding scripts.
- Mitigation:
  - Add post-seed enforcement checks that reject weak/predictable password patterns.
- False positive notes:
  - If these scripts are never used against production data, direct exposure is lower; still high risk for operational mistakes.

---

## Medium Findings

### SEC-003
- Rule ID: `FLASK-CSRF-001`
- Severity: **Medium**
- Location: `apps/api/config.py:230`, `apps/api/config.py:235`, `apps/api/config.py:240`, `apps/api/routes/auth.py:443`, `apps/api/routes/auth.py:738`, `apps/api/routes/auth.py:1803`, `apps/api/routes/auth.py:507`, `apps/admin/src/lib/api.ts:65`
- Evidence:
  - JWTs are accepted from cookies.
  - Refresh token cookies are issued.
  - `JWT_COOKIE_CSRF_PROTECT` defaults to `False`.
  - Production default `JWT_COOKIE_SAMESITE` is `None`.
  - Admin refresh call sends credentials but no CSRF header/token.
- Impact:
  - Cross-site request forgery can target cookie-authenticated refresh flows.
  - Current impact is mainly session churn/forced refresh behavior, but risk increases if additional cookie-authenticated state-changing routes are introduced.
- Fix:
  - Set `JWT_COOKIE_CSRF_PROTECT=True` in production.
  - Require and validate CSRF token/header on refresh and any cookie-authenticated state-changing endpoints.
  - Use `SameSite=Lax` unless a proven cross-site requirement exists.
- Mitigation:
  - Add strict Origin/Referer validation on refresh endpoint.
- False positive notes:
  - If cookies are never used for auth in production, this drops in severity; current code does issue refresh cookies.

### SEC-004
- Rule ID: `REACT-STORAGE-001`
- Severity: **Medium**
- Location: `apps/web/src/lib/api.ts:53`, `apps/web/src/lib/api.ts:165`, `apps/admin/src/lib/api.ts:36`, `apps/admin/src/lib/api.ts:92`
- Evidence:
  - Access tokens are persisted in `sessionStorage` for both resident and admin frontends.
- Impact:
  - Any XSS vulnerability in either frontend enables token theft and API impersonation for token lifetime.
- Fix:
  - Keep access tokens in memory only; rely on HttpOnly refresh cookies for session continuity.
  - Minimize token lifetime and rotate aggressively.
- Mitigation:
  - Strengthen CSP and XSS defenses to reduce exploitability.
- False positive notes:
  - If you can prove no XSS vectors and strict CSP+Trusted Types are enforced end-to-end, practical risk decreases but does not become zero.

### SEC-005
- Rule ID: `OUTPUT-CSV-001`
- Severity: **Medium**
- Location: `apps/api/routes/admin.py:770`, `apps/api/routes/admin.py:805`, `apps/api/utils/admin_audit.py:224`, `apps/api/utils/admin_audit.py:226`, `apps/api/routes/superadmin.py:375`
- Evidence:
  - Untrusted values (for example `reason`) are stored in audit `details`.
  - Export writes fields directly to CSV without formula neutralization.
- Impact:
  - Opening exported CSV in spreadsheet software can trigger formula injection (`=`, `+`, `-`, `@`) and data exfiltration/phishing behavior.
- Fix:
  - Escape dangerous leading characters in all CSV cells (prepend `'` when needed) before `writer.writerow`.
- Mitigation:
  - Provide safer export formats (JSON) and warn operators not to open CSV in formula-enabled mode.
- False positive notes:
  - If all logged fields are fully trusted/admin-generated, exploitability is reduced; current flow includes user-influenced fields.

---

## Low Findings

### SEC-006
- Rule ID: `FLASK-SSRF-001`
- Severity: **Low**
- Location: `apps/api/config.py:262`, `apps/api/routes/admin.py:96`, `apps/api/routes/admin.py:99`, `apps/api/routes/admin.py:113`, `apps/api/routes/documents.py:180`, `apps/api/routes/documents.py:183`, `apps/api/routes/documents.py:197`
- Evidence:
  - Remote fetch allowlist is optional and defaults to empty.
  - When empty, `_remote_content_allowed` returns `True`.
  - Server performs `requests.get(...)` on URL-style file references.
- Impact:
  - If an attacker can influence stored file reference URLs, this becomes an SSRF primitive.
- Fix:
  - Fail closed: deny remote fetch when `ALLOWED_FILE_DOMAINS` is empty.
  - Restrict to strict HTTPS allowlist and block private/link-local/metadata destinations.
- Mitigation:
  - Add outbound egress filtering at infrastructure level.
- False positive notes:
  - If URL fields are guaranteed server-generated and immutable from user input, immediate exploitability is limited.

---

## Priority Remediation Order

1. Remove/rotate exposed credentials and clean repository history (`SEC-001`).
2. Replace predictable password seeding logic and disable plaintext exports (`SEC-002`).
3. Enable CSRF protection for cookie flows and align frontend refresh requests (`SEC-003`).
4. Move access tokens out of Web Storage (`SEC-004`).
5. Patch CSV export formula injection (`SEC-005`).
6. Close SSRF fail-open behavior (`SEC-006`).
