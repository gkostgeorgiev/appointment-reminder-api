# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
yarn install      # install dependencies
yarn dev          # nodemon + tsx, watches src/, restarts on change (loads .env)
yarn build        # tsc -> dist/
yarn start        # node dist/server.js (run build first)
yarn kill         # force-kill any lingering node.exe (Windows helper for stuck dev servers)
yarn test         # vitest run - integration + unit suite, see Testing section below
```

There is no lint/format tooling configured in this repo (no eslint/prettier config, no `lint` script in `package.json`). Don't invent commands for that.

Package manager is Yarn Classic (1.x), pinned via `volta` alongside Node — don't use `npm` (no `package-lock.json` is committed; `yarn.lock` is the source of truth). Node is pinned via `volta` to 24.21.0 (current Active LTS). Module system is native ESM (`"type": "module"`) with `nodenext` resolution — relative imports inside `src/` must use explicit `.js` extensions (e.g. `import x from "./config/db.js"`), even though the source files are `.ts`.

Required env vars (see `.env`, not committed): `PORT`, `MONGO_URI`, `JWT_SECRET`, `CORS_ORIGIN`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `RUN_REMINDER_WORKER`, `NODE_ENV`, `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL`. Required env vars are documented in `.env` (not committed). The actual `.env` file contains secrets and must not be read or modified. `PERSONAL_NUMBER` is additionally needed for the dev-only `/api/dev/test-sms` route. `CORS_ORIGIN` is a comma-separated allowlist of origins passed to `cors({ origin, credentials: true })` in `src/app.ts` — required because credentialed CORS cannot use a wildcard origin. `RESEND_API_KEY`/`EMAIL_FROM` are used by `src/services/emailService.ts` to send password-reset emails via Resend; `FRONTEND_URL` is the base URL used to build the reset link (`${FRONTEND_URL}/reset-password?token=...`) — no frontend exists yet, so this just needs to point at wherever that route will eventually live. `SENTRY_DSN` is optional — when unset, `initSentry()` (`src/config/sentry.ts`) logs and no-ops, and nothing else changes.

### Error reporting

`src/config/sentry.ts` wraps `@sentry/node`. `initSentry()` is called first thing in `server.ts`'s module body, before `connectDB()` or any app setup, and no-ops if `SENTRY_DSN` isn't set — no tracing/performance monitoring is configured, only `Sentry.captureException`. Reporting is intentionally narrow: `errorHandler.ts` only reports when the final `statusCode >= 500` (expected 4xx — validation, not-found, duplicate-key — are never sent); the reminder job (`src/jobs/reminderJob.ts`) reports both a failed `Appointment.find(...)` tick and a failed per-appointment send; `server.ts`'s `uncaughtException`/`unhandledRejection` handlers report, then `await Sentry.flush(2000)` before calling the existing `shutdown()` (same one used for `SIGTERM`/`SIGINT`) — `captureException` only queues the event, so without the bounded flush the process could exit before it's actually sent. `sentry.ts`'s `beforeSend` scrubs phone-number- and email-shaped substrings out of error messages before they leave the process — this repo handles patient-adjacent PII (customer name/phone/email), and e.g. a Twilio error can otherwise echo a real phone number in its message. Keep new error-reporting call sites consistent with this "5xx/crash only, never 4xx" split.

## Architecture

Multi-tenant SaaS backend: **Professional → Customers → Appointments**. A "professional" is a tenant/account (dentist, doctor, etc.); every Customer and Appointment document carries a `professional` field, and every query in the controllers is scoped with `professional: req.user!.userId`. There is no cross-tenant access anywhere — when adding a new query/mutation, always filter/set `professional` from the authenticated user, never trust a client-supplied tenant id.

### Request pipeline

Every protected route follows the same chain, in this order:

```
router.<verb>(path, authMiddleware, validate(zodSchema), catchAsync(controller))
```

- **`authMiddleware`** (`src/middleware/authMiddleware.ts`) reads the JWT from the `token` cookie only (no `Authorization: Bearer` support — cookie-only auth, see Auth below), verifies it (`src/utils/jwt.ts`), and sets `req.user = { userId, email }`. For every mutating method (not `GET`/`HEAD`/`OPTIONS`), it also enforces a double-submit CSRF check: the `x-csrf-token` header must match the `csrfToken` cookie, or the request is rejected with `403`.
- **`validate(schema)`** (`src/middleware/validate.ts`) runs a single Zod schema against `{ body, params, query }` combined into one object, and on success stores the parsed result on `req.validated` (typed in `src/types/express.d.ts`). Controllers read `req.validated!.body` / `.query` / `.params`, cast to the schema's inferred type — **not** `req.body`/`req.query` directly (one legacy exception: `getAllCustomers` falls back to `req.query` if `req.validated?.query` is absent).
- Controllers are plain `async` functions that `throw` on error and are wrapped in **`catchAsync`** (`src/utils/catchAsync.ts`) to forward rejections to Express's error handler — controllers never need their own try/catch for expected failures.
- **`ErrorResponse`** (`src/utils/errorResponse.ts`) is the standard way to fail a request: `throw new ErrorResponse(message, statusCode)`.
- **`errorHandler`** (`src/middleware/errorHandler.ts`, mounted last in `src/app.ts`) normalizes `ErrorResponse`, Mongoose `CastError`/`ValidationError`, and Mongo duplicate-key (11000) errors into `{ ok: false, status, message, requestId }`.
- Successful responses go through **`sendResponse(res, status, data?)`** (`src/utils/apiResponse.ts`) → `{ ok, status, data }`. Keep both shapes consistent when adding new endpoints.

### Validation / OpenAPI schemas

Zod schemas live in `src/validators/*.ts` and are built with the `z` re-exported from `src/config/openapi.ts` (which calls `extendZodWithOpenApi`), not plain `"zod"` — this is what makes `.openapi({...})` available for examples. Every schema is shaped `{ body?, params?, query? }` to match what `validate()` passes in. `objectIdParam`/`objectIdSchema` in `src/validators/commonSchemas.ts` are the shared helpers for validating Mongo ObjectId route params.

Note: these `.openapi()` annotations are *not* currently wired into the served docs. `src/config/swagger.ts` builds the actual Swagger spec from JSDoc comments in `src/docs/*.ts` via `swagger-jsdoc`, served at `/docs` (UI) and `/docs-json`. If you change a validator's shape, update the matching file in `src/docs/` too — they are maintained by hand in parallel, not generated from each other.

### `app.ts` vs `server.ts`

`src/app.ts` exports the Express `app` (all middleware, routes, `errorHandler`) with no side effects — importing it never connects to Mongo or binds a port, which is what makes it importable from tests. `src/server.ts` is the thin runtime entrypoint: `initSentry()`, `connectDB()`, the dev-cert HTTPS-or-plain `.listen()` branch, graceful `shutdown()`, signal handlers, and starting the cron reminder job. When adding new middleware/routes, they belong in `app.ts`; process-lifecycle concerns belong in `server.ts`.

### Testing

`yarn test` (Vitest) runs an integration-first suite against a real, ephemeral MongoDB (`mongodb-memory-server`) driven with `supertest` against the real `app` from `src/app.ts` — not mocks of Mongoose/Express, since the areas covered (tenant scoping, the appointment conflict `$expr` query, the cookie/CSRF middleware chain, the reminder job's guard) are precisely about real query/middleware behavior. `tests/integration/` and `tests/unit/` hold the suites; `tests/helpers/` has the shared setup (env bootstrap + `MongoMemoryReplSet` lifecycle in `setup.ts`, register/login/CSRF-cookie plumbing in `auth.ts`). The test DB is a single-node replica set, not a standalone instance, because appointment create/update run inside a multi-document transaction (see below) — same as production, which runs on Atlas (always a replica set, even on the free/shared tier). Because `src/config/env.ts` validates `process.env` synchronously at import time, every test file sets fake-but-schema-valid env vars *before* dynamically importing anything under `src/` — see `tests/helpers/testEnv.ts` and the dynamic-import pattern in `setup.ts`. The auth cookies are `Secure` in every environment (see below), so tests capture and manually reattach the raw `Set-Cookie` values rather than relying on `supertest.agent()`'s cookie jar, which won't resend a `Secure` cookie over the plain HTTP connection supertest uses internally. `src/jobs/reminderJob.ts` exports `runReminderTick()` (called by `startReminderJob()`'s `cron.schedule`) specifically so tests can invoke a tick directly instead of waiting on real cron timing. A basic GitHub Actions workflow (`.github/workflows/ci.yml`) runs `yarn build && yarn test` on push/PR to `main`.

### Reminder system (background job)

`src/jobs/reminderJob.ts` runs a `node-cron` job (`*/5 * * * *`) only when `RUN_REMINDER_WORKER=true` and `NODE_ENV !== "test"` (see `server.ts`). Each tick it finds `scheduled` appointments starting 23–25h out with `reminderSent: false`, populates the customer, and calls `sendAppointmentReminder` (`src/services/reminderService.ts`) → `sendSms` (`src/services/smsService.ts`, Twilio). After a successful send it flips `reminderSent` with `updateOne({ _id, reminderSent: false }, { $set: { reminderSent: true } })` — the `reminderSent: false` guard in the filter is intentional and prevents duplicate SMS sends if the API is scaled to multiple instances/workers. Preserve that guard pattern if you touch this job.

This is deliberately a polling design, not a queue — see the closed-issue discussion for why (the `{ reminderSent, start }` index already makes the poll an index seek over pending reminders, not a collection scan, and re-reading `start` live means reschedule/cancel need no extra bookkeeping). A failed send is retried on later ticks via `reminderAttempts`/`reminderNextAttemptAt` (linear backoff, capped at `MAX_REMINDER_ATTEMPTS = 4`); once the cap is hit, `reminderNextAttemptAt` is cleared and a distinct `Sentry.captureMessage` ("Reminder permanently failed...") fires so a permanent failure is distinguishable from one still retrying.

### Appointment conflict detection

`hasAppointmentConflict` (`src/controllers/appointment.controller.ts`) is shared by create and update. It computes the candidate appointment's end time (`getAppointmentEnd`, `src/utils/dateUtils.ts`) and uses a Mongo `$expr` to detect overlap against other appointments for the same professional (`existing.start < candidateEnd AND existing.end > candidateStart`), excluding the appointment's own id on update.

Both `createAppointment` and `updateAppointment` run the conflict check plus the write inside a transaction via `withSchedulingLock`, which first bumps a per-professional `AppointmentLock` document ($inc on a `version` counter, upserted) before calling `hasAppointmentConflict`. A transaction alone isn't enough here — snapshot isolation lets two concurrent transactions each see "no conflict" and both commit an overlapping appointment (write skew); forcing both transactions to write the same `AppointmentLock` document first turns that into a detectable MongoDB write conflict, so the loser aborts and `session.withTransaction` retries it automatically, at which point it re-checks against the winner's now-committed appointment. `AppointmentLock` docs have no meaning outside this — don't query them for anything else. This requires a replica-set connection (transactions aren't supported on a standalone `mongod`); production is Atlas (always a replica set), and tests use `MongoMemoryReplSet` for the same reason.

### Date filtering

`GET /appointments` supports exactly one of: `start` (single day), `from`/`to` (range), or `range=today|week|month` — enforced by a `refine` in `getAppointmentsSchema`. All day/range boundaries are computed in UTC via `src/utils/dateUtils.ts` (`getStartOfDay`, `getEndOfDay`, `getDateRange`).

### Phone numbers

`normalizeMsisdn` (`src/utils/index.ts`) rewrites Bulgarian local-format numbers (`0xxxxxxxxx`) to intl format (`359xxxxxxxxx`). It's applied on customer creation; `getAllCustomers`'s phone search re-implements the same normalization inline rather than importing it — keep both in sync if the format changes.

### Auth

JWT payload is `{ userId, email }`, 1h expiry (`src/utils/jwt.ts`). `Professional` passwords are bcrypt-hashed in a Mongoose `pre("save")` hook (`src/models/Professional.ts`); compare via `professional.comparePassword(candidate)`.

Auth is cookie-only — login never returns a token in the JSON body (dropped in favor of pure `httpOnly` cookies: keeping the raw JWT in JSON would let an XSS bug read it from the response and replay it via an `Authorization` header, bypassing the cookie's protection entirely). Login (`src/controllers/professional.controller.ts`) sets three cookies via `setAuthCookies` (`src/config/cookies.ts` holds the shared names/options, all `secure: true; sameSite: "none"` in every environment — see the dev-HTTPS note below):
- `token` — the access JWT, 1h expiry, httpOnly.
- `csrfToken` — a random UUID (unrelated to the JWT), readable by JS, echoed back as `x-csrf-token` for the double-submit check.
- `refreshToken` — an opaque random token, httpOnly, 30-day expiry, cookie `path` scoped to `/api/v1/professionals` so it's never sent to `/customers` or `/appointments`.

`POST /professionals/refresh` (public, no `authMiddleware`) is how a client gets a new access token once the 1h one expires without re-entering a password: it reads the `refreshToken` cookie, hashes it (`src/utils/refreshToken.ts` — same sha256-hash-in-DB pattern as password reset/email verification below), looks up a `Professional` by `{ refreshTokenHash, refreshTokenExpires: { $gt: now } }`, and on a match **rotates** both tokens (new access JWT + new refresh token, overwriting the stored hash) and re-sets all three cookies. A used refresh token fails immediately afterwards. There's one active refresh token per professional, not a multi-device session list.

The refresh token is invalidated in two places: `POST /professionals/logout` (auth required) clears it server-side (`refreshTokenHash`/`refreshTokenExpires` → `null`) in addition to clearing all three cookies, and the `pre("save")` hook on `Professional` (`src/models/Professional.ts`) clears it too whenever `password` is modified — the same hook that already bumps `passwordChangedAt` for access-token invalidation, so a password reset/change kills both tokens together for free.

`registerProfessional` does **not** issue a token or set any cookies — it only creates the account (`isEmailVerified: false`) and emails a verification link. `loginProfessional` throws `403` if `professional.isEmailVerified` is `false`, so the only way to obtain a session is to verify first, then call `/login` separately. Verification tokens use the same hashed-token-in-DB pattern as password reset (raw token emailed to the user, only its sha256 hash + expiry stored on the doc, `select: false` on both fields) — see `src/utils/passwordReset.ts` vs. `src/utils/emailVerification.ts`, which is identical except for a 24h TTL (vs. 1h for reset) and its own `emailVerificationTokenHash`/`emailVerificationTokenExpires` fields on `Professional`. `POST /professionals/verify-email` consumes the token; `POST /professionals/resend-verification` (rate-limited, same anti-enumeration shape as `forgot-password`) issues a new one for an existing, not-yet-verified account. Outside production (`env.NODE_ENV !== "production"`), both `register` and `resend-verification` also echo the raw token back as `data.verificationToken` — a deliberate dev/test convenience so accounts can be verified with made-up email addresses (Resend's sandbox mode won't deliver to arbitrary test inboxes), never present in production.

Because `SameSite=None` cookies require HTTPS, `npm run dev` looks for a locally-trusted cert/key at `certs/dev-cert.pem` / `certs/dev-key.pem` (gitignored) and serves over `https` when both are present (generate them with [`mkcert`](https://github.com/FiloSottile/mkcert) for `localhost`); otherwise it falls back to plain `http`. Production runs behind Render's proxy, which terminates TLS in front of the app (hence `trust proxy` in `src/app.ts`), so `app.listen` stays plain there.

### Mounting / routing gotcha

`src/app.ts` mounts the API under `/api/${API_VERSION}` where `API_VERSION = "v1"`, i.e. **`/api/v1/...`** — note this differs from the paths shown in `README.md` (which document plain `/api/...`). `dev.routes.ts` is mounted at `/api/dev` (unversioned, and only when `NODE_ENV === "development"`) with an unauthenticated Twilio smoke-test endpoint.

Indexes worth knowing about when writing queries: `Customer` has a unique compound index on `{ professional, phone }`; `Appointment` has `{ professional, start, reminderSent }` (calendar queries) and `{ reminderSent, start }` (reminder worker queries).
