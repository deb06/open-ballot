# Open Ballot — Next Development Plan

All phases below have been implemented, tested and deployed.

## Phase N1 — Public platform surfaces (features)
- **Organization directory**: `GET /api/orgs`, `GET /api/orgs/:slug`, `GET /api/orgs/:slug/elections`.
- Public pages `/orgs` (directory) and `/org/:slug` (profile with public elections).
- Header/nav entry for organizations.
- **Poll owner tools**: clone a poll (`POST /api/polls/:slug/clone`), download results as CSV
  (`GET /api/polls/:slug/results.csv`).
- **Share improvements**: QR code on the share card, copy-link button on every poll page.

## Phase N2 — API & platform tech
- Refresh `public/openapi.json` with organization, poll, moderation and reminder endpoints.
- Add `/.well-known/security.txt`.
- Extend `sitemap.xml` with the new public routes.
- Add API rate-limit metadata headers where limits are enforced.

## Phase N3 — UX & accessibility
- Axe sweep (0 WCAG A/AA violations) on every new route in dark and light.
- Keyboard and focus checks on new dialogs/buttons.
- Responsive verification of directory/profile pages.

## Phase N4 — Security hardening (continued)
- Sliding **idle session timeout** (24h default, configurable via `SESSION_IDLE_HOURS`).
- Audit entries for session expiry and security-sensitive actions.
- Confirm CSP and headers on all new static assets.

## Phase N5 — Operations & documentation
- Update `docs/SECURITY_PLAN.md`, `docs/INCIDENT_RESPONSE.md`, `docs/HANDOFF.md`, README and roadmap.
- Full smoke suite and live deployment verification.
- Keep live data clean (1 admin, 0 elections, 0 ballots) after any test artifacts.

## Definition of done
`npm test` → 59/59 green (4 new checks), 0 axe violations on all new routes in dark and light,
live health OK, working tree clean.
