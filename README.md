# Open Ballot

A complete, self-hosted online voting system built on the classic web stack:

| Layer    | Technology                                                        |
| -------- | ----------------------------------------------------------------- |
| Client   | HTML5, CSS3, vanilla JavaScript (hash-routed SPA, no framework)   |
| Server   | PHP 8.5 (PDO, native prepared statements)                          |
| Database | MariaDB 11.8 / MySQL 8+ (utf8mb4, InnoDB, UTC `DATETIME(3)`)       |

Open Ballot lets an organisation run elections end to end: voters register once,
cast a secret ballot from any device, and receive a receipt code that proves their
ballot was recorded without revealing how they voted to anyone else. Administrators
get a dashboard for elections, candidates, the voter register, live results and an
append-only audit log.

Everything runs locally: PHP and MariaDB are downloaded into `tools/` by the setup
script, with no administrator rights, Windows services or `npm install` required.

---

## Quick start

Requirements: **Windows 10/11 with PowerShell 5.1+**. The setup script downloads
portable PHP 8.5 and MariaDB 11.8 (about 130 MB) on first use.

```powershell
.\start.bat
```

or, equivalently:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup.ps1   # first run only
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start.ps1
```

If the portable stack has not been installed yet, run `scripts\setup.ps1` first.
Then open <http://127.0.0.1:3000>.

Stop everything with:

```powershell
.\stop.bat
```

### First-run data

The database (`open_ballot`) is created automatically and seeded with a demo
election and one administrator:

| Email                    | Password     |
| ------------------------ | ------------ |
| `admin@openballot.local` | `Admin#2026` |

> Change the administrator password from **Account → Password** immediately after
> signing in, or set `ADMIN_PASSWORD` before the first run. The public-tunnel
> setup writes a generated password to `data/admin-credentials.txt` so the
> default credentials are never exposed.

The application secret is written to `data/secret.key`. Keep it with the database:
receipt hashes are keyed with it, so losing it breaks verification for receipts
issued after the anonymous-ballot upgrade. The database itself never stores a
voter-to-choice link.

### Handy npm wrappers

Node.js is not required to run the app, but if it is installed the usual commands
work as thin wrappers around the PowerShell scripts:

```powershell
npm run setup        # install portable PHP + MariaDB
npm start            # start MariaDB + PHP server
npm stop             # stop both
npm test             # 38-check end-to-end test
npm run db:init      # create/reset schema and seed data
npm run tunnel       # expose the running app on a public HTTPS URL
npm run tunnel:stop  # close the public URL
npm run tunnel:named:login  # authorise a Cloudflare account for a permanent URL
npm run tunnel:named:setup  # create the named tunnel and its DNS record
npm run tunnel:named        # start the permanent named tunnel
npm run tunnel:named:status # show the permanent URL and its health
```

One-click alternative from Explorer or a terminal: `.\live.bat`.

---

## Going live in one command

To put the app on the public internet without a server, a domain or a Cloudflare
account, start the app and then open a Cloudflare quick tunnel:

```powershell
.\live.bat
```

The `live.bat` shortcut starts the app if needed and then opens the tunnel in one
step. Or run the two pieces yourself:

```powershell
.\start.bat
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\tunnel-start.ps1
```

The script downloads `cloudflared` into `tools/` on first use (Cloudflare-signed
binary), prints an `https://<random>.trycloudflare.com` URL and waits until that
URL answers. That link is live for anyone, with TLS handled by Cloudflare.

Good to know:

- The quick-tunnel URL is **random and changes** every time the tunnel restarts.
  Use the **named tunnel** workflow below for a stable address on your own
  domain, or a normal server deployment.
- The tunnel only works while this PC is powered on and `cloudflared` is running.
  `scripts\tunnel-stop.ps1` closes it, and `.\stop.bat` also stops the tunnel
  before shutting the app down.
- Quick-tunnel traffic is proxied by Cloudflare, but the app still runs on your
  machine. Treat the link as public: anyone who has it can register and vote.
  Use **Voters → Add account** and a closed electorate for a real election.
- For real client IPs behind the tunnel, start the app with `TRUST_PROXY=1`
  (otherwise every visitor shares the `127.0.0.1` rate-limit bucket):

  ```powershell
  $env:TRUST_PROXY = "1"
  .\start.bat
  ```

- The tunnel script replaces the seeded administrator password with a strong
  generated one the first time the site is exposed, so the published default
  credentials cannot be used against your instance. The new credentials are
  stored in `data/admin-credentials.txt` (gitignored) and printed once.

---

## Permanent address with a named tunnel

The quick tunnel is ideal for a demonstration, but its address is random. If you
own a domain that is active on Cloudflare (the free plan is enough), the included
named-tunnel workflow gives the app a stable HTTPS address such as
`https://vote.example.com`:

```powershell
# 1. Authorise cloudflared and pick the domain in the browser
npm run tunnel:named:login

# 2. Create the tunnel and route your hostname to it
$env:TUNNEL_HOSTNAME = "vote.example.com"
npm run tunnel:named:setup

# 3. Start MariaDB, PHP and the named tunnel
.\live.bat
```

`setup` creates a tunnel named `open-ballot` (override with `TUNNEL_NAME`),
writes the ingress configuration to `data\cloudflared\config.yml`, and asks
Cloudflare to create the DNS record. Once that configuration exists, `live.bat`
and `npm run tunnel:named` use it automatically instead of a quick tunnel.

Useful commands:

```powershell
npm run tunnel:named:status  # permanent URL and health check
npm run tunnel:named         # start the connector only
npm run tunnel:named:stop    # stop the connector
```

Notes:

- The hostname must belong to a zone that is active on the same Cloudflare
  account you authorised in step 1. If `setup` cannot create the DNS record, add
  a proxied CNAME for the hostname pointing at `<tunnel-id>.cfargotunnel.com` in
  the Cloudflare dashboard, or remove the conflicting record and re-run `setup`.
- A named tunnel is still an outbound connector from this PC. The address stays
  the same across restarts, but the site is online only while this computer is
  powered on, connected and running `cloudflared`. For 24/7 availability, run the
  same stack on a VPS or a container platform (see below).
- To start automatically after sign-in, create a Task Scheduler task at logon
  whose action is `C:\path\to\live.bat` and whose start-in folder is the project
  directory.
- To move the address to a different domain later, run
  `scripts\tunnel-named.ps1 login -Force`, then `setup` again with the new
  `TUNNEL_HOSTNAME`.
- Administrator credentials are still rotated before exposure, and `live.bat`
  sets `TRUST_PROXY=1` so audit entries and rate limits use the real visitor IP.

For a deployment that does not depend on this computer, run the app on a VPS or
a container platform: serve `public/` with Apache/nginx + PHP-FPM, route `/api/*`
through `router.php`, set `DB_*` environment variables to a managed
MySQL/MariaDB instance, and terminate TLS in front. The PHP code needs no
changes. Avoid the PHP built-in server in production.

---

## Features

**Voting**
- Email + password registration with `password_hash()` (bcrypt)
- Anonymous ballots: `votes` stores only election, candidate and a random ballot
  id — no voter id and no timestamp
- Participation is recorded separately in `participation`, with
  `UNIQUE(election_id, voter_id)` enforcing one ballot per voter even under
  concurrent requests
- Ballot casting is a single transaction: lock the election, check it is open,
  record participation, insert the anonymous ballot, and roll everything back on
  any error
- Receipt code (`OB-XXXX-XXXX-XXXX-XXXX`) for every ballot, publicly verifiable
- Election scheduling (open / close dates), draft → open → closed lifecycle
- Configurable result publication: always, after voting, after close, or never
- Live tally refresh, turnout donut, share bars, "Leading" marker

**Administration**
- Dashboard with turnout, ballots today and recent activity
- Create/edit/delete elections; candidate management (locked once ballots exist)
- Voter register: search, promote/demote admins, activate/deactivate accounts
- Results timeline sparkline and CSV export
- Append-only audit log with filters (auth, elections, candidates, ballots, users)

**Security**
- Session cookies are `HttpOnly`, `SameSite=Strict`, `Secure` behind HTTPS, and only
  a SHA-256 hash of the session token is stored in the database
- CSRF token bound to the session, required on every state-changing request
- Origin checks on mutating requests
- Per-IP / per-account rate limiting for login, registration, ballots and verification
- Constant-time comparisons; dummy password hash so unknown accounts take the same
  time to fail as real ones
- Path-traversal-safe static file serving
- Strict Content-Security-Policy (`script-src 'self'`), `X-Frame-Options: DENY`,
  `nosniff`, restrictive `Referrer-Policy`, `Permissions-Policy`,
  `Cross-Origin-Resource-Policy` and HSTS over HTTPS
- Every administrative action and ballot event is written to the audit log, without
  recording a voter's choice

---

## Configuration

Everything is set through environment variables:

| Variable        | Default                  | Description                                        |
| --------------- | ------------------------ | -------------------------------------------------- |
| `PORT`          | `3000`                   | Listening port                                     |
| `HOST`          | `127.0.0.1`              | Bind address (`0.0.0.0` to accept LAN connections) |
| `ADMIN_NAME`    | `Election Administrator` | Seeded administrator display name                  |
| `ADMIN_EMAIL`   | `admin@openballot.local` | Seeded administrator email                         |
| `ADMIN_PASSWORD`| `Admin#2026`             | Seeded administrator password (first run only)     |
| `DATA_DIR`      | `./data`                 | Directory for `secret.key` and logs                |
| `DB_HOST`       | `127.0.0.1`              | MariaDB/MySQL host                                 |
| `DB_PORT`       | `3307`                   | MariaDB/MySQL port                                 |
| `DB_NAME`       | `open_ballot`            | Database name                                      |
| `DB_USER`       | `openballot`             | Database user                                      |
| `DB_PASS`       | `OpenBallot#2026`        | Database password                                  |
| `TRUST_PROXY`   | unset                    | Set to `1` behind a reverse proxy to trust `X-Forwarded-For` / `X-Forwarded-Proto` |

Example:

```powershell
$env:PORT = "8080"
$env:ADMIN_PASSWORD = "a-much-better-password"
.\start.bat
```

The seeding runs only when the database is empty, so changing `ADMIN_PASSWORD`
later has no effect on an existing database.

---

## How the secrecy model works

The database separates **who voted** from **what was chosen**:

1. `participation` stores `(election_id, voter_id, voted_at)`. Its unique key
   `(election_id, voter_id)` is the hard guarantee behind one person, one vote.
2. `votes` stores `(random id, election_id, candidate_id, receipt_hash)`.
   It has no user id, no voter hash and no timestamp, and its random primary key
   does not reveal insertion order. Nothing in the schema joins a voter to a
   ballot.
3. Ballot casting runs in one transaction. The election row is locked and its
   status re-checked, participation is inserted, and the anonymous ballot is
   inserted. Any error — including a duplicate participation key from a
   simultaneous request — rolls the whole transaction back.
4. Receipts are random 80-bit codes. Only a keyed hash
   `HMAC-SHA256(secret, "receipt:<code>")` is stored, so the database cannot
   recover a receipt code. Verification recomputes the hash from the code the
   voter supplies. Receipts issued before the anonymous-ballot upgrade still
   verify through their legacy SHA-256 hash.

An attacker who steals only the database learns who voted and the aggregate
tally, but cannot link any ballot to a voter. Keep `data/secret.key` off the
database host and serve traffic over HTTPS.

### Known limitations (important)

This is a solid, self-contained voting application, but it is **not** a
cryptographically end-to-end verifiable (E2E-V) election system. In particular:

- The server is trusted with decrypted ballots. A malicious server operator could
  change a tally; the audit log and receipt verification make tampering detectable
  only if voters keep and check their receipts.
- Receipt verification reveals the **choice** linked to a code. Treat a receipt as
  a secret; anyone holding it can check your vote.
- There is no identity proofing: registration is open, so an election is only as
  trustworthy as its voter register. Use the admin **Voters** page to create
  accounts for a closed electorate and turn registration off at the network level
  (e.g. reverse proxy) if needed.
- Rate limiting is in-memory and per PHP process; run a single server process, or
  add a shared store before scaling horizontally.
- Cookies are only marked `Secure` when the request arrives over HTTPS (or via a
  trusted proxy), so deploy behind TLS in production.
- The included PHP built-in server is for development. In production, point Apache,
  nginx + PHP-FPM or IIS at `public/` and route `/api/*` through `router.php`; the
  PHP code itself needs no changes.

---

## Project layout

```
router.php             front controller (API routes + static serving)
src/php/bootstrap.php  environment/config loader
src/php/config.php     environment-driven configuration
src/php/db.php         PDO connection, schema bootstrap, seed data
src/php/schema.sql     MySQL/MariaDB schema
src/php/security.php   passwords, HMACs, receipts, rate limiting
src/php/http.php       headers, JSON bodies, cookies, static files
src/php/domain.php     validation, elections, sessions, serialization
src/php/api.php        all API routes and the dispatcher
scripts/setup.ps1      download portable PHP + MariaDB, create databases
scripts/start.ps1      start MariaDB + PHP server
scripts/stop.ps1       stop the tunnel, PHP server and MariaDB
scripts/tunnel-start.ps1  quick Cloudflare tunnel (temporary public URL)
scripts/tunnel-named.ps1  permanent hostname via a named Cloudflare tunnel
scripts/tunnel-stop.ps1   close the public URL (quick or named)
scripts/db-start.ps1   start MariaDB only
scripts/db-stop.ps1    stop MariaDB only
scripts/init-db.php    create/reset schema and seed data
scripts/prepare-public.php  rotate the default admin password before exposure
scripts/test.ps1       run the smoke test
test/smoke.php         38-check end-to-end API test
public/index.html      SPA shell
public/styles.css      design system
public/js/core.js      DOM helpers, API client, router, modals, toasts
public/js/public.js    home, election, ballot, verify, account views
public/js/admin.js     dashboard, election manager, voters, audit log
data/                  MariaDB data directory, secret key, credentials, logs (gitignored)
tools/                 portable PHP, MariaDB and cloudflared binaries (gitignored)
```

The frontend is a hash-routed single-page app. Because the CSP forbids inline
scripts and styles, all markup is built through `el()`/`svgEl()` helpers and all
styling comes from `styles.css`.

---

## Database

The schema lives in `src/php/schema.sql`. Seven InnoDB tables:

- `users` — accounts, roles (`voter`/`admin`), activation and last login
- `elections` — status, result visibility and schedule
- `candidates` — ordered per election
- `votes` — anonymous ballots: random id, election, candidate, receipt hash
  (no voter id and no timestamp)
- `participation` — who voted in which election, with
  `UNIQUE(election_id, voter_id)` and the time they voted
- `sessions` — hashed session token, CSRF secret, expiry, IP, user agent
- `audit_log` — append-only actions with JSON details and IP

All timestamps are stored as UTC `DATETIME(3)` and serialized to ISO-8601 (`…Z`)
by the PHP layer.

### Local MariaDB notes

`scripts/setup.ps1` initialises MariaDB in `data/mysql` and starts it on
`127.0.0.1:3307` (deliberately not 3306, so it never conflicts with an existing
MySQL install). It creates:

- database `open_ballot` and test database `open_ballot_test`
- application user `openballot` / `OpenBallot#2026` (stored in `src/php/config.php`
  defaults and used by the app)

The MariaDB **root** account has **no password** and binds to `127.0.0.1` only.
That is convenient for local development but should never be exposed to a network.
For a real deployment, set a root password and change the application credentials
via `DB_USER` / `DB_PASS`.

---

## Resetting the installation

Reset the schema and all data without reinstalling the database:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\stop.ps1
tools\php\php.exe scripts\init-db.php --reset
.\start.bat
```

This drops every application table, recreates the schema and re-seeds the demo
data (including the default administrator). `data/secret.key` is kept.

To start completely fresh, stop the app, delete `data/`, and run `scripts\setup.ps1`
again.

## Running the tests

```powershell
npm test
```

or:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\test.ps1
```

The smoke test boots the app on an ephemeral port against the isolated
`open_ballot_test` database with a temporary `DATA_DIR`, then verifies health,
registration, login, CSRF enforcement, anonymous ballots, one-vote enforcement,
receipt verification, result visibility, admin workflows, candidate locking,
account management, password changes and audit logging — 38 checks in total.

## License

MIT
