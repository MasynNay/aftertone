/** Per-profile cancellation for background related-artist lookups.
 * Each caller keeps its own request, but a new personalization session
 * invalidates all outstanding work from the previous one.
 */
export function createRelatedRequestScope() {
  let controller=new AbortController();
  return {
    get signal() {return controller.signal;},
    advance() {
      controller.abort();
      controller=new AbortController();
      return controller.signal;
    },
  };
}
