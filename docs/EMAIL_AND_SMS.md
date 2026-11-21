# Email & SMS verification — status and configuration

## Email verification (code: works, delivery: needs SMTP)

**What works today**
- Registration creates a hashed, single-use, 24-hour token in `email_verifications`.
- `POST /api/auth/verify-email` consumes the token and marks the address verified.
- `POST /api/auth/resend-verification` issues a fresh token.
- `REQUIRE_EMAIL_VERIFICATION=1` blocks voting until the address is verified.
- The same mail function is used for password resets, org invitations, login alerts, election
  invitations, digests and poll reminders.

**What does NOT work without configuration**
- Delivery uses PHP `mail()`. The Docker image has no MTA, so `mail()` fails and the message is only
  appended to `data/mail.log` **inside the container**. That log is not exposed to users and is lost
  on restart. In other words: verification links are generated, but they do not reach anyone.

**How to make links actually arrive**
Set these in Render → Environment (they are declared `sync: false` in `render.yaml`):

```
SMTP_HOST=smtp.resend.com        # or your provider
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=<api key>
SMTP_FROM=Open Ballot <no-reply@yourdomain.com>
```

`send_mail()` then uses SMTP with STARTTLS and AUTH (PLAIN, with LOGIN fallback). If SMTP is unset or
fails, it falls back to `mail()` and the local outbox log, so nothing breaks.

Also set `APP_URL=https://open-ballot.onrender.com` so links point at the live site.

## SMS verification (not implemented)

There is no SMS system: no phone field, no provider integration, and no SMS verification endpoint.
Adding it requires choosing a provider (e.g. Twilio), adding a `phone`/`phone_verified_at` schema pair,
an SMS code endpoint and rate limits, and provider credentials. Nothing in the current app sends SMS.

## Quick check after configuring SMTP

1. Register a test account.
2. Confirm the email arrives and `/verify-email/<token>` marks it verified.
3. Check `email_verified_at` is set for that user.
