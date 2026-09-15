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
import type { MongoMemoryServer } from "mongodb-memory-server";
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
let mongod: MongoMemoryServer;

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
