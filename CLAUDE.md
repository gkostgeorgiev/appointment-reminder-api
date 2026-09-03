# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm install       # install dependencies
npm run dev       # nodemon + tsx, watches src/, restarts on change (loads .env)
npm run build     # tsc -> dist/
npm start         # node dist/server.js (run build first)
npm run kill      # force-kill any lingering node.exe (Windows helper for stuck dev servers)
```

There is no test suite and no lint/format tooling configured in this repo (no test files, no eslint/prettier config, no `test`/`lint` script in `package.json`). Don't invent commands for these.

Node is pinned via `volta` to 20.19.4. Module system is native ESM (`"type": "module"`) with `nodenext` resolution — relative imports inside `src/` must use explicit `.js` extensions (e.g. `import x from "./config/db.js"`), even though the source files are `.ts`.

Required env vars (see `.env`, not committed): `PORT`, `MONGO_URI`, `JWT_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `RUN_REMINDER_WORKER`, `NODE_ENV`. Required env vars are documented in `.env` (not committed). The actual `.env` file contains secrets and must not be read or modified. `PERSONAL_NUMBER` is additionally needed for the dev-only `/api/dev/test-sms` route.

## Architecture

Multi-tenant SaaS backend: **Professional → Customers → Appointments**. A "professional" is a tenant/account (dentist, doctor, etc.); every Customer and Appointment document carries a `professional` field, and every query in the controllers is scoped with `professional: req.user!.userId`. There is no cross-tenant access anywhere — when adding a new query/mutation, always filter/set `professional` from the authenticated user, never trust a client-supplied tenant id.

### Request pipeline

Every protected route follows the same chain, in this order:

```
router.<verb>(path, authMiddleware, validate(zodSchema), catchAsync(controller))
```

- **`authMiddleware`** (`src/middleware/authMiddleware.ts`) reads the `Bearer` JWT, verifies it (`src/utils/jwt.ts`), and sets `req.user = { userId, email }`.
- **`validate(schema)`** (`src/middleware/validate.ts`) runs a single Zod schema against `{ body, params, query }` combined into one object, and on success stores the parsed result on `req.validated` (typed in `src/types/express.d.ts`). Controllers read `req.validated!.body` / `.query` / `.params`, cast to the schema's inferred type — **not** `req.body`/`req.query` directly (one legacy exception: `getAllCustomers` falls back to `req.query` if `req.validated?.query` is absent).
- Controllers are plain `async` functions that `throw` on error and are wrapped in **`catchAsync`** (`src/utils/catchAsync.ts`) to forward rejections to Express's error handler — controllers never need their own try/catch for expected failures.
- **`ErrorResponse`** (`src/utils/errorResponse.ts`) is the standard way to fail a request: `throw new ErrorResponse(message, statusCode)`.
- **`errorHandler`** (`src/middleware/errorHandler.ts`, mounted last in `server.ts`) normalizes `ErrorResponse`, Mongoose `CastError`/`ValidationError`, and Mongo duplicate-key (11000) errors into `{ ok: false, status, message, requestId }`.
- Successful responses go through **`sendResponse(res, status, data?)`** (`src/utils/apiResponse.ts`) → `{ ok, status, data }`. Keep both shapes consistent when adding new endpoints.

### Validation / OpenAPI schemas

Zod schemas live in `src/validators/*.ts` and are built with the `z` re-exported from `src/config/openapi.ts` (which calls `extendZodWithOpenApi`), not plain `"zod"` — this is what makes `.openapi({...})` available for examples. Every schema is shaped `{ body?, params?, query? }` to match what `validate()` passes in. `objectIdParam`/`objectIdSchema` in `src/validators/commonSchemas.ts` are the shared helpers for validating Mongo ObjectId route params.

Note: these `.openapi()` annotations are *not* currently wired into the served docs. `src/config/swagger.ts` builds the actual Swagger spec from JSDoc comments in `src/docs/*.ts` via `swagger-jsdoc`, served at `/docs` (UI) and `/docs-json`. If you change a validator's shape, update the matching file in `src/docs/` too — they are maintained by hand in parallel, not generated from each other.

### Reminder system (background job)

`src/jobs/reminderJob.ts` runs a `node-cron` job (`*/5 * * * *`) only when `RUN_REMINDER_WORKER=true` and `NODE_ENV !== "test"` (see `server.ts`). Each tick it finds `scheduled` appointments starting 23–25h out with `reminderSent: false`, populates the customer, and calls `sendAppointmentReminder` (`src/services/reminderService.ts`) → `sendSms` (`src/services/smsService.ts`, Twilio). After a successful send it flips `reminderSent` with `updateOne({ _id, reminderSent: false }, { $set: { reminderSent: true } })` — the `reminderSent: false` guard in the filter is intentional and prevents duplicate SMS sends if the API is scaled to multiple instances/workers. Preserve that guard pattern if you touch this job.

### Appointment conflict detection

`hasAppointmentConflict` (`src/controllers/appointment.controller.ts`) is shared by create and update. It computes the candidate appointment's end time (`getAppointmentEnd`, `src/utils/dateUtils.ts`) and uses a Mongo `$expr` to detect overlap against other appointments for the same professional (`existing.start < candidateEnd AND existing.end > candidateStart`), excluding the appointment's own id on update.

### Date filtering

`GET /appointments` supports exactly one of: `start` (single day), `from`/`to` (range), or `range=today|week|month` — enforced by a `refine` in `getAppointmentsSchema`. All day/range boundaries are computed in UTC via `src/utils/dateUtils.ts` (`getStartOfDay`, `getEndOfDay`, `getDateRange`).

### Phone numbers

`normalizeMsisdn` (`src/utils/index.ts`) rewrites Bulgarian local-format numbers (`0xxxxxxxxx`) to intl format (`359xxxxxxxxx`). It's applied on customer creation; `getAllCustomers`'s phone search re-implements the same normalization inline rather than importing it — keep both in sync if the format changes.

### Auth

JWT payload is `{ userId, email }`, 1h expiry (`src/utils/jwt.ts`). `Professional` passwords are bcrypt-hashed in a Mongoose `pre("save")` hook (`src/models/Professional.ts`); compare via `professional.comparePassword(candidate)`.

### Mounting / routing gotcha

`server.ts` mounts the API under `/api/${API_VERSION}` where `API_VERSION = "v1"`, i.e. **`/api/v1/...`** — note this differs from the paths shown in `README.md` (which document plain `/api/...`). `dev.routes.ts` is mounted at `/api/dev` (unversioned, and only when `NODE_ENV === "development"`) with an unauthenticated Twilio smoke-test endpoint.

Indexes worth knowing about when writing queries: `Customer` has a unique compound index on `{ professional, phone }`; `Appointment` has `{ professional, start, reminderSent }` (calendar queries) and `{ reminderSent, start }` (reminder worker queries).
