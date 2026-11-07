/** Local-only playlist import helpers. No Spotify API, credentials or scraping. */
const MAX_ROWS = 5000;
const tidy = (value, max = 180) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const canonical = (value) => tidy(value, 180).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export const trackIdentity = (artist, title) => `${canonical(artist)}::${canonical(title)}`;

/** RFC4180-ish CSV with quoted multiline cells, BOM and CRLF support. */
export function parseCSV(text, maxRows = MAX_ROWS + 2) {
  const rows = [];
  let cell = '', row = [], inQuote = false;
  const input = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inQuote) {
      if (char === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') inQuote = false;
      else cell += char;
    } else if (char === '"' && cell.length === 0) inQuote = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c.trim())) rows.push(row);
      row = [];
      if (rows.length >= maxRows) break;
    } else cell += char;
  }
  if (inQuote) throw new Error('The CSV has an unclosed quoted field.');
  if (rows.length < maxRows) { row.push(cell); if (row.some(c => c.trim())) rows.push(row); }
  return rows;
}

function cleanTrack(artist, title) {
  artist = tidy(artist); title = tidy(title);
  if (!artist || !title || artist.length < 2 || title.length < 1) return null;
  if (/^https?:\/\//i.test(artist) || /^https?:\/\//i.test(title)) return null;
  if (/^(unknown|various artists|n\/a)$/i.test(artist)) return null;
  // Some exports use ';' or '|' between artist credits. Retain the lead artist.
  artist = artist.split(/\s*(?:;|\|)\s*/)[0].trim();
  return { artist, title };
}
function artistName(value) {
  if (Array.isArray(value)) return value.map(artistName).find(Boolean) || '';
  if (value && typeof value === 'object') return value.name || value.artist || '';
  return value;
}
function jsonTracks(raw) {
  const list = Array.isArray(raw) ? raw : raw?.tracks?.items || raw?.tracks || raw?.items || [];
  if (!Array.isArray(list)) throw new Error('JSON must contain a list of playlist tracks.');
  return list.slice(0, MAX_ROWS).map(entry => {
    const track = entry?.track || entry;
    return cleanTrack(artistName(track?.artists || track?.artist || entry?.artist), track?.name || track?.title || entry?.title);
  });
}

export function parsePlaylist(text) {
  text = String(text || '').trim();
  if (!text) throw new Error('Paste some artists and songs, or choose a CSV/JSON file.');
  if (text.length > 3_000_000) throw new Error('This file is too large (3 MB limit).');
  if (/^https?:\/\/(?:open\.)?spotify\.com\/(?:playlist|album|track)\//i.test(text)) {
    throw new Error('Spotify links cannot be read directly. Export the playlist as CSV first, or paste the artist and song names.');
  }
  let items = [];
  if (text[0] === '[' || text[0] === '{') {
    try { items = jsonTracks(JSON.parse(text)); }
    catch (error) { throw new Error(`Invalid playlist JSON: ${error.message}`); }
  } else {
    const rows = parseCSV(text);
    const headers = (rows[0] || []).map(s => canonical(s).replaceAll(' ', ''));
    const find = (choices) => headers.findIndex(h => choices.includes(h));
    const titleAt = find(['trackname','songname','title','name','tracktitle','track']);
    const artistAt = find(['artistname','artistnames','artist','artists','primaryartist','artistname1']);
    if (titleAt >= 0 && artistAt >= 0) {
      items = rows.slice(1, MAX_ROWS + 1).map(row => cleanTrack(row[artistAt], row[titleAt]));
    } else {
      // User paste format: "Artist - Song", one per line. Avoid accidentally
      // interpreting a full unfamiliar CSV as an artist's name.
      items = text.split(/\r?\n/).slice(0, MAX_ROWS).map(line => {
        const parts = line.split(/\s+(?:—|–|-|\|)\s+/);
        return parts.length >= 2 ? cleanTrack(parts[0], parts.slice(1).join(' - ')) : null;
      });
    }
  }
  const seen = new Set();
  const tracks = [];
  for (const item of items) {
    if (!item) continue;
    const key = trackIdentity(item.artist, item.title);
    if (seen.has(key)) continue;
    seen.add(key);
    tracks.push(item);
  }
  if (!tracks.length) throw new Error('No artist/title pairs found. Use a CSV with Track Name and Artist Name columns, or lines like "Artist - Song".');
  return { tracks, count: tracks.length, artistCount: new Set(tracks.map(t => canonical(t.artist))).size };
}

export function buildSeedProfile(playlist) {
  const counts = new Map();
  const seenTracks = new Set();
  for (const entry of (playlist?.tracks || []).slice(0, MAX_ROWS)) {
    const t = cleanTrack(entry?.artist, entry?.title);
    if (!t) continue;
    const key = canonical(t.artist);
    const previous = counts.get(key);
    counts.set(key, { artist: previous?.artist || t.artist, count: (previous?.count || 0) + 1 });
    seenTracks.add(trackIdentity(t.artist, t.title));
  }
  const artists = [...counts.values()].sort((a,b) => b.count - a.count || a.artist.localeCompare(b.artist));
  return { artists, seenTracks, totalSongs: seenTracks.size, artistCount: artists.length };
}

/** Interleave favorite artists with newly discovered related artists. */
export function buildSeedLanes(profile, related = [], max = 24) {
  const own = profile.artists.slice(0, max).map(a => ({ artist: a.artist, reason: 'In your playlist', weight: a.count }));
  const ownNames = new Set(own.map(a => canonical(a.artist)));
  const linked = related.filter(r => r?.artist && !ownNames.has(canonical(r.artist))).map(r => ({ artist: tidy(r.artist), reason: `Similar to ${tidy(r.because)}`, weight: 0 }));
  const seen = new Set(); const output = [];
  while ((own.length || linked.length) && output.length < max) {
    const candidates = [own.shift(), linked.shift()];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const key = canonical(candidate.artist);
      if (key && !seen.has(key)) { output.push(candidate); seen.add(key); }
      if (output.length >= max) break;
    }
  }
  return output;
}
