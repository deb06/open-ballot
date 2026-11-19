# Open Ballot — Future Roadmap

> Status: **all feature waves complete** · Last updated 2026-11-20
> Companion to `C:\Users\DEBMALYA\.opencode\plan\enhancement_plan.md`

This document plans the next waves of work. Everything already shipped (Phases 1–2, A, H, D, B, and the targeted C/E/F/G items) is considered the **baseline**. What follows is grouped by user value and technical dependency.

---

## Completion status (2026-11-20)

| Wave | Status |
|---|---|
| 1 — Trust & transparency | ✅ Archive, receipt Merkle index, full audit-chain verifier, observer role, signed PDF |
| 2 — Account & security | ✅ Sessions, login alerts, trusted devices, password policy, OAuth (GitHub/Google), recovery contact |
| 3 — Election capabilities | ✅ Ranked-choice IRV, multi-choice, templates library, bulk voter import UI, email invitations, wizard-style creation form |
| 4 — Platform & ops | ✅ Sentry, backups, status history, public API + keys, webhook delivery history, docker-compose |
| 5 — Nice-to-haves | ✅ i18n (EN/ES), per-election branding, email digest, results party screen, command palette |
| UI Waves A–D | ✅ Shared components, breadcrumbs, command palette, voter polish, admin polish, design tokens |
| UI Wave E (visual refresh concepts) | ⏸ Optional — editorial hero, glass cards, page transitions, control-room layout |

**Verification:** 38/38 smoke checks, zero console errors, all routes browser-verified.

---

## Part 1 — Feature Roadmap

### Wave 1 — Trust & transparency (highest value)

| # | Feature | User story | Endpoint / route | Effort |
|---|---|---|---|---|
| 1.1 | **Public results archive** | "Show me final tallies of past elections, signed and immutable." | `/archive` + `/api/elections/closed` | M |
| 1.2 | **Receipt status timeline** | "When I verify, show *when* my ballot entered the Merkle tree." | Extend `/api/verify/:code` with block index | S |
| 1.3 | **Audit chain verification UI** | "Let me independently verify the whole audit chain, not just see the head." | `/api/audit/chain` (full entries) + client verifier | M |
| 1.4 | **Observer role** | "Let trusted third parties view read-only election state without admin powers." | `role=observer`, `/api/admin/*` read-only subset | M |
| 1.5 | **Signed PDF results** | "Give me a printable, signed results certificate for records." | `GET /api/elections/:id/results.pdf` | M |

### Wave 2 — Account & security hardening

| # | Feature | User story | Endpoint / route | Effort |
|---|---|---|---|---|
| 2.1 | **Session manager** | "Show my active devices and let me revoke them." | `/account` → `/api/sessions` CRUD | M |
| 2.2 | **Login alerts** | "Email me when a new device signs in." | Hook in `create_session()` + mail template | S |
| 2.3 | **Trusted devices** | "Don't ask for MFA on my own laptop for 30 days." | Device cookie + `mfa_trusted` table | M |
| 2.4 | **Password policy enforcement** | "Require 12 chars + block common passwords." | Server `validate_password()` + HIBP k-anonymity | S |
| 2.5 | **OAuth / SSO** | "Let members sign in with Google/Microsoft/GitHub." | OAuth callbacks, JIT provisioning | L |
| 2.6 | **Recovery contact** | "Let me recover access via a secondary email." | `recovery_email` + verified flow | M |

### Wave 3 — Election capabilities

| # | Feature | User story | Endpoint / route | Effort |
|---|---|---|---|---|
| 3.1 | **Ranked-choice (IRV)** | "Let voters rank candidates, not just pick one." | New ballot type + tally algorithm | L |
| 3.2 | **Approval / multi-choice** | "Let voters pick up to N options." | Extend existing `max_choices` UI | S |
| 3.3 | **Election templates library** | "Save and reuse election setups." | `election_templates` table + picker | M |
| 3.4 | **Multi-step creation wizard** | "Guide me through basics → schedule → candidates → review." | Wizard UI over existing endpoints | M |
| 3.5 | **Bulk voter import UI** | "Upload a CSV of voters and send invites." | Extend `/api/admin/users/import` | M |
| 3.6 | **Email invitations** | "Email voters a personalized ballot link." | Queue + mail templates | M |

### Wave 4 — Platform & operations

| # | Feature | User story | Endpoint / route | Effort |
|---|---|---|---|---|
| 4.1 | **Sentry error tracking** | "Get alerted when production throws." | Sentry DSN env + PHP SDK | S |
| 4.2 | **Automated backups** | "Nightly DB dumps to cheap object storage." | `pg_dump` cron / Render job | S |
| 4.3 | **Status history** | "Show 90-day uptime graph on `/status`." | Store hourly health snapshots | M |
| 4.4 | **Public API + keys** | "Let researchers query published results." | API keys + read-only v1 scope | M |
| 4.5 | **Webhooks UI improvements** | "Show delivery history and retry failed hooks." | `webhook_deliveries` table | M |
| 4.6 | **docker-compose local parity** | "Run the exact production stack locally." | `docker-compose.yml` (PHP + PG + Redis) | M |

### Wave 5 — Nice-to-haves

| # | Feature | Effort |
|---|---|---|
| 5.1 | i18n (English + one more language) | L |
| 5.2 | Custom per-election branding (logo/colors) | M |
| 5.3 | Email digest of new elections | M |
| 5.4 | Anonymous "results party" live screen | S |
| 5.5 | Keyboard shortcuts / command palette | S |

**Effort key:** S ≈ half a day · M ≈ 1–2 days · L ≈ 3–5 days

---

## Part 2 — UI / UX Plan

### Design principles (keep these)
1. **Modern institutional** — editorial hierarchy, generous whitespace, calm surfaces, restrained motion.
2. **One component system** — extend `tokens.css` / `components.css`; never hardcode colors or one-off widgets.
3. **Progressive disclosure** — advanced controls behind tabs/details, never on the first screen.
4. **Accessible by default** — keyboard paths, visible focus, announced state, reduced-motion respect.
5. **Fast, local, dependency-light** — no framework, no runtime CDN, CSP-compatible.

### Current UI inventory (baseline)

| Area | Existing views | Notes |
|---|---|---|
| Public | Home, Election detail, Verify, Help, Privacy, Status, Audit chain | Home carries stats + election cards |
| Auth | Login, Register, Forgot/Reset password, Verify email, Passkeys | Registration has a strength meter |
| Account | Account (ballots + security + password), Passkeys | Notification bell in header |
| Admin | Overview, Election manager (4 tabs), Voters, Audit log, Webhooks, Schema (ERD) | Tabbed election manager, animated ERD |

---

### UI Wave A — Information architecture

**A1. Persistent secondary navigation**
- Today: public and admin areas share one header; admin has its own nav bar.
- Plan: a single shell with contextual side rail on `#/admin/*`, collapsible on mobile; public pages get a slim top nav only.

**A2. Command palette (⌘K / Ctrl+K)**
- Fuzzy search across elections, voters, receipts, admin actions.
- Opens as an accessible dialog; keyboard-first; deep-links to any view.

**A3. Breadcrumbs everywhere**
- Public: `Home › Election › Ballot`.
- Admin: `Admin › Elections › <title> › Results`.
- Reuse one `breadcrumbs()` component with `aria-label="Breadcrumb"`.

**A4. Global empty/error/loading states**
- One `stateView()` component with variants: empty, error, offline, permission-denied, not-found.
- Replace the ad-hoc error cards with it.

---

### UI Wave B — Voter-facing polish

**B1. Home page refresh**
- Hero with live counters (already exists) → add an "upcoming" strip with countdown chips.
- Election cards: add status timeline micro-bar (open → closes in X), turnout sliver, "You voted" ribbon.
- Filter/sort toolbar: All / Open /Upcoming / Closed; sort by closing date, turnout.

**B2. Election detail**
- Sticky sub-nav (Overview · Candidates · Results · Rules) mirroring the admin tab pattern.
- Candidate cards: initials avatar → optional photo with graceful fallback, party chip, expandable bio.
- Countdown: large hero countdown card when open/scheduled (exists) → add "closes in" micro-label in the sticky bar.

**B3. Ballot & confirmation**
- Stepper: `Review → Confirm → Receipt`.
- Candidate selection: radio/checkbox grid with clear selected state and hover affordance.
- Confirmation dialog: show a plain-language summary + explicit "This cannot be changed" notice.

**B4. Receipt experience**
- Receipt card with monospace code, copy button, QR (exists), and "Verify now" CTA.
- Add **downloadable PNG receipt** (code + QR + election title + timestamp-free by design).
- Add a share-sheet with Web Share API + copy fallback.

**B5. Verify page**
- Split layout: input card on left, result on right (desktop), stacked on mobile.
- Progressive result: "Found ballot" → "In Merkle tree" → "Signature valid" as three checkpoints.
- Keep `noindex` (privacy) — do not change.

---

### UI Wave C — Admin experience

**C1. Dashboard**
- KPI cards (exists) → add sparklines and period selector (today / 7d / 30d).
- "Needs attention" panel: elections closing soon, low turnout, failed webhooks, unread audit flags.
- Live updates via 30s poll with a visible "Updated Xs ago" indicator.

**C2. Election manager**
- Keep the 4 tabs; add **Audit** and **Voters** tabs (per original plan) → 6 tabs.
- Settings tab: inline validation summaries using the `Validator` error details.
- Candidates tab: drag-to-reorder (requires a `position` column) + CSV import (exists).
- Results tab: keep bars, add hourly turnout chart (exists) + signed-results panel.

**C3. Data tables**
- One `DataTable` component: sortable headers, column visibility, pagination, density toggle, CSV export.
- Apply to: Voters, Audit log, Webhooks, Elections list.
- Add bulk selection with actions (activate/deactivate, export) for Voters.

**C4. Audit log**
- Timeline view toggle (list ↔ timeline).
- Filter chips instead of a plain select; preserve filter in URL query.
- Integrity badge: "Chain head verified" from `/api/audit/verify`.

**C5. Schema page**
- Keep the animated ERD (exists). Add: table search, "focus table" highlight, column/type tooltip, export SVG/PNG.

---

### UI Wave D — Design system evolution

**D1. Component gaps to add**
| Component | Why |
|---|---|
| `DataTable` | Replaces 4 bespoke tables |
| `Breadcrumbs` | A2/A3 |
| `Stepper` | B3 |
| `FileDrop` | Bulk imports |
| `Timeline` | Audit + election history |
| `CommandPalette` | A2 |
| `EmptyState` variants | A4 |

**D2. Token additions**
- Status scale: `--status-open`, `--status-closed`, `--status-scheduled` (semantic, theme-aware).
- Data-viz palette: 6 accessible categorical colors for charts.
- Elevation: `--shadow-focus-ring` for consistent keyboard focus.
- Motion: `--duration-fast / normal / slow` (currently ad-hoc).

**D3. Theming**
- Light theme parity audit across every view (use automated screenshot diff).
- Optional: "system" theme option that follows `prefers-color-scheme` (currently only dark/light manual).

**D4. Responsive**
- Define 4 breakpoints (existing tokens) and enforce: 360, 768, 1024, 1440.
- Admin side rail collapses to a drawer with focus trap.
- Tables become cards at ≤768px.

**D5. Accessibility**
- axe-core sweep on every route; target 0 violations.
- Keyboard walkthrough of every flow (register → vote → verify → admin actions).
- Announce async state changes with `aria-live`.

---

### UI Wave E — Visual refresh concepts (optional, higher effort)

- **E1.** Editorial homepage with a larger hero illustration and feature mosaic.
- **E2.** Dark-glass card style with subtle gradient borders (backed by tokens).
- **E3.** Motion system: page transitions, tab cross-fades, sequenced chart entry — all behind `prefers-reduced-motion`.
- **E4.** Data-dense admin "control room" layout with dockable panels.

---

## Recommended next sequence

1. **UI Wave A + D1/D2** — shared components and IA first; everything after builds on them.
2. **Wave 2.1–2.3** — session manager, login alerts, trusted devices (high trust value).
3. **UI Wave B + C** — voter and admin polish on top of the new components.
4. **Wave 1.1/1.3/1.5** — transparency features (archive, chain verifier, signed PDF).
5. **Wave 3** — ranked-choice and wizard (large, needs schema work).
6. **Wave 4/5** — ops and nice-to-haves.

---

## Success metrics

| Metric | Target |
|---|---|
| axe-core violations | 0 on all routes |
| Lighthouse (Perf / A11y / BP / SEO) | ≥95 / 100 / 100 / 100 |
| Smoke checks | 38/38 on every CI run |
| Dark/light parity | 100% of views |
| Keyboard-complete flows | 100% of core flows |
| Component duplication | 0 one-off tables/cards |
