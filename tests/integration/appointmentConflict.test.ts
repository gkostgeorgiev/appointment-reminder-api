import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import type { Express } from "express";
import type { MongoMemoryReplSet } from "mongodb-memory-server";
import { setupTestApp, teardownTestApp, clearDatabase } from "../helpers/setup.js";
import { registerAndLogin } from "../helpers/auth.js";

type Authed = Awaited<ReturnType<typeof registerAndLogin>>["authed"];

vi.mock("../../src/services/smsService.js", () => ({
  sendSms: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/services/emailService.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

let app: Express;
let mongod: MongoMemoryReplSet;

beforeAll(async () => {
  ({ app, mongod } = await setupTestApp());
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await teardownTestApp(mongod);
});

const createCustomer = async (authed: Authed, phone: string) => {
  const res = await authed
    .post("/api/v1/customers")
    .send({ firstName: "Maria", lastName: "Ivanova", phone });

  return res.body.data._id as string;
};

describe("appointment conflict detection", () => {
  it("rejects an overlapping appointment for the same professional", async () => {
    const pro = await registerAndLogin(app, "conflict1@example.com");
    const customerId = await createCustomer(pro.authed, "359888100001");

    const baseStart = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const first = await pro.authed
      .post("/api/v1/appointments")
      .send({ customer: customerId, start: baseStart.toISOString(), duration: 30 });
    expect(first.status).toBe(201);

    // Starts 15 minutes into the first appointment's 30-minute slot -> overlaps
    const overlapStart = new Date(baseStart.getTime() + 15 * 60 * 1000);
    const second = await pro.authed
      .post("/api/v1/appointments")
      .send({ customer: customerId, start: overlapStart.toISOString(), duration: 30 });

    expect(second.status).toBe(409);
  });

  it("accepts a back-to-back appointment that starts exactly when the previous one ends", async () => {
    const pro = await registerAndLogin(app, "conflict2@example.com");
    const customerId = await createCustomer(pro.authed, "359888100002");

    const baseStart = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const first = await pro.authed
      .post("/api/v1/appointments")
      .send({ customer: customerId, start: baseStart.toISOString(), duration: 30 });
    expect(first.status).toBe(201);

    const backToBackStart = new Date(baseStart.getTime() + 30 * 60 * 1000);
    const second = await pro.authed.post("/api/v1/appointments").send({
      customer: customerId,
      start: backToBackStart.toISOString(),
      duration: 30,
    });

    expect(second.status).toBe(201);
  });

  it("rejects updating an appointment into a conflict, but allows updating it around its own slot", async () => {
    const pro = await registerAndLogin(app, "conflict3@example.com");
    const customerId = await createCustomer(pro.authed, "359888100003");

    const baseStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const otherStart = new Date(baseStart.getTime() + 60 * 60 * 1000);

    await pro.authed
      .post("/api/v1/appointments")
      .send({ customer: customerId, start: baseStart.toISOString(), duration: 30 });

    const second = await pro.authed
      .post("/api/v1/appointments")
      .send({ customer: customerId, start: otherStart.toISOString(), duration: 30 });

    expect(second.status).toBe(201);
    const secondId = second.body.data._id;

    // Move the second appointment to overlap the first -> conflict
    const conflictingUpdate = await pro.authed
      .patch(`/api/v1/appointments/${secondId}`)
      .send({ start: baseStart.toISOString() });
    expect(conflictingUpdate.status).toBe(409);

    // A no-op-ish update to the second appointment's own slot (excluding itself) succeeds
    const selfUpdate = await pro.authed
      .patch(`/api/v1/appointments/${secondId}`)
      .send({ start: otherStart.toISOString(), notes: "confirmed" });
    expect(selfUpdate.status).toBe(200);
  });

  it("only lets one of two truly concurrent overlapping creates succeed", async () => {
    const pro = await registerAndLogin(app, "conflict5@example.com");
    const customerId = await createCustomer(pro.authed, "359888100006");

    const baseStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const overlapStart = new Date(baseStart.getTime() + 15 * 60 * 1000);

    const [first, second] = await Promise.all([
      pro.authed
        .post("/api/v1/appointments")
        .send({ customer: customerId, start: baseStart.toISOString(), duration: 30 }),
      pro.authed
        .post("/api/v1/appointments")
        .send({ customer: customerId, start: overlapStart.toISOString(), duration: 30 }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const listRes = await pro.authed.get("/api/v1/appointments");
    expect(listRes.body.data.items).toHaveLength(1);
  });

  it("lets two truly concurrent non-overlapping creates both succeed", async () => {
    const pro = await registerAndLogin(app, "conflict6@example.com");
    const customerId = await createCustomer(pro.authed, "359888100007");

    const baseStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    // Two hours apart, both 30-minute slots - genuinely non-overlapping, so
    // the shared per-professional AppointmentLock (which serializes these
    // two transactions against each other) must not spuriously reject one
    // just because they raced.
    const laterStart = new Date(baseStart.getTime() + 2 * 60 * 60 * 1000);

    const [first, second] = await Promise.all([
      pro.authed
        .post("/api/v1/appointments")
        .send({ customer: customerId, start: baseStart.toISOString(), duration: 30 }),
      pro.authed
        .post("/api/v1/appointments")
        .send({ customer: customerId, start: laterStart.toISOString(), duration: 30 }),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 201]);

    const listRes = await pro.authed.get("/api/v1/appointments");
    expect(listRes.body.data.items).toHaveLength(2);
  });

  it("allows booking a slot held only by a cancelled appointment", async () => {
    const pro = await registerAndLogin(app, "conflict7@example.com");
    const customerId = await createCustomer(pro.authed, "359888100008");

    const baseStart = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const first = await pro.authed
      .post("/api/v1/appointments")
      .send({ customer: customerId, start: baseStart.toISOString(), duration: 30 });
    expect(first.status).toBe(201);
    const firstId = first.body.data._id;

    const cancelled = await pro.authed
      .patch(`/api/v1/appointments/${firstId}`)
      .send({ status: "cancelled" });
    expect(cancelled.status).toBe(200);

    // Same slot, now only occupied by a cancelled appointment -> should succeed
    const second = await pro.authed
      .post("/api/v1/appointments")
      .send({ customer: customerId, start: baseStart.toISOString(), duration: 30 });
    expect(second.status).toBe(201);
  });

  it("still rejects a slot held by a scheduled appointment (regression guard)", async () => {
    const pro = await registerAndLogin(app, "conflict8@example.com");
    const customerId = await createCustomer(pro.authed, "359888100009");

    const baseStart = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const first = await pro.authed
      .post("/api/v1/appointments")
      .send({ customer: customerId, start: baseStart.toISOString(), duration: 30 });
    expect(first.status).toBe(201);

    const overlapStart = new Date(baseStart.getTime() + 15 * 60 * 1000);
    const second = await pro.authed
      .post("/api/v1/appointments")
      .send({ customer: customerId, start: overlapStart.toISOString(), duration: 30 });
    expect(second.status).toBe(409);
  });

  it("rejects reactivating a cancelled appointment back to scheduled if its slot was rebooked meanwhile", async () => {
    const pro = await registerAndLogin(app, "conflict9@example.com");
    const customerId = await createCustomer(pro.authed, "359888100010");

    const baseStart = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const first = await pro.authed
      .post("/api/v1/appointments")
      .send({ customer: customerId, start: baseStart.toISOString(), duration: 30 });
    expect(first.status).toBe(201);
    const firstId = first.body.data._id;

    const cancelled = await pro.authed
      .patch(`/api/v1/appointments/${firstId}`)
      .send({ status: "cancelled" });
    expect(cancelled.status).toBe(200);

    // Slot is free now, so a different appointment rebooks it
    const rebooked = await pro.authed
      .post("/api/v1/appointments")
      .send({ customer: customerId, start: baseStart.toISOString(), duration: 30 });
    expect(rebooked.status).toBe(201);

    // Reactivating the original cancelled appointment now conflicts with the rebooking
    const reactivate = await pro.authed
      .patch(`/api/v1/appointments/${firstId}`)
      .send({ status: "scheduled" });
    expect(reactivate.status).toBe(409);
  });

  it("does not consider appointments under a different professional as conflicting", async () => {
    const proA = await registerAndLogin(app, "conflict4a@example.com");
    const proB = await registerAndLogin(app, "conflict4b@example.com");

    const customerAId = await createCustomer(proA.authed, "359888100004");
    const customerBId = await createCustomer(proB.authed, "359888100005");

    const start = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const aRes = await proA.authed
      .post("/api/v1/appointments")
      .send({ customer: customerAId, start, duration: 30 });
    expect(aRes.status).toBe(201);

    const bRes = await proB.authed
      .post("/api/v1/appointments")
      .send({ customer: customerBId, start, duration: 30 });
    expect(bRes.status).toBe(201);
  });
});
