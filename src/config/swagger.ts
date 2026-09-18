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

const options: Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Appointment Reminder API",
      version: "1.0.0",
    },
    servers: [
      {
        url: "http://localhost:5000",
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
