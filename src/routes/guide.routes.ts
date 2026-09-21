import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { logger } from "../config/logger.js";
import { catchAsync } from "../utils/catchAsync.js";
import { ErrorResponse } from "../utils/errorResponse.js";

/**
 * Serves the frontend handoff bundle (`docs/frontend/`) over HTTP so the
 * frontend repository can treat this API as the single canonical source for
 * the contract instead of holding a copy that silently drifts. See
 * docs/frontend/README.md.
 *
 * Resolved relative to this module's own location rather than process.cwd(),
 * same reasoning as swagger.ts: `src/routes/` and `dist/routes/` are both two
 * levels below the project root, so the same "../.." reaches `docs/frontend/`
 * whether we're running under tsx or from a compiled build.
 */
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const bundleDir = path.join(currentDir, "..", "..", "docs", "frontend");

/**
 * Explicit allowlist rather than express.static or a path join on user input:
 * the filename never reaches the filesystem unless it is one of these exact
 * keys, which forecloses path traversal entirely instead of relying on a
 * sanitizer being correct.
 */
const SERVED_FILES = {
  "API_GUIDE.md": {
    contentType: "text/markdown; charset=utf-8",
    description: "The API contract: auth handshake, response envelope, business rules, date semantics, rate limits, known gaps.",
  },
  "api-types.ts": {
    contentType: "text/plain; charset=utf-8",
    description: "TypeScript types for every request and response.",
  },
  "api-client.ts": {
    contentType: "text/plain; charset=utf-8",
    description: "Zero-dependency reference client: cookies, CSRF, single-flight token refresh, envelope unwrapping.",
  },
  "FRONTEND_CLAUDE.seed.md": {
    contentType: "text/markdown; charset=utf-8",
    description: "Starter CLAUDE.md / AGENTS.md for the frontend repository.",
  },
  "README.md": {
    contentType: "text/markdown; charset=utf-8",
    description: "What the bundle is and how to use it.",
  },
} as const;

type ServedFile = keyof typeof SERVED_FILES;

// Takes `unknown` rather than `string`: Express 5 types a route param as
// `string | string[]`, and an array must fall through to the 404 rather than
// being coerced into a lookup key.
const isServedFile = (name: unknown): name is ServedFile =>
  typeof name === "string" &&
  Object.prototype.hasOwnProperty.call(SERVED_FILES, name);

// The bundle can only change via a redeploy, so a file is read once and then
// held in memory - this endpoint shouldn't add disk I/O per request.
const cache = new Map<ServedFile, string>();

const loadFile = async (name: ServedFile): Promise<string> => {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  try {
    const contents = await readFile(path.join(bundleDir, name), "utf8");
    cache.set(name, contents);
    return contents;
  } catch (error) {
    // A missing bundle is a deployment problem (files not shipped), not a
    // client error - surface it as a 500 so it reaches Sentry.
    logger.error({ err: error, file: name }, "frontend guide file unavailable");
    throw new ErrorResponse("Guide file unavailable", 500);
  }
};

const router = Router();

/**
 * Index. Deliberately plain JSON rather than the {ok,status,data} envelope:
 * this is documentation, not part of the versioned API surface, and it is
 * mounted outside /api/v1 alongside /docs and /health.
 */
router.get("/", (req, res) => {
  const base = `${req.protocol}://${req.get("host")}/guide`;

  res.json({
    description:
      "Frontend integration bundle for the Appointment Reminder API. Start with API_GUIDE.md.",
    files: Object.entries(SERVED_FILES).map(([name, meta]) => ({
      name,
      url: `${base}/${name}`,
      description: meta.description,
    })),
  });
});

router.get(
  "/:file",
  catchAsync(async (req, res) => {
    const { file } = req.params;

    if (!isServedFile(file)) {
      throw new ErrorResponse("Guide file not found", 404);
    }

    const contents = await loadFile(file);

    res.type(SERVED_FILES[file].contentType);
    // Short cache: the whole point of serving these is that a consumer always
    // gets the current contract, but a few minutes of staleness is harmless
    // and keeps a polling client off the rate limiter.
    res.set("Cache-Control", "public, max-age=300");
    res.send(contents);
  }),
);

export default router;
