// Deployment smoke test for #27: swagger.ts's docs glob is resolved relative
// to its own compiled location, so this verifies that resolution actually
// finds src/docs/*.ts's compiled output once shipped as dist/. Run after
// `yarn build`, no server or env vars needed - swagger.ts has no DB dependency.
import { swaggerSpec } from "../dist/config/swagger.js";

const pathCount = Object.keys(swaggerSpec.paths ?? {}).length;

if (pathCount === 0) {
  console.error(
    "Swagger spec has no documented paths - the docs glob in src/config/swagger.js isn't matching dist/docs/*.js.",
  );
  process.exit(1);
}

console.log(`Swagger spec OK: ${pathCount} documented paths found in the compiled build.`);
