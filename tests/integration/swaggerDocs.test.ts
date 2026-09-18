import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { MongoMemoryReplSet } from "mongodb-memory-server";
import { setupTestApp, teardownTestApp } from "../helpers/setup.js";

let app: Express;
let mongod: MongoMemoryReplSet;

beforeAll(async () => {
  ({ app, mongod } = await setupTestApp());
});

afterAll(async () => {
  await teardownTestApp(mongod);
});

describe("GET /docs-json", () => {
  it("serves a non-empty OpenAPI spec", async () => {
    const res = await request(app).get("/docs-json");

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.paths ?? {}).length).toBeGreaterThan(0);
  });
});
