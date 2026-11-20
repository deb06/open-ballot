# Open Ballot — project crux (handoff to Claude)

## What it is
A secure, anonymous, receipt-verifiable online voting platform (student/community elections).
Live demo: https://open-ballot.onrender.com — already deployed, healthy, with full demo data.
Repo: https://github.com/deb06/open-ballot (branch `main`; check `git rev-parse --short HEAD` for
the exact commit — generated docs are bumped by CI, so this file deliberately avoids pinning one).

## Stack & architecture
- Frontend: plain HTML/CSS/vanilla JS component system. NO build step, NO framework, NO Vite/bundler.
  - `public/js/core.js`, `components.js`, `public.js`, `admin.js`, `design.js`, `theme.js`, `i18n.js`, `meta.js`.
  - History API path routing via `router.php` (NOT hash routing).
  - Dark default + light + system theme; EN/ES i18n; local vendored axe + qrcode.
- Backend: one PHP monolith (`src/php/api.php`, ~1000+ lines) with `bootstrap.php`, `config.php`, `db.php`,
  `domain.php`, `security.php`, `validation.php`, `http.php`, `oauth.php`, `pdf.php`.
  - PDO prepared statements; dual schema: `schema.sql` (MariaDB local) and `schema.pgsql` (Postgres prod).
    KEEP THEM IN SYNC. `db_ensure_ready()` runs migrations + seed at boot.
  - API under `/api` and `/api/v1`; OpenAPI spec at `public/openapi.json`.
- Runtime: Docker `php:8.3-cli-alpine` + `php -S` with `PHP_CLI_SERVER_WORKERS=4` and persistent PDO
  (needed because remote Neon handshakes are slow and would block health checks).
- Local: Windows/PowerShell scripts download portable PHP 8.5.13 + MariaDB (port 3307), app on
  http://127.0.0.1:3000. `npm start` / `npm stop` / `npm test`.

## Repo map (top level)
`public/` (app + styles/tokens.css, styles.css, styles/components.css), `src/php/`, `router.php`,
`Dockerfile`, `render.yaml`, `docker-compose.yml`, `scripts/*.ps1`, `test/smoke.php`, `tools/php/`,
`docs/` (FUTURE_ROADMAP.md, DEPLOY_RENDER.md, OPS.md, generated README + DOCX/PDF report),
`data/secret.key` (receipt HMAC key), `package.json`.
Progress logs: `C:\Users\DEBMALYA\.opencode\plan\enhancement_plan.md` + `docs/FUTURE_ROADMAP.md`.

## Feature status — ALL waves shipped (do not re-implement)
- Trust: public results archive, receipt Merkle index + inclusion proofs, full audit-chain verifier,
  observer role (read-only), signed PDF results.
- Security: sessions, login alerts, trusted devices, password policy, OAuth (GitHub/Google),
  recovery contact, MFA, backup codes, passkeys/WebAuthn, API keys, HMAC-chained audit log.
- Elections: ranked-choice IRV, multi-choice, templates, bulk voter import UI, email invitations,
  wizard creation flow, per-election branding.
- Ops: Sentry-ready, backups, status history, public API + keys, webhook history, docker-compose.
- Nice-to-have: i18n EN/ES, email digest, results party screen, command palette, sparklines,
  filter chips, bulk actions, responsive tables, admin drawer.
- Ballot privacy model: `votes` has NO voter id/timestamp; `participation` stores who voted separately;
  `UNIQUE(election_id, voter_id)` enforces one vote; casting is atomic in one transaction.

## Organizations (multi-tenant)
- Platform admin = global `admin` role (from `ADMIN_EMAIL`/`ADMIN_PASSWORD`). Org admins use `org_admin`
  plus `users.organization_id`; elections carry `organization_id`.
- Public signup: `POST /api/organizations/register` auto-approves and signs the org admin in.
  Pages: `/register-organization`, `/join?token=…` (invite acceptance), `/org` (member view).
- Membership: `organizations.membership_mode = 'domain'` auto-attaches anyone whose email domain matches
  (also adopted at login for older accounts); `'invite'` requires an `organization_invites` token.
- Org admins get a scoped subset of the admin API: `/api/admin/{overview,elections,users,audit,schema}`
  plus `/api/org*`; platform-only areas (webhooks, API keys, org list) stay `admin`-only.
- Any schema change must keep `schema.sql`, `schema.pgsql` and `db_migrate_final()` aligned. IMPORTANT:
  never create an index on a new column inside the schema script itself — `db_add_column()` runs after
  `db_run_script()`, so on an existing DB the index would fail before the column exists. Create such
  indexes in `db_migrate_final()` instead.
- Verified live: org register → org read → domain member auto-join → scoped election create/list →
  platform endpoint denied (403). Temporary test org was deleted afterwards.

## Public polls (individuals, no organization needed)
- Any signed-in user creates a poll via `POST /api/polls` — same election engine with `kind='poll'`, a
  unique `slug`, `allow_anonymous=1`, and options stored as candidates.
- Share link `/p/<slug>` is returned at creation. Anyone with the link votes without an account.
- One vote per browser: `voter_token_for()` sets an `ob_vote_<id>` cookie and stores only a keyed hash in
  `participation.voter_token` (with `voter_id = NULL`). Never store the raw cookie value.
- Poll endpoints: `GET /api/polls/:slug`, `POST /api/polls/:slug/vote`, `GET /api/polls/:slug/results`,
  `GET /api/polls/mine`. Pages: `/polls`, `/polls/new`, `/p/:slug`.
- `participation.voter_id` is nullable (org elections still use it); keep the anonymous and account
  flows separate so ballot privacy is preserved.

## Poll moderation
- `poll_reports` table: one report per poll per anonymous reporter token; reasons spam/misleading/
  harassment/other. `POST /api/polls/:slug/report` is public and CSRF-exempt.
- Platform-admin only: `GET /api/admin/polls`, `GET /api/admin/polls/:id/reports`,
  `PATCH /api/admin/polls/:id/reports/:reportId`, `PATCH /api/admin/polls/:id` (close/reopen).
- Admin UI at `/admin/polls`. No voter or receipt data is exposed to moderators.

## Poll reminders
- Signed-in voters opt in with `POST /api/polls/:slug/subscribe` (and `DELETE` to opt out); poll payload
  exposes `subscribed` for the current user.
- `GET /api/cron/poll-reminders?secret=<CRON_SECRET>` emails each subscriber once for polls closing within
  24h, then sets `poll_subscriptions.reminded_at` so it is not repeated. Point an external scheduler at it.
- `send_mail()` writes to `data/mail.log` when no local MTA exists and counts that as delivered.

## Visual identity — current direction (civic editorial + Swiss grid)
- Public: editorial serif hierarchy (h1/h2/h3), warm paper/ink surfaces, flat brass accent `#d9a441`,
  hairline rules, restrained radii (3/5/8/10/12px), no gradients or shadows.
- Admin: same neutral surfaces, denser control-room layout, mono labels for metadata.
- Dark surfaces are warm near-black (`#0c0c0a`), light surfaces warm paper (`#f5f3ec`).
- Functional gradients remain only where they carry meaning (progress donut, sparklines, skeleton shimmer).
- 0 axe WCAG A/AA violations in both themes after this refinement.

## Visual identity — anti-"AI slop" (important, already fixed)
- Flat institutional brass accent `#d9a441`. NO violet `#8b7bff`, NO violet→cyan gradient.
- Solid page background, hairline borders, no glass overlays or big shadows, radius 10px.
- Editorial serif display on public `h1` (Iowan/Palatino/Georgia); sans for functional admin.
- Hero is a concrete verified-receipt / audit excerpt, NOT a three-tile motif.
- Favicon, PWA icons and OG image regenerated to match. Preserve this direction.

## Verification (all green)
- `npm test` → 55/55 smoke checks (org tenancy, polls, moderation, reminders, security phases 1–2).
- Security program: `docs/SECURITY_PLAN.md` (Phases 1–5 complete) and `docs/INCIDENT_RESPONSE.md`.
- axe-core: 0 WCAG A/AA violations on 12 audited routes in BOTH themes.
- Zero browser console errors.
- CI: `scripts/lib.ps1` pins PHP 8.5.13 + SHA256 (8.5.12 URL 404s — do not downgrade).
- Live: 10/10 health checks, stats users=15/open=1/completed=2/ballots=11, 4 elections, brass theme served.

## Live deployment — current truth
- Render free web service `srv-dbvjd3ff3r2c73ce894g` (Blueprint-managed from `render.yaml`),
  permanent URL https://open-ballot.onrender.com. Deploys auto on push to `main` (~35–50s cached).
- **The app reads Neon**, not Render's DB. Verified by an A/B test: a title changed in Neon only
  appeared on the live API.
- Mechanism: `DATABASE_URL` env var set in the Render dashboard; `src/php/config.php` parses it and
  OVERRIDES the individual `DB_*` vars. `render.yaml` declares it with `sync: false` so blueprint
  syncs won't erase it.
- Three fixes that made Neon work from Render's Alpine PHP:
  1. Postgres URL without explicit port must default to **5432** (config.php).
  2. Neon pooler needs `options='endpoint=<first-label-of-host>'` for libpq without SNI — added in
     `db.php` for `*.neon.tech` hosts.
  3. `PHP_CLI_SERVER_WORKERS=4` + `PDO::ATTR_PERSISTENT` so slow remote handshakes don't block
     Render's health check (otherwise 502 flapping).
- `APP_SECRET` env var is set on Render to the same key that minted the imported receipt hashes (local
  `data/secret.key`), so public receipt verification works on the live site.
- Neon data fully synced: 15 users, 4 elections, 18 candidates, 11 ballots, 11 vote_choices,
  11 participation, 145 audit_log. Sequences reset.
- Render's own PG18 DB (`open-ballot-db`) still exists but is UNUSED; its Dec 20 2026 expiry is irrelevant.

## Credentials (intentionally not committed)
This is a public repository — live credentials are deliberately omitted here. They are available in:
- **Neon connection string**: the `DATABASE_URL` env var in the Render dashboard (Environment tab), or the Neon console.
- **Render dashboard auth**: the logged-in browser session; token lives in localStorage key `render-auth`
  on `dashboard.render.com` (use browser tools; do not hardcode it).
- **Admin credentials**: the `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars in the Render dashboard; local
  defaults documented in `README.md`.
- A full unredacted copy of this crux exists only in a private local file outside the repository.

## Gotchas / do not regress
- Do NOT "simplify" back to `fromDatabase` DB_* wiring on Render — that silently sends the app to
  the expiring Render DB. Keep `DATABASE_URL`.
- `README.md` documents the `DATABASE_URL` flow (regenerated from `docs/README.template.md` — edit the
  template, not the generated README).
- Receipt hashes in imported rows were minted with the LOCAL `data/secret.key`; the live app now reads
  the same key via the `APP_SECRET` env var (declared `sync: false` in `render.yaml`). Verified end to
  end: a ballot seeded in Neon with a known code returned `valid=true, counted=true` from
  `/api/verify/:code`. If receipts ever stop verifying, check `APP_SECRET` first.
- Any schema change must be applied to BOTH `schema.sql` and `schema.pgsql` AND the live Neon DB.
- Watch for CHECK constraints in Postgres (`users_role_check` must include `observer`).
- Free Render sleeps when idle; first request can be slow. Health endpoint is DB-free by design.
