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

describe("GET /appointments/:id", () => {
  it("returns the appointment with the customer populated", async () => {
    const pro = await registerAndLogin(app, "getappt1@example.com");

    const customerRes = await pro.authed
      .post("/api/v1/customers")
      .send({ firstName: "Maria", lastName: "Ivanova", phone: "359888400001" });
    const customerId = customerRes.body.data._id;

    const start = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const apptRes = await pro.authed
      .post("/api/v1/appointments")
      .send({ customer: customerId, start, duration: 30 });
    const appointmentId = apptRes.body.data._id;

    const getRes = await pro.authed.get(`/api/v1/appointments/${appointmentId}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data._id).toBe(appointmentId);
    expect(getRes.body.data.customer._id).toBe(customerId);
    expect(getRes.body.data.customer.firstName).toBe("Maria");
  });

  it("404s for an appointment id that doesn't exist", async () => {
    const pro = await registerAndLogin(app, "getappt2@example.com");

    const getRes = await pro.authed.get(
      "/api/v1/appointments/65f1b9e9d02c9a0012c5c9a1",
    );

    expect(getRes.status).toBe(404);
  });

  it("400s for a malformed id", async () => {
    const pro = await registerAndLogin(app, "getappt3@example.com");

    const getRes = await pro.authed.get("/api/v1/appointments/not-an-object-id");

    expect(getRes.status).toBe(400);
  });
});
