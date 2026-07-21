import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.ts"],
    },
    environment: "node",
    restoreMocks: true,
    testTimeout: 10_000,
  },
});
