import { createInitialState } from './taste.mjs';
import { THEME_IDS } from './themes.mjs';
import { normalizeVolume } from './volume.mjs';
export const STORAGE_KEY = 'aftertone:session:v1';

/** A defensive boundary: malformed saved state cannot break the app. */
export function sanitizeState(value) {
  const defaults = createInitialState();
  if (!value || value.version !== 1 || !Array.isArray(value.history) || !Array.isArray(value.favorites)) return defaults;
  const history = value.history.filter((item) => item && typeof item.id === 'string' && /^(commons|jamendo|audius|jellyfin|youtube|deezer):[\w-]+$/.test(item.id) && ['like', 'pass'].includes(item.action)).slice(-5000).map((item) => ({ ...item, genre: typeof item.genre === 'string' ? item.genre.slice(0,30) : null, artist: typeof item.artist === 'string' ? item.artist.slice(0,180) : null, context: item.context === 'search' ? 'search' : 'discovery', route: ['balanced','familiar','explore'].includes(item.route) ? item.route : null }));
  const favorites = [...new Set(value.favorites.filter((id) => typeof id === 'string' && /^(commons|jamendo|audius|jellyfin|youtube|deezer):[\w-]+$/.test(id)))].slice(-5000);
  // Persist track identities for live discoveries so collection survives a restart.
  // Restrict URLs, lengths and count when hydrating untrusted localStorage.
  const cleanLink = (value) => {
    try { const link = new URL(value); return link.protocol === 'https:' ? link.href : ''; }
    catch { return ''; }
  };
  const savedTracks = (Array.isArray(value.savedTracks) ? value.savedTracks : []).filter((t) =>
    t && typeof t.id === 'string' && /^(commons|jamendo|audius|jellyfin|youtube|deezer):[\w-]+$/.test(t.id) &&
    typeof t.title === 'string' && typeof t.artist === 'string'
  ).slice(-1500).map((t) => ({
    id: t.id, title: t.title.slice(0, 180), artist: t.artist.slice(0, 180),
    uploader: typeof t.uploader === 'string' ? t.uploader.slice(0, 180) : '',
    genre: typeof t.genre === 'string' ? t.genre.slice(0, 30) : 'all',
    mood: typeof t.mood === 'string' ? t.mood.slice(0, 30) : 'Fresh',
    tags: [], source: t.id.split(':')[0],
    artwork: /^\/api\/jellyfin-art\?id=[a-f0-9]{32}$/i.test(t.artwork || '') ? t.artwork : cleanLink(t.artwork) || null, link: cleanLink(t.link),
    license: typeof t.license === 'string' ? t.license.slice(0, 180) : 'See original source',
    language: typeof t.language === 'string' ? t.language.slice(0,12) : 'unknown', inferredLanguage: typeof t.inferredLanguage === 'string' ? t.inferredLanguage.slice(0,12) : 'unknown',
  }));
  return {
    version: 1, history, favorites, savedTracks,
    genre: typeof value.genre === 'string' ? value.genre.slice(0, 24) : 'all',
    theme: THEME_IDS.includes(value.theme) ? value.theme : 'night',
    sound: value.sound !== false,
    volume: normalizeVolume(value.volume), // legacy v1 sessions migrate safely to 35%
    source: ['deezer','mix', 'audius', 'jamendo', 'commons', 'jellyfin', 'library-hits', 'youtube', 'charts', 'featured'].includes(value.source) ? value.source : 'deezer',
    blind: value.blind === true,
    language: value.language === 'en' && !Object.hasOwn(value, 'era') ? 'all' : (['en','en-strict','all','es','fr','pt','de','it','ja','ko','zh','hi','ar','ru'].includes(value.language) ? value.language : 'all'),
    // Old versions silently defaulted to English preferred. On first upgrade
    // restore the new all-languages default once. Explicit strict English stays.
    // Subsequent user selections are persistent.
    era: ['any','1980s','1990s','2000s','2010s','2020s'].includes(value.era) ? value.era : 'any',
    discovery: ['hits','variety'].includes(value.discovery) ? value.discovery : 'hits',
    discoveryMix: ['balanced','explore','familiar'].includes(value.discoveryMix) ? value.discoveryMix : 'balanced',
  };
}

export function loadState(storage) {
  try { return sanitizeState(JSON.parse(storage.getItem(STORAGE_KEY) || 'null')); }
  catch { return createInitialState(); }
}

export function saveState(storage, state) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}
