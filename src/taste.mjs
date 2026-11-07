/** Pure recommendation and taste-modeling functions. No access to DOM or storage. */
import { artistKey, chooseListeningLane } from './discovery/rotation.mjs';

export const MOODS = ['Bright', 'Warm', 'Dreamy', 'Intense', 'Reflective', 'Hopeful', 'Bold', 'Focused', 'Mysterious'];

export function createInitialState() {
  return { version: 1, history: [], favorites: [], savedTracks: [], genre: 'all', theme: 'night', sound: true, volume: 35, source: 'deezer', blind: false, language: 'all', era: 'any', discovery: 'hits', discoveryMix: 'balanced' };
}

export function computeTaste(history, catalog) {
  const lookup = new Map(catalog.map((track) => [track.id, track]));
  const genres = new Map();
  const moods = new Map();
  let recognized = 0;
  let correct = 0;
  let answered = 0;
  let liked = 0;
  for (const event of history) {
    const track = lookup.get(event.id);
    if (!track && !event.genre) continue;
    const rating = (event.action === 'like' ? 3 : -1) * (event.context === 'search' ? .5 : 1);
    if (event.action === 'like') liked++;
    if (event.recognized === true) recognized++;
    if (event.correct !== null && event.correct !== undefined) {
      answered++;
      if (event.correct) correct++;
    }
    const selectedGenre = track?.genre || event.genre;
    if (selectedGenre && selectedGenre !== 'unknown' && selectedGenre !== 'all')
      genres.set(selectedGenre, (genres.get(selectedGenre) ?? 0) + rating);
    const mood = event.mood || track?.mood || 'Fresh';
    if (mood && mood !== 'Fresh' && mood !== 'unknown')
      moods.set(mood, (moods.get(mood) ?? 0) + rating);
  }
  return {
    genres: [...genres].sort((a, b) => b[1] - a[1]),
    moods: [...moods].sort((a, b) => b[1] - a[1]),
    total: history.length, liked, recognized, correct, answered,
    accuracy: answered ? Math.round(correct / answered * 100) : null,
  };
}

/**
 * A lightweight contextual ranking strategy. Preferences follow likes/dislikes,
 * while a novelty bonus and artist-repetition penalty prevent a feedback loop.
 * `random` can be injected so tests are deterministic.
 */
export function selectNext(catalog, history, genre = 'all', random = Math.random, options = {}) {
  const seen = new Set(history.map((event) => event.id));
  const pool = catalog.filter((track) => !seen.has(track.id) && (genre === 'all' || track.genre === genre));
  if (!pool.length) return null;
  const taste = computeTaste(history, catalog);
  const preference = new Map(taste.genres);
  const moodPreference = new Map(taste.moods);
  const seedArtists = new Set((options?.seedArtists || []).map(artistKey));
  const relatedArtists = new Set((options?.relatedArtists || []).map(artistKey));
  const recentShown = (options?.recentArtists || []).slice(-4).map(artistKey).filter(Boolean);
  const artistAppearances = options?.artistAppearances || {};
  // Two passes of an artist with no corresponding Keep is a meaningful
  // negative signal. Deprioritize that artist when alternatives exist.
  const artistActions = new Map();
  for (const event of history) {
    const key=artistKey(event.artist);
    if (!key) continue;
    const counts=artistActions.get(key) || {likes:0,passes:0};
    if(event.action==='like') counts.likes++;
    if(event.action==='pass') counts.passes++;
    artistActions.set(key,counts);
  }
  // Hard preference for different artists, before applying soft taste scores.
  // A hundred tracks by one seed must not overpower five tracks by new artists.
  let candidates = pool;
  const acceptable=candidates.filter(t=>{
    const counts=artistActions.get(artistKey(t.artist));
    return !counts || counts.likes>0 || counts.passes<2;
  });
  if (acceptable.length) candidates=acceptable;
  const different = candidates.filter(t => !recentShown.includes(artistKey(t.artist)));
  if (different.length) candidates = different;
  if (options?.personalized) {
    const classify = t => seedArtists.has(artistKey(t.artist)) ? 'favorite' : relatedArtists.has(artistKey(t.artist)) ? 'related' : 'broad';
    const availableKinds = [...new Set(candidates.map(classify))];
    const lane = chooseListeningLane(options?.position || 0, options?.discoveryMix || 'balanced', availableKinds);
    if (lane) candidates = candidates.filter(t => classify(t) === lane);
  }
  // Prefer artists that have been heard less, with no hard empty-queue failure.
  if (candidates.length > 1) {
    const minimum = Math.min(...candidates.map(t => artistAppearances[artistKey(t.artist)] || 0));
    const underCap = candidates.filter(t => (artistAppearances[artistKey(t.artist)] || 0) <= minimum + 1);
    if (underCap.length) candidates = underCap;
  }
  // Artist search does not change this profile. Only deliberate Keep/Pass decisions do.
  const artistLikes = new Map();
  for (const event of history) {
    if (!event.artist) continue;
    const name = event.artist.toLowerCase();
    const weight = (event.context === 'search' ? .5 : 1) * (event.action === 'like' ? 1 : -.5);
    artistLikes.set(name, (artistLikes.get(name) || 0) + weight);
  }
  const recent = history.slice(-6).map(e => e.artist?.toLowerCase()).filter(Boolean);
  const recentGenres = history.slice(-6).map(e => e.genre).filter(Boolean);
  const scored = candidates.map(track => {
    const genreBonus = Math.max(-3, Math.min(6, preference.get(track.genre) ?? 0)) * .22;
    const moodBonus = Math.max(-3, Math.min(6, moodPreference.get(track.mood) ?? 0)) * .15;
    const newGenreBonus = preference.has(track.genre) ? 0 : 1.7;
    const artistName = String(track.artist || '').toLowerCase();
    const artistBonus = Math.max(-2,Math.min(3,artistLikes.get(artistName) || 0)) * .7;
    const repetitionPenalty = recent.includes(artistName) ? -5 : 0;
    const genreStreak = recentGenres.length >= 4 && recentGenres.slice(-4).every(g => g===track.genre) ? -2.8 : 0;
    // Chosen onboarding seeds inform the feed, but not enough to eliminate exploration.
    const seedBonus = 0; // Starting artists shape related-artist requests, not track-ranking bias.
    // Deezer's rank is a light popularity signal, not a guarantee of quality.
    // Use a logarithm so popularity cannot overpower the listener's choices.
    const popularityBonus = track.rank > 0 ? Math.max(0,Math.min(1.8,(Math.log10(track.rank)-3)*.55)) : 0;
    const exploration = random() * 7;
    return {track,score:genreBonus+moodBonus+newGenreBonus+artistBonus+repetitionPenalty+genreStreak+seedBonus+popularityBonus+exploration};
  });
  scored.sort((a, b) => b.score - a.score);
  // Sampling from the top cohort retains exploration, rather than lockstep ordering.
  return scored[Math.floor(random() * Math.min(4, scored.length))].track;
}

export function recordChoice(state, { id, action, recognized = null, correct = null, mood = null, genre = null, artist = null, context = 'discovery', route = 'balanced', at = Date.now() }) {
  if (!id || !['like', 'pass'].includes(action) || state.history.some((item) => item.id === id)) return state;
  const event = { id, action, recognized, correct, mood, genre, artist, context: context === 'search' ? 'search' : 'discovery', route: ['balanced','familiar','explore'].includes(route) ? route : 'balanced', at };
  return {
    ...state,
    history: [...state.history, event].slice(-5000),
    favorites: action === 'like' ? [...state.favorites, id] : state.favorites,
  };
}

export function removeFavorite(state, id) {
  return { ...state, favorites: state.favorites.filter((value) => value !== id) };
}

export function restoreLastChoice(state) {
  if (!state.history.length) return state;
  const history = state.history.slice(0, -1);
  const undone = state.history.at(-1);
  return { ...state, history, favorites: undone.action === 'like' ? state.favorites.filter((id) => id !== undone.id) : state.favorites };
}
