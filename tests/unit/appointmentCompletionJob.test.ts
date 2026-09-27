import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
  type MockedFunction,
} from "vitest";
import type { MongoMemoryReplSet } from "mongodb-memory-server";
import { setupTestApp, teardownTestApp, clearDatabase } from "../helpers/setup.js";
import type * as SentryNode from "@sentry/node";

vi.mock("@sentry/node", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

let mongod: MongoMemoryReplSet;
let runAppointmentCompletionTick: () => Promise<void>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Appointment: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Customer: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Professional: any;
let sentry: {
  captureException: MockedFunction<typeof SentryNode.captureException>;
};

beforeAll(async () => {
  ({ mongod } = await setupTestApp());
  ({ runAppointmentCompletionTick } = await import(
    "../../src/jobs/appointmentCompletionJob.js"
  ));
  ({ Appointment } = await import("../../src/models/Appointment.js"));
  ({ Customer } = await import("../../src/models/Customer.js"));
  ({ Professional } = await import("../../src/models/Professional.js"));
  const sentryModule = await import("@sentry/node");
  sentry = {
    captureException: vi.mocked(sentryModule.captureException),
  };
});

afterEach(async () => {
  await clearDatabase();
  sentry.captureException.mockReset();
});

afterAll(async () => {
  await teardownTestApp(mongod);
});

let counter = 0;
const createAppointment = async (overrides: {
  start: Date;
  duration: number;
  status?: string;
}) => {
  counter += 1;

  const professional = await Professional.create({
    email: `completion-${counter}@example.com`,
    password: "TestPassword123!",
    isEmailVerified: true,
  });

  const customer = await Customer.create({
    professional: professional._id,
    firstName: "Maria",
    lastName: "Ivanova",
    phone: `35988841${String(counter).padStart(4, "0")}`,
  });

  return Appointment.create({
    professional: professional._id,
    customer: customer._id,
    start: overrides.start,
    duration: overrides.duration,
    status: overrides.status ?? "scheduled",
  });
};

describe("appointment completion job", () => {
  it("completes a scheduled appointment whose end time has passed", async () => {
    const appointment = await createAppointment({
      start: new Date(Date.now() - 60 * 60 * 1000),
      duration: 30,
    });

    await runAppointmentCompletionTick();

    const reloaded = await Appointment.findById(appointment._id);
    expect(reloaded.status).toBe("completed");
  });

  it("leaves a scheduled appointment alone while it has started but not yet ended", async () => {
    const appointment = await createAppointment({
      start: new Date(Date.now() - 5 * 60 * 1000),
      duration: 60,
    });

    await runAppointmentCompletionTick();

    const reloaded = await Appointment.findById(appointment._id);
    expect(reloaded.status).toBe("scheduled");
  });

  it("leaves a future scheduled appointment alone", async () => {
    const appointment = await createAppointment({
      start: new Date(Date.now() + 60 * 60 * 1000),
      duration: 30,
    });

    await runAppointmentCompletionTick();

    const reloaded = await Appointment.findById(appointment._id);
    expect(reloaded.status).toBe("scheduled");
  });

  it("never overwrites a manually-set status, even once its end time has passed", async () => {
    const cancelled = await createAppointment({
      start: new Date(Date.now() - 60 * 60 * 1000),
      duration: 30,
      status: "cancelled",
    });
    const noShow = await createAppointment({
      start: new Date(Date.now() - 60 * 60 * 1000),
      duration: 30,
      status: "no-show",
    });

    await runAppointmentCompletionTick();

    expect((await Appointment.findById(cancelled._id)).status).toBe(
      "cancelled",
    );
    expect((await Appointment.findById(noShow._id)).status).toBe("no-show");
  });

  it("completes an appointment whose end time is exactly now", async () => {
    const now = new Date();
    const appointment = await createAppointment({
      start: new Date(now.getTime() - 30 * 60000),
      duration: 30,
    });

    // Force the "now" the tick sees to line up exactly with this
    // appointment's end (start + duration), rather than racing real time.
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      await runAppointmentCompletionTick();
    } finally {
      vi.useRealTimers();
    }

    const reloaded = await Appointment.findById(appointment._id);
    expect(reloaded.status).toBe("completed");
  });

  it("reports to Sentry and does not throw when the update fails", async () => {
    await createAppointment({
      start: new Date(Date.now() - 60 * 60 * 1000),
      duration: 30,
    });

    const updateManySpy = vi
      .spyOn(Appointment, "updateMany")
      .mockImplementation(() => ({
        maxTimeMS: () => Promise.reject(new Error("Mongo down")),
      }));

    await expect(runAppointmentCompletionTick()).resolves.toBeUndefined();
    expect(sentry.captureException).toHaveBeenCalledTimes(1);

    updateManySpy.mockRestore();
  });
});
