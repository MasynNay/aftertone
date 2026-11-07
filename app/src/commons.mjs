import { getStarterTrack } from './catalog.mjs';
const cache = new Map();
const MAX_CACHE = 700;

/** Resolve a curated file by title or live discovery by numeric Commons pageid. */
export async function resolveCommonsAudio(id, fetcher = fetch) {
  const track = getStarterTrack(id);
  const live = /^commons:file-(\d{1,11})$/.exec(id || '');
  if (!track && !live) throw Object.assign(new Error('Unknown starter track or live Commons file'), { status: 404 });
  const cached = cache.get(id);
  if (cached && cached.until > Date.now()) return cached.value;
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  const params = { action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url|mime|extmetadata' };
  if (track) params.titles = `File:${track.file}`;
  else params.pageids = live[1];
  url.search = new URLSearchParams(params).toString();
  const response = await fetcher(url, {
    headers: { 'User-Agent': 'Aftertone/0.2 (open-source attribution-aware music discovery demo)' },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Commons returned HTTP ${response.status}`);
  const payload = await response.json();
  const pages = Object.values(payload.query?.pages || {});
  const info = pages[0]?.imageinfo?.[0];
  if (!info?.url || !/^https:\/\/upload\.wikimedia\.org\//.test(info.url)) throw new Error('Source file is unavailable');
  const value = {
    url: info.url,
    license: info.extmetadata?.LicenseShortName?.value || 'See Commons file page for license',
    attribution: info.extmetadata?.AttributionRequired?.value || 'See Commons file page for credit',
    page: info.descriptionurl || track?.link || `https://commons.wikimedia.org/?curid=${live?.[1]}`,
  };
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(id, { until: Date.now() + 6 * 60 * 60 * 1000, value });
  return value;
}
