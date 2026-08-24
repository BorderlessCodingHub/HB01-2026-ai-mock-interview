import { readFileSync } from "node:fs";
import { join } from "node:path";

const expected = process.env.NEXT_BASE_PATH;
if (!expected) {
  process.exit(0);
}

const manifestPath = join(process.cwd(), ".next", "routes-manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (manifest.basePath !== expected) {
  console.error(
    `[verify-cloudflare-basepath] Expected basePath "${expected}" but routes-manifest has "${manifest.basePath ?? ""}".`,
  );
  console.error(
    "Clear the Workers Builds cache and rebuild so OpenNext routes /ai-mock-interview/api/* correctly.",
  );
  process.exit(1);
}

const hasAuthRoute = (manifest.dynamicRoutes ?? []).some(
  (route) => route.page === "/api/auth/[...all]",
);

if (!hasAuthRoute) {
  console.error(
    "[verify-cloudflare-basepath] Missing dynamic route /api/auth/[...all] in routes-manifest.json.",
  );
  process.exit(1);
}

console.log(
  `[verify-cloudflare-basepath] OK basePath=${manifest.basePath} auth route present`,
);
