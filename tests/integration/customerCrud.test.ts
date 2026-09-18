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

describe("GET /customers/:id", () => {
  it("returns the customer for the authenticated professional", async () => {
    const pro = await registerAndLogin(app, "getcust1@example.com");

    const createRes = await pro.authed
      .post("/api/v1/customers")
      .send({ firstName: "Maria", lastName: "Ivanova", phone: "359888300001" });
    const customerId = createRes.body.data._id;

    const getRes = await pro.authed.get(`/api/v1/customers/${customerId}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data._id).toBe(customerId);
    expect(getRes.body.data.firstName).toBe("Maria");
  });

  it("404s for a customer id that doesn't exist", async () => {
    const pro = await registerAndLogin(app, "getcust2@example.com");

    const getRes = await pro.authed.get(
      "/api/v1/customers/65f1b9e9d02c9a0012c5c9a1",
    );

    expect(getRes.status).toBe(404);
  });

  it("400s for a malformed id", async () => {
    const pro = await registerAndLogin(app, "getcust3@example.com");

    const getRes = await pro.authed.get("/api/v1/customers/not-an-object-id");

    expect(getRes.status).toBe(400);
  });

  it("finds a customer by a local-format phone search term against a normalized stored phone", async () => {
    const pro = await registerAndLogin(app, "getcust4@example.com");

    const createRes = await pro.authed
      .post("/api/v1/customers")
      .send({ firstName: "Elena", lastName: "Petrova", phone: "0888300004" });
    expect(createRes.body.data.phone).toBe("359888300004");

    const searchRes = await pro.authed.get(
      "/api/v1/customers?phone=0888300004",
    );

    expect(searchRes.status).toBe(200);
    expect(
      searchRes.body.data.items.some(
        (c: { phone: string }) => c.phone === "359888300004",
      ),
    ).toBe(true);
  });
});

describe("PATCH /customers/:id", () => {
  it("normalizes a local-format phone on update", async () => {
    const pro = await registerAndLogin(app, "patchcust1@example.com");

    const createRes = await pro.authed
      .post("/api/v1/customers")
      .send({ firstName: "Ivan", lastName: "Dimitrov", phone: "359888300010" });
    const customerId = createRes.body.data._id;

    const patchRes = await pro.authed
      .patch(`/api/v1/customers/${customerId}`)
      .send({ phone: "0888300011" });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.phone).toBe("359888300011");
  });

  it("leaves an already-international phone unchanged on update", async () => {
    const pro = await registerAndLogin(app, "patchcust2@example.com");

    const createRes = await pro.authed
      .post("/api/v1/customers")
      .send({ firstName: "Petar", lastName: "Georgiev", phone: "359888300020" });
    const customerId = createRes.body.data._id;

    const patchRes = await pro.authed
      .patch(`/api/v1/customers/${customerId}`)
      .send({ phone: "359888300021" });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.phone).toBe("359888300021");
  });
});
