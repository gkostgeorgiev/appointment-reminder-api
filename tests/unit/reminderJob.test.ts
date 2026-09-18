import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import type { MongoMemoryReplSet } from "mongodb-memory-server";
import { setupTestApp, teardownTestApp, clearDatabase } from "../helpers/setup.js";

vi.mock("../../src/services/smsService.js", () => ({
  sendSms: vi.fn(),
}));
vi.mock("@sentry/node", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

let mongod: MongoMemoryReplSet;
let runReminderTick: () => Promise<void>;
let MAX_REMINDER_ATTEMPTS: number;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Appointment: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Customer: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Professional: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ReminderWorkerLock: any;
let REMINDER_WORKER_LOCK_ID: string;
let sendSmsMock: ReturnType<typeof vi.fn>;
let sentry: { captureException: ReturnType<typeof vi.fn>; captureMessage: ReturnType<typeof vi.fn> };

beforeAll(async () => {
  ({ mongod } = await setupTestApp());
  ({ runReminderTick, MAX_REMINDER_ATTEMPTS } = await import(
    "../../src/jobs/reminderJob.js"
  ));
  ({ Appointment } = await import("../../src/models/Appointment.js"));
  ({ Customer } = await import("../../src/models/Customer.js"));
  ({ Professional } = await import("../../src/models/Professional.js"));
  ({ ReminderWorkerLock, REMINDER_WORKER_LOCK_ID } = await import(
    "../../src/models/ReminderWorkerLock.js"
  ));
  ({ sendSms: sendSmsMock } = await import("../../src/services/smsService.js"));
  sentry = await import("@sentry/node");
});

afterEach(async () => {
  await clearDatabase();
  sendSmsMock.mockReset();
  sentry.captureException.mockReset();
  sentry.captureMessage.mockReset();
});

afterAll(async () => {
  await teardownTestApp(mongod);
});

let counter = 0;
const createDueAppointment = async () => {
  counter += 1;

  const professional = await Professional.create({
    email: `reminder-${counter}@example.com`,
    password: "TestPassword123!",
    isEmailVerified: true,
  });

  const customer = await Customer.create({
    professional: professional._id,
    firstName: "Maria",
    lastName: "Ivanova",
    phone: `35988840${String(counter).padStart(4, "0")}`,
  });

  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);

  return Appointment.create({
    professional: professional._id,
    customer: customer._id,
    start,
    duration: 30,
    status: "scheduled",
  });
};

describe("reminder job retry/backoff", () => {
  it("sends the reminder and flips reminderSent on success", async () => {
    sendSmsMock.mockResolvedValue(undefined);
    const appointment = await createDueAppointment();

    await runReminderTick();

    expect(sendSmsMock).toHaveBeenCalledTimes(1);
    const reloaded = await Appointment.findById(appointment._id);
    expect(reloaded.reminderSent).toBe(true);
  });

  it("increments reminderAttempts and schedules a backoff on failure, without retrying immediately", async () => {
    sendSmsMock.mockRejectedValue(new Error("Twilio down"));
    const appointment = await createDueAppointment();

    await runReminderTick();

    let reloaded = await Appointment.findById(appointment._id);
    expect(reloaded.reminderAttempts).toBe(1);
    expect(reloaded.reminderNextAttemptAt).not.toBeNull();
    expect(reloaded.reminderNextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(reloaded.reminderSent).toBe(false);

    // A second tick, immediately after, must not retry yet (still within backoff)
    await runReminderTick();
    expect(sendSmsMock).toHaveBeenCalledTimes(1);

    reloaded = await Appointment.findById(appointment._id);
    expect(reloaded.reminderAttempts).toBe(1);
  });

  it("retries once the backoff window has passed", async () => {
    sendSmsMock.mockRejectedValue(new Error("Twilio down"));
    const appointment = await createDueAppointment();

    await runReminderTick();

    // Simulate time having passed by moving reminderNextAttemptAt into the past
    await Appointment.updateOne(
      { _id: appointment._id },
      { $set: { reminderNextAttemptAt: new Date(Date.now() - 1000) } },
    );

    await runReminderTick();

    expect(sendSmsMock).toHaveBeenCalledTimes(2);
    const reloaded = await Appointment.findById(appointment._id);
    expect(reloaded.reminderAttempts).toBe(2);
  });

  it("gives up after MAX_REMINDER_ATTEMPTS, excludes the appointment from future ticks, and reports once", async () => {
    sendSmsMock.mockRejectedValue(new Error("Twilio down"));
    const appointment = await createDueAppointment();

    for (let i = 0; i < MAX_REMINDER_ATTEMPTS; i++) {
      if (i > 0) {
        await Appointment.updateOne(
          { _id: appointment._id },
          { $set: { reminderNextAttemptAt: new Date(Date.now() - 1000) } },
        );
      }
      await runReminderTick();
    }

    let reloaded = await Appointment.findById(appointment._id);
    expect(reloaded.reminderAttempts).toBe(MAX_REMINDER_ATTEMPTS);
    expect(reloaded.reminderNextAttemptAt).toBeNull();
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1);

    const callsBeforeExtraTick = sendSmsMock.mock.calls.length;
    await runReminderTick();
    expect(sendSmsMock).toHaveBeenCalledTimes(callsBeforeExtraTick);

    reloaded = await Appointment.findById(appointment._id);
    expect(reloaded.reminderAttempts).toBe(MAX_REMINDER_ATTEMPTS);
  });

  it("never double-sends across sequential ticks (the reminderSent guard) - this is how node-cron actually invokes it: one tick always finishes before the next fires, never overlapping", async () => {
    sendSmsMock.mockResolvedValue(undefined);
    await createDueAppointment();

    await runReminderTick();
    await runReminderTick();

    expect(sendSmsMock).toHaveBeenCalledTimes(1);
  });

  it("never double-sends across two truly overlapping ticks (the reminderClaimedUntil lease)", async () => {
    // A slow send widens the window in which a second, overlapping tick
    // (e.g. one that started because the first one ran long) could race the
    // first for the same appointment.
    sendSmsMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 20)),
    );
    await createDueAppointment();

    await Promise.all([runReminderTick(), runReminderTick()]);

    expect(sendSmsMock).toHaveBeenCalledTimes(1);
  });

  it("lets a later tick reclaim an appointment once its claim lease has expired", async () => {
    sendSmsMock.mockResolvedValue(undefined);
    const appointment = await createDueAppointment();

    // Simulate a previous tick that claimed this appointment and then
    // crashed before finishing (send + flip reminderSent, or the
    // failure/backoff bookkeeping) - the lease is in the past, so it's
    // abandoned rather than permanently stuck.
    await Appointment.updateOne(
      { _id: appointment._id },
      { $set: { reminderClaimedUntil: new Date(Date.now() - 1000) } },
    );

    await runReminderTick();

    expect(sendSmsMock).toHaveBeenCalledTimes(1);
    const reloaded = await Appointment.findById(appointment._id);
    expect(reloaded.reminderSent).toBe(true);
    expect(reloaded.reminderClaimedUntil).toBeNull();
  });

  it("skips the tick entirely while another instance holds the leadership lease (issue #23)", async () => {
    sendSmsMock.mockResolvedValue(undefined);
    await createDueAppointment();

    await ReminderWorkerLock.create({
      _id: REMINDER_WORKER_LOCK_ID,
      holder: "some-other-instance",
      expiresAt: new Date(Date.now() + 60_000),
    });

    await runReminderTick();

    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it("takes over leadership once the previous holder's lease has expired", async () => {
    sendSmsMock.mockResolvedValue(undefined);
    const appointment = await createDueAppointment();

    await ReminderWorkerLock.create({
      _id: REMINDER_WORKER_LOCK_ID,
      holder: "some-other-instance",
      expiresAt: new Date(Date.now() - 1000),
    });

    await runReminderTick();

    expect(sendSmsMock).toHaveBeenCalledTimes(1);
    const reloaded = await Appointment.findById(appointment._id);
    expect(reloaded.reminderSent).toBe(true);

    const lock = await ReminderWorkerLock.findById(REMINDER_WORKER_LOCK_ID);
    expect(lock.holder).not.toBe("some-other-instance");
  });
});
