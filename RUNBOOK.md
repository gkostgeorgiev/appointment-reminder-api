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

Environments: local development (`yarn dev`) and CI (GitHub Actions, ephemeral in-memory MongoDB via `mongodb-memory-server`) cover pre-merge testing; production is the single Render service + Atlas cluster described below. No separate staging/UAT environment — solo-dev project, no other testers, so a persistent pre-prod environment would be maintenance overhead (secrets, env vars, another cluster) without a corresponding benefit.

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
* **Free M0 tier**: Atlas does **not** provide automated backups on M0. Until the project is upgraded off M0 (not currently planned — see `.local/production-go-live-notes.md`), backups are automated outside Atlas instead: `.github/workflows/backup.yml` runs daily (`0 3 * * *` UTC) plus on-demand via `workflow_dispatch`, and:

  1. Installs `mongodb-database-tools` on the runner.
  2. Runs `mongodump --uri="$MONGO_BACKUP_URI" --archive="backup-<date>.gz" --gzip` against a dedicated **read-only** Atlas DB user (`backup-readonly`, scoped to just this database) — deliberately not the app's own read-write `MONGO_URI`, so a leaked backup credential can't write or delete production data.
  3. Uploads the archive to a private Backblaze B2 bucket via `aws-cli` (B2's API is S3-compatible) — see `SECRETS.md` for the credentials involved.

  Retention is a 30-day bucket lifecycle rule on the B2 side (auto-deletes anything older), not script logic — the bucket should always hold roughly the last 30 daily dumps, no manual pruning needed.

  A failed scheduled run triggers GitHub's own automatic email to the repo owner — no additional alerting is wired up for this (it's a CI-only script, not app runtime, so it doesn't go through Sentry). Note GitHub auto-disables scheduled workflows after 60 days of zero repository activity; worth a glance at the Actions tab if this repo goes quiet for a while.

  To restore, download the archive from the B2 bucket (`aws s3 cp "s3://$B2_BUCKET/backup-<date>.gz" . --endpoint-url "$B2_ENDPOINT"`, using the same endpoint/credentials as the workflow) and run:

  ```
  mongorestore --uri="$MONGO_URI" --archive=backup-<date>.gz --gzip
  ```

  **Without `--drop`, `mongorestore` will not overwrite a document whose `_id` already exists in the target collection** — it silently reports it as a failure (`E11000 duplicate key error`) and moves on, rather than erroring out or halting. The command still exits cleanly and looks like it succeeded unless you actually read the final `X document(s) restored successfully, Y document(s) failed to restore` line. This matters for a real incident: restoring into a database that's only partially damaged (not empty) will silently skip every document that survived, giving false confidence that a full restore happened. Add `--drop` (drops each collection before restoring into it) if the intent is a full replace rather than a fill-in, and always check that final restored/failed count rather than just the exit code — confirmed by an actual test restore against prod data on 2026-09-21, which silently skipped every document for exactly this reason.

  Given this DB holds patient-adjacent PII (customer name/phone/email — see `sentry.ts`'s scrubbing), don't skip this just because M0 makes it manual to set up.

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
