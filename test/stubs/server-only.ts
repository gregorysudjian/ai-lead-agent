/**
 * Test stub for the `server-only` package.
 *
 * In the real app, importing `server-only` from a Client Component is a build
 * error -- that guard is what keeps repository and provider code out of the
 * browser bundle, and it stays fully active in application builds.
 *
 * Vitest does not run under React's `react-server` resolution condition, so the
 * package resolves to its throwing client build and any server module becomes
 * untestable. Aliasing it to this empty module in the test runner only mirrors
 * what the real server runtime resolves (`server-only/empty.js`).
 */
export {};
