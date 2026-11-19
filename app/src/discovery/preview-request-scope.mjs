/**
 * Shared controller for on-demand preview metadata. Requests for the same
 * song coalesce, but abandoned Play operations must not leave JSONP running.
 * This controls metadata only; actual audio playback is owned by the player.
 */
export function createPreviewRequestScope() {
  const flights=new Map();
  return {
    run(id,request) {
      const existing=flights.get(id);
      if(existing) return existing.promise;
      const controller=new AbortController();
      const flight={controller,promise:null};
      flight.promise=Promise.resolve()
        .then(()=>{controller.signal.throwIfAborted();return request(controller.signal);})
        .finally(()=>{if(flights.get(id)===flight)flights.delete(id);});
      flights.set(id,flight);
      return flight.promise;
    },
    cancelAll() {
      // Clear first: a retry started by another interaction must not inherit
      // or be deleted by the old request's eventual finally handler.
      const old=[...flights.values()];
      flights.clear();
      for(const flight of old)flight.controller.abort();
    },
    size() {return flights.size;},
  };
}
