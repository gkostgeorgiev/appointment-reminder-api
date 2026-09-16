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

describe("customer deletion policy", () => {
  it("deletes a customer with no appointments", async () => {
    const pro = await registerAndLogin(app, "delcust1@example.com");
    const customerId = await createCustomer(pro.authed, "359888200001");

    const res = await pro.authed.delete(`/api/v1/customers/${customerId}`);
    expect(res.status).toBe(204);
  });

  it("blocks deleting a customer with a scheduled appointment", async () => {
    const pro = await registerAndLogin(app, "delcust2@example.com");
    const customerId = await createCustomer(pro.authed, "359888200002");

    const start = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const apptRes = await pro.authed
      .post("/api/v1/appointments")
      .send({ customer: customerId, start, duration: 30 });
    expect(apptRes.status).toBe(201);

    const deleteRes = await pro.authed.delete(`/api/v1/customers/${customerId}`);
    expect(deleteRes.status).toBe(409);

    // The customer and its appointment are both still there afterwards.
    const getRes = await pro.authed.get("/api/v1/customers");
    expect(
      getRes.body.data.items.some((c: { _id: string }) => c._id === customerId),
    ).toBe(true);
  });

  it("allows deleting a customer once their appointment is cancelled", async () => {
    const pro = await registerAndLogin(app, "delcust3@example.com");
    const customerId = await createCustomer(pro.authed, "359888200003");

    const start = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const apptRes = await pro.authed
      .post("/api/v1/appointments")
      .send({ customer: customerId, start, duration: 30 });
    const appointmentId = apptRes.body.data._id;

    const cancelRes = await pro.authed
      .patch(`/api/v1/appointments/${appointmentId}`)
      .send({ status: "cancelled" });
    expect(cancelRes.status).toBe(200);

    const deleteRes = await pro.authed.delete(`/api/v1/customers/${customerId}`);
    expect(deleteRes.status).toBe(204);
  });
});
