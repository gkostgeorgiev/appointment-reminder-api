# Frontend handoff bundle

Everything the frontend project needs to build against this API **without
access to this repository**. The frontend is a separate repo built by a
separate agent; this directory is the contract between the two.

## What's here

## Served live — fetch, don't copy

This directory is served by the running API, so there is exactly one canonical
copy and it can never drift from the implementation:

| URL | What it is |
|---|---|
| <https://api.napomnyane.eu/guide> | Index of the bundle (JSON) |
| <https://api.napomnyane.eu/guide/API_GUIDE.md> | The contract document — auth handshake, envelope, business rules, date semantics, rate limits, known gaps |
| <https://api.napomnyane.eu/guide/api-types.ts> | TypeScript types for every request and response |
| <https://api.napomnyane.eu/guide/api-client.ts> | Zero-dependency reference client: cookies, CSRF, single-flight refresh-and-retry, envelope unwrapping |
| <https://api.napomnyane.eu/guide/FRONTEND_CLAUDE.seed.md> | Starter `CLAUDE.md` for the frontend repo |

Public, unauthenticated, `Cache-Control: public, max-age=300`. Implementation
is `src/routes/guide.routes.ts` — an explicit filename allowlist, so adding a
file here also means adding it to `SERVED_FILES`.

**How each piece should be consumed:**

- `API_GUIDE.md` — **fetch it, every time.** It is prose, has no build
  dependency, and is the part whose *meaning* changes. The frontend's
  `CLAUDE.md` should carry the URL, not a copy of the text.
- `api-types.ts` / `api-client.ts` — these must be real files in the frontend
  repo to compile against, so they are necessarily copies. They carry the
  canonical URL in a header comment; re-fetch and diff when the contract
  changes rather than hand-patching them.
- `FRONTEND_CLAUDE.seed.md` — a one-time starting point. Once copied it belongs
  to the frontend repo and diverges on purpose.

## Why the OpenAPI spec isn't sufficient on its own

`/docs-json` describes paths, bodies and status codes correctly. It cannot
express:

- that auth is cookie-only and every request needs `credentials: "include"`
- the CSRF double-submit handshake and when the token rotates
- that `Secure; SameSite=None` forces the dev server onto HTTPS
- the `{ ok, status, data }` envelope and the four endpoints that break it
- that request bodies are strict, so a fetched object can't be PATCHed back
- that appointment overlap, customer-phone uniqueness and customer deletion
  all produce a bare `409`
- that "no date filter" means a rolling -7d/+30d window, not everything
- that all date boundaries are UTC, not the professional's local timezone

Those are exactly the things that cost days when they're discovered by
debugging instead of by reading. Hence `API_GUIDE.md`.

## Before the frontend work starts

1. **Add the frontend's origins to `CORS_ORIGIN`** on Render (comma-separated,
   exact origins, no wildcards). Both the local HTTPS dev origin — e.g.
   `https://localhost:5173` — and the eventual deployed origin.
2. **Point `FRONTEND_URL`** at the deployed frontend once it exists. It's what
   builds the password-reset and email-verification links; until then those
   links go nowhere useful.
3. Point the frontend agent at `https://api.napomnyane.eu/guide`. It needs
   nothing else from this repo.

## Keeping it accurate

These files are hand-maintained, not generated. When a validator in
`src/validators/`, a model in `src/models/`, or a response shape in a
controller changes, update `API_GUIDE.md` and `api-types.ts` in the same
change — the same rule that already applies to `src/docs/*.ts` and the Swagger
spec. A frontend built against a stale contract fails at runtime, not at build
time.

Because the bundle is served from this repo rather than copied into the
frontend, an update here reaches the frontend on the next deploy of *this*
service — there is no second place to remember to update. That is the whole
reason the endpoint exists.
