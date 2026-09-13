# Appointment Reminder API

![Node.js](https://img.shields.io/badge/node.js-20.x-green)
![TypeScript](https://img.shields.io/badge/typescript-5.x-blue)
![Express](https://img.shields.io/badge/express-4.x-lightgrey)
![MongoDB](https://img.shields.io/badge/mongodb-atlas-green)
![OpenAPI](https://img.shields.io/badge/openapi-swagger-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![API Docs](https://img.shields.io/badge/API-Documentation-green)

A backend API for managing appointments and automatically sending SMS reminders to patients before their scheduled visits.

The system is designed as a **multi-tenant SaaS backend**, allowing professionals to manage their customers and appointments while the platform automatically handles reminder notifications.

---

# Features

* Professional authentication (JWT)
* Multi-tenant architecture
* Customer management
* Appointment scheduling
* Appointment conflict detection
* Automatic SMS reminders
* Cron-based reminder worker
* Input validation with Zod
* Centralized error handling
* Production security middleware

---

# Tech Stack

Backend

* Node.js
* Express
* TypeScript

Database

* MongoDB
* Mongoose

Validation

* Zod

Authentication

* JWT

Background Jobs

* node-cron

SMS

* Twilio

Security

* helmet
* express-rate-limit
* hpp
* cors

---

# Architecture Overview

The API follows a **multi-tenant architecture**.

Each professional can only access their own data.

Professional → Customers → Appointments

All queries are scoped using the authenticated user:

req.user.userId

This ensures complete isolation between different professionals using the system.

---

# API Base URL

Example:

/api

---

# Health Check

GET /health

Used for uptime monitoring and deployment verification.

---

# Authentication

Base route:

/api/professionals

## Register Professional

POST /api/professionals/register

Creates a new professional account and emails a verification link (valid 24 hours) via Resend. No session is created at this point — the response contains no token, and no cookies are set. The account must be verified before login will succeed.

Outside production (`NODE_ENV !== "production"`), the response also includes `verificationToken` — the raw token, directly usable with `/verify-email` — so you can test with made-up addresses (e.g. `test1@example.com`) without needing a real, deliverable inbox. `/resend-verification` does the same. This is never present in production.

Request body

```json
{
  "name": "Dr. Ivan Petrov",
  "email": "ivan@example.com",
  "password": "password123"
}
```

---

## Verify Email

POST /api/professionals/verify-email

Consumes the single-use token from the verification email and marks the account verified.

Request body

```json
{
  "token": "raw-token-from-email"
}
```

---

## Resend Verification Email

POST /api/professionals/resend-verification

Rate-limited (5/hour per client). Always returns the same generic message, whether or not the account exists or is already verified, so it can't be used to enumerate accounts. Sends a new verification link only if the account exists and isn't verified yet.

Request body

```json
{
  "email": "ivan@example.com"
}
```

---

## Login

POST /api/professionals/login

Returns a JWT token, both in the response body and as an httpOnly cookie. Fails with `403` if the account's email hasn't been verified yet.

Request body

```json
{
  "email": "ivan@example.com",
  "password": "password123"
}
```

Response

```json
{
  "token": "jwt-token"
}
```

The same JWT is also set as an httpOnly `token` cookie, plus a companion, readable `csrfToken` cookie. Browser clients should authenticate via the cookie (`fetch(url, { credentials: "include" })`); non-browser clients can keep using `Authorization: Bearer <token>` from the JSON response — both are accepted on every protected route.

If you authenticate via the cookie, every mutating request (`POST`/`PUT`/`PATCH`/`DELETE`) must also send an `X-CSRF-Token` header equal to the `csrfToken` cookie's value (read it with client-side JS — it is not httpOnly). This is a CSRF mitigation required by the cookie being `SameSite=None`; Bearer-header requests don't need this header.

---

## Get Current Professional

GET /api/professionals/me

Returns information about the authenticated professional.

Authentication required (cookie or `Authorization: Bearer` header).

---

## Logout

POST /api/professionals/logout

Clears the `token` and `csrfToken` cookies. Authentication required. Has no effect on a Bearer token already handed to a non-browser client.

---

## Forgot Password

POST /api/professionals/forgot-password

Request body

```json
{
  "email": "ivan@example.com"
}
```

Always responds with the same generic message, whether or not an account exists for that email:

```json
{
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

If the account exists, an email is sent (via Resend) containing a reset link (`${FRONTEND_URL}/reset-password?token=...`). The token is single-use and expires after 1 hour. This endpoint is rate-limited to 5 requests/hour per client.

---

## Reset Password

POST /api/professionals/reset-password

Request body

```json
{
  "token": "the-token-from-the-email",
  "password": "newPassword123"
}
```

On success, the password is updated and any JWT issued before the reset is invalidated — the client must log in again.

---

# Customers

Base route:

/api/customers

All customer records belong to the authenticated professional.

Customer fields:

* firstName
* lastName
* phone
* email (optional)

---

## Create Customer

POST /api/customers

Request body

```json
{
  "firstName": "Maria",
  "lastName": "Ivanova",
  "phone": "+359888123456",
  "email": "maria@example.com"
}
```

---

## Get Customers

GET /api/customers

Returns customers belonging to the authenticated professional, paginated.

### Query Parameters

```
?phone=888
?name=John
?page=1
?limit=50
```

`limit` defaults to 50, max 200. Response shape:

```json
{
  "ok": true,
  "status": 200,
  "data": {
    "items": [ /* customers */ ],
    "pagination": { "page": 1, "limit": 50, "total": 132, "totalPages": 3 }
  }
}
```

---

## Get Customer

GET /api/customers/:id

Returns a specific customer.

---

## Update Customer

PATCH /api/customers/:id

Updates customer information.

---

## Delete Customer

DELETE /api/customers/:id

Removes a customer.

---

# Appointments

Base route:

/api/appointments

Appointments represent scheduled meetings between a professional and a customer.

Fields:

* professional
* customer
* start
* duration
* service
* notes
* status
* reminderSent

Possible status values:

scheduled
completed
cancelled
no-show

---

## Create Appointment

POST /api/appointments

Request body

```json
{
  "customer": "customerId",
  "start": "2026-03-20T15:00:00Z",
  "duration": 30,
  "service": "check-up"
}
```

---

## Get Appointments

GET /api/appointments

Returns appointments belonging to the authenticated professional, paginated.

Supports flexible date filtering.

### Query Parameters

Filter by day

```
?start=2026-03-20
```

Filter by date range

```
?from=2026-03-20&to=2026-03-25
```

Predefined ranges

```
?range=today
?range=week
?range=month
```

Filter by customer (returns that customer's full history if used alone, with no date filter)

```
?customer=customerId
```

Pagination

```
?page=1
?limit=100
```

`limit` defaults to 100, max 500.

If none of `start`/`range`/`from`/`to`/`customer` are given, the query defaults to a rolling window of 7 days back through 30 days forward from now, instead of every appointment ever created — this bounds the response for accounts with a lot of history while still showing the near-term schedule by default.

Appointments are returned sorted by start time. Response shape:

```json
{
  "ok": true,
  "status": 200,
  "data": {
    "items": [ /* appointments */ ],
    "pagination": { "page": 1, "limit": 100, "total": 42, "totalPages": 1 }
  }
}
```

---

## Get Appointment

GET /api/appointments/:id

---

## Update Appointment

PATCH /api/appointments/:id

---

## Delete Appointment

DELETE /api/appointments/:id

---

# Reminder System

The system automatically sends SMS reminders approximately **24 hours before an appointment**.

Process:

cron worker
↓
find appointments starting in ~24h
↓
populate customer
↓
send SMS via Twilio
↓
mark reminderSent = true

Cron schedule:

```
*/5 * * * *
```

The worker checks every 5 minutes.

---

# Reminder Worker Safety

To prevent duplicate reminders when scaling the API, the worker runs only when enabled:

```
RUN_REMINDER_WORKER=true
```

---

# Examples Reminder Message

Reminder: Appointment tomorrow at 17:50.

Напомняне: Имате час утре в 17:50 ч.

Notes:

* Bulgarian messages use Unicode SMS encoding
* Maximum 70 characters per SMS segment

---

# Database Indexes

Appointments include optimized indexes:

```
{ professional: 1, start: 1, reminderSent: 1 }
{ reminderSent: 1, start: 1 }
```

These support:

* calendar queries
* reminder worker queries

---

## Architecture

The system follows a service-oriented backend architecture designed for SaaS scalability.

```
Client Application
        │
        ▼
   Express API
        │
        │ JWT Authentication
        │ Request Validation (Zod)
        ▼
     MongoDB Atlas
        │
        ▼
 Appointment Storage
        │
        ▼
 Reminder Worker (node-cron)
        │
        ▼
   SMS Service (Twilio)
        │
        ▼
     Patient Phone
```

### Components

**Express API**

Handles authentication, business logic, and data validation.

**MongoDB**

Stores professionals, customers, and appointment data.

**Reminder Worker**

Runs every 5 minutes and checks for appointments occurring in the next 24 hours.

**SMS Service**

Sends reminder messages to customers using Twilio.


# Security

The API includes several protection layers.

Request validation

* Zod schemas

Security middleware

* helmet
* express-rate-limit
* hpp
* cors

Payload protection

```
app.use(express.json({ limit: "10kb" }));
```

---

# Environment Variables

Example `.env`

```
PORT=5000
MONGO_URI=mongo_connection_string
JWT_SECRET=secret
CORS_ORIGIN=https://your-frontend.example.com

TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...

RUN_REMINDER_WORKER=true

RESEND_API_KEY=...
EMAIL_FROM=noreply@your-domain.example.com
FRONTEND_URL=https://your-frontend.example.com
```

`CORS_ORIGIN` is a comma-separated list of allowed origins (e.g. `https://app.example.com,https://staging.example.com`). It's required because cookie-based auth needs `credentials: true` on CORS, which the spec forbids combining with a wildcard `*` origin.

---

# Running Locally

Install dependencies

```
npm install
```

Cookie-based auth uses `SameSite=None` cookies, which only get set/sent over HTTPS. To exercise that locally, generate a trusted local certificate with [mkcert](https://github.com/FiloSottile/mkcert) and save it as `certs/dev-cert.pem` / `certs/dev-key.pem` (gitignored) — `npm run dev` will pick it up automatically and serve over HTTPS. Without it, dev falls back to plain HTTP and only the `Authorization: Bearer` auth path is testable locally.

Start development server

```
npm run dev
```

---

# Production Deployment

Typical infrastructure:

API → Render / Railway / Fly.io
Database → MongoDB Atlas
SMS → Twilio

Recommended environments:

* development
* staging
* production

---

# Project Status

MVP backend completed.

Implemented:

* Authentication
* Password reset (forgot/reset password)
* Customers CRUD
* Appointments CRUD
* Conflict detection
* SMS reminders
* Cron worker
* Security middleware
* Health endpoint

Next step:

Frontend dashboard.

Before going live (production):

* Verify a real sending domain in Resend and update `EMAIL_FROM` to an address on it — password reset emails currently only deliver to the Resend account owner's own email address (sandbox sender `onboarding@resend.dev`), which is fine for MVP development but won't reach real users in production.
