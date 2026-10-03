import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * The engine is pure TypeScript with no DOM dependency, so tests run in a plain
 * Node environment — deliberately not jsdom. If a test here ever needs a DOM,
 * that is a signal the engine has leaked UI concerns into lib/engine.
 */
export default defineConfig({
  resolve: {
    alias: { "@": root.replace(/\/$/, "") },
  },
  test: {
    environment: "node",
    include: ["lib/engine/__tests__/**/*.test.ts", "store/__tests__/**/*.test.ts"],
    globals: false,
  },
});
