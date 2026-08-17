import "@/config/env";
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  basePath: "/ai-mock-interview",
  typedRoutes: true,
  reactCompiler: true,
};

export default nextConfig;

initOpenNextCloudflareForDev();
