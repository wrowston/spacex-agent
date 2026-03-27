import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    testTimeout: 120_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "."),
      // Real `server-only` throws when imported from Vitest (non-RSC).
      "server-only": path.resolve(root, "tests/setup/server-only-shim.ts"),
    },
  },
});
