/**
 * Recommendation lanes are a DISCOVERY policy, not a song catalog.
 * Deezer provides the recordings. This module decides whether the next catalog
 * request should explore a related artist, revisit a seed or fetch chart music.
 * No network, DOM, storage, clocks or randomness: deterministic and testable.
 */
export const DISCOVERY_MIXES = Object.freeze({
  balanced: Object.freeze(['broad','related','broad','related','broad','related','broad','related','broad','related']),
  explore: Object.freeze(['broad','broad','related','broad','broad','related','broad','broad','related','broad']),
  familiar: Object.freeze(['related','favorite','broad','related','broad','related','favorite','broad','related','broad']),
});

export const MIX_LABELS = Object.freeze({
  balanced: 'Balanced · new music first',
  explore: 'Adventurous · mostly surprises',
  familiar: 'Closer to my favorites',
});

export const artistKey = name => String(name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().toLowerCase();
export const laneKey = lane => `seed:${artistKey(lane?.artist)}`;

/**
 * Pick a request lane with explicit quotas. NEVER silently replace an absent
 * related-artist lane with another seed request: use broad discovery instead.
 */
export function planArtistRequest({ requestNumber=0, seeds=[], related=[], exhausted=new Set(), mix='balanced', forceRelated=false }={}) {
  const available = list => list.filter(l => l?.artist && !exhausted.has(laneKey(l)));
  const favorites = available(seeds);
  const neighbors = available(related);
  const position = Math.max(0, Math.floor(Number(requestNumber) || 0));
  const slot = forceRelated && neighbors.length ? 'related' : (DISCOVERY_MIXES[mix] || DISCOVERY_MIXES.balanced)[position % 10];
  if (slot === 'related' && neighbors.length) return {kind:'related', lane:neighbors[position % neighbors.length]};
  if (slot === 'favorite' && favorites.length) return {kind:'favorite', lane:favorites[position % favorites.length]};
  // The fallback is *charts*, not another track by the same five artists.
  return {kind:'broad', lane:null};
}

/**
 * Decide which kind of song to PRESENT, independent of catalog composition.
 * Balanced and Adventurous have no direct-seed slots; familiar has two.
 */
export function chooseListeningLane(position=0, mix='balanced', availableKinds=[]) {
  const pattern = DISCOVERY_MIXES[mix] || DISCOVERY_MIXES.balanced;
  const desired = pattern[Math.abs(Math.floor(position)) % pattern.length];
  const kinds = new Set(availableKinds);
  if (kinds.has(desired)) return desired;
  // If artist matching is late/unavailable, still surface NEW music.
  return ['related','broad','favorite'].find(k => kinds.has(k)) || null;
}

export function splitSeedLanes(lanes=[], seedArtists=[]) {
  const favorites = new Set(seedArtists.map(artistKey));
  return {
    seeds: lanes.filter(l => favorites.has(artistKey(l.artist))),
    related: lanes.filter(l => !favorites.has(artistKey(l.artist))),
  };
}
