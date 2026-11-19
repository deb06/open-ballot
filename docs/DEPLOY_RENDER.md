# Deploying Open Ballot (zero cost)

## Render (free tier) — recommended path

1. Push this repo to GitHub.
2. In Render: **New → Blueprint** and point at the repo. Render reads `render.yaml`
   and creates the `open-ballot` web service (Docker) plus a free PostgreSQL.
3. Render builds the `Dockerfile`, exposes the service on a `*.onrender.com` URL.
4. On first boot, `db_ensure_ready()` creates the schema and seeds the admin
   account using `ADMIN_EMAIL` / `ADMIN_PASSWORD` (check the Render dashboard for
   the generated admin password).

### Caveats on the free tier
- Free web services **sleep after 15 min of inactivity** (cold start ~30s).
- Free PostgreSQL **expires after 90 days**. For a permanent free database use
  [Neon](https://neon.tech) or [Supabase](https://supabase.com) (both free,
  no expiry) and set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`,
  `DB_DRIVER=pgsql` as environment variables instead of the Render database.

## Local Docker smoke test

```bash
docker build -t open-ballot .
docker run --rm -p 8080:8080 \
  -e DB_DRIVER=pgsql -e DB_HOST=host.docker.internal -e DB_PORT=5433 \
  -e DB_NAME=open_ballot -e DB_USER=postgres -e DB_PASS= \
  open-ballot
# open http://localhost:8080
```
