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

describe("GET /guide", () => {
  it("lists the bundle with an absolute URL per file", async () => {
    const res = await request(app).get("/guide");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.files)).toBe(true);

    const names = res.body.files.map((f: { name: string }) => f.name);
    expect(names).toContain("API_GUIDE.md");
    expect(names).toContain("api-types.ts");
    expect(names).toContain("api-client.ts");

    for (const file of res.body.files) {
      expect(file.url).toMatch(/^https?:\/\/.+\/guide\/.+/);
      expect(typeof file.description).toBe("string");
    }
  });
});

describe("GET /guide/:file", () => {
  // The whole point of serving these is that the frontend reads the current
  // contract rather than a stale copy - so an empty or missing file is a
  // deployment failure worth catching here, the same way
  // scripts/check-swagger-dist.mjs guards the compiled Swagger spec.
  it("serves the contract document as markdown", async () => {
    const res = await request(app).get("/guide/API_GUIDE.md");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/markdown/);
    expect(res.text).toContain("Frontend Integration Guide");
    expect(res.text.length).toBeGreaterThan(1000);
  });

  it("serves the reference client and types as plain text", async () => {
    for (const file of ["api-types.ts", "api-client.ts"]) {
      const res = await request(app).get(`/guide/${file}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/plain/);
      expect(res.text.length).toBeGreaterThan(500);
    }
  });

  it("404s on a file that isn't in the allowlist", async () => {
    const res = await request(app).get("/guide/nope.md");

    expect(res.status).toBe(404);
  });

  // The route matches on an allowlist of exact filenames rather than joining
  // the param onto a path, so traversal can't reach outside docs/frontend/.
  it("refuses to traverse out of the bundle directory", async () => {
    const attempts = [
      "/guide/..%2F..%2F.env",
      "/guide/..%2F..%2Fpackage.json",
      "/guide/%2e%2e%2f%2e%2e%2f.env",
    ];

    for (const url of attempts) {
      const res = await request(app).get(url);

      expect(res.status).toBe(404);
      expect(res.text).not.toContain("MONGO_URI");
      expect(res.text).not.toContain("dependencies");
    }
  });

  it("is cacheable but not for long", async () => {
    const res = await request(app).get("/guide/API_GUIDE.md");

    expect(res.headers["cache-control"]).toBe("public, max-age=300");
  });

  it("does not require authentication", async () => {
    // No cookies attached at all - the bundle is public, like /docs.
    const res = await request(app).get("/guide/API_GUIDE.md");

    expect(res.status).toBe(200);
  });
});
