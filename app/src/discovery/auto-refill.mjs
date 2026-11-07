/** Adaptive catalog prefetch. A 3-second *check* is not a request storm.
 * It only fetches while the upcoming pool is below target and a provider is
 * still offering pages. Explicit upper bound protects long-running sessions.
 */
export const REFILL_INTERVAL_MS = 3000;
export const REFILL_TARGET = 160;
export const MAX_SESSION_TRACKS = 1200;
export function shouldRefill({ ready=0, loaded=0, loading=false, hasMore=true, visible=true, active=true, challenge=false }={}) {
  return Boolean(active && visible && !challenge && !loading && hasMore &&
    Number.isFinite(ready) && ready < REFILL_TARGET && loaded < MAX_SESSION_TRACKS);
}
