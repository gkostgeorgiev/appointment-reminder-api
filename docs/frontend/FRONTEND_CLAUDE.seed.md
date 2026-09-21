# Seed `CLAUDE.md` for the frontend repository

Copy this file into the **new frontend repo** as `CLAUDE.md` (and mirror it to
`AGENTS.md` / `.github/copilot-instructions.md` if you keep the same
three-file convention as the backend). Fill in the `TODO` markers once the
stack is chosen; everything else is already true and does not need editing.

Everything below the line is the file content.

---

# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

**Keep in sync:** `AGENTS.md` and `.github/copilot-instructions.md` mirror this
file. Any edit here must be applied to both in the same change.

## What this is

The web frontend for the Appointment Reminder API — a multi-tenant SaaS where a
"professional" (dentist, doctor, etc.) manages their customers and appointments,
and the backend automatically sends SMS reminders ~24h before each appointment.

The backend is a **separate, already-deployed repository**. It is not in this
workspace and must not be modified from here. If something needs a backend
change, say so explicitly rather than working around it on the client.

- Production API: `https://api.napomnyane.eu` (all paths under `/api/v1`)
- Interactive API reference: <https://api.napomnyane.eu/docs>
- OpenAPI spec: <https://api.napomnyane.eu/docs-json>

## Read before writing any network code

The API contract document is served by the API itself and is the single
canonical copy:

**<https://api.napomnyane.eu/guide/API_GUIDE.md>**

**Fetch and read it before touching anything that talks to the API**, and
re-fetch it whenever API behaviour surprises you — it is always current with
the deployed backend, which a copy in this repo would not be. It covers the
rules the OpenAPI spec cannot express: the cookie/CSRF handshake, the response
envelope and its exceptions, strict request bodies, UTC date semantics, rate
limits, and the per-resource business rules (appointment overlap, phone
normalization, customer deletion blocking). `https://api.napomnyane.eu/guide`
lists the rest of the bundle.

`src/api/client.ts` and `src/api/types.ts` are copies of `api-client.ts` and
`api-types.ts` from that bundle — they have to be real files here to compile
against. They already implement the transport rules correctly. **Build on them;
do not write raw `fetch` calls against the API.** If the client needs a new
endpoint, add a method there rather than bypassing it. If the API contract has
changed, re-fetch those two files from `/guide` and diff rather than
hand-patching them.

## Non-negotiable API rules

These cause silent, hard-to-debug failures if broken:

1. Every request sends `credentials: "include"`. Auth is cookie-only; there is
   no bearer-token path.
2. Every `POST`/`PATCH`/`DELETE` sends an `x-csrf-token` header read fresh from
   the `csrfToken` cookie at request time (it rotates on every login/refresh).
3. **Local dev must run over HTTPS.** The auth cookies are `Secure;
   SameSite=None`, so they are neither set nor sent over `http://localhost`.
   Use `mkcert` and the dev server's HTTPS option.
4. This origin must be in the backend's `CORS_ORIGIN` allowlist (a Render env
   var, comma-separated, exact origins — credentialed CORS forbids wildcards).
   Both the local HTTPS dev origin and the deployed origin need to be there.
5. Request bodies are strict — an unknown key is a `400`. Never round-trip a
   fetched object into a `PATCH`; send only changed fields.
6. `401` is recovered by a single-flight refresh-and-retry (already in
   `client.ts`). Never fire a bare refresh per failed request — the backend
   rotates the refresh token, so concurrent refreshes log the user out.

## Screens the API implies

The backend's auth flow forces these routes to exist:

- `/verify-email?token=...` — registration does **not** log the user in, and
  login returns `403` until the email is verified. This route consumes the
  token from the emailed link.
- `/reset-password?token=...` — target of the password-reset email. The
  backend builds the link as `${FRONTEND_URL}/reset-password?token=...`, so
  `FRONTEND_URL` on the backend must point here once deployed.
- A "resend verification email" affordance (tokens expire after 24h).

Plus the core product surface: login/register, a calendar or agenda view of
appointments, appointment create/edit, and customer list/create/edit.

## Known backend gaps

Do not paper over these — they are tracked as backend work. See `API_GUIDE.md`
§9.1 for the full list.

- No profile endpoint. `GET /professionals/me` returns only the JWT contents
  (`userId`, `email`) — not `profession` or `isEmailVerified`.
- No change-password-while-authenticated endpoint. A logged-in user can only
  change their password via the emailed forgot-password flow.
- No manual trigger/cancel/resend for reminders.
- Cancelled appointments still block their time slot for conflict detection.
  This is a known backend bug under review — cancelling does **not** free the
  slot for rebooking, so don't build UI that promises it does.
- Date filters are date-only and UTC-anchored, so a local-timezone "today"
  cannot be expressed exactly. Compute local day boundaries client-side and
  send `from`/`to` rather than using `range=today`.

## Deliberate design decisions — do not "fix" these

- **There is no working-hours or available-slots concept, by design.**
  Professionals set their own hours; the product deliberately does not impose a
  standard working day. Slot selection is a free-form date/time picker. Do not
  add client-side working-day assumptions (no 9–17 defaults, no greying out
  evenings or weekends) and do not propose a working-hours API. The only
  scheduling constraint the server enforces is the overlap check.
- Auth is cookie-only with no bearer-token path — keeping the JWT out of JSON
  is the point.
- `forgot-password` and `resend-verification` always return the same generic
  200; that is anti-enumeration, not a missing error path.

## Conventions

TODO once the stack is picked — framework, router, data-fetching library,
styling, component structure, state management, and where each lives.

## Commands

TODO once the stack is picked — install, dev, build, test, lint.

## Environment

- `TODO_API_ORIGIN_VAR` — API origin, e.g. `https://api.napomnyane.eu`. No
  trailing slash and no `/api/v1` suffix; the client appends it. Feed it to the
  client once at app start with `configureApi({ origin: ... })`; the client
  defaults to production if never configured.

The frontend holds **no secrets**. Every credential (Twilio, Resend, Mongo,
JWT) lives on the backend. If something seems to need a secret in the browser,
it belongs on the backend instead.

## Locale

The product targets Bulgaria. Phone numbers are stored in international format
without a leading `+` (e.g. `359888123456`) and the backend normalizes
`0888123456` on write. UI text language is TODO.
