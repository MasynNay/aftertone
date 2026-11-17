/** Distinguish a genuinely exhausted source from a temporary outage.
 * A provider that failed this network batch should not be retried again in
 * the same batch, but must remain eligible on the next explicit or timed load.
 * Neither input set is mutated; catalog exhaustion is recorded only after a
 * successful response has reported no remaining pages.
 */
export function eligibleProviders(sources, exhausted, failedThisBatch = new Set()) {
  return sources.filter(source =>
    !exhausted.has(source) && !failedThisBatch.has(source));
}
