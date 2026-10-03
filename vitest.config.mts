import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * The default environment is a plain Node one, deliberately not jsdom. The engine
 * is pure TypeScript; if a test under `lib/engine` ever needs a DOM, that is a
 * signal UI concerns have leaked into it.
 *
 * The rare test that genuinely needs a DOM — currently only
 * `components/layout/__tests__/theme-provider.test.ts`, which exercises the
 * pre-paint bootstrap script — opts in per file with a
 * `// @vitest-environment jsdom` docblock rather than changing the default here.
 */
export default defineConfig({
  resolve: {
    alias: { "@": root.replace(/\/$/, "") },
  },
  test: {
    environment: "node",
    include: [
      "lib/**/__tests__/**/*.test.ts",
      "store/__tests__/**/*.test.ts",
      "hooks/__tests__/**/*.test.ts",
      "components/**/__tests__/**/*.test.ts",
    ],
    globals: false,
  },
});
