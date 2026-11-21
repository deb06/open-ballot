# Step-by-step: enable real Email (Resend) and SMS delivery

The app code is already finished. These steps only configure credentials in Render — no code changes needed.

---

## Recommended free path (no domain, no cost) — Brevo

Resend's test domain can only mail your own account address. To email **any user** without owning a
domain, use Brevo's free plan (300 emails/day, no credit card) and verify one email address you own.

1. Sign up at https://www.brevo.com (free).
2. **Senders** → **Add a sender** → use an email address you control (e.g. your Gmail) → verify it by
   clicking the email Brevo sends you. No domain/DNS needed.
3. **SMTP & API** → **API Keys** → generate a key (or use the SMTP key).
4. In Render → Environment, set:
   - `EMAIL_API_URL` = `https://api.brevo.com/v3/smtp/email`
   - `EMAIL_API_KEY` = your Brevo key
   - `SMTP_FROM` = `Open Ballot <your-verified-email>` (Brevo uses this as the sender)
5. Save, rebuild, deploy. The generic JSON API takes priority over Resend/SMTP automatically.
   My code sends Brevo's expected body: `{"from":{"email":...,"name":...},"to":[{"email":...}],"subject":...,"textContent":...}`
   with `api-key` and `Authorization: Bearer` headers.

Gmail is an alternative: enable 2FA → create an app password → use `smtp.gmail.com:587` with your
Gmail address as user and the app password as `SMTP_PASS`, and `SMTP_FROM` = your Gmail address.

---

## Part A — Resend (email, requires a domain for real users)

### 1. Create a Resend account
1. Go to https://resend.com and sign up.
2. Verify your account (check your inbox).

### 2. Verify a sending domain (recommended)
1. In Resend, open **Domains** → **Add Domain**.
2. Enter a domain you control, e.g. `yourdomain.com`.
3. Resend shows DNS records (SPF, DKIM, DMARC). Add them at your DNS provider (Cloudflare, Namecheap, etc.).
4. Wait for Resend to show the domain as **Verified** (can take a few minutes to hours).

> For a quick test you can skip this and use Resend's test address `onboarding@resend.dev` as the From, but it can only send to **your own** account email.

### 3. Create an API key
1. In Resend, open **API Keys** → **Create API Key**.
2. Name it `open-ballot`, give it **Sending** permission, and choose your domain.
3. Copy the key — it starts with `re_...`. It is shown only once.

### 4. Add the variables in Render
1. Open https://dashboard.render.com → **open-ballot** → **Environment**.
2. Click **Edit**.
3. Add or edit these exact keys:

| Key | Value |
|---|---|
| `SMTP_HOST` | `smtp.resend.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `resend` |
| `SMTP_PASS` | your `re_...` API key |
| `SMTP_FROM` | `Open Ballot <no-reply@yourdomain.com>` (must be a verified domain) |

4. Click **Save, rebuild, and deploy**. Wait until the deploy is Live.

---

## Part B — SMS (generic HTTP provider)

Your provider must accept an HTTP POST. The app currently sends:

```
POST <SMS_API_URL>
Header: X-API-Key: <SMS_API_KEY>
Header: Content-Type: application/json
Body:   { "to": "+15551234567", "message": "Your code is 123456" }
```

A `2xx` response counts as success.

### 1. Get your provider's details
You need:
- the **endpoint URL** (e.g. `https://api.yoursmsprovider.com/v1/send`)
- an **API key/token**
- confirmation of the JSON field names and auth header

If your provider uses different field names or auth (e.g. `Authorization: Bearer ...`, `{"phone":..., "text":...}`), send me those details and I'll update `src/php/sms.php` to match.

### 2. Add the variables in Render
In the same **Environment** edit screen add:

| Key | Value |
|---|---|
| `SMS_PROVIDER` | `generic` |
| `SMS_API_URL` | your endpoint URL |
| `SMS_API_KEY` | your API key |

Leave all `SMS_TWILIO_*` variables unset. Click **Save, rebuild, and deploy**.

---

## Part C — verify everything works

### Test email
1. Open the live site → **Create account** with a real email you can access.
2. Check your inbox for "Verify your Open Ballot e-mail".
3. Open the link — your account should show as verified.
4. In Account → **Email verification** it should say "Your email is verified."

### Test SMS
1. Sign in → **Account** → **Phone verification**.
2. Enter your phone in international format, e.g. `+15551234567`.
3. Click **Send code** — you should receive an SMS.
4. Enter the 6-digit code and click **Verify code** — status should show "Verified".

### If nothing arrives
- Check Render → **Logs** for errors after the action.
- Email: confirm the domain is verified in Resend and `SMTP_FROM` matches it exactly.
- SMS: confirm the provider returns `2xx` and accepts the JSON/auth format above.
- Both systems fall back to an internal log (`data/mail.log`, `data/sms.log`) instead of silently dropping messages — but those logs are inside the container and not user-visible.

---

## Security notes
- Never commit these keys to the repository. Render environment variables are encrypted at rest.
- Rotate keys in Render if they are ever exposed; the change takes effect after redeploy.
- `APP_URL` is already correctly set to `https://open-ballot.onrender.com`, so all links point to the live site.

Reference: `docs/EMAIL_AND_SMS.md`.
