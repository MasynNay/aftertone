/** Per-feed retry policy. A real provider failure increases the pause between
 * background requests, but never disables explicit listener-initiated Retry.
 * No timers or global storage: changing discovery paths gives an independent
 * feed and a successful response fully clears its outage history.
 */
export const DISCOVERY_RETRY_BASE_MS = 20000;
export const DISCOVERY_RETRY_MAX_MS = 180000;
export const DISCOVERY_RETRY_MAX_FAILURES = 8;

export function nextDiscoveryRetry(previousFailures=0,now=Date.now()) {
  const count=Number.isFinite(previousFailures)
    ? Math.max(0,Math.floor(previousFailures)) : 0;
  const failures=Math.min(DISCOVERY_RETRY_MAX_FAILURES,count+1);
  const delayMs=Math.min(
    DISCOVERY_RETRY_MAX_MS,DISCOVERY_RETRY_BASE_MS*2**(failures-1));
  return {failures,delayMs,retryAt:now+delayMs};
}
