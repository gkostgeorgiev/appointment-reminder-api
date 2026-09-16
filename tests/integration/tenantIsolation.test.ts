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

describe("multi-tenant isolation", () => {
  it("professional A cannot read, update, or delete professional B's customer", async () => {
    const a = await registerAndLogin(app, "a@example.com");
    const b = await registerAndLogin(app, "b@example.com");

    const createRes = await b.authed
      .post("/api/v1/customers")
      .send({ firstName: "Bob", lastName: "Customer", phone: "359888000001" });

    expect(createRes.status).toBe(201);
    const customerId = createRes.body.data._id;

    const getRes = await a.authed.get(`/api/v1/customers`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.items).toHaveLength(0);

    const patchRes = await a.authed
      .patch(`/api/v1/customers/${customerId}`)
      .send({ firstName: "Hacked" });
    expect(patchRes.status).toBe(404);

    const deleteRes = await a.authed.delete(`/api/v1/customers/${customerId}`);
    expect(deleteRes.status).toBe(404);
  });

  it("professional A cannot read, update, or delete professional B's appointment", async () => {
    const a = await registerAndLogin(app, "a2@example.com");
    const b = await registerAndLogin(app, "b2@example.com");

    const customerRes = await b.authed
      .post("/api/v1/customers")
      .send({ firstName: "Bob", lastName: "Customer", phone: "359888000002" });

    const start = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const appointmentRes = await b.authed
      .post("/api/v1/appointments")
      .send({ customer: customerRes.body.data._id, start, duration: 30 });

    expect(appointmentRes.status).toBe(201);
    const appointmentId = appointmentRes.body.data._id;

    const listRes = await a.authed.get("/api/v1/appointments");
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items).toHaveLength(0);

    const patchRes = await a.authed
      .patch(`/api/v1/appointments/${appointmentId}`)
      .send({ notes: "Hacked" });
    expect(patchRes.status).toBe(404);

    const deleteRes = await a.authed.delete(
      `/api/v1/appointments/${appointmentId}`,
    );
    expect(deleteRes.status).toBe(404);

    // B still sees it, undisturbed
    const bListRes = await b.authed.get("/api/v1/appointments");
    expect(bListRes.body.data.items).toHaveLength(1);
  });

  it("professional A cannot create an appointment against professional B's customer", async () => {
    const a = await registerAndLogin(app, "a3@example.com");
    const b = await registerAndLogin(app, "b3@example.com");

    const customerRes = await b.authed
      .post("/api/v1/customers")
      .send({ firstName: "Bob", lastName: "Customer", phone: "359888000003" });

    const start = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const appointmentRes = await a.authed
      .post("/api/v1/appointments")
      .send({ customer: customerRes.body.data._id, start, duration: 30 });

    expect(appointmentRes.status).toBe(404);
  });
});
