// Simulated latency for the "expensive" aggregate queries, so streamed
// sections are observable. Read per call: on edge runtimes env is injected
// per request and is not available at module scope.
export async function slowQuery() {
  const raw = process.env.SLOW_QUERY_MS
  const ms = raw ? Number(raw) : import.meta.env.DEV ? 700 : 0
  if (Number.isFinite(ms) && ms > 0) await new Promise((r) => setTimeout(r, ms))
}
