/**
 * Public playlist LINK importer. This module never fetches an arbitrary user
 * URL: only validated numeric Deezer IDs are resolved against Deezer's API.
 *
 * Spotify links are recognized so the UI can explain the real limitation:
 * Spotify requires authorization and disallows using its platform for games.
 * Never imply that a Spotify link has yielded track data when it hasn't.
 */
import { parsePlaylist } from './playlist-import.mjs';

const DEEZER_API = 'https://api.deezer.com';
const PAGE_SIZE = 100;
const MAX_LINK_TRACKS = 2000;

export function parsePlaylistLink(raw) {
  const text = String(raw || '').trim();
  if (text.length > 2048) throw new Error('Playlist link is too long.');
  if (!text) throw new Error('Paste a Deezer or Spotify playlist link.');
  let url;
  try { url = new URL(text); }
  catch { throw new Error('Enter a full playlist URL starting with https://'); }
  if (url.protocol !== 'https:') throw new Error('Playlist links must use HTTPS.');
  const host = url.hostname.toLowerCase();
  if (url.username || url.password || url.port) throw new Error('Invalid playlist link.');
  const deezer = /^(www\.)?deezer\.com$/.test(host);
  const spotify = host === 'open.spotify.com';
  const parts = url.pathname.split('/').filter(Boolean);
  const path = deezer && parts.length === 3 && /^[a-z]{2}(?:-[a-z]{2})?$/i.test(parts[0]) ? parts.slice(1) : parts;
  if (deezer && path.length === 2 && path[0] === 'playlist' && /^[1-9]\d{0,19}$/.test(path[1])) {
    return { provider:'deezer', id:path[1] };
  }
  if (spotify && path.length === 2 && path[0] === 'playlist' && /^[A-Za-z0-9]{15,40}$/.test(path[1])) {
    return { provider:'spotify', id:path[1] };
  }
  throw new Error('Use a Deezer or Spotify playlist URL, not a song, artist, or homepage link.');
}

async function deezerJSON(path, fetcher) {
  const response = await fetcher(`${DEEZER_API}${path}`, {
    headers: {Accept:'application/json'}, signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`Deezer playlist request failed (HTTP ${response.status}). The playlist may be private or unavailable.`);
  const body = await response.json();
  if (body?.error) throw new Error(`Deezer could not open this playlist: ${body.error.message || 'unavailable'}`);
  return body;
}

/** Public Deezer playlists need no visitor account, user token, or API setup. */
export async function importPlaylistLink(raw, fetcher=fetch) {
  const link = parsePlaylistLink(raw);
  if (link.provider === 'spotify') {
    const error = new Error('Spotify link recognized, but Spotify does not give AFTERTONE access to its tracks without an authorized integration. Use a playlist CSV/JSON export or paste the artist and song names below.');
    error.code = 'SPOTIFY_AUTH_REQUIRED';
    throw error;
  }
  const metadata = await deezerJSON(`/playlist/${link.id}`,fetcher);
  const label = String(metadata.title || 'Deezer playlist').slice(0,140);
  let index=0;
  const tracks=[];
  const expected = Math.min(MAX_LINK_TRACKS,Math.max(0,Number(metadata.nb_tracks)||0));
  // Pagination is constructed here: never follow untrusted remote `next` URLs.
  while(index < MAX_LINK_TRACKS) {
    const size=Math.min(PAGE_SIZE,MAX_LINK_TRACKS-index);
    const page=await deezerJSON(`/playlist/${link.id}/tracks?index=${index}&limit=${size}`,fetcher);
    if (!Array.isArray(page.data)) throw new Error('Deezer returned an invalid playlist track list.');
    if (!page.data.length) break;
    for (const row of page.data) {
      if (!row || !row.title || !row.artist?.name) continue;
      tracks.push({artist:row.artist.name,title:row.title});
    }
    index+=page.data.length;
    if (page.data.length < size || (expected && index >= expected)) break;
  }
  // Reuse the exact validated import pipeline as CSV, JSON, and pasted text.
  const parsed=parsePlaylist(JSON.stringify(tracks));
  return {...parsed, provider:'deezer', playlistTitle:label, playlistId:link.id,
    truncated: Number(metadata.nb_tracks || 0) > MAX_LINK_TRACKS};
}
