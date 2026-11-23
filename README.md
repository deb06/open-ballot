# Open Ballot

[![CI](https://github.com/deb06/open-ballot/actions/workflows/docs.yml/badge.svg)](https://github.com/deb06/open-ballot/actions/workflows/docs.yml)
[![Smoke tests](https://img.shields.io/badge/smoke%20tests-62%2F62-brightgreen)](test/smoke.php)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A secure, anonymous and receipt-verifiable online voting platform. Generated on 2026-11-23 from commit `82621d3`.

> **Live demo:** <https://open-ballot.onrender.com> · **Report:** [DOCX](docs/Open_Ballot_Project_Report.docx) · [PDF](docs/Open_Ballot_Project_Report.pdf)

| Layer | Technology |
|---|---|
| Client | HTML5, CSS3, vanilla JS component library, design tokens, PWA |
| Server | PHP 8.5 (PDO, prepared statements), PHP 8.3 in Docker |
| Database | PostgreSQL 16 (production, Neon) / MariaDB 11.8 (local) |
| Hosting | Render free web service + Neon free PostgreSQL, permanent HTTPS subdomain |
| API | `/api` and `/api/v1` (OpenAPI 3.1 spec at `public/openapi.json`) |

Open Ballot lets an organisation run an election end to end: voters register once, cast a secret ballot from any device, and receive a receipt code that proves their ballot was recorded without revealing how they voted. Administrators get a dashboard for elections, candidates, the register, live results, analytics and an HMAC-chained audit log.

---

## Quick start (local)

Requirements: **Windows 10/11 with PowerShell 5.1+**. The setup script downloads portable PHP and MariaDB on first use.

```powershell
.\start.bat
```

Then open <http://127.0.0.1:3000>. Stop with `.\stop.bat`.

Default administrator (local): `admin@openballot.local` / `Admin#2026` — change it immediately, or set `ADMIN_PASSWORD` before first run.

```powershell
npm test        # 38-check end-to-end smoke test
npm start       # start MariaDB + PHP server
npm stop        # stop everything
```

---

## Production deployment (free)

1. Push to `main` — Render deploys automatically from `render.yaml`.
2. Create a free [Neon](https://neon.tech) PostgreSQL database and copy its connection string.
3. In Render → **Environment**, set `DATABASE_URL` to that connection string. `config.php` parses it and
   overrides the individual `DB_*` variables, so the app uses Neon instead of Render's own database.
   Also set `APP_URL`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
   `APP_SECRET` should match the key that minted any imported receipt hashes (`data/secret.key` locally);
   otherwise previously imported receipts will not verify. All of these are declared with `sync: false`
   in `render.yaml`, so blueprint syncs will not overwrite them.
4. UptimeRobot should ping `/api/stats` every 5 minutes to keep the free services awake.

Full guide: [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md).

---

## Features

### Voting
- Anonymous ballots — `votes` stores no voter id and no timestamp; `participation` records who voted separately
- `UNIQUE(election_id, voter_id)` enforces one ballot per voter even under concurrency
- Atomic ballot casting inside a single database transaction
- Receipt codes (`OB-XXXX-XXXX-XXXX-XXXX`) with public verification and **Merkle inclusion proofs**
- Election scheduling, draft → open → closed lifecycle, configurable result publication
- Live tally, turnout donut, share bars and activity sparkline

### Front end
- Token-based design system with dark and light themes and a living style guide at `#/design`
- Reusable component library (buttons, cards, badges, fields, modals, toasts, tabs, skeletons)
- Installable PWA: manifest, generated icons, offline-capable service worker
- WCAG-minded markup: focus traps, `aria-current`, live regions, keyboard-navigable tabs, reduced-motion support

### Administration
- Dashboard with turnout, ballots today and recent activity
- Tabbed election manager (Settings / Candidates / Results / Manage) with hero header and turnout bar
- Election cloning from a template, CSV bulk candidate import, turnout analytics
- Voter register with roles, status, activation and search
- Notifications, webhooks and HMAC-signed audit export
- Live entity-relationship diagram at `#/admin/schema`

### Security & authentication
- E-mail + password registration with `password_hash()`, server sessions and CSRF tokens
- TOTP MFA, **WebAuthn passkeys** and ten single-use **backup codes**
- Keyed receipt hashes, constant-time comparisons, per-IP/per-account rate limiting
- Strict CSP, HSTS preload, `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, COOP/CORP
- Append-only audit log that never records a voter's choice

### API
- `/api/v1` versioned routes with `X-API-Version` header
- OpenAPI 3.1 specification covering 27 paths (`public/openapi.json`)
- Central `Validator` and uniform error envelope `{ error: { code, message, timestamp, details? } }`
- `security.txt` at `/.well-known/security.txt`

---

## Documentation

| Document | Path |
|---|---|
| Project report (DOCX) | `docs/Open_Ballot_Project_Report.docx` |
| Project report (PDF) | `docs/Open_Ballot_Project_Report.pdf` |
| Deployment guide | `docs/DEPLOY_RENDER.md` |
| i18n (English + Español) | `public/js/i18n.js` + header switcher |
| Per-election branding | `brand_color`, `logo_url` on elections; editor in election form |
| Public API keys | `Admin → API keys` + `/api/public/*` |
| Results party | `/party` |
| Recovery contact | `Account → Recovery contact` |
| Weekly digest | `Account → Weekly digest` + `/api/cron/digest` |
| OAuth sign-in | `/api/auth/oauth/:provider` (GitHub/Google via env) |
| Ranked-choice IRV | `ballot_type=ranked`, `/api/elections/:id/irv` |
| Templates library | `Admin → Election → Templates` |
| Email invitations | `Admin → Election → Voters → Send invitations` |
| Observer role | `role=observer`, `/observer` |
| Ops guide | `docs/OPS.md` |
| Future roadmap (features + UI) | `docs/FUTURE_ROADMAP.md` |
| OpenAPI specification | `public/openapi.json` |
| Enhancement plan | `C:\Users\DEBMALYA\.opencode\plan\enhancement_plan.md` |

The report and this README are **regenerated automatically on every push to `main`** by `.github/workflows/docs.yml`. Report content lives in `docs/report/updates.json` applied to the pristine template in `docs/report/Report_Template.docx`. To regenerate locally:

```powershell
python scripts\generate_report.py
python scripts\generate_readme.py
```

---

## Architecture

The front end is an SPA with real path-based URLs (`/election/3`, `/admin/users`) using the History API, with server-side fallbacks for deep links and `<noscript>` content for crawlers. Because the CSP forbids inline scripts and styles, all markup is built through `el()`/`svgEl()` helpers and all styling comes from the token and component stylesheets.

```
router.php                 front controller (API + static serving)
src/php/api.php            all API routes and dispatcher
src/php/db.php             driver-aware PDO, migrations, seed
src/php/schema.sql         MariaDB schema
src/php/schema.pgsql       PostgreSQL schema
src/php/validation.php     Validator + error envelope
src/php/domain.php         elections, receipts, WebAuthn, webhooks, Merkle helpers
src/php/security.php       passwords, sessions, rate limits
public/js/                 core, components, public, admin, design views
public/styles/             tokens.css, components.css, styles.css
scripts/generate_*.py      report and README generators
.github/workflows/docs.yml documentation CI
```

The schema contains seventeen tables: core voting (`users`, `elections`, `candidates`, `votes`, `participation`), security (`sessions`, `audit_log`, `password_resets`, `email_verifications`, `rate_limits`, `mfa_challenges`, `backup_codes`, `passkeys`, `webauthn_challenges`) and platform features (`notifications`, `webhooks`).

---

## Known limitations

- The server is trusted with decrypted ballots; receipt checks and the audit chain make tampering detectable but not cryptographically impossible.
- Receipt verification reveals the choice linked to a code — treat a receipt as a secret.
- There is no identity proofing; registration can be closed and voters imported for a closed electorate.
- Free-tier hosting sleeps after inactivity; an uptime monitor is recommended.
- Ranked-choice ballots, E2E zero-knowledge proofs and custom domains are future work.

---

## License

MIT
