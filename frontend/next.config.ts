import "@/config/env";
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const basePath = process.env.NEXT_BASE_PATH;

const nextConfig: NextConfig = {
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  typedRoutes: true,
  reactCompiler: true,
};

export default nextConfig;

initOpenNextCloudflareForDev();
