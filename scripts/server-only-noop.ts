/**
 * Stand-in for the `server-only` package when running scripts with tsx.
 *
 * `server-only` throws on import outside the React Server Components
 * environment, which is exactly what happens when a plain Node script pulls in
 * `src/lib/db.ts`. Scripts *are* server code, so the guard is meaningless here —
 * this no-op lets them reuse the real models and connection helper instead of a
 * duplicated copy that could drift.
 *
 * The alias is declared in `scripts/tsconfig.json`.
 */
export {};