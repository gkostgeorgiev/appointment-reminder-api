# Production Deployment & Operations Runbook

Supported target: **Render** (API) + **MongoDB Atlas** (database) + **Twilio** (SMS) + **Resend** (email).

See [SECRETS.md](SECRETS.md) for how production credentials are stored, rotated, and scanned for.

---

# Infrastructure

* API → Render Web Service
* Database → MongoDB Atlas, **replica set** (any tier, including the free M0 — even the shared/free tier is provisioned as a replica set). A replica set is required because `createAppointment`/`updateAppointment` run inside a multi-document transaction (see `AppointmentLock` in `src/controllers/appointment.controller.ts`); transactions aren't supported on a standalone `mongod`.
* SMS → Twilio
* Email → Resend

Render terminates TLS in front of the app and proxies requests, which is why `src/app.ts` sets `app.set("trust proxy", 1)` — this is Render-specific and would need revisiting under a different host.

Recommended environments: development, staging, production — each as a separate Render service and Atlas project/cluster, with its own secrets (see SECRETS.md).

---

# Build & start

Render service settings:

* **Build command**: `yarn install --frozen-lockfile && yarn build`
* **Start command**: `yarn start` (runs `node dist/server.js`)

`PORT` is supplied by Render at runtime — the app already reads it from `env.PORT` (`src/config/env.ts`), no code change needed.

---

# Environment & secrets

Required env vars are listed in `.env.example` and documented in `CLAUDE.md`. In production these are set directly in Render's per-service **Environment** tab, never through a committed file — see [SECRETS.md](SECRETS.md) for the full policy and per-secret rotation steps.

---

# Health & readiness

`GET /health` (`src/app.ts:58`) reports live DB connectivity:

```json
{ "status": "ok", "db": "connected" }
```

returning `503` with `"status": "error"` if Mongoose isn't connected. Configure this as Render's health check path — a `503` here should be treated as not-ready, not just degraded, since every request handler depends on Mongo.

Also point an external uptime monitor (e.g. UptimeRobot, Better Uptime) at `/health` in production — Render's own health check only affects routing/restarts, it doesn't page anyone.

---

# MongoDB backup & restore

* **Paid Atlas tiers (M10+)**: enable Atlas's continuous backups (point-in-time restore). Restoring is a few clicks in the Atlas UI — restore to a new cluster first, verify, then cut over.
* **Free M0 tier**: Atlas does **not** provide automated backups on M0. Until the project is upgraded off M0, take manual backups periodically:

  ```
  mongodump --uri="$MONGO_URI" --archive=backup-$(date +%F).gz --gzip
  ```

  Store the archive somewhere outside the Atlas project (e.g. encrypted cloud storage). Restore with:

  ```
  mongorestore --uri="$MONGO_URI" --archive=backup-<date>.gz --gzip
  ```

  Given this DB holds patient-adjacent PII (customer name/phone/email — see `sentry.ts`'s scrubbing), don't skip this just because M0 makes it manual.

---

# Index rollout

Mongoose's default `autoIndex: true` (unchanged in `src/config/db.ts`) builds every schema-declared index on each `connect()` call. At current scale this is fine — index builds are the app's own startup cost, not a separate migration step.

Current indexes:

* `Customer`: unique compound `{ professional, phone }`
* `Appointment`: `{ professional, start, reminderSent }` (calendar queries), `{ reminderSent, start }` (reminder worker poll)

If the `Customer`/`Appointment` collections ever grow large enough that a startup index build becomes disruptive (blocking connect, or building a large index under load), switch to `autoIndex: false` in `mongoose.connect()` and run `Model.syncIndexes()` explicitly as a one-off deploy step, so index builds happen on your schedule rather than on every restart.

---

# Alerting

* `errorHandler.ts` reports to Sentry only for `statusCode >= 500` — expected 4xxs are noise-free by design (see CLAUDE.md's "Error reporting" section for the full policy, including the deliberate email-delivery exceptions).
* `reminderJob.ts` reports both a failed tick (`Appointment.find` failure) and a failed per-appointment send to Sentry.
* A reminder that exhausts `MAX_REMINDER_ATTEMPTS` (4) fires a **distinct** `Sentry.captureMessage("Reminder permanently failed...")` — treat this as a real, actionable alert (a patient will not get their reminder), not just noise alongside transient failures still retrying.
* `server.ts`'s `uncaughtException`/`unhandledRejection` handlers report to Sentry, flush (bounded 2s), then shut down — a spike of these means the process is crash-looping.
* Point an uptime monitor at `/health` (see above) for infra-level (not app-level) alerting.

If `SENTRY_DSN` isn't set, none of this fires — `initSentry()` no-ops silently. Set it in every environment that matters for alerting.

---

# Rollback

No data migrations exist today — only Mongoose index changes (see above), which are additive and safe to roll forward/back. Rollback is therefore just a code rollback:

* Render: redeploy the previous successful build from the service's deploy history.
* Or: `git revert` the bad commit(s) on `main` and push — CI (`yarn build && yarn test`) gates the revert the same as any other change.

If a change ever does need a real data migration, that migration needs its own rollback plan at the time — this section doesn't cover that case.

---

# Single-reminder-worker requirement

`RUN_REMINDER_WORKER=true` must be set on **exactly one** Render instance. The reminder job (`src/jobs/reminderJob.ts`) is a polling `node-cron` job started in-process by `server.ts`, not a separately-deployed worker — running it on more than one instance means more than one process polling and calling Twilio for the same window.

This is a cost/waste concern, not a correctness one: `reminderJob.ts` claims each appointment atomically before sending (`reminderClaimedUntil`, a short TTL lease — see the comment at the top of the claim logic), so a second worker racing on the same appointment finds nothing left to claim and skips it rather than double-sending. If this invariant is ever accidentally violated (e.g. Render autoscaling spins up a second instance with the same env), reminders stay correct but Twilio gets polled and (occasionally) called twice for no benefit.

Keep autoscaling disabled on the reminder-worker-enabled service, or run the reminder worker as a separate, single-instance Render service (with `RUN_REMINDER_WORKER=true` only there) if the web tier is ever scaled horizontally.
