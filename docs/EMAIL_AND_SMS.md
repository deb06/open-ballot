# Email & SMS verification — configuration

Both systems are implemented. They work locally out of the box via an outbox log, and use real
providers once credentials are configured.

## Email (SMTP)

**What works**
- Registration issues a hashed, single-use, 24-hour token in `email_verifications`.
- `POST /api/auth/verify-email` consumes it; `POST /api/auth/resend-verification` reissues it.
- `REQUIRE_EMAIL_VERIFICATION=1` blocks voting until verified.
- Account page shows verification status and a resend button.
- Same transport sends password resets, org invitations, login alerts, digests and poll reminders.

**Configuration** (Render → Environment; declared `sync: false` in `render.yaml`):
```
SMTP_HOST=smtp.resend.com        # or your provider
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=<api key>
SMTP_FROM=Open Ballot <no-reply@yourdomain.com>
APP_URL=https://open-ballot.onrender.com
```
With no `SMTP_HOST`, `mail()` is tried and the message is written to `data/mail.log` in the container.
That log is not user-visible — configure SMTP for real delivery.

## SMS (phone verification)

**What works**
- `POST /api/account/phone` validates and stores an E.164 phone, sends a 6-digit code (10-minute expiry).
- `POST /api/account/phone/verify` checks the code (max 5 attempts), sets `phone_verified_at`, notifies the user.
- `DELETE /api/account/phone` removes the number; `GET /api/account/phone` reports status.
- Account page has a phone card with send/verify/remove controls.
- Verified phones receive sign-in alerts and poll-closing reminders by SMS.

**Configuration:**
```
SMS_PROVIDER=twilio
SMS_TWILIO_SID=...
SMS_TWILIO_TOKEN=...
SMS_FROM=+15550001111
```
or a generic HTTP provider:
```
SMS_PROVIDER=generic
SMS_API_URL=https://.../sms
SMS_API_KEY=...
```
With no `SMS_PROVIDER`, codes are written to `data/sms.log` (local outbox). Nothing is silently dropped;
provider failures never break the user action.

## Security notes
- Phone numbers are unique per user and stored in `users.phone`; codes are stored only as keyed hashes
  in `phone_verifications`.
- Both endpoints are rate-limited; verification attempts are capped.
- SMS is additive — accounts remain fully usable without a phone.
