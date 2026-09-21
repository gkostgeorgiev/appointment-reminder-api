# Appointment Reminder API — Frontend Integration Guide

**Audience:** whoever (human or AI agent) builds the frontend. This is the contract document. It is written to be self-contained — you do **not** need access to the backend repository to build against this API.

- **Production base URL:** `https://api.napomnyane.eu`
- **All API paths are versioned:** `/api/v1/...`
- **Interactive reference:** <https://api.napomnyane.eu/docs>
- **Machine-readable spec:** <https://api.napomnyane.eu/docs-json> (OpenAPI 3.0)

The OpenAPI spec is accurate for *shapes* — paths, request bodies, status codes. It does not and cannot express the things in the next section, which are where integrations actually break.

---

## 1. Read this first — the eight things the OpenAPI spec won't tell you

1. **Every request must send `credentials: "include"`.** Auth is cookie-only. There is no `Authorization: Bearer` support anywhere. A `fetch` without `credentials: "include"` will be silently unauthenticated (401) no matter how correct everything else is.

2. **Every mutating request (`POST`/`PATCH`/`DELETE`) must send an `x-csrf-token` header** whose value equals the `csrfToken` cookie. Missing or mismatched gives `403 {"message":"Invalid or missing CSRF token"}`. `GET`/`HEAD`/`OPTIONS` are exempt.

3. **The auth cookies are `Secure; SameSite=None` in every environment.** That means **your local dev server must be served over HTTPS** — cookies will not be set or sent over `http://localhost`. Use `mkcert` plus your dev server's HTTPS option. This is the single most common way to lose an afternoon on this API.

4. **Your origin must be on the backend's `CORS_ORIGIN` allowlist** (comma-separated, exact origins, no wildcards — credentialed CORS forbids `*`). Add both your local HTTPS dev origin and the deployed frontend origin. It is a backend env var on Render; get it set before you start.

5. **Success responses are enveloped: `{ ok, status, data }`.** Errors are `{ ok: false, status, message, requestId }`. **Four cases break the envelope** — see §3.1. Write one unwrapping helper and route everything through it.

6. **All request bodies are strict** — an unknown key is a `400`, not ignored. You cannot round-trip a fetched object back into a `PATCH`. Send only the fields you are changing, never `_id`, `createdAt`, `professional`, `reminderSent`, and so on.

7. **`DELETE` returns `204` with no body.** Do not call `.json()` on it.

8. **All dates are UTC.** Day and range boundaries are computed in UTC on the server, not in the professional's local timezone. A "today" view for a Bulgarian user (UTC+2/+3) will not match their wall clock at the edges. See §6.

---

## 2. Authentication

### 2.1 The full lifecycle

```
POST /api/v1/professionals/register        201, account created, NOT logged in
POST /api/v1/professionals/verify-email    200, account usable
POST /api/v1/professionals/login           200, sets 3 cookies
  ... authenticated requests ...
POST /api/v1/professionals/refresh         200, rotates cookies (when the access token expires)
POST /api/v1/professionals/logout          200, clears cookies server- and client-side
```

**Registration does not log you in and does not set cookies.** It creates the account with `isEmailVerified: false` and emails a verification link. `POST /login` throws `403 "Please verify your email before logging in"` until the email is verified. The frontend must therefore have:

- a `/verify-email?token=...` route that POSTs the token to `/api/v1/professionals/verify-email`, and
- a "resend verification email" affordance, since the token expires after 24h.

**Password reset** works the same way: `/forgot-password` emails a link to `${FRONTEND_URL}/reset-password?token=...`, so the frontend needs a `/reset-password` route that POSTs `{ token, password }` to `/api/v1/professionals/reset-password`. Reset tokens expire after 1h. `FRONTEND_URL` is a backend env var — it must be pointed at the deployed frontend once it exists.

### 2.2 The three cookies

| Cookie | httpOnly | Lifetime | Path | Purpose |
|---|---|---|---|---|
| `token` | yes | 1 hour | `/` | Access JWT. You can never read it from JS — that's intentional. |
| `csrfToken` | **no** | 1 hour | `/` | Random UUID. Read it from `document.cookie` and echo it as `x-csrf-token`. |
| `refreshToken` | yes | 30 days | `/api/v1/professionals` | Opaque token. Only sent to the professionals routes. |

All three are `Secure; SameSite=None`.

### 2.3 CSRF: the double-submit check

Read `csrfToken` from `document.cookie` and set it as the `x-csrf-token` header on every mutation. Because the cookie is deliberately not `httpOnly`, this is a plain `document.cookie` read — there is no endpoint to fetch it from.

The cookie is **re-issued with a new value on every login and every refresh**. Read it fresh at request time; do not cache it in a module variable at app start.

### 2.4 Token refresh

The access token lives 1 hour. When it expires, any protected request returns `401`. The recovery is:

```
POST /api/v1/professionals/refresh    (no body, no CSRF header, no auth header)
```

It reads the `refreshToken` cookie and on success **rotates both tokens** — new access JWT, new refresh token, new CSRF value, all three cookies re-set. The old refresh token is dead immediately.

Implement this as: on `401`, refresh once, retry the original request once; if the refresh also fails, clear local auth state and send the user to login. **Single-flight it** — if five requests 401 simultaneously and each fires its own refresh, rotation means four of them fail and the user is logged out. The provided `api-client.ts` does this correctly; copy it rather than rewriting it.

There is **one active refresh token per account**, not a per-device session list. Logging in on a second device invalidates the first device's refresh token. Treat that as current intended behaviour.

### 2.5 What login gives you (almost nothing)

`POST /login` returns `200` with body `{"ok":true,"status":200}` — **no user object, no token, no `data` field at all.** To learn who is logged in, call:

```
GET /api/v1/professionals/me
```

which returns a **non-enveloped** body:

```json
{
  "message": "Protected route accessed",
  "user": { "userId": "...", "email": "...", "iat": 0, "iatMs": 0, "exp": 0 }
}
```

It returns only what is in the JWT — `userId` and `email`. It does **not** return `profession`, `createdAt`, or `isEmailVerified`. If the UI needs those, that is a backend change, not something to work around on the client.

Use `GET /me` as the "am I logged in?" probe on app boot.

---

## 3. Response shapes

### 3.1 The envelope, and its exceptions

Success:

```json
{ "ok": true, "status": 200, "data": { "...": "..." } }
```

Error:

```json
{ "ok": false, "status": 404, "message": "Customer not found", "requestId": "..." }
```

`requestId` is worth surfacing in a support/error UI — it correlates to the backend's structured logs and Sentry.

**Exceptions — do not assume the envelope here:**

| Endpoint / case | Actual body |
|---|---|
| `GET /api/v1/professionals/me` | `{ message, user }` — no envelope |
| Any `401`/`403` from the auth middleware | `{ "message": "Unauthorized" }` or `{ "message": "Invalid or missing CSRF token" }` — no `ok`/`status`/`requestId` |
| `429` from a rate limiter | `{ ok, status, message }` — enveloped, but produced by `express-rate-limit`, so no `requestId` |
| `GET /health` | `{ status, db }` — no envelope, and not under `/api/v1` |

Your error parser must tolerate a body carrying only `message`.

### 3.2 Paginated lists

`GET /customers` and `GET /appointments` return:

```json
{
  "ok": true,
  "status": 200,
  "data": {
    "items": [],
    "pagination": { "page": 1, "limit": 50, "total": 120, "totalPages": 3 }
  }
}
```

Defaults and caps: customers `limit` default 50 / max 200; appointments `limit` default 100 / max 500. `page` is 1-based.

### 3.3 Mongo document shape

Documents are serialized straight from Mongoose, so the id field is **`_id`**, not `id`, and there are `createdAt` / `updatedAt` ISO strings on everything. `__v` may be present. Dates are ISO-8601 strings in UTC.

---

## 4. Resources

### 4.1 Customer

```ts
{
  _id: string;
  firstName: string;       // required, trimmed, min 1
  lastName: string;        // required, trimmed, min 1
  phone: string;           // required — see normalization below
  email?: string;          // optional, lowercased by the server
  professional: string;    // set from your session, never send it
  createdAt: string;
  updatedAt: string;
}
```

**Phone normalization.** On create and update the server rewrites a Bulgarian local-format number to international: a 10-character string starting with `0` becomes `359` plus the remaining 9 digits (`0888123456` becomes `359888123456`). Anything else is stored verbatim. Note the stored format has **no leading `+`**. Display formatting is the frontend's job; do not pre-normalize before sending.

**Uniqueness.** `{ professional, phone }` is a unique index. A duplicate phone returns `409 "Duplicate field value entered"` — a generic message, so the UI should map a `409` on customer create/update to "a customer with this phone already exists."

**Search.** `GET /customers?name=...&phone=...` — both are case-insensitive substring matches (`name` matches first *or* last name). `phone` is normalized the same way before matching, so searching `0888` finds `359888...`.

**Deletion is blocked** while the customer has any appointment with status `scheduled`: `409 "Cannot delete a customer with scheduled appointments. Cancel or complete them first."` Completed/cancelled/no-show history does not block deletion. The UI should surface that path rather than presenting delete as always available.

### 4.2 Appointment

```ts
{
  _id: string;
  professional: string;
  customer: string | PopulatedCustomer;   // see below
  start: string;                          // ISO datetime, UTC
  duration: number;                       // minutes, integer >= 1
  service?: string;
  notes?: string;
  status: "scheduled" | "completed" | "cancelled" | "no-show";
  reminderSent: boolean;
  reminderAttempts: number;
  reminderNextAttemptAt: string | null;
  reminderClaimedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}
```

**`customer` is populated on reads, an id string on writes.** `GET /appointments` and `GET /appointments/:id` populate it to `{ _id, firstName, lastName, phone, email }` — only those fields. `POST` and `PATCH` return the **unpopulated** document, with `customer` as a bare id string. If your UI renders the customer name from the create response it will render nothing; either refetch or merge the customer you already hold client-side.

**There is no end-time field.** End is `start + duration * 60000`, computed client-side for rendering.

**Creation rules:**

- `start` must be strictly in the future (`400` otherwise). Beware of the user filling a form slowly — validate near submit time, not just on field blur.
- `customer` must be one of *your* customers, else `404 "Customer not found"`.
- **Overlap is rejected:** `409 "Appointment overlaps with another booking"`, against any other **`scheduled`** appointment of yours — `cancelled`/`completed`/`no-show` appointments don't occupy their slot. The check is `existing.start < newEnd && existing.end > newStart`. Back-to-back appointments (one ending exactly when the next starts) are allowed.

**Update (`PATCH /appointments/:id`):**

- At least one field required; the body is strict, and allowed keys are exactly `customer`, `start`, `duration`, `service`, `notes`, `status`.
- The overlap check re-runs on any change, using the new `start`/`duration` where supplied and the existing values otherwise, excluding the appointment itself. This means reactivating a cancelled appointment back to `scheduled` conflicts if something else has since been booked into its old slot.
- Setting `status` to `cancelled` does stop the reminder (the worker only sends for `scheduled`) **and** frees its slot for rebooking — the overlap check only considers `scheduled` appointments.

**Reminders.** A reminder SMS fires roughly 24h before `start` (a worker polls every 5 minutes for `scheduled` appointments 23–25h out with `reminderSent: false`). The `reminder*` fields are readable and useful for a "reminder sent" indicator, but are **not writable** — there is no endpoint to trigger, cancel, or resend a reminder. Rescheduling an appointment further out does not reset `reminderSent` if one already went out.

### 4.3 Professional

There is no profile read/update endpoint beyond `GET /me` (§2.5), and no change-password-while-logged-in endpoint — only the emailed reset flow. Plan the settings screen accordingly, or request those endpoints.

---

## 5. `GET /appointments` — the filter rules

Exactly **one** of these three filtering methods, or none:

| Method | Params | Format |
|---|---|---|
| Single day | `start` | `YYYY-MM-DD` (date only) |
| Explicit range | `from` and/or `to` | `YYYY-MM-DD` (date only) |
| Named range | `range` | `today`, `week`, or `month` |

Combining two gives `400 "Use only one filtering method: date, range, or from/to"`. `from` later than `to` gives `400 "From date must be before To date"`.

**Naming trap:** the query param `start` is a **date-only string** meaning "this calendar day". The body field `start` on create/update is a **full ISO datetime**. Same name, different types — do not share a type between them.

`customer=<id>` is an independent filter and may be combined with any of the above.

**The no-filter default is not "everything".** With no date filter and no `customer`, the server returns a rolling window of **7 days back to 30 days forward**. For full history you must pass an explicit `from`/`to`. With `customer` set and no date filter, no date window is applied — you get that customer's full history.

Results are sorted by `start` ascending.

**`range` semantics:** `today` is the current UTC day; `week` is Monday–Sunday of the current UTC week; `month` is the current UTC calendar month.

---

## 6. Dates and timezones

Everything on the server is UTC:

- `start` on create/update is parsed with `new Date(value)` — send a full ISO string with an explicit offset or `Z`. A bare `2026-04-10T14:30:00` is ambiguous; don't send it.
- Day boundaries for `start` / `from` / `to` are `00:00:00.000Z` and `23:59:59.999Z` of that UTC date.
- `range=today|week|month` is anchored to the *server's* UTC clock.

For a Bulgarian audience (UTC+2 winter, UTC+3 summer), `range=today` between midnight and 03:00 local returns *yesterday's* appointments from the user's point of view.

**Recommendation:** have the frontend compute local day boundaries itself and send them as an explicit `from`/`to` range rather than using `range=today`. Use `range` only where "approximately this period" is good enough. Note `from`/`to` are date-only and still snap to UTC day boundaries, so a local-midnight-accurate calendar view will need the backend to accept datetimes or a timezone — flag it if the product needs exactness.

Every account is hardcoded to `Europe/Sofia` server-side (`Professional.timezone`, not currently exposed via the API) since every professional using this product operates in Bulgaria today — there's no per-account detection to wire up on the frontend.

---

## 7. Errors and rate limits

### 7.1 Status codes you will actually hit

| Status | When | Frontend handling |
|---|---|---|
| `400` | Validation failure, unknown body key, bad filter combo, expired/invalid reset or verification token | Show `message`; it's specific enough to display |
| `401` | No/expired/invalid `token` cookie, token predating a password change, bad refresh token | Refresh once, then log out |
| `403` | CSRF mismatch **or** login with an unverified email | Distinguish by `message` — they need very different UI |
| `404` | Resource not found, not yours, or a malformed ObjectId that reached a controller | Treat as not found |
| `409` | Appointment overlap; duplicate customer phone; deleting a customer with scheduled appointments | Map to a specific message per call site |
| `429` | Rate limited | Back off; show a "try again shortly" message |
| `500`+ | Server error | Show `requestId` |

### 7.2 Rate limits

| Scope | Limit |
|---|---|
| Global, all routes, per IP | 100 requests / 10 min |
| `POST /login`, per IP | 20 failed / 15 min |
| `POST /login`, per submitted email | 5 failed / 15 min |
| `POST /refresh`, per IP | 20 failed / 15 min |
| `POST /forgot-password` | 5 / hour |
| `POST /resend-verification` | 5 / hour |

The login and refresh limiters skip successful requests, so only failures count. The **global 100 / 10 min per IP** is the one a normal app can trip: debounce customer search at 300ms or more, and avoid polling loops. Standard `RateLimit-*` headers are returned.

### 7.3 Anti-enumeration responses

`forgot-password` and `resend-verification` always return `200` with a generic message regardless of whether the account exists or whether the email actually sent. **Never** render these as "we sent an email to that address" in a way that implies the account exists. Use the wording the API returns.

---

## 8. Endpoint index

All paths prefixed with `https://api.napomnyane.eu/api/v1`. **A** = requires auth cookie. **C** = requires `x-csrf-token` header.

### Professionals

| Method | Path | | Notes |
|---|---|---|---|
| POST | `/professionals/register` | | `{ email, password (min 8), profession? }` → 201, no session |
| POST | `/professionals/verify-email` | | `{ token }` |
| POST | `/professionals/resend-verification` | | `{ email }` |
| POST | `/professionals/login` | | `{ email, password }` → sets cookies, empty data |
| POST | `/professionals/refresh` | | no body; rotates all three cookies |
| GET | `/professionals/me` | A | non-enveloped |
| POST | `/professionals/logout` | A C | |
| POST | `/professionals/forgot-password` | | `{ email }` |
| POST | `/professionals/reset-password` | | `{ token, password (min 8) }` |

### Customers

| Method | Path | | Notes |
|---|---|---|---|
| GET | `/customers` | A | `?name=&phone=&page=&limit=` |
| POST | `/customers` | A C | `{ firstName, lastName, phone, email? }` → 201 |
| GET | `/customers/:id` | A | |
| PATCH | `/customers/:id` | A C | partial |
| DELETE | `/customers/:id` | A C | → 204, no body |

### Appointments

| Method | Path | | Notes |
|---|---|---|---|
| GET | `/appointments` | A | `?start=` or `?from=&to=` or `?range=`, plus `&customer=&page=&limit=` |
| POST | `/appointments` | A C | `{ customer, start, duration, service?, notes? }` → 201 |
| GET | `/appointments/:id` | A | |
| PATCH | `/appointments/:id` | A C | partial, plus `status` |
| DELETE | `/appointments/:id` | A C | → 204, no body |

### Unversioned

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | `{ status, db }`, 503 when Mongo is down |
| GET | `/docs`, `/docs-json` | Swagger UI / OpenAPI JSON |

---

## 9. Gaps to raise before or while building

### 9.1 Missing — raise these rather than working around them

The fix belongs on the backend:

- **No profile endpoint.** Nothing returns the professional's `profession`, `isEmailVerified` or `createdAt`; `GET /me` only reflects the JWT. A settings screen has nothing to render.
- **No change-password-while-authenticated endpoint.** A logged-in user who knows their current password still has to go out through the emailed forgot-password flow to change it. (The pre-login reset flow itself works fine — this is about the in-app one.)
- **No account-deletion or data-export endpoint.**
- **No way to trigger, cancel, or resend a reminder manually.**
- `GET /me` and the auth middleware's `401`/`403` bodies are not enveloped.
- `DELETE` returns `204` with no body while other writes return the affected document.
- Date filters are date-only and UTC-anchored, so a local-timezone day cannot be expressed exactly (see §6).

### 9.2 Deliberate — do not "fix" these

- **There is no working-hours, availability, or bookable-slots concept, and that is a product decision.** Professionals set their own hours and the product does not impose a standard working day on them. Build slot selection as a free-form date/time picker. Do **not** invent a client-side working-day assumption (no "9–17, Mon–Fri" defaults, no greying out evenings or weekends), and do not propose adding a working-hours resource to the backend. The only scheduling constraint the server enforces is the overlap check.
- **Auth is cookie-only with no bearer-token path.** Keeping the JWT out of JSON is the point; don't add a token-in-body fallback.
- **`forgot-password` and `resend-verification` always return the same generic 200.** That is anti-enumeration, not a missing error path.

---

## 10. First-hour smoke test

Run this before writing any UI. Substitute a real email you control.

```bash
BASE=https://api.napomnyane.eu/api/v1
JAR=./cookies.txt

# 1. register (in production the token is NOT echoed back; check your inbox)
curl -s -X POST $BASE/professionals/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"aVeryGoodPassword","profession":"Dentist"}'

# 2. verify with the token from the email link
curl -s -X POST $BASE/professionals/verify-email \
  -H 'Content-Type: application/json' -d '{"token":"TOKEN_FROM_EMAIL"}'

# 3. login — you should see three Set-Cookie headers
curl -si -c $JAR -X POST $BASE/professionals/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"aVeryGoodPassword"}' | grep -i set-cookie

# 4. authenticated GET
curl -s -b $JAR $BASE/professionals/me

# 5. authenticated mutation — the CSRF header must match the cookie
CSRF=$(grep csrfToken $JAR | awk '{print $7}')
curl -s -b $JAR -X POST $BASE/customers \
  -H 'Content-Type: application/json' -H "x-csrf-token: $CSRF" \
  -d '{"firstName":"Test","lastName":"Patient","phone":"0888123456"}'
# phone comes back as "359888123456"
```

If step 5 returns `403`, the CSRF wiring is wrong. If step 4 returns `401`, the cookie handling is wrong. Fix those before touching any UI framework.
