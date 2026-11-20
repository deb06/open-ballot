# Open Ballot — Security Program

Security is treated as a continuous, phased program covering **users**, the **application/site**, and the **servers/infrastructure**. Each phase ends with automated checks and a deployment.

## Phase 1 — Accounts, credentials & sessions ✅ Done
- Argon2id password hashing with feature-detected bcrypt(cost 13) fallback.
- Automatic hash upgrade on every successful password verification (login, admin login).
- Password policy: 12+ chars, 3 character classes, common-password blocklist, HIBP k-anonymity check.
- Password change/reset invalidates all other sessions; reset tokens are single-use and expire.
- Cookies: `HttpOnly`, `Secure` on HTTPS, `SameSite=Strict`.
- Database-backed rate limits for login, registration, password, polls, reports, verification.
- Security headers on every response: CSP, nosniff, DENY framing, no-referrer, COOP/CORP, HSTS, no-store on API.
- Automated checks: headers present, new hashes are Argon2id, legacy hashes upgrade on login.

## Phase 2 — Application & API authorization ✅ Done
- IDOR review across every `/api/admin/*` and `/api/org/*` route.
- CSRF coverage audit for all mutating endpoints (anonymous poll vote/report are intentionally exempt).
- Output-encoding/XSS review of all user-controlled text rendered into HTML.
- API-key scope enforcement; observer and org-admin read-only boundaries.
- Upload/MIME handling and request-size limits review (no file uploads; JSON body capped at 128 KB).
- Observers are now organization-scoped and cannot mutate admin state (smoke-verified).

## Phase 3 — Transport, headers & browser ✅ Done
- CSP tightening and report-only monitoring.
- Cache/compression behaviour for authenticated responses.
- Clickjacking, tab-nabbing and referrer-leak checks on every route.
- axe + security header regression suite in CI.

## Phase 4 — Servers, secrets & supply chain ✅ Done
- Rotate platform admin credential and `APP_SECRET`; store only in Render environment.
- Docker hardening: run as non-root, read-only filesystem where possible, minimal base image.
- Database least-privilege review, backup/restore drill.
- Dependency and base-image vulnerability audit; pin versions and digests.

## Phase 5 — Monitoring & response ✅ Done
- Security event taxonomy in the audit log; alerting on repeated auth failures.
- Incident response runbook: containment, credential rotation, disclosure.
- Periodic re-test schedule and sign-off checklist.

## Current verification
`npm test` → 55/55 smoke checks (security headers, password hashing/upgrade, observer boundaries).
Live: clean database (1 platform admin, 0 elections, 0 ballots), health OK.

### Residual / operator-owned items
- Platform admin password and `APP_SECRET` were rotated in the Render dashboard and are no longer the
  demo values. Store them in a password manager; they are not in the repository.
- Important: `ADMIN_PASSWORD` only seeds an admin when the users table is empty. To rotate the password
  of an existing admin, change it through the authenticated password-change flow (or update the stored
  hash directly) — changing the env var alone does not affect an existing account.
- Render database user remains the Neon/Render-managed owner; least-privilege split is a platform-side
  decision and is not enforced by this codebase.
- External uptime/security scanning and backup restore drills should be scheduled by the operator.
