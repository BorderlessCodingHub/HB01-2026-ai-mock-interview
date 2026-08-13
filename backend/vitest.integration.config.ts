import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      bun: path.resolve(__dirname, "./src/test/mocks/bun-password.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    globalSetup: ["./src/test/containers/vitest.integration.global-setup.ts"],
    setupFiles: [
      "./src/test/containers/inject-env.setup.ts",
      "./vitest.setup.ts",
    ],
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 30_000,
    passWithNoTests: true,
  },
});
