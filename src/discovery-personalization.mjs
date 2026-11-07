/** Local-only first-run artist choices and discovery-pool boundaries. */
const canonical = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();

export function parseFavoriteArtists(value, max=5) {
  const output=[]; const seen=new Set();
  for (const raw of (Array.isArray(value) ? value : String(value || '').split(/[\n,;]+/))) {
    const artist=raw.replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,75);
    const key=canonical(artist);
    if (!artist || artist.length < 2 || /^https?:\/\//i.test(artist) || seen.has(key)) continue;
    output.push(artist);seen.add(key);
    if (output.length>=max) break;
  }
  return output;
}

export function artistSeedProfile(artists) {
  const chosen=parseFavoriteArtists(artists);
  return { artists:chosen.map(artist=>({artist,count:1})), seenTracks:new Set(), totalSongs:0, artistCount:chosen.length };
}

/** A search is a separate lane. Nothing from a prior search leaks into fresh discovery. */
export function fromActiveFeed(track, activeIds, source='deezer') {
  return Boolean(track && activeIds?.has(track.id) && track.source === source);
}

/** A maximum of a few user-liked artists influences requests, never searches alone. */
export function likedArtistLanes(history, limit=8) {
  const counts=new Map();
  for (const h of history || []) {
    if (h.action !== 'like' || !h.artist) continue;
    const key=canonical(h.artist);
    if (!key) continue;
    const existing=counts.get(key) || {artist:h.artist,count:0};
    existing.count += h.context === 'search' ? 0.5 : 1;
    counts.set(key,existing);
  }
  return [...counts.values()].sort((a,b)=>b.count-a.count).slice(0,limit).map(item=>({artist:item.artist,reason:'Because you kept a song by this artist',weight:Math.min(3,item.count)}));
}
