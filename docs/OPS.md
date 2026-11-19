# Platform Operations

## Error tracking (Sentry)
Set `SENTRY_DSN` in the environment (Render dashboard or `.env`). Both server-side fatals and uncaught client errors are reported to that DSN in a best-effort, non-blocking way. Leave it unset to disable.
`APP_ENV` defaults to `production` and is attached to reports.

## Automated backups
Local PostgreSQL:
```powershell
npm run db:backup
```
This writes `backups/open-ballot-<timestamp>.sql` (gzipped when `gzip` is available) using `pg_dump` from the portable PostgreSQL install. The `backups/` folder is gitignored.

For production, configure a scheduled `pg_dump` against the managed database (Neon also provides point-in-time recovery). Store backups off-host.

## Public API keys
Admins can create read-only keys at **Admin → API keys**. Send the key in the `X-API-Key` header:

- `GET /api/public/elections` — published elections
- `GET /api/public/results/:id` — signed results for a closed election

Keys are shown once at creation and stored as SHA-256 hashes. Revoke them any time from the same page.

## Webhook delivery history
**Admin → Webhooks → Deliveries** shows the last 50 deliveries per hook, with HTTP status, success/failure, and timestamps. Each `vote.cast` delivery is signed with HMAC-SHA256 in `X-Webhook-Signature`.

## Local parity with Docker
```powershell
npm run docker:up     # build + start PHP app on :8080 and PostgreSQL on :5432
npm run docker:down   # stop and remove containers
```
`docker-compose.yml` wires the app to the `db` service using `DB_DRIVER=pgsql`. The schema and admin user are created on first boot.

## Uptime history
`/status` records an hourly health snapshot and shows a 90-day uptime bar chart. The free-tier sleep cycle is reflected in these snapshots.
