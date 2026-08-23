import "@/config/env";
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const basePath = process.env.NEXT_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  // Inlined into the client bundle at build time. OpenNext/Cloudflare does not
  // replace process.env.__NEXT_ROUTER_BASEPATH, so better-auth cannot use it.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  typedRoutes: true,
  reactCompiler: true,
};

export default nextConfig;

initOpenNextCloudflareForDev();
