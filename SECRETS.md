# Secret Management & Scanning

See [RUNBOOK.md](RUNBOOK.md) for the deployment target this policy assumes (Render + Atlas + Twilio + Resend).

---

# Current state

* `.env` is listed in `.gitignore` and has never been committed — verified with `git log --all --full-history -- .env` (no results).
* `.env.example` is the checked-in template: every required var is listed with a placeholder, never a real value. Keep it in sync whenever a new required env var is added (`src/config/env.ts` is the source of truth for what's required).
* `src/config/sentry.ts`'s `beforeSend` scrubs phone-number- and email-shaped substrings out of error messages before they leave the process. This protects PII that might otherwise leak into an error message (e.g. a Twilio error echoing a real phone number) — it is **not** a secret store and doesn't reduce the need for anything below.

---

# Where production secrets live

Render's per-service **Environment** tab (encrypted at rest, scoped to that service, never written to a file or git). Set each required var there directly for every environment (development/staging/production get separate Render services and separate secret values — see RUNBOOK.md).

Do not:

* Put real values in `.env.example`.
* Pass secrets as build-time arguments that end up baked into an image/layer.
* Echo secrets in logs — `requestLogger`/`morgan` already only log request metadata, not bodies; keep it that way.

---

# Automated scanning

Two layers, both using [gitleaks](https://github.com/gitleaks/gitleaks):

* **CI** — `.github/workflows/ci.yml` runs `gitleaks/gitleaks-action@v3` on every push/PR to `main`. This is the hard gate: a detected secret fails the check.
* **Local pre-commit** — `.husky/pre-commit` runs `gitleaks protect --staged --no-banner` before every commit, so a secret is caught before it's even pushed. If gitleaks isn't installed locally, the hook warns and lets the commit through (it doesn't block a fresh clone that hasn't installed the binary yet) — CI remains the actual backstop either way.

Install gitleaks locally to get the pre-commit check:

* Windows: `winget install --id Gitleaks.Gitleaks`
* macOS: `brew install gitleaks`

No `.gitleaks.toml` allowlist exists today — a full-history scan (`gitleaks detect --source .`) came back clean, including the fake credential-shaped values in `tests/helpers/testEnv.ts` (e.g. the padded test JWT secret, the zero-filled Twilio SID). Only add an allowlist entry if a *confirmed* false positive shows up — don't add one preemptively "just in case," since a broad allowlist rule is exactly what would let a real secret slip through unnoticed.

---

# Rotation runbook

Rotate at the provider first, then update the Render env var, then redeploy (or let the next deploy pick it up).

* **`JWT_SECRET`** — rotate in Render. Invalidates every currently-issued access token immediately: existing clients get a `401` on their next request and must hit `POST /professionals/refresh`. Refresh tokens are unaffected — they're opaque random values hashed in the DB (`src/utils/refreshToken.ts`), not JWTs, so this rotation doesn't force a full re-login, just one extra round trip per active session.
* **`MONGO_URI`** (Atlas DB user password) — rotate the database user's password in Atlas, then update the env var. Existing connections drop and Mongoose reconnects with the new URI on next deploy/restart; brief connection gap, no data impact.
* **`TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`** — rotate the auth token in the Twilio console (the SID itself doesn't need to change). In-flight reminder sends during the rotation window may fail once and retry via the existing backoff (`reminderJob.ts`'s `reminderAttempts`/`reminderNextAttemptAt`), so a rotation doesn't need to be scheduled around traffic.
* **`RESEND_API_KEY`** — rotate in the Resend dashboard. Affects password-reset/verification email sends only; a failure during rotation is already reported to Sentry without changing the client-facing response (see CLAUDE.md's "Error reporting" section) and Resend calls aren't retried automatically, so double-check no reset/verification emails were dropped during the rotation window.
* **`SENTRY_DSN`** — not a traditional secret (it can only be used to *send* events to your project, not read them), but if it's ever treated as sensitive, regenerate it from the Sentry project settings.
* **`CSRF`/`JWT_SECRET`-adjacent cookies** (`csrfToken`, `refreshToken`) — not env vars, so nothing to rotate here directly; they're invalidated per-user by the existing logout/password-change flows.

---

# Suspected-leak response

1. **Rotate immediately** at the provider (see above) — don't wait to finish investigating first.
2. **Scope the exposure**: search git history (`git log -p` / `gitleaks detect --source . --no-banner`), CI logs, and Sentry (breadcrumbs/error messages — note the PII scrubber above doesn't scrub arbitrary secret-shaped strings, only phone/email patterns).
3. **Document the incident**: what leaked, where, for how long, what was rotated, and what (if anything) needs to change in this doc or the scanning rules to prevent a repeat.
