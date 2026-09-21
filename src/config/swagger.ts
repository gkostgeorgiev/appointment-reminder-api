import { fileURLToPath } from "node:url";
import path from "node:path";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import swaggerJsdoc, { Options } from "swagger-jsdoc";

// Resolved relative to this module's own location (not process.cwd(), which
// varies by how/where the process is launched) and to its own extension -
// ".ts" under tsx/vitest, ".js" once compiled to dist/ - so the glob still
// matches after a production build, instead of silently matching nothing.
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const isCompiled = import.meta.url.endsWith(".js");
const docsGlob = path
  .join(currentDir, "..", "docs", `*.${isCompiled ? "js" : "ts"}`)
  .split(path.sep)
  .join("/"); // glob patterns want forward slashes even on Windows

// Rendered as markdown at the top of Swagger UI, and — more importantly —
// carried inside /docs-json. A client (or an AI agent) working from the spec
// alone has no other way to learn any of this: none of it is expressible as
// OpenAPI structure. Keep it in sync with docs/frontend/API_GUIDE.md, which
// is the long-form version.
const description = `
Multi-tenant appointment scheduling with automatic SMS reminders.

**Full frontend integration guide:** <https://api.napomnyane.eu/guide> — served
by this API so it can never drift from the implementation.
\`GET /guide\` lists the bundle; \`GET /guide/API_GUIDE.md\` is the contract
document, and \`api-types.ts\` / \`api-client.ts\` are a ready-made typed client.

The essentials that this spec cannot express:

1. **Auth is cookie-only.** There is no \`Authorization: Bearer\` support. Every
   request must be sent with credentials included (\`fetch(..., { credentials:
   "include" })\`).
2. **Mutations need a CSRF header.** Every \`POST\`/\`PATCH\`/\`DELETE\` must send
   \`x-csrf-token\` matching the \`csrfToken\` cookie, or it is rejected with 403.
   The cookie is deliberately readable by JS, and is re-issued on every login
   and refresh — read it at request time.
3. **Cookies are \`Secure; SameSite=None\` in every environment**, so a local
   frontend dev server must be served over HTTPS or the cookies are never set
   or sent. The frontend origin must also be in the server's \`CORS_ORIGIN\`
   allowlist (credentialed CORS forbids a wildcard origin).
4. **Login sets three cookies** — \`token\` (access JWT, 1h), \`csrfToken\` (1h),
   \`refreshToken\` (30d, scoped to \`/api/v1/professionals\`) — and returns no
   body payload. Call \`GET /api/v1/professionals/me\` to identify the session.
5. **Registration does not log you in.** The account is created unverified and
   \`POST /login\` returns 403 until \`POST /verify-email\` has consumed the
   emailed token.
6. **On 401, \`POST /api/v1/professionals/refresh\` rotates all three cookies**
   and the original request can be retried once. Refresh tokens are single-use,
   so concurrent refreshes must be de-duplicated client-side.
7. **Responses are enveloped:** \`{ ok, status, data }\` on success,
   \`{ ok, status, message, requestId }\` on error. Exceptions: \`GET /me\` and
   \`GET /health\` return a bare object, and 401/403 from the auth middleware
   return only \`{ message }\`.
8. **Request bodies are strict** — an unknown property is a 400, not ignored.
   Send only the fields being changed; never PATCH a previously fetched object
   back verbatim.
9. **\`DELETE\` returns 204 with no body.**
10. **All dates are UTC.** Day and range boundaries (\`start\`, \`from\`, \`to\`,
    \`range\`) are computed against the server's UTC clock, not the caller's
    timezone.
`.trim();

const options: Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Appointment Reminder API",
      version: "1.0.0",
      description,
    },
    servers: [
      {
        url: "https://api.napomnyane.eu",
        description: "Production",
      },
      {
        url: "http://localhost:5000",
        description: "Local development (plain HTTP — cookie auth will not work)",
      },
      {
        url: "https://localhost:5000",
        description: "Local development over HTTPS (required for cookie auth)",
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "token",
        },
      },
    },
    security: [
      {
        cookieAuth: [],
      },
    ],
  },

  apis: [docsGlob],
};
const registry = new OpenAPIRegistry();

export const swaggerSpec = swaggerJsdoc(options);
