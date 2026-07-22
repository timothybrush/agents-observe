// app/server/src/cors.ts
// CORS origin policy. The dashboard is served same-origin (the client fetches
// `/api` relative URLs), so cross-origin access is never needed for normal
// use. The default therefore reflects only loopback origins — this blocks an
// arbitrary website the user visits from reading the unauthenticated API via
// the browser, while still allowing same-machine dashboards on any port. See
// GitHub issue #22.

import type { Context } from 'hono'

/**
 * True when `origin` is a loopback URL (localhost / 127.0.0.1 / ::1) on any
 * port. Malformed origins (including the empty string sent by non-browser
 * clients) return false.
 */
export function isLoopbackOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin)
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]'
    )
  } catch {
    return false
  }
}

type CorsOrigin = string | string[] | ((origin: string, c: Context) => string | null)

/**
 * Resolve the value passed to hono's `cors({ origin })` from the configured
 * allowlist:
 *   - contains `*` → allow any origin (opt-in; restores the legacy behavior)
 *   - non-empty    → exact allowlist
 *   - empty        → reflect loopback origins only (the secure default)
 */
export function resolveCorsOrigin(allowedOrigins: string[]): CorsOrigin {
  if (allowedOrigins.includes('*')) return '*'
  if (allowedOrigins.length > 0) return allowedOrigins
  return (origin: string) => (isLoopbackOrigin(origin) ? origin : null)
}
