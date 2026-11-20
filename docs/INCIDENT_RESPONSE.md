# Open Ballot — Incident Response Runbook

## Scope
Any suspected account takeover, data exposure, abuse of public polls, or compromise of the hosting environment.

## 1. Containment (first 15 minutes)
- **Suspend the affected account** via `PATCH /api/admin/users/:id` with `{"active":false}`.
- **Revoke all sessions** for that account (deactivation already deletes them).
- **Revoke API keys** via `DELETE /api/admin/api-keys/:id` if a key may be exposed.
- **Suspend an organization** via `PATCH /api/admin/organizations/:id` with `{"status":"suspended"}`.
- **Close an abused poll** via `PATCH /api/admin/polls/:id` with `{"action":"close"}`.
- If an env secret is exposed, rotate it in the Render dashboard immediately (see below).

## 2. Secret rotation
1. Render Dashboard → service → **Environment**.
2. Rotate `ADMIN_PASSWORD`, `APP_SECRET`, `DATABASE_URL`, OAuth secrets or `CRON_SECRET` as needed.
3. Save, rebuild and deploy — this also restarts all workers.
4. Verify `/api/health` and a fresh admin login.

> Rotating `APP_SECRET` invalidates previously issued receipt hashes. Only do this after Archiving or reissuing affected receipts. With an empty production dataset this is safe.

## 3. Investigation
- Query `audit_log` for `security.rate_limit`, `auth.login_failed`, `auth.admin_login_failed`,
  `auth.password_reset`, `poll.report` and `organization.*` events.
- Correlate `ip` and `created_at`; review `sessions` for unexpected devices.
- Confirm the audit chain with `GET /api/audit/verify` and `GET /api/audit/chain`.
- Check Render logs for `[error]` / `[fatal]` entries and unexpected request patterns.

## 4. Recovery
- Re-enable accounts only after a password reset; require MFA for privileged roles.
- Restore from the last verified backup only if data integrity cannot be established otherwise
  (`scripts/backup-pg.ps1`), then verify receipt verification and election tallies.

## 5. Disclosure
- Record: what happened, affected users, timeline, containment actions, root cause, fix, and follow-ups.
- Notify affected users by email if their account or data was impacted.
- Keep receipts and the audit chain intact as evidence.

## 6. Periodic re-test
- Run `npm test` before every deploy (54+ security-aware smoke checks).
- Repeat the axe accessibility sweep and header checks after any styling change.
- Re-run this runbook as a tabletop exercise quarterly.
