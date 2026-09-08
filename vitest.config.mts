import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const resolvePath = (relative: string) =>
  fileURLToPath(new URL(relative, import.meta.url));

/**
 * Minimal Vitest configuration -- two aliases, nothing else.
 *
 * 1. `@/*` mirrors the tsconfig path alias so tests can import application
 *    modules the same way the app does.
 *
 * 2. `next/font/google` is aliased to a stub. The real module is a build-time
 *    compiler transform rather than a runtime library, so calling it under
 *    Vitest fails with "Inter is not a function".
 *
 * 3. `server-only` is aliased to an empty stub. Modules carrying that import
 *    are unimportable outside a React Server Component, and Vitest does not run
 *    under React's `react-server` resolution condition, so the package resolves
 *    to its throwing client build and every server module becomes untestable.
 *    The stub mirrors what the real server runtime resolves to
 *    (`server-only/empty.js`); the guard remains fully active in app builds.
 *
 * The file is `.mts` deliberately: loaded as CommonJS, `import.meta.url` is
 * unavailable and the alias paths resolve incorrectly.
 */
export default defineConfig({
  resolve: {
    alias: {
      "next/font/google": resolvePath("./test/stubs/next-font-google.ts"),
      "server-only": resolvePath("./test/stubs/server-only.ts"),
      "@": resolvePath("./src"),
    },
  },
});
