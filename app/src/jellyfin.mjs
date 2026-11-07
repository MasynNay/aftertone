/** Optional personal-library adapter. API credentials live only in the local Node process. */
import { validGenre } from './live-commons.mjs';
import { likelyMusicRecording, trackLanguage } from './recording-quality.mjs';

const TAGS = { pop: 'Pop', rock: 'Rock', indie: 'Alternative', electronic: 'Electronic',
  hiphop: 'Hip-Hop', ambient: 'Ambient', jazz: 'Jazz', funk: 'Funk', folk: 'Folk',
  cinematic: 'Soundtrack', classical: 'Classical' };
const text = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 180);
export const isJellyfinId = (id) => /^[a-f0-9]{32}$/i.test(String(id || ''));
export function jellyfinSettings(env = process.env) {
  const token = env.JELLYFIN_API_KEY?.trim();
  try {
    const url = new URL(env.JELLYFIN_URL?.trim() || '');
    if (!/^https?:$/.test(url.protocol) || !token || /[\r\n]/.test(token) || url.username || url.password || url.search || url.hash) return null;
    return { base: url.href.replace(/\/$/, ''), token, userId: isJellyfinId(env.JELLYFIN_USER_ID) ? env.JELLYFIN_USER_ID : null };
  } catch { return null; }
}
export function jellyfinHeaders(settings) {
  // Jellyfin's MediaBrowser authorization header avoids exposing a token in URLs.
  return { Authorization: `MediaBrowser Client="Aftertone", Device="Local Browser", DeviceId="aftertone-local", Version="0.3.1", Token="${settings.token}"`, Accept: 'application/json' };
}
export function jellyfinUrl(settings, path) { return new URL(`${settings.base}/${path.replace(/^\//, '')}`); }
export function normalizeJellyfinTrack(item, genre = 'all') {
  if (!isJellyfinId(item?.Id) || item.Type !== 'Audio' || !text(item.Name) || !likelyMusicRecording({title:item.Name, duration: Number(item.RunTimeTicks) ? Number(item.RunTimeTicks)/10000000 : null})) return null;
  const artist = text(item.Artists?.[0] || item.AlbumArtist || item.AlbumArtists?.[0] || 'Unknown artist');
  const rawGenre = item.Genres?.find((name) => typeof name === 'string') || '';
  const category = genre !== 'all' ? validGenre(genre) : Object.entries(TAGS).find(([, label]) => rawGenre.toLowerCase().includes(label.toLowerCase()))?.[0] || 'indie';
  const artId = isJellyfinId(item.AlbumId) ? item.AlbumId : isJellyfinId(item.Id) && item.ImageTags?.Primary ? item.Id : null;
  return {
    id: `jellyfin:${item.Id.toLowerCase()}`, title: text(item.Name), artist, genre: category, mood: 'Fresh',
    tags: [category], source: 'jellyfin', originalCandidate: true, language: trackLanguage({ language: item.Language || item.Languages?.[0], title:item.Name }), artwork: artId ? `/api/jellyfin-art?id=${artId.toLowerCase()}` : null,
    link: '', license: 'From your own Jellyfin music library. Personal listening only.',
  };
}
export async function fetchJellyfinPage(settings, genre = 'all', cursor = '0', fetcher = fetch, search = '') {
  if (!settings) throw new Error('Jellyfin is not configured.');
  genre = validGenre(genre);
  const offset = /^\d{1,7}$/.test(String(cursor)) ? Math.min(Number(cursor), 3000000) : 0;
  const url = jellyfinUrl(settings, settings.userId ? `Users/${settings.userId}/Items` : 'Items');
  const params = { Recursive: 'true', IncludeItemTypes: 'Audio', Fields: 'Genres,Images', StartIndex: String(offset),
    Limit: '60', SortBy: 'SortName', SortOrder: 'Ascending', EnableImages: 'true' };
  if (genre !== 'all') params.Genres = TAGS[genre] || genre;
  if (search) params.SearchTerm = search.slice(0, 90);
  url.search = new URLSearchParams(params).toString();
  const response = await fetcher(url, { headers: jellyfinHeaders(settings), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Jellyfin HTTP ${response.status}. Check your URL, API key and user permissions.`);
  const data = await response.json();
  if (!Array.isArray(data?.Items)) throw new Error('Jellyfin returned an unexpected item list');
  const tracks = data.Items.map((item) => normalizeJellyfinTrack(item, genre)).filter(Boolean);
  const total = Number(data.TotalRecordCount) || 0;
  const hasMore = offset + data.Items.length < total && data.Items.length > 0;
  return { tracks, nextCursor: hasMore ? String(offset + data.Items.length) : null, hasMore, provider: 'jellyfin', total };
}
