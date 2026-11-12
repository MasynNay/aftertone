import {apiFetch} from './api-browser.js';
import { createInitialState, computeTaste, selectNext, recordChoice, removeFavorite, restoreLastChoice, MOODS } from '/src/taste.mjs';
import { makeRecognitionQuiz } from '/src/quiz.mjs';
import { loadState, saveState } from '/src/persistence.mjs';
import { BACKUP_MAX_BYTES, createProgressBackup, inspectProgressBackup, restoreProgressBackup } from '/src/progress-backup.mjs';
import { encodeChallenge, decodeChallenge } from '/src/challenge.mjs';
import { createViews } from './views.js';
import { html, urlSafe, tag } from './view-utils.js';
import { THEMES, THEME_IDS } from '/src/themes.mjs';
import { matchesLanguage, likelyMusicRecording } from '/src/recording-quality.mjs';
import { parsePlaylist, buildSeedProfile, buildSeedLanes, trackIdentity } from '/src/playlist-import.mjs';
import { parseFavoriteArtists, artistSeedProfile, likedArtistLanes } from '/src/discovery-personalization.mjs';
import { artistKey, laneKey, splitSeedLanes } from '/src/discovery/rotation.mjs';
import { planDiscoveryRequest, explainDiscovery, PATH_DESCRIPTIONS } from '/src/discovery/mode-engine.mjs';
import { belongsToDiscoveryFeed } from '/src/discovery/queue.mjs';
import { selectRouteQueue, isActiveRequest } from '/src/discovery/route-session.mjs';
import { mergeRelatedArtists, interleaveArtistBranches } from '/src/discovery/graph.mjs';
import { REFILL_INTERVAL_MS, shouldRefill } from '/src/discovery/auto-refill.mjs';
import { createTournament, voteDuel, nextDuelMatch, availableChampions, podiumTracks, podiumCsv, hallOfFame, hallOfFameCsv, loadDuelStore, saveDuelStore, loadDuelSelection, saveDuelSelection } from '/src/duels.mjs';
import { renderDuels } from './duels-view.js';
import { pickThemedEntries, tournamentAvailability, tournamentTheme, isMysteryTournament, tournamentStatusLabel } from '/src/tournament-themes.mjs';
import { normalizeVolume, updateVolumeSetting, toggleMuteSetting } from '/src/volume.mjs';

const main = document.querySelector('#main-content');
const modalRoot = document.querySelector('#modal-root');
const toastEl = document.querySelector('#toast');
const audio = document.querySelector('#player');
// Assign the saved listening level before loading any preview, not after play.
// The same HTMLAudioElement handles discovery, collections, and duels.
const nav = document.querySelector('#main-nav');
const previewLength = 22;
let state = loadState(localStorage);
audio.volume = normalizeVolume(state.volume) / 100;
audio.muted = !state.sound || normalizeVolume(state.volume) === 0;
// Optional personalization is OFF on every launch. Importing never becomes
// mandatory and never silently replaces the normal fresh-discovery experience.
const PLAYLIST_STORAGE_KEY = 'aftertone:optional-playlist:v1';
function readPlaylist() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PLAYLIST_STORAGE_KEY) || 'null');
    return Array.isArray(parsed?.tracks) ? { tracks: parsed.tracks.slice(0,3000) } : null;
  } catch { return null; }
}
let importedPlaylist = readPlaylist();
let playlistProfile = importedPlaylist ? buildSeedProfile(importedPlaylist) : null;
let seedActive = false;
let seedKind = 'playlist';
const ARTISTS_STORAGE_KEY = 'aftertone:favorite-artists:v1';
const FAVORITE_ARTIST_LIMIT = 5;
const INTRO_STORAGE_KEY = 'aftertone:intro-shown:v054';
let chosenArtists = (() => {try {return parseFavoriteArtists(JSON.parse(localStorage.getItem(ARTISTS_STORAGE_KEY)||'[]'));}catch{return [];}})();
let seedRelated = [];
let seedVersion = 0;
let relatedLookupStatus = 'idle'; // idle | searching | ready | unavailable
const expandedArtists = new Set(); // Limits graph lookups on explicit likes.
let sessionPosition = 0;
const sessionArtists = [];
const artistAppearances = Object.create(null);
function resetArtistRotation() {
  sessionPosition = 0;
  sessionArtists.length = 0;
  for (const key of Object.keys(artistAppearances)) delete artistAppearances[key];
}
function activeSeedProfile() { return seedKind === 'artists' ? artistSeedProfile(chosenArtists) : playlistProfile; }
function playlistInfo() {
  const profile = activeSeedProfile();
  return { active: seedActive, kind: seedKind, count: profile?.totalSongs || 0,
    artists: profile?.artistCount || 0, related: seedRelated.length, lookupStatus:relatedLookupStatus, mix:state.discoveryMix,
    ready: Boolean(playlistProfile?.totalSongs), hasArtists: chosenArtists.length>0, chosenArtists,
    sourceReady: availableSources.includes('deezer') };
}
function getSeedLanes() {
  const profile=activeSeedProfile();
  if (!profile) return [];
  const disliked=new Set();
  const feedback=new Map();
  for(const entry of state.history) {
    const key=artistKey(entry.artist);
    if(!key) continue;
    const counts=feedback.get(key) || {likes:0,passes:0};
    if(entry.action==='like') counts.likes++;
    if(entry.action==='pass') counts.passes++;
    feedback.set(key,counts);
  }
  for(const [artist,counts] of feedback) if(counts.passes>=2 && !counts.likes) disliked.add(artist);
  const lanes = buildSeedLanes(profile, interleaveArtistBranches(seedRelated,64), 64)
    .filter(l=>!disliked.has(artistKey(l.artist)));
  return seedKind === 'artists' ? lanes.map(l => l.reason === 'In your playlist' ? {...l, reason:'One of your chosen artists'} : l) : lanes;
}
function saveImportedPlaylist(playlist) {
  try {
    if (playlist) localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify({ tracks: playlist.tracks.slice(0,3000) }));
    else localStorage.removeItem(PLAYLIST_STORAGE_KEY);
    return true;
  } catch { toast('The imported playlist could not be saved; this browser may have limited storage.'); return false; }
}

let catalog = [];
let starterShelf = [];
let availableSources = ['deezer'];
let searchQuery = '';
let searchDraft = '';
let lastModeSwitchTrackId = null; // Never show the same exact song as a new path's first suggestion.
const SOURCE_LABEL = { deezer:'Deezer · 22-second swipe previews', featured:'Official video starter · no key', charts: 'Global Listening Charts + YouTube', mix: 'Independent audio sources', audius: 'Audius', jamendo: 'Jamendo', commons: 'Wikimedia Commons', jellyfin: 'My Jellyfin library', 'library-hits':'Popular songs · ad-free from my library', youtube: 'YouTube (video, may have ads)' };
const catalogIds = new Set();
// Tracks retrieved during ordinary discovery are a LAST RESORT when a path
// has already tried its own fetch and is out of playable results. Manual
// searches never enter this shared pool (and end on a path switch).
const discoveryIds = new Set();
function rememberDiscoveryIds(tracks) {
  for(const track of tracks||[]) if(track?.id) {
    if(discoveryIds.size>=1600) discoveryIds.delete(discoveryIds.values().next().value);
    discoveryIds.add(track.id);
  }
}
const feeds = new Map();
let animatingChoice = false;
let allGenres = [];
let view = 'discover';
let duelTournaments = loadDuelStore(localStorage);
let selectedDuelId = loadDuelSelection(localStorage,duelTournaments); // Active bracket reopens after refresh.
let hallSeason = 'all'; // Season filter only affects the leaderboard, not stored results.
let sidebarFiltersCollapsed = false;
let quizSession = null;
const quizStorageKey = 'aftertone:tune-lab:v1';
let quizStats = (() => { try { const data=JSON.parse(localStorage.getItem(quizStorageKey)||'null'); return {answered:Math.max(0,Number(data?.answered)||0),correct:Math.max(0,Number(data?.correct)||0)}; } catch { return {answered:0,correct:0}; } })();
let current = null;
let modal = null;
let activeAudioId = null;
let continuousListening = false; // Starts only on a user-initiated Play in Discover.
const unvotedPreviews = new Set(); // Auto-advanced previews aren't falsely recorded as dislikes.
let advancingPreview = false;
let consecutivePlaybackFailures = 0;
let audioGeneration = 0;
let isLoadingAudio = false;
let activeAudioFallback = false;
let failedAudioId = null;
let resolved = new Map();
const inFlightAudio = new Map();
let failedSources = new Set();
const deezerRefreshedOnce = new Set(); // A signed preview can expire; retry once with a fresh URL.
const LYRIC_OFFSET_KEY='aftertone:lyric-offsets:v1';
let lyricsEnabled=false;
let lyricTrackId=null;
let lyricPayload=null;
let lyricsRequestVersion=0;
let lyricOffsets=(()=>{try{const data=JSON.parse(localStorage.getItem(LYRIC_OFFSET_KEY)||'{}');return data && typeof data==='object' && !Array.isArray(data)?data:{};}catch{return {};}})();
function lyricOffsetFor(track) {return Number(lyricOffsets[track?.id]) || 0;}
function storeLyricOffset(track,value) {
  if(!track) return;
  const seconds=Math.max(0,Math.min(Math.max(0,(track.duration||330)-22),Number(value)||0));
  lyricOffsets[track.id]=seconds;
  const ids=Object.keys(lyricOffsets);
  if(ids.length>200) delete lyricOffsets[ids[0]];
  try{localStorage.setItem(LYRIC_OFFSET_KEY,JSON.stringify(lyricOffsets));}catch{}
}
function lyricLineAt(lines,time) {
  let result=null;
  for(const line of lines||[]) {if(line.time>time) break;result=line;}
  return result;
}
async function requestCurrentLyrics(track) {
  if(!lyricsEnabled || !track || lyricTrackId===track.id) return;
  const token=++lyricsRequestVersion;
  lyricTrackId=track.id;
  lyricPayload={status:'loading',lines:[]};
  updateLyricView();
  try {
    const q=new URLSearchParams({artist:track.artist,title:track.title,duration:String(track.duration||0)});
    const response=await apiFetch(`/api/lyrics?${q}`);
    const payload=await response.json();
    if(token!==lyricsRequestVersion || current?.id!==track.id) return;
    lyricPayload=response.ok ? payload:{status:'error',lines:[]};
  } catch {
    if(token!==lyricsRequestVersion) return;
    lyricPayload={status:'error',lines:[]};
  }
  updateLyricView();
}
function updateLyricView() {
  const box=$('#live-lyrics');
  const indicator=$('#lyric-indicator');
  const button=$('[data-action="lyrics-toggle"]');
  if(button) button.setAttribute('aria-expanded',String(lyricsEnabled));
  if(indicator) indicator.textContent=lyricsEnabled?'On':'Optional';
  if(!box) return;
  box.hidden=!lyricsEnabled;
  if(!lyricsEnabled) return;
  const target=$('#lyric-line');
  const align=$('#lyric-align');
  if(!target || !align) return;
  const payload=lyricPayload;
  align.hidden=payload?.status!=='available';
  if(payload?.status==='available') {
    const offset=lyricOffsetFor(current);
    const fullTime=(activeAudioId===current?.id ? Number(audio.currentTime)||0 : 0)+offset;
    const line=lyricLineAt(payload.lines,fullTime);
    target.textContent=line?.text || '♪ Waiting for the next timed line';
    const slider=$('#lyrics-offset');
    const max=Math.max(0,(Number(current?.duration)||330)-previewLength);
    if(slider) {slider.max=String(max); slider.value=String(offset);}
    const duration=$('#lyric-offset-value');
    if(duration) duration.textContent=`${Math.floor(offset/60)}:${String(offset%60).padStart(2,'0')}`;
  } else target.textContent=payload?.status==='loading' ? 'Finding timed lyrics…' : payload?.status==='rate-limited' ? 'Lyrics service is busy. Try another song later.' : payload?.status==='unavailable' ? 'No verified timed lyrics for this recording.' : 'Lyrics unavailable right now.';
}

let toastTimer = null;
let catalogWarning = '';
const rememberSource = () => { try { localStorage.setItem('aftertone:source-choice:v038','1'); } catch {} };
const sourceRemembered = () => { try { return Boolean(localStorage.getItem('aftertone:source-choice:v038')); } catch { return true; } };
let catalogLive = false;
let collectionQuery = '';
let collectionSort = 'recent';
let pointerStart = null;
let startedAt = Date.now();
const initialChallenge = decodeChallenge(new URL(location.href).searchParams.get('challenge'));
let challengeIds = initialChallenge;
let challengeResponses = [];

const $ = (selector, root = document) => root.querySelector(selector);
const lookup = (id) => catalog.find((track) => track.id === id) ?? null;
const persist = () => { if (!saveState(localStorage, state)) toast('Local storage unavailable; progress may not persist.'); };
const currentTheme = () => THEMES.find((t) => t.id === state.theme) || THEMES[0];
function themeSwatch(theme, large = false) {
  return `<button class="${large ? 'theme-tile' : 'theme-dot'} ${theme.id === state.theme ? 'active' : ''}" data-set-theme="${html(theme.id)}" title="${html(theme.name)}" aria-label="${html(theme.name)} theme" aria-pressed="${theme.id === state.theme}" style="--swatch:${theme.swatch};${large ? `--tile-bg:${theme.colors.bg};--tile-surface:${theme.colors.surface};--tile-accent:${theme.colors.accent}` : ''}">${large ? `<span class="theme-tile-preview"><i></i><i></i><i></i></span><strong>${html(theme.name)}</strong><small>${html(theme.description)}</small>` : ''}</button>`;
}
function addToCatalog(tracks) {
  let added = 0;
  for (const track of tracks || []) {
    if (!track || !/^(commons|jamendo|audius|jellyfin|youtube|deezer):[\w-]+$/.test(track.id || '') || !track.title || !track.artist || !likelyMusicRecording({title:track.title, tags:track.tags, duration:track.duration})) continue;
    if (catalogIds.has(track.id)) {
      if (track.chartSource === 'ListenBrainz') {
        const previouslyLoaded = catalog.find(item => item.id === track.id);
        if (previouslyLoaded) Object.assign(previouslyLoaded, {title:track.title, artist:track.artist, artwork:track.artwork || previouslyLoaded.artwork,chartSource:track.chartSource});
      }
      continue;
    }
    catalogIds.add(track.id);
    catalog.push(track);
    added++;
  }
  return added;
}
function getFeed(genre = state.genre) {
  const key = `${genre}:${state.source}:${searchQuery}:${state.language}:${state.era}:${state.discovery}:${state.discoveryMix}:seed${seedActive ? seedVersion : 0}`;
  if (!feeds.has(key) && feeds.size >= 48) feeds.delete(feeds.keys().next().value);
  if (!feeds.has(key)) feeds.set(key, {
    cursors: {}, exhausted: new Set(), loading: false, hasMore: true, error: '',
    provider: state.source, added: 0, requests: 0, ids: new Set(), reasons: new Map(), total: null, emptyRefills:0, retryAt:0, note:'', primed:false,
  });
  return feeds.get(key);
}
function matchesFeed(track, genre = state.genre) {
  if (seedActive && !getFeed(genre).ids.has(track.id) && !discoveryIds.has(track.id)) return false;
  if (seedActive && activeSeedProfile()?.seenTracks.has(trackIdentity(track.artist, track.title))) return false;
  const sourceMatch = state.source === 'mix' || (['charts','featured','library-hits'].includes(state.source) ? getFeed(genre).ids.has(track.id) && track.source === (state.source === 'library-hits' ? 'jellyfin' : 'youtube') : track.source === state.source);
  const genreMatch = genre === 'all' || track.genre === genre;
  // Crucial: every Deezer feed is scoped to its own fetched IDs; a previous
  // search never becomes part of the fresh recommendation pool.
  // Path switches reuse genuine non-search catalog results already fetched in
  // this browser session; manually searched titles never enter this shared pool.
  const activeIds=getFeed(genre).ids;
  const accepted=belongsToDiscoveryFeed(track.id,activeIds,discoveryIds,Boolean(searchQuery));
  const queryMatch=(state.source === 'deezer' || ['charts','featured','library-hits'].includes(state.source) || Boolean(searchQuery))
    ? accepted && track.source === (state.source === 'deezer' ? 'deezer' : track.source) : true;
  // Deezer offers no trustworthy vocal-language field. The artist lanes steer
  // the feed without silently discarding every real song as 'unknown'.
  const languageMatch = state.source === 'deezer'
    ? (Boolean(searchQuery) || state.language === 'all' || state.language === 'en' ||
      track.inferredLanguage === (state.language === 'en-strict' ? 'en' : state.language))
    : (state.language === 'en' ? true : matchesLanguage(track, state.language));
  return sourceMatch && genreMatch && queryMatch && languageMatch;
}
function routeCandidates(genre=state.genre) {
  const heard=new Set(state.history.map(event=>event.id));
  let available=catalog.filter(track=>!heard.has(track.id) && !unvotedPreviews.has(track.id) &&
    !failedSources.has(track.id) && matchesFeed(track,genre));
  if(lastModeSwitchTrackId && available.some(track=>track.id!==lastModeSwitchTrackId))
    available=available.filter(track=>track.id!==lastModeSwitchTrackId);
  const profile=seedActive ? activeSeedProfile() : null;
  const feed=getFeed(genre);
  return selectRouteQueue({pool:available,feedIds:feed.ids,primed:feed.primed,loading:feed.loading,mode:state.discoveryMix,
    searching:Boolean(searchQuery),context:{history:state.history,
      seeds:(profile?.artists || []).map(x=>x.artist),related:seedRelated,position:sessionPosition}});
}
function availableCount(genre=state.genre) {return routeCandidates(genre).tracks.length;}
function sourceOrder() {
  // YouTube is opt-in: do not silently introduce video ads into the audio mix.
  return state.source === 'mix' ? ['audius', 'jellyfin', 'jamendo', 'commons'].filter((x) => availableSources.includes(x)) : [state.source];
}
/** Fetch new batches progressively. Counters represent loaded songs, not provider catalog sizes. */
async function loadMore(genre = state.genre, showStatus = false, prioritizeRelated = false) {
  if (challengeIds.length) return;
  const feed = getFeed(genre);
  const requestSearch=searchQuery;
  if (feed.loading) { if (prioritizeRelated) feed.relatedUpdatePending = true; return; }
  if (!feed.hasMore) return;
  if (!showStatus && Date.now()<feed.retryAt) return;
  if (feed.emptyRefills>=5 && !showStatus) {
    // Strict modes must never permanently poison a feed because an artist
    // graph was delayed. Back off, then try again; the loaded queue remains.
    feed.retryAt=Date.now()+45000;
    feed.emptyRefills=0;
    feed.error='Still looking for matches. Try searching an artist, or keep listening to available discoveries.';
    if(showStatus) render();
    return;
  }
  feed.retryAt=0;
  if(showStatus) feed.emptyRefills=0;
  feed.loading = true;
  feed.error = '';
  if (showStatus || !current) render();
  let successes = 0;
  try {
    const seedMode = seedActive && !requestSearch && ['deezer','youtube','jellyfin','library-hits'].includes(state.source);
    const lanes = seedMode ? getSeedLanes() : [];
    const profile = seedMode ? activeSeedProfile() : null;
    const groups = splitSeedLanes(lanes,(profile?.artists || []).map(a => a.artist));
    // Real discovery lanes: path policy is applied at the network boundary, not just in the UI.
    // A wildcard requests genre-specific catalog lanes; Comfort requests kept
    // performers; New Territory requests graph neighbors and chart breadth.
    const likedLanes = !requestSearch && state.source==='deezer' ? likedArtistLanes(state.history) : [];
    const candidateKinds={seeds:groups.seeds,related:seedMode ? groups.related : seedRelated,liked:likedLanes};
    for (let attempt = 0; attempt < (state.source==='deezer' && !requestSearch ? 6 : 5); attempt++) {
      const providers = sourceOrder().filter(name => !feed.exhausted.has(name));
      if (!providers.length) break;
      const source = providers[feed.requests % providers.length];
      const planned = source==='deezer' && !requestSearch
        ? planDiscoveryRequest({mode:state.discoveryMix,requestNumber:feed.requests,
            ...candidateKinds,history:state.history,selectedGenre:genre,exhausted:feed.exhausted})
        : {kind:'search',lane:null,genre};
      const lane = planned.lane;
      // Each Wild Card genre gets its own pagination cursor, otherwise repeated
      // pages accidentally carry the cursor of an unrelated artist/genre.
      const requestGenre=planned.genre || genre;
      const cursorKey=lane ? `${planned.kind}:${laneKey(lane)}` :
        (planned.kind==='wild' ? `wild:${requestGenre}` : source==='deezer' && !searchQuery ? 'broad' : source);
      if(planned.kind==='none' || feed.exhausted.has(cursorKey)) {
        feed.requests++;
        continue;
      }
      feed.requests++;
      const query = new URLSearchParams({ genre:requestGenre, source, strict:'1', language:state.language,
        era:state.era, discovery:state.discovery });
      if (feed.cursors[cursorKey]) query.set('cursor',feed.cursors[cursorKey]);
      // Important: an artist lane must use Deezer's dedicated artist filter.
      // A free-text query can fetch unrelated songs with the same words.
      if (requestSearch) query.set('q', requestSearch);
      if (lane) query.set('seed_artist', lane.artist);
      try {
        const response = await apiFetch(`/api/discover?${query}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error || `HTTP ${response.status}`);
        const before = feed.cursors[cursorKey];
        for (const track of result.tracks || []) {
          // Provenance belongs to the active path feed, not the global catalog:
          // another path can discover the same song for a different reason.
          feed.reasons.set(track.id,explainDiscovery({...planned,artist:track.artist}));
        }
        const added = addToCatalog(result.tracks);
        if((result.tracks || []).length) feed.primed=true;
        for (const track of result.tracks || []) feed.ids.add(track.id);
        if(!requestSearch) rememberDiscoveryIds(result.tracks);
        feed.added += added;
        if (typeof result.total === 'number') feed.total = result.total;
        feed.provider = source;
        if (result.note) feed.note = String(result.note).slice(0, 280);
        feed.cursors[cursorKey] = result.nextCursor || '';
        if (!result.hasMore || (before && before === result.nextCursor)) feed.exhausted.add(cursorKey);
        successes++;
      } catch (error) {
        // Do not permanently exhaust a provider on a temporary outage.
        feed.error = `${SOURCE_LABEL[source]} could not load: ${error.message}`;
        if (lane && /HTTP (400|404)\b/.test(String(error.message))) {
          feed.exhausted.add(cursorKey); continue;
        }
        // 429s, timeouts and provider outages are temporary. Retry later;
        // never mark an otherwise useful artist lane permanently exhausted.
        feed.retryAt=Date.now()+20000;
        if (state.source !== 'mix') break;
        // In mix mode skip this source for this fetch cycle, retry on the next request.
        feed.exhausted.add(source);
      }
      // A usable first page is enough to present a real mode-specific card.
      // The 3-second replenisher brings in deeper catalog pages afterward.
      if (successes >= 1 && availableCount(genre) >= (prioritizeRelated ? 8 : 12)) break;
    }
    if (availableCount(genre) === 0) feed.emptyRefills++;
    else feed.emptyRefills = 0;
    // A finished broad chart page does NOT mean all related-artist pages have
    // finished. Conversely, if every cursor is exhausted, stop polling.
    if(state.source==='deezer' && !requestSearch) {
      const relatedKinds={seeds:groups.seeds,related:seedMode?groups.related:seedRelated,liked:likedLanes};
      feed.hasMore=Array.from({length:24},(_,offset)=>planDiscoveryRequest({
        mode:state.discoveryMix,requestNumber:feed.requests+offset,...relatedKinds,
        history:state.history,selectedGenre:genre,exhausted:feed.exhausted,
      })).some(plan=>plan.kind!=='none');
    } else feed.hasMore = sourceOrder().some(source=>!feed.exhausted.has(source));
    if(feed.error && !successes) feed.retryAt=Date.now()+20000;
    if (feed.error && successes) feed.error = '';
    if (state.source === 'mix' && state.discovery === 'variety' && !current && !availableCount(genre) && !successes && !catalog.length && !requestSearch) {
      addToCatalog(starterShelf);
      feed.error = 'Live music is temporarily unavailable. Showing the offline starter shelf.';
    }
    if (!feed.hasMore && !availableCount(genre) && showStatus) toast('No more matching songs from selected sources. Change the filter or source.');
  } finally {
    feed.loading = false;
    feed.primed = true;
    if (genre === state.genre && isActiveRequest(feed,getFeed(genre))) {
      // Auto-refill must not replace the playing card's DOM every three
      // seconds: that would steal focus from the lyrics slider, interrupt
      // gestures and make the page jump while someone is listening.
      const neededCard = !current;
      if (neededCard) chooseNext();
      if (neededCard || showStatus) render();
      else {
        const queueLabel = $('#queue-count');
        if (queueLabel) queueLabel.textContent = String(availableCount(genre));
        const loaded = $('.queue-loaded');
        if (loaded) loaded.textContent = `${feed.ids.size} loaded · Deezer`;
      }
      maybeResumeContinuous();
    }
    // Similarity lookups may finish during a chart fetch. Never lose the
    // background related-artist refill just because a request was in flight.
    if (feed.relatedUpdatePending) {
      feed.relatedUpdatePending = false;
      if (feed.hasMore) void loadMore(genre,false,true);
    }
  }
}
/** Regular check, not an unconditional API request. Keeps a deep queue for
 * quick swipe sessions; no timers are created by individual card renders. */
function autoRefillTick() {
  const feed=getFeed();
  const ready=availableCount(state.genre);
  const active=view==='discover' && !modal && !searchQuery;
  if(Date.now()>=feed.retryAt && shouldRefill({ready,loaded:feed.ids.size,loading:feed.loading,hasMore:feed.hasMore,
    visible:!document.hidden,active,challenge:Boolean(challengeIds.length)})) {
    void loadMore(state.genre,false);
  }
  const counter=$('#queue-count');
  if(counter) counter.textContent=String(ready);
}
setInterval(autoRefillTick,REFILL_INTERVAL_MS);
function maybeTopUp() {
  if (challengeIds.length) return;
  const feed = getFeed();
  if (availableCount(state.genre) < 12 && feed.hasMore && !feed.loading) void loadMore(state.genre);
}

function toast(message) {
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.classList.add('show');
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3400);
}

function updateChrome() {
  document.body.dataset.theme = state.theme;
  // Build the 20-option navbar palette once, so rerenders do not steal focus.
  const palette = $('#theme-menu-grid');
  if (palette && !palette.children.length) palette.innerHTML = THEMES.map(t => `<button type="button" class="theme-menu-option" data-set-theme="${html(t.id)}" title="${html(t.description)}" aria-pressed="false"><span class="theme-menu-swatch" style="--swatch:${t.swatch};--tile-bg:${t.colors.bg};--tile-surface:${t.colors.surface}"></span><span class="theme-menu-option-name">${html(t.name)}</span><span class="theme-option-check" aria-hidden="true">✓</span></button>`).join('');
  $('#theme-menu-toggle')?.setAttribute('title', `Theme: ${currentTheme().name}. Choose a theme`);
  document.querySelectorAll('[data-set-theme]').forEach((button) => {
    button.classList.toggle('active', button.dataset.setTheme === state.theme);
    button.setAttribute('aria-pressed', String(button.dataset.setTheme === state.theme));
  });
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  $('#current-view-label').textContent = ({ discover: 'DISCOVER', collection: 'COLLECTION', taste: 'TASTE MAP', challenges: 'CHALLENGES', quiz: 'TUNE LAB', duels: 'MUSIC DUELS' })[view];
  $('#sidebar-saves').textContent = String(state.favorites.length);
  const sound = $('#sound-toggle');
  sound.textContent = state.sound ? '♫' : '♪';
  sound.classList.toggle('muted', !state.sound);
  sound.setAttribute('aria-label', state.sound ? 'Mute music' : 'Unmute music');
  applySavedVolume();
}

/** Set both the media element and every visible slider from one saved state.
 * Kept outside render() because a focused slider must not be replaced mid-drag. */
function applySavedVolume() {
  const level = normalizeVolume(state.volume);
  audio.volume = level / 100;
  audio.muted = !state.sound || level === 0;
  document.querySelectorAll('[data-volume-slider]').forEach((slider) => {
    if (document.activeElement !== slider) slider.value = String(level);
    slider.setAttribute('aria-valuetext', state.sound && level > 0 ? `${level} percent` : 'Muted');
  });
  document.querySelectorAll('[data-volume-value]').forEach((output) => {
    output.textContent = audio.muted ? 'Muted' : `${level}%`;
  });
}

/** Menu lives outside the app modal so the music never pauses during a color change. */
function setThemeMenuOpen(open, restoreFocus = false) {
  const menu = $('#theme-menu');
  const toggle = $('#theme-menu-toggle');
  if (!menu || !toggle) return;
  menu.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  if (restoreFocus && !open) toggle.focus();
  if (open) menu.querySelector(`[data-set-theme="${state.theme}"]`)?.focus();
}

function stopAudio() {
  audioGeneration++;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  activeAudioId = null;
  isLoadingAudio = false;
  activeAudioFallback = false;
  failedAudioId = null;
}

async function resolveAudio(track) {
  if (resolved.has(track.id)) {
    const item = resolved.get(track.id);
    if (!item.expiresAt || Date.now() < item.expiresAt) return item;
    resolved.delete(track.id);
  }
  if (inFlightAudio.has(track.id)) return inFlightAudio.get(track.id);
  const request = (async () => {
    const response = await apiFetch(`/api/audio?id=${encodeURIComponent(track.id)}`);
    const payload = await response.json();
    if (!response.ok || !payload.url) throw new Error(payload.detail || payload.error || 'No playable file');
    if (resolved.size >= 320) resolved.delete(resolved.keys().next().value);
    if (payload.ttlSeconds) payload.expiresAt = Date.now() + payload.ttlSeconds * 1000;
    resolved.set(track.id, payload);
    return payload;
  })();
  inFlightAudio.set(track.id, request);
  try { return await request; }
  finally { inFlightAudio.delete(track.id); }
}

function prewarm(track) {
  if (track && track.source !== 'youtube' && !resolved.has(track.id) && !failedSources.has(track.id)) {
    resolveAudio(track).catch(() => { /* Let the play action surface a retryable error. */ });
  }
}

function stopContinuous() {
  continuousListening = false;
  consecutivePlaybackFailures = 0;
  stopAudio();
  updatePlaybackView();
}
function maybeResumeContinuous() {
  if (!continuousListening || modal || view !== 'discover' || animatingChoice || advancingPreview) return;
  if (!current) {
    const feed = getFeed();
    if (!feed.hasMore && !feed.loading) { continuousListening = false; toast('No more playable matches for these filters. Continuous listening stopped.'); }
    else maybeTopUp();
    return;
  }
  // Embeds remain inside YouTube's official visible player and cannot be
  // seamlessly autoplayed like a permitted audio stream.
  if (current.source === 'youtube') { continuousListening = false; updatePlaybackView(); return; }
  if (activeAudioId === current.id && !audio.paused) return;
  void togglePlayback(current, true);
}
/** Retry the same preview using a freshly resolved URL, without changing taste data. */
function retryFailedPreview() {
  if (!current || view !== 'discover' || failedAudioId !== current.id) return;
  resolved.delete(current.id);
  failedSources.delete(current.id);
  deezerRefreshedOnce.delete(current.id);
  stopAudio();
  void togglePlayback(current, false);
}
/** A failed preview is not a vote. Leave collection and history unchanged. */
function skipUnavailablePreview() {
  if (!current || view !== 'discover' || challengeIds.length) return;
  unvotedPreviews.add(current.id);
  continuousListening=false;
  stopAudio();
  chooseNext();
  render();
  maybeTopUp();
}
function advancePreview() {
  if (advancingPreview || !current || view !== 'discover' || modal || !continuousListening) return;
  advancingPreview = true;
  // Reaching 22 seconds is a neutral skip, NOT an implicit dislike.
  unvotedPreviews.add(current.id);
  stopAudio();
  chooseNext();
  render();
  maybeTopUp();
  advancingPreview = false;
  maybeResumeContinuous();
}
async function togglePlayback(track, automatic = false) {
  if (!track || (isLoadingAudio && activeAudioId === track.id)) return;
  // Switching contestants while a prior preview is resolving cancels the stale
  // request via audioGeneration rather than ignoring the user's second click.
  if (track.source === 'youtube') {
    continuousListening = false;
    return openModal('youtube', { id: track.id, from: view });
  }
  if (activeAudioId === track.id && !audio.paused) {
    if (!automatic) continuousListening = false; // Explicit pause ends the autoplay session.
    audio.pause();
    updatePlaybackView();
    return;
  }
  if (!automatic && view === 'discover' && current?.id === track.id) continuousListening = true;
  else if (!automatic) continuousListening = false; // Collection playback is manual.
  const sameTrack = activeAudioId === track.id;
  if (!sameTrack) stopAudio();
  const generation = audioGeneration;
  activeAudioId = track.id;
  activeAudioFallback = false;
  failedAudioId = null;
  isLoadingAudio = true;
  updatePlaybackView();
  try {
    const source = await resolveAudio(track);
    if (activeAudioId !== track.id || generation !== audioGeneration) return;
    if (!sameTrack || !audio.src) {
      audio.src = source.url;
      audio.currentTime = 0;
    } else if (audio.currentTime >= previewLength - 0.1) {
      audio.currentTime = 0; // Replay a finished clip from the beginning.
    }
    applySavedVolume();
    try {
      await audio.play();
    } catch (directError) {
      // Firefox/Zen and other browsers sometimes reject an upstream redirect.
      // Retry Audius using our bounded, same-origin streaming endpoint.
      if (!source.fallbackUrl || activeAudioId !== track.id || generation !== audioGeneration) throw directError;
      activeAudioFallback = true;
      audio.src = source.fallbackUrl;
      audio.currentTime = 0;
      await audio.play();
    }
    failedSources.delete(track.id);
    if (deezerRefreshedOnce.size > 300) deezerRefreshedOnce.clear();
    consecutivePlaybackFailures = 0;
  } catch (error) {
    // A missing Commons upload or blocked format should never trap the player.
    if (generation !== audioGeneration) return; // Old stream was canceled by a swipe.
    if (activeAudioId === track.id) {
      audio.pause();
      activeAudioId = null;
    }
    if (failedSources.size >= 320) failedSources.delete(failedSources.values().next().value);
    failedSources.add(track.id);
    failedAudioId = track.id;
    toast(`${SOURCE_LABEL[track.source] || 'This source'} could not play this recording. Try again or skip without voting.`);
    if (automatic && continuousListening && generation === audioGeneration) {
      consecutivePlaybackFailures++;
      if (consecutivePlaybackFailures >= 3) { continuousListening = false; toast('Several tracks could not play. Continuous listening stopped.'); }
      else queueMicrotask(() => { if (continuousListening && current?.id === track.id) advancePreview(); });
    } else if (!automatic) continuousListening = false;
    console.warn('Could not play recording:', error);
  } finally {
    if (generation === audioGeneration) isLoadingAudio = false;
    updatePlaybackView();
  }
}

function updatePlaybackView() {
  const stop = $('#stop-session');
  if (stop) stop.hidden = !continuousListening;
  const hint = $('#continuity-hint');
  if (hint) hint.textContent = continuousListening ? '● Auto-playing · Stop to end' : '▶ Play once for continuous listening';
  const button = $('#stage-play');
  if (button && current) {
    if (current.source === 'youtube') {
      button.textContent = '▶';
      button.setAttribute('aria-label', 'Open YouTube video preview');
      const status = $('#audio-status');
      if (status) status.textContent = 'Watch a 22-second clip in the YouTube player; ads may appear';
      const time = $('#audio-time');
      if (time) time.textContent = '22 sec';
      const fill = $('#audio-progress');
      if (fill) fill.style.width = '0%';
      return;
    }
    const playing = activeAudioId === current.id && !audio.paused;
    button.textContent = isLoadingAudio ? '···' : playing ? 'Ⅱ' : '▶';
    button.setAttribute('aria-label', isLoadingAudio ? 'Loading audio' : playing ? 'Pause preview' : 'Play preview');
    $('#waveform')?.classList.toggle('playing', playing);
    $('#vinyl')?.classList.toggle('spin', playing);
    const seconds = activeAudioId === current.id ? Math.min(previewLength, audio.currentTime || 0) : 0;
    const fill = $('#audio-progress');
    const time = $('#audio-time');
    if (fill) fill.style.width = `${seconds / previewLength * 100}%`;
    if (time) time.textContent = `0:${String(Math.floor(seconds)).padStart(2, '0')} / 0:${previewLength}`;
    const status = $('#audio-status');
    if (status) status.textContent = isLoadingAudio ? 'Finding the recording…' : playing ? (continuousListening ? 'Continuous listening · playing now' : 'Listening in progress') : failedAudioId === current.id ? 'Stream unavailable — try another song or source' : 'Press play to sample this track';
  }
  // Recoverable failure controls belong to the discovery card, never the saved collection.
  const recovery=$('#preview-recovery');
  if(recovery && current) recovery.hidden = isLoadingAudio || failedAudioId !== current.id;
  const skipRecovery=$('#preview-skip');
  if(skipRecovery) skipRecovery.hidden=Boolean(challengeIds.length);
  // Tournament previews have their own, quiet status bar. Never accidentally
  // start continuous radio playback while the user is evaluating contenders.
  const duelStatus=$('#duel-now-playing');
  if(duelStatus && view==='duels') {
    const selected=duelTournaments.find(t=>t.id===selectedDuelId);
    const match=nextDuelMatch(selected);
    const contender=selected?.entries.find(t=>t.id===activeAudioId && [match?.a,match?.b].includes(t.id));
    // In Mystery Matchups neither the card nor the shared status bar may
    // disclose the track identity before the bracket is completed.
    const contenderLabel=isMysteryTournament(selected)
      ? (match?.a===contender?.id ? 'Mystery contender A' : 'Mystery contender B')
      : contender ? `${contender.artist} — ${contender.title}` : '';
    duelStatus.textContent=contender ? (isLoadingAudio ? `Loading ${contenderLabel}…` : audio.paused ? `Paused · ${contenderLabel}` : `♪ Playing ${contenderLabel}`) : '▶ Choose a contender to preview';
    const elapsed=contender?Math.min(previewLength,Number(audio.currentTime)||0):0;
    const time=$('#duel-preview-time');if(time)time.textContent=`0:${String(Math.floor(elapsed)).padStart(2,'0')} / 0:${previewLength}`;
    const fill=$('#duel-preview-fill');if(fill)fill.style.width=`${elapsed/previewLength*100}%`;
  }
  // Collection players share the same audio element, but no duplicate playback.
  document.querySelectorAll('[data-preview], [data-duel-play]').forEach((button) => {
    const id=button.dataset.preview || button.dataset.duelPlay;
    const playing=activeAudioId===id && !audio.paused;
    button.textContent=playing ? 'Ⅱ Pause' : button.dataset.duelPlay ? `▶ Preview ${button.closest('.duel-contender')?.querySelector('.duel-side-label')?.textContent?.slice(-1) || ''}` : '▶ Listen';
  });
}

audio.addEventListener('timeupdate', () => {
  if (lyricsEnabled) updateLyricView();
  if (audio.currentTime >= previewLength) {
    if (continuousListening && view === 'discover' && current?.id === activeAudioId && !modal) { advancePreview(); return; }
    audio.pause();
    try { audio.currentTime = previewLength; } catch { /* media unloaded */ }
  }
  updatePlaybackView();
});
audio.addEventListener('ended', () => { if (continuousListening) advancePreview(); });
audio.addEventListener('play', updatePlaybackView);
audio.addEventListener('pause', updatePlaybackView);
audio.addEventListener('error', async () => {
  if (!activeAudioId) return;
  const track = lookup(activeAudioId);
  const activeId = activeAudioId;
  if (track?.source === 'deezer' && !isLoadingAudio && !deezerRefreshedOnce.has(activeId)) {
    deezerRefreshedOnce.add(activeId);
    resolved.delete(activeId);
    const generation = audioGeneration;
    try {
      const fresh = await resolveAudio(track);
      if (activeAudioId !== activeId || generation !== audioGeneration) return;
      audio.src = fresh.url;
      await audio.play();
      failedAudioId = null;
      return;
    } catch (error) {
      console.warn('Deezer preview URL refresh failed:', error);
    }
  }
  if (track?.source === 'audius'  && !activeAudioFallback && !isLoadingAudio) {
    activeAudioFallback = true;
    try {
      const source = await resolveAudio(track);
      if (activeAudioId !== activeId) return;
      if (!source.fallbackUrl) throw new Error('No local stream fallback');
      audio.src = source.fallbackUrl;
      await audio.play();
      failedAudioId = null;
      return;
    } catch (error) {
      console.warn('Audius local stream fallback failed:', error);
    }
  }
  if (activeAudioId === activeId && !isLoadingAudio) {
    if(failedAudioId===activeId) return; // A failed media element can emit more than one error.
    failedAudioId = activeId;
    failedSources.add(activeId);
    toast(`${SOURCE_LABEL[track?.source] || 'Music provider'} could not deliver this audio.`);
    if (continuousListening && current?.id === activeId) {
      consecutivePlaybackFailures++;
      if (consecutivePlaybackFailures >= 3) { continuousListening = false; toast('Several tracks failed playback. Continuous listening stopped.'); }
      else advancePreview();
    }
    updatePlaybackView();
  }
});

function chooseNext() {
  if (challengeIds.length) {
    const completed = new Set(challengeResponses.map(item=>item.id));
    current = challengeIds.map(lookup).find(track=>track && !completed.has(track.id)) ?? null;
    return;
  }
  const feed=getFeed();
  const path=routeCandidates();
  const next=selectNext(path.tracks,state.history,state.genre,Math.random,{
    recentArtists:sessionArtists,artistAppearances,
  });
  current=next ? {...next,seedReason:feed.reasons.get(next.id) ||
    (searchQuery ? 'Your current search · not a lasting preference' : path.reason || PATH_DESCRIPTIONS[state.discoveryMix])} : null;
  if(next) {
    lastModeSwitchTrackId=null;
    sessionPosition++;
    sessionArtists.push(next.artist);
    if(sessionArtists.length>12) sessionArtists.shift();
    const artist=artistKey(next.artist);
    artistAppearances[artist]=(artistAppearances[artist] || 0)+1;
  }
}

/** Switching paths is a new listening lane, not a cosmetic ranking tweak.
 * Leave the saved collection untouched and let the new lane preload first. */
function changeDiscoveryPath(mode) {
  if (!['familiar','balanced','explore'].includes(mode) || state.discoveryMix===mode) return;
  lastModeSwitchTrackId=current?.id || null;
  // Clicking a discovery path exits any temporary artist/song search. Otherwise
  // every path would keep replaying the same searched artist, which makes the
  // modes appear identical even when their recommendation rules differ.
  const wasSearching=Boolean(searchQuery);
  searchQuery=''; searchDraft='';
  state.discoveryMix=mode;
  persist();
  stopContinuous();
  resetArtistRotation();
  current=null;
  const feed=getFeed();
  // Never fill the newly selected path from the global pool *before* the new
  // path has fetched its own artists. A loading card is less misleading than
  // pretending the same song was recommended by three different modes.
  if(feed.primed) chooseNext();
  render();
  if(wasSearching) toast('Search closed · loading your new discovery path.');
  if(!feed.primed || !availableCount(state.genre)) void loadMore(state.genre,false,true);
  if(mode!=='explore') void warmRelatedFromSaved(seedVersion);
}

function goTo(nextView) {
  setThemeMenuOpen(false);
  if (!['discover', 'collection', 'taste', 'challenges', 'quiz', 'duels'].includes(nextView)) return;
  if (modal) closeModal();
  stopContinuous();
  view = nextView;
  document.body.classList.remove('mobile-filters-open');
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function render() {
  updateChrome();
  const pages = createViews({ state, catalog, current, allGenres, challengeIds, challengeResponses, catalogWarning, catalogLive, collectionQuery, collectionSort,
    feed: { ...getFeed(), loading: getFeed().loading || (!getFeed().primed && !current), available: availableCount(state.genre) }, availableSources, searchQuery, sourceLabel: SOURCE_LABEL[state.source], seedInfo: playlistInfo(), quizSession, quizStats });
  const side = $('#sidebar-preferences');
  if (side) { side.innerHTML = view === 'discover' ? pages.renderSidebarPreferences() : ''; side.hidden = view !== 'discover'; side.classList.toggle('is-collapsed', sidebarFiltersCollapsed); const toggle = side.querySelector('[data-action=toggle-side-filters]'); if(toggle) {toggle.setAttribute('aria-expanded',String(!sidebarFiltersCollapsed));toggle.textContent = sidebarFiltersCollapsed ? '▸' : '▾';}}
  switch (view) {
    case 'collection': main.innerHTML = pages.renderCollection(); break;
    case 'taste': main.innerHTML = pages.renderTaste(); break;
    case 'challenges': main.innerHTML = pages.renderChallenges(); break;
    case 'quiz': main.innerHTML = pages.renderQuizLab(); break;
    case 'duels': main.innerHTML = renderDuels({tournaments:duelTournaments,selectedId:selectedDuelId,catalog,favorites:state.favorites,savedTracks:state.savedTracks,volume:state.volume,sound:state.sound,hallSeason}); break;
    default: main.innerHTML = pages.renderDiscovery();
  }
  applySavedVolume();
  updatePlaybackView();
  if (view === 'discover') {
    if (current && lyricsEnabled) void requestCurrentLyrics(current);
    updateLyricView();
  }
  if (view === 'discover' && current) prewarm(current);
  if (view === 'duels') refreshDuelAvailability();
  if (view === 'duels' && selectedDuelId) {
    const bracket=duelTournaments.find(t=>t.id===selectedDuelId);
    const match=nextDuelMatch(bracket);
    if (match) prewarm(bracket.entries.find(t=>t.id===match.a));
  }
}

function renderModal() {
  if (!modal) {
    modalRoot.innerHTML = '';
    $('.shell').inert = false;
    return;
  }
  $('.shell').inert = true;
  let body = '';
  const track = lookup(modal.id);
  if (modal.kind === 'youtube' && track) {
    const videoId = track.id.slice('youtube:'.length);
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return closeModal();
    const videoSrc = `https://www.youtube.com/embed/${videoId}?start=30&end=52&playsinline=1&autoplay=1`;
    body = `<div class="eyebrow">22-SECOND VIDEO PREVIEW / YOUTUBE</div><h2>${html(track.title)}</h2><p class="modal-copy">${html(track.artist)} · Uploaded by ${html(track.uploader || track.artist)}. YouTube may show ads before playback. If autoplay is blocked, press Play in the video.</p><div class="youtube-player-frame"><iframe src="${videoSrc}" width="560" height="315" title="YouTube preview: ${html(track.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div><p class="youtube-note">The official YouTube player stops at 0:52 (starts at 0:30). Native player controls and advertisements remain available. <a href="${urlSafe(track.link)}" target="_blank" rel="noopener noreferrer">Open original on YouTube ↗</a></p><div class="modal-actions">${modal.from === 'discover' ? '<button class="secondary-button" data-modal="yt-pass">× Pass</button><button class="accent-button" data-modal="yt-like">♡ Keep this song</button>' : '<button class="accent-button" data-modal="close">Close preview</button>'}</div>`;
  } else if (modal.kind === 'onboarding') {
    body = `<div class="eyebrow">WELCOME TO AFTERTONE / YOUR FIRST LISTEN</div><h2>Find music that sounds like you.</h2>
      <p class="modal-copy">Tell us <strong>five artists you love</strong>. They're just starting clues, not your whole feed. Balanced discovery focuses on related performers and broader music. You can also skip this or import a playlist.</p>
      <div class="intro-choice intro-choice-primary"><div class="intro-choice-title"><strong>01 · Pick your five favorites</strong><span>Any genre, any language. Add up to five unique artists. One is enough to start, but five gives us a better mix.</span></div>
        <div class="intro-artist-grid">${Array.from({length:FAVORITE_ARTIST_LIMIT},(_,i)=>`<label class="intro-artist-field" for="intro-artist-${i}"><span>ARTIST ${String(i+1).padStart(2,'0')}</span><input type="text" id="intro-artist-${i}" data-intro-artist="${i}" maxlength="75" autocomplete="off" placeholder="${['e.g. Harry Styles','e.g. Kacey Musgraves','e.g. Paramore','e.g. Bruno Mars','e.g. Billie Eilish'][i]}" value="${html(chosenArtists[i]||'')}" /></label>`).join('')}</div>
        <div class="intro-artist-actions"><span id="intro-artist-count" role="status" aria-live="polite">${chosenArtists.length} of ${FAVORITE_ARTIST_LIMIT} selected</span><button class="accent-button" data-modal="onboarding-artists">Find my music →</button></div>
      </div>
      <div class="intro-alternatives"><div class="intro-choice"><div class="intro-choice-title"><strong>02 · Start without favorites</strong><span>Build your taste from scratch through your swipes.</span></div><button class="secondary-button" data-modal="onboarding-fresh">Just discover →</button></div>
      <div class="intro-choice"><div class="intro-choice-title"><strong>03 · Import a playlist</strong><span>Use a Deezer link, CSV/JSON export, or paste songs you already love.</span></div><button class="secondary-button" data-modal="onboarding-playlist">Import playlist →</button></div></div>
      <p class="playlist-import-hint">The artists are stored locally. You can change your choice later under Personalization. Fresh discovery is the default each time you reopen AFTERTONE.</p>`;
  } else if (modal.kind === 'playlist') {
    const existing = playlistInfo();
    body = `<div class="eyebrow">OPTIONAL · YOUR MUSIC, YOUR RULES</div><h2>Teach AFTERTONE your taste.</h2><p class="modal-copy">Fresh discovery always comes first. Importing is optional and local to this browser. The songs you bring are used as clues to find <strong>different songs and related artists</strong>—not added automatically to your favorites.</p>
      <div class="playlist-import-panel"><label for="playlist-link">Import a playlist link</label>
      <div class="playlist-link-row"><input id="playlist-link" type="url" inputmode="url" autocomplete="url" placeholder="https://www.deezer.com/playlist/… or Spotify playlist URL" maxlength="2048" /><button class="secondary-button" type="button" data-modal="playlist-link-import">Import link</button></div>
      <p id="playlist-link-status" class="playlist-link-status" role="status" aria-live="polite">Public Deezer links import songs directly, with no account setup. Spotify URLs are recognized, but importing their track list requires authorization Spotify does not offer to this music game.</p>
      <label for="playlist-file">Choose a playlist CSV or JSON export</label><input id="playlist-file" type="file" accept=".csv,.json,.txt,text/csv,application/json,text/plain"/><p class="playlist-import-hint">For Spotify, export your own playlist as a CSV/JSON, or paste its artist–song list below. Spotify links alone cannot provide track details under the current platform rules.</p>
      <label for="playlist-paste">Or paste a list of songs</label><textarea id="playlist-paste" rows="6" placeholder="Paramore - Still Into You&#10;Charlie Puth - How Long&#10;The Weeknd - Blinding Lights"></textarea><p class="playlist-import-hint">One <strong>Artist - Song</strong> per line; CSVs with Track Name / Artist Name columns also work. Maximum 5,000 songs per import.</p></div>
      ${existing.ready ? `<p class="playlist-loaded-note">Saved in this browser: ${existing.count.toLocaleString()} songs from ${existing.artists.toLocaleString()} artists · ${existing.active ? 'Tailoring is active' : 'Not active until you choose it'}</p><div class="modal-actions"><button class="secondary-button" data-modal="playlist-clear">Delete saved import</button><button class="secondary-button" data-modal="playlist-use-saved">Use saved playlist</button></div>` : ''}
      <div class="modal-actions"><button class="secondary-button" data-modal="close">Maybe later · keep it fresh</button><button class="accent-button" data-modal="playlist-import">Import & tailor discovery ↗</button></div><p class="playlist-import-hint">Song names stay in your browser; when tailoring is active, selected artist names are sent to the locally running server for Deezer discovery and public related-artist lookups. You can switch back to fresh mode any time.</p>`;
  } else if (modal.kind === 'help') {
    body = `<div class="eyebrow">A QUICK INTRO</div><h2>Discover on your terms.</h2><p class="modal-copy">See the title, artist and cover before pressing Play to hear a 22-second preview. Swipe left (or press ←) to pass, or right (→) to keep it. Keeping a song saves it immediately and moves on. Play recognition games whenever you feel like it in Tune Lab.</p><div class="insight-list"><div class="insight"><strong>Blind mode is optional</strong><p>Use the switch in the left sidebar to hide the card title and artwork. The listening card hides the details until you choose.</p></div><div class="insight"><strong>Recognition is optional</strong><p>Tune Lab has optional recognition questions and mood ratings from songs you saved. Swipe decisions never require a quiz.</p></div><div class="insight"><strong>Start fresh or import a playlist</strong><p>Fresh discovery is always the default. Choose five artists, import a public Deezer playlist link, or bring a CSV/JSON export to add optional clues. Your initial artists do not dominate Balanced mode. Searching for a specific song is temporary; only your actual choices help shape the long-term taste profile.</p></div><div class="insight"><strong>Big catalogs, loaded in pages</strong><p>Deezer is the single visible discovery source. Its short-lived public preview links play directly in AFTERTONE. Press Play once to enable continuous discovery and Stop to end. Public game usage still requires permission from Deezer.</p></div></div><div class="sidebar-label" style="margin:22px 0 13px">PERSONALIZE YOUR ROOM</div><button class="secondary-button" data-modal="themes">Explore all 20 color themes →</button><div class="modal-actions"><button class="accent-button" data-modal="close">Let's listen →</button></div>`;
  } else if (modal.kind === 'themes') {
    body = `<div class="eyebrow">MAKE IT YOURS / 20 PALETTES</div><h2>Find your frequency.</h2><p class="modal-copy">Pick a look that feels right. Your choice saves automatically in this browser.</p><div class="theme-gallery" role="group" aria-label="Choose a color theme">${THEMES.map((t) => themeSwatch(t, true)).join('')}</div><div class="modal-actions"><button class="accent-button" data-modal="close">Done →</button></div>`;
  } else if (modal.kind === 'choice' && track) {
    if (modal.phase === 'familiarity') {
      body = `<div class="eyebrow">GOOD CALL. YOU KEPT IT.</div><h2>Was that a familiar sound?</h2><p class="modal-copy">Your reaction earns the track a place in your collection. The next question helps separate songs you already know from exciting new discoveries.</p><div class="modal-options"><button class="modal-option" data-modal="familiar"><span class="option-letter">↗</span><span>${state.blind || challengeIds.length ? 'I know this one. Quiz me!' : 'Yes, I already knew this song'}</span></button><button class="modal-option" data-modal="new"><span class="option-letter">✳</span><span>Never heard it. I'm into it, though.</span></button></div>`;
    } else if (modal.phase === 'quiz') {
      body = `<div class="eyebrow">PROVE YOUR EARS</div><h2>${html(modal.quiz.label)}</h2><p class="modal-copy">One mystery, four possibilities. Your correct answers count toward recognition, not whether the song deserves a spot in your favorites.</p><div class="modal-options">${modal.quiz.options.map((option, i) => `<button class="modal-option" data-answer="${i}"><span class="option-letter">${'ABCD'[i]}</span><span>${html(option)}</span></button>`).join('')}</div><div class="modal-actions"><button class="secondary-button" data-modal="skip-quiz">I can't remember</button></div>`;
    } else if (modal.phase === 'mood') {
      body = `<div class="eyebrow">A FIRST IMPRESSION</div><h2>What did that feel like?</h2><p class="modal-copy">No correct answer. Your instinct helps steer future discoveries.</p><div class="modal-options" style="grid-template-columns:1fr 1fr">${MOODS.slice(0, 8).map((mood) => `<button class="modal-option" data-mood="${html(mood)}"><span>${html(mood)}</span></button>`).join('')}</div><div class="modal-actions"><button class="secondary-button" data-modal="skip-mood">Just reveal it</button></div>`;
    } else if (modal.phase === 'reveal') {
      const scoreText = modal.recognized ? (modal.correct === true ? '✓ NICE CALL' : modal.correct === null ? '✓ YOU KNEW THIS ONE' : 'A NEW DETAIL LEARNED') : '✦ FRESH DISCOVERY';
      const preview = resolved.get(track.id);
      body = `<div class="eyebrow">THE BIG REVEAL</div><div class="reveal-art">${track.artwork ? `<img src="${urlSafe(track.artwork)}" alt="" />` : '♪'}</div><div class="reveal-result"><h2>${html(track.title)}</h2><span class="result-chip">${scoreText}</span></div><p class="reveal-artist">${html(track.artist)}</p><div class="tag-row">${tag(track.genre)}${tag(modal.mood || track.mood)}</div><div class="modal-actions"><button class="accent-button" data-modal="next">Save & next sound →</button>${track.link ? `<a class="secondary-button" href="${urlSafe(track.link)}" target="_blank" rel="noopener noreferrer">↗ Original source</a>` : ''}</div><div class="attribution">Music by ${html(track.artist)}. ${html(preview?.license || track.license)}. Listen from the original host. Check the linked file page for the complete license terms and credit requirements.</div>`;
    }
  }
  modalRoot.innerHTML = `<div class="modal ${modal.kind === 'themes' ? 'modal-themes' : modal.kind === 'youtube' ? 'modal-youtube' : modal.kind === 'onboarding' ? 'modal-onboarding' : ''}" role="dialog" aria-modal="true" aria-label="${modal.kind === 'help' ? 'How to play' : modal.kind === 'themes' ? 'Appearance themes' : modal.kind === 'onboarding' ? 'Set up your music taste' : modal.kind === 'youtube' ? 'YouTube music preview' : 'Music recognition challenge'}"><button class="modal-close" data-modal="close" aria-label="Close dialog">×</button>${body}</div>`;
  modalRoot.querySelector('button[data-modal],button[data-answer],button[data-mood]')?.focus();
}

async function findRelatedForPlaylist(version) {
  if (!activeSeedProfile() || !seedActive) return;
  relatedLookupStatus='searching'; render();
  // This work is non-blocking. Deezer charts are already playable while the
  // artist graph loads. Two concurrent lookups limit API pressure.
  const choices=activeSeedProfile()?.artists.slice(0,FAVORITE_ARTIST_LIMIT) || [];
  let nextIndex=0;
  const worker=async () => {
    while(nextIndex<choices.length && seedActive && version===seedVersion) {
      const candidate=choices[nextIndex++];
      try {
        const response=await apiFetch(`/api/related-artists?artist=${encodeURIComponent(candidate.artist)}`);
        if(!response.ok) continue;
        const data=await response.json();
        if (!seedActive || version!==seedVersion || !Array.isArray(data.related)) return;
        const next=mergeRelatedArtists(seedRelated,data.related,
          choices.map(a=>a.artist),candidate.artist);
        if(next.length>seedRelated.length) {
          seedRelated=next;
          const feed=getFeed();
          feed.hasMore=true;
          feed.emptyRefills=0;
          // New artists are fetched proactively, not buried behind old queues.
          void loadMore(state.genre,false,true);
          render();
        }
      } catch { /* A provider outage must never turn off fresh discovery. */ }
    }
  };
  await Promise.all(Array.from({length:Math.min(2,choices.length)},()=>worker()));
  if(seedActive && version===seedVersion) {
    relatedLookupStatus=seedRelated.length ? 'ready' : 'unavailable';
    render();
  }
}


/**
 * Repair an old-session empty graph: saved Keeps persist across browser restarts,
 * but network artist relationships do not. Resolve a few of the listener's
 * *saved* artists on demand instead of requiring another Keep first.
 * This runs in the background and deduplicates with on-Keep expansions.
 */
async function warmRelatedFromSaved(version) {
  const seeds=likedArtistLanes(state.history,5).map(x=>x.artist)
    .filter(name=>!expandedArtists.has(artistKey(name)));
  if(!seeds.length) return;
  await Promise.all(seeds.slice(0,3).map(async name=>{
    const key=artistKey(name);
    expandedArtists.add(key);
    try {
      const response=await apiFetch(`/api/related-artists?artist=${encodeURIComponent(name)}`);
      if(!response.ok || version!==seedVersion) return;
      const data=await response.json();
      if(!Array.isArray(data.related)) return;
      const next=mergeRelatedArtists(seedRelated,data.related,
        seedActive?(activeSeedProfile()?.artists.map(x=>x.artist)||[]):[],name);
      if(next.length<=seedRelated.length) return;
      seedRelated=next;
      // All path feeds use their own cursor sets; try the newly available
      // neighbors even if a former chart-only feed was exhausted.
      const feed=getFeed();feed.hasMore=true;feed.emptyRefills=0;feed.retryAt=0;
      void loadMore(state.genre,false,true);
      render();
    }catch{/* Offline graph data must never block playable chart discoveries. */}
  }));
}

/**
 * Explicit likes can grow the taste graph one hop at a time. Search alone
 * never triggers this; unfamiliar artists only influence future requests when
 * the listener deliberately keeps one of their recordings.
 */
async function expandRelatedFromLike(track,version) {
  if(track?.source!=='deezer' || version!==seedVersion) return;
  const artist=String(track.artist || '').trim();
  const norm=artistKey(artist);
  if(!norm || expandedArtists.has(norm) || expandedArtists.size >= 12) return;
  expandedArtists.add(norm);
  try {
    const response=await apiFetch(`/api/related-artists?artist=${encodeURIComponent(artist)}`);
    if(!response.ok || version!==seedVersion) return;
    const data=await response.json();
    if(!Array.isArray(data.related)) return;
    const starters=seedActive ? (activeSeedProfile()?.artists.map(a=>a.artist) || []) : [];
    const next=mergeRelatedArtists(seedRelated,data.related,starters,artist);
    if(next.length<=seedRelated.length) return;
    seedRelated=next;
    const feed=getFeed();
    feed.hasMore=true;
    feed.emptyRefills=0;
    if(!searchQuery) void loadMore(state.genre,false,true);
    render();
  } catch { /* Discovery continues even if the similar-artist API is down. */ }
}

function startPlaylistDiscovery() {
  if (!playlistProfile?.totalSongs) return toast('Import a playlist first.');
  if (!availableSources.includes('deezer')) return toast('Deezer discovery is temporarily unavailable.');
  seedActive = true; seedKind = 'playlist'; seedVersion++; seedRelated = []; relatedLookupStatus='idle'; expandedArtists.clear(); resetArtistRotation();
  state.source = availableSources.includes('deezer') ? 'deezer' : 'featured';
  state.genre = 'all'; state.language = 'all';
  searchQuery = ''; searchDraft = '';
  persist(); rememberSource(); stopContinuous(); current = null;
  modal = null; renderModal(); render(); void loadMore(state.genre, true);
  void findRelatedForPlaylist(seedVersion);
  toast(`Playlist discovery on · ${playlistProfile.totalSongs.toLocaleString()} songs, ${playlistProfile.artistCount} artists. Fresh mode remains one click away.`);
}
function updateArtistCount() {
  const counter=$('#intro-artist-count',modalRoot);
  if (!counter) return;
  const picked=parseFavoriteArtists([...modalRoot.querySelectorAll('[data-intro-artist]')].map(input=>input.value));
  counter.textContent=`${picked.length} of ${FAVORITE_ARTIST_LIMIT} selected`;
}
function startArtistDiscovery(artists=chosenArtists) {
  chosenArtists=parseFavoriteArtists(artists);
  if (!chosenArtists.length) return toast('Add at least one artist you love to begin.');
  try { localStorage.setItem(ARTISTS_STORAGE_KEY,JSON.stringify(chosenArtists)); } catch {}
  seedActive=true; seedKind='artists'; seedVersion++; seedRelated=[]; relatedLookupStatus='idle'; expandedArtists.clear(); resetArtistRotation();
  state.source='deezer'; state.genre='all'; state.language='all';
  searchQuery='';searchDraft='';stopContinuous();current=null;
  persist(); modal=null;renderModal();render();void loadMore(state.genre,true);
  void findRelatedForPlaylist(seedVersion);
  toast(`Finding songs based on ${chosenArtists.slice(0,3).join(', ')}${chosenArtists.length>3?' and more':''}. Switch to fresh anytime.`);
}
function startFreshDiscovery() {
  seedActive = false; seedVersion++; seedRelated = []; relatedLookupStatus='idle'; expandedArtists.clear(); resetArtistRotation();
  searchQuery=''; searchDraft=''; state.genre='all'; persist();
  stopContinuous(); current = null; chooseNext(); render(); maybeTopUp();
  toast('Fresh discovery is on. No artist or playlist seeds are active.');
}
function finishPlaylistImport(data) {
  // All import paths converge here; no favorites/history are modified.
  importedPlaylist = { tracks: data.tracks.slice(0, 3000) };
  playlistProfile = buildSeedProfile(importedPlaylist);
  saveImportedPlaylist(importedPlaylist);
  startPlaylistDiscovery();
}

async function importPlaylistFromDialog() {
  const file = $('#playlist-file', modalRoot)?.files?.[0];
  const pasted = $('#playlist-paste', modalRoot)?.value?.trim();
  if (file && file.size > 3_000_000) return toast('The file must be under 3 MB.');
  try { finishPlaylistImport(parsePlaylist(file ? await file.text() : pasted)); }
  catch (error) { toast(error.message); }
}

/** A link is resolved by our same-origin server, never fetched from a visitor URL directly. */
async function importPlaylistLinkFromDialog() {
  const link = $('#playlist-link', modalRoot)?.value?.trim();
  const status = $('#playlist-link-status', modalRoot);
  const button = $('[data-modal="playlist-link-import"]',modalRoot);
  if (!link) { if(status) {status.textContent='Paste a playlist link first.';status.classList.add('is-error');} return; }
  if (button) { button.disabled=true;button.textContent='Reading playlist…'; }
  if (status) {status.textContent='Checking the public playlist…';status.classList.remove('is-error');}
  try {
    const response=await apiFetch(`/api/playlist-link?url=${encodeURIComponent(link)}`);
    const result=await response.json();
    if (!response.ok || !Array.isArray(result.tracks) || !result.tracks.length) throw new Error(result.error || 'No songs available from this link.');
    // Modal may have been closed while the network request was in flight.
    if (modal?.kind !== 'playlist') return;
    finishPlaylistImport(result);
    toast(`Imported ${result.tracks.length.toLocaleString()} tracks from ${result.playlistTitle || 'Deezer'}${result.truncated ? ' (first 2,000)' : ''}.`);
  } catch(error) {
    if(status && modal?.kind==='playlist') { status.textContent=error.message;status.classList.add('is-error'); }
  } finally {
    if(button && modal?.kind==='playlist') {button.disabled=false;button.textContent='Import link';}
  }
}

function openModal(kind, extra = {}) {
  setThemeMenuOpen(false);
  modal = { kind, ...extra };
  audio.pause();
  renderModal();
}

function recordDecision(id, action, extra = {}) {
  if (challengeIds.length) challengeResponses.push({ id, action });
  const meta = lookup(id);
  state = recordChoice(state, { id, action, genre: meta?.genre, artist: meta?.artist, context: searchQuery ? 'search' : 'discovery', route: state.discoveryMix, ...extra });
  if (action === 'like') {
    const track = lookup(id);
    if (track && !state.savedTracks.some((t) => t.id === id)) state.savedTracks = [...state.savedTracks, track].slice(-1500);
    if (track) void expandRelatedFromLike(track,seedVersion);
  }
  persist();
  stopAudio();
  chooseNext();
  render();
  maybeTopUp();
  maybeResumeContinuous();
}

function closeModal() {
  if (!modal) return;
  if (modal.kind === 'onboarding') { try {localStorage.setItem(INTRO_STORAGE_KEY,'1');} catch {} }
  const wasChoice = modal.kind === 'choice';
  const choice = modal;
  modal = null;
  renderModal();
  if (wasChoice && choice.id) recordDecision(choice.id, 'like', { recognized: choice.recognized, correct: choice.correct, mood: choice.mood });
}

function acceptChoice(action) {
  if (view !== 'discover' || !current || modal || animatingChoice) return;
  animatingChoice = true;
  const selected = current.id;
  const card = $('#listening-card');
  if (card) {
    const stamp = $('#decision-stamp', card);
    if (stamp) { stamp.textContent = action === 'like' ? '♥' : 'NOPE'; stamp.dataset.feedback = action; }
    card.classList.add(action === 'like' ? 'swipe-like' : 'swipe-pass');
  }
  audio.pause();
  const finish = () => {
    animatingChoice = false;
    if (action === 'pass') recordDecision(selected, 'pass');
    else recordDecision(selected, 'like');
  };
  // One bounded timer per gesture; honor the reduced-motion preference.
  setTimeout(finish, matchMedia('(prefers-reduced-motion: reduce)').matches ? 15 : 190);
}

function handleModalAction(action) {
  if (!modal) return;
  if (action === 'close') return closeModal();
  if (modal.kind === 'onboarding') {
    try {localStorage.setItem(INTRO_STORAGE_KEY,'1');} catch {}
    if (action === 'onboarding-artists') return startArtistDiscovery(parseFavoriteArtists([...modalRoot.querySelectorAll('[data-intro-artist]')].map(input=>input.value)));
    if (action === 'onboarding-playlist') return openModal('playlist');
    if (action === 'onboarding-fresh') {modal=null;renderModal();return startFreshDiscovery();}
    return;
  }
  if (modal.kind === 'youtube') {
    if (['yt-pass','yt-like'].includes(action)) {
      const selected = modal.id;
      closeModal(); // Removes the iframe before continuing; no background YouTube playback.
      if (current?.id === selected) return acceptChoice(action === 'yt-like' ? 'like' : 'pass');
    }
    return;
  }
  if (modal.kind === 'playlist') {
    if (action === 'playlist-import') { void importPlaylistFromDialog(); return; }
    if (action === 'playlist-link-import') { void importPlaylistLinkFromDialog(); return; }
    if (action === 'playlist-use-saved') return startPlaylistDiscovery();
    if (action === 'playlist-clear') {
      importedPlaylist = null; playlistProfile = null; seedRelated = []; seedActive = false; seedVersion++; relatedLookupStatus='idle'; expandedArtists.clear(); resetArtistRotation();
      saveImportedPlaylist(null); closeModal(); stopContinuous(); current = null; chooseNext(); render(); maybeTopUp(); toast('Saved playlist deleted. Fresh mode is active.'); return;
    }
    return;
  }
  if (modal.kind === 'help' || modal.kind === 'themes') { if (action === 'themes') openModal('themes'); return; }
  const track = lookup(modal.id);
  if (!track) return closeModal();
  switch (action) {
    case 'familiar': modal.recognized = true; if (state.blind || challengeIds.length) { modal.quiz = makeRecognitionQuiz(track, catalog); modal.phase = 'quiz'; } else { modal.phase = 'reveal'; } break;
    case 'new': modal.recognized = false; modal.phase = 'mood'; break;
    case 'skip-quiz': modal.correct = false; modal.phase = 'reveal'; break;
    case 'skip-mood': modal.phase = 'reveal'; break;
    case 'next': return closeModal();
    default: return;
  }
  renderModal();
}

function startQuizRound() {
  const ids=state.favorites.filter(id=>Boolean(lookup(id)));
  if (!ids.length) {quizSession=null; render(); return;}
  const candidates = ids.filter(id=>id!==quizSession?.id);
  const chosen = (candidates.length ? candidates : ids)[Math.floor(Math.random()*(candidates.length||ids.length))];
  quizSession={id:chosen,quiz:makeRecognitionQuiz(lookup(chosen),catalog),answer:null,mood:null};
  render();
}

function playSampleChallenge() {
  challengeIds = catalog.slice(0, 5).map((track) => track.id);
  challengeResponses = [];
  history.replaceState(null, '', `${location.pathname}?challenge=${encodeURIComponent(encodeChallenge(challengeIds))}`);
  current = null;
  chooseNext();
  goTo('discover');
  toast('Sample challenge activated. Five blind tracks await.');
}

async function shareChallenge() {
  const ids = state.favorites.slice().reverse().filter((id) => lookup(id) && /^(audius|jamendo|commons):/.test(id)).slice(0, 5);
  if (!ids.length) return toast('Save an Audius, Jamendo or Commons song to make a blind challenge. YouTube videos and private Jellyfin files are excluded.');
  const value = encodeChallenge(ids);
  const link = new URL(location.href);
  link.searchParams.set('challenge', value);
  await copy(link.toString(), 'Challenge link copied. Send it to a friend!');
}

async function copy(value, message) {
  try {
    await navigator.clipboard.writeText(value);
    toast(message);
  } catch {
    // Browser clipboard permissions vary, particularly on non-HTTPS hosting.
    const input = document.createElement('textarea');
    input.value = value;
    input.style.position = 'fixed'; input.style.opacity = '0';
    document.body.append(input); input.select();
    const copied = document.execCommand('copy');
    input.remove();
    toast(copied ? message : 'Could not copy automatically. Check your browser clipboard permissions.');
  }
}

/** Music Duels are independent of swipe ratings. A vote advances a bracket;
 * it never counts as a Like, Pass, or playlist recommendation signal. */
/** Write before mutating the in-memory bracket. A failed save must never
 * imply the vote or tournament will survive a page refresh.
 */
function writeDuelArchive(next=duelTournaments) {
  if(!saveDuelStore(localStorage,next)) {
    toast('Unable to save this tournament. Check browser storage before continuing.');
    return false;
  }
  duelTournaments=next;
  return true;
}
function setDuelSelection(id) {
  selectedDuelId=id;
  saveDuelSelection(localStorage,id);
}
function duelTrack(id) {
  return lookup(id) || duelTournaments.flatMap(t=>t.entries).find(t=>t.id===id) || null;
}
function randomizeTracks(tracks) {
  const shuffled=[...tracks];
  for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
  return shuffled;
}
/** Include saved songs that were discovered in earlier browser sessions. */
function duelSongPool() {
  return [...new Map([...catalog,...(state.savedTracks||[])].filter(t=>t?.source==='deezer' && t?.id && t?.title && t?.artist).map(t=>[t.id,t])).values()];
}
/** Updates eligibility without rerendering form fields as the user types. */
function refreshDuelAvailability() {
  const size=Number($('#duel-size')?.value||8);
  const themeId=$('#duel-theme-choice')?.value||'open';
  const poolKind=$('#duel-pool')?.value||'all';
  const music=duelSongPool();
  const tracks=poolKind==='favorites'?music.filter(t=>state.favorites.includes(t.id)):music;
  const result=tournamentAvailability({themeId,tracks,favoriteIds:state.favorites,size});
  const label=$('#duel-eligibility');
  if(label){label.textContent=result.message;label.classList.toggle('is-ready',result.ready);}
  const submit=$('[data-duel-action="create"]');
  if(submit){submit.disabled=!result.ready;submit.setAttribute('aria-describedby','duel-eligibility');}
  const help=$('[data-duel-action="discover-more"]');
  if(help)help.hidden=result.ready;
  document.querySelectorAll('[data-duel-theme]').forEach(button=>{
    const arena=button.dataset.duelTheme;
    const availability=tournamentAvailability({themeId:arena,tracks,favoriteIds:state.favorites,size});
    const status=button.querySelector('[data-duel-status]');
    if(status){
      status.textContent=tournamentStatusLabel(availability,arena,size);
      status.dataset.ready=String(availability.ready);
    }
    const selected=arena===themeId;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
}
function registerTournament(event) {
  if (duelTournaments.length>=40) {
    toast('The tournament archive is full (40). Delete an old event to create another.');
    return;
  }
  if(!writeDuelArchive([...duelTournaments,event]))return;
  setDuelSelection(event.id);
  stopContinuous();render();
  document.querySelector('#duel-active-event')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function createDuelId() {
  return 'duel_'+crypto.randomUUID().replaceAll('-','').slice(0,24);
}
function exportDuelPodium(event) {
  const blob=new Blob([podiumCsv(event)],{type:'text/csv;charset=utf-8'});
  const href=URL.createObjectURL(blob);
  const anchor=document.createElement('a'); anchor.href=href;
  anchor.download=`aftertone-${event.kind==='champions'?'champions':'podium'}-${event.id.slice(-8)}.csv`;
  document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(href),200);
  toast('Podium playlist CSV exported.');
}
function handleDuelAction(action, id=null) {
  const selected=duelTournaments.find(t=>t.id===selectedDuelId);
  if(action==='discover-more')return goTo('discover');
  if(action==='create') {
    const size=Number($('#duel-size')?.value||8);
    if(![4,8,16].includes(size)) return;
    const themeId=$('#duel-theme-choice')?.value||'open';
    const poolKind=$('#duel-pool')?.value||'all';
    const music=duelSongPool();
    const pool=poolKind==='favorites'?music.filter(t=>state.favorites.includes(t.id)):music;
    try {
      const tracks=pickThemedEntries({themeId,tracks:pool,favoriteIds:state.favorites,size});
      registerTournament(createTournament({id:createDuelId(),name:$('#duel-name')?.value||`${tournamentTheme(themeId).name} · ${new Date().toLocaleDateString()}`,themeId,tracks}));
    } catch(error){toast(error.message);}
    return;
  }
  if(action==='export-hall') {
    const csv=hallOfFameCsv(duelTournaments,hallSeason);
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    const href=URL.createObjectURL(blob);
    const anchor=document.createElement('a');anchor.href=href;
    anchor.download=`aftertone-hall-of-fame-${hallSeason.replaceAll(' ','-')}.csv`;
    document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(href),200);
    return toast('Hall of Fame leaderboard exported.');
  }
  if(action==='save-champions') {
    const winners=hallOfFame(duelTournaments).filter(t=>t.gold>0);
    let added=0;
    for(const track of winners) {
      if(!catalogIds.has(track.id))addToCatalog([track]);
      if(!state.favorites.includes(track.id)){state.favorites.push(track.id);added++;}
      if(!state.savedTracks.some(t=>t.id===track.id))state.savedTracks.push(track);
    }
    state.favorites=state.favorites.slice(-5000);
    state.savedTracks=state.savedTracks.slice(-1500);
    persist();render();return toast(added?`${added} champions added to your Collection.`:'All champions are already saved.');
  }
  if(action==='create-cup') {
    const champions=availableChampions(duelTournaments);
    const size=[16,8,4,2].find(n=>champions.length>=n);
    if(!size) return toast('Finish at least two tournaments with different winners.');
    try {registerTournament(createTournament({id:createDuelId(),name:`Champions Cup · ${new Date().toLocaleDateString()}`,kind:'champions',tracks:randomizeTracks(champions).slice(0,size)}));}
    catch(error){toast(error.message);}
    return;
  }
  if(action==='open') {if(!duelTournaments.some(t=>t.id===id))return;setDuelSelection(id);stopAudio();render();return;}
  if(action==='dismiss') {setDuelSelection(null);stopAudio();render();return;}
  if(action==='delete') {
    const event=duelTournaments.find(t=>t.id===id);
    if(!event || !confirm(`Delete tournament “${event.name}”? This cannot be undone.`)) return;
    if(!writeDuelArchive(duelTournaments.filter(t=>t.id!==id)))return;
    if(selectedDuelId===id)setDuelSelection(null);
    stopAudio();render();return;
  }
  const event=duelTournaments.find(t=>t.id===id);
  if(!event || event.status!=='complete')return;
  if(action==='export-podium')return exportDuelPodium(event);
  if(action==='save-podium') {
    const entries=podiumTracks(event);
    for(const track of entries) {
      if(!catalogIds.has(track.id))addToCatalog([track]);
      if(!state.favorites.includes(track.id))state.favorites.push(track.id);
      if(!state.savedTracks.some(t=>t.id===track.id))state.savedTracks.push(track);
    }
    // Respect the original storage cap; podium rankings stay in the archive.
    state.favorites=state.favorites.slice(-5000);
    state.savedTracks=state.savedTracks.slice(-1500);
    persist();render();return toast('The podium tracks are in your Collection.');
  }
}
function voteActiveDuel(winnerId) {
  const index=duelTournaments.findIndex(t=>t.id===selectedDuelId);
  if(index<0)return;
  const match=nextDuelMatch(duelTournaments[index]);
  if(!match)return;
  try {
    const updated=voteDuel(duelTournaments[index],match.id,winnerId);
    if(!writeDuelArchive(duelTournaments.map((event,i)=>i===index?updated:event)))return;
    stopAudio();render();
    if(updated.status==='complete') toast('Tournament complete! Your podium is ready.');
    else if(match.stage==='third')toast('Bronze decided. Time for the grand final!');
    else toast('Winner advances!');
  }catch(error){toast(error.message);}
}

function exportLibrary(type = 'json') {
  const items = state.favorites.map(lookup).filter(Boolean);
  if (!items.length && type === 'csv') return toast('Save a track first.');
  const data = type === 'json'
    ? JSON.stringify({ exportVersion: 1, exportedAt: new Date().toISOString(), tracks: items, history: state.history }, null, 2)
    : ['Title,Artist,Genre,Mood,Source URL', ...items.map((item) => [item.title, item.artist, item.genre, item.mood, item.link].map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))].join('\n');
  const blob = new Blob([data], { type: type === 'json' ? 'application/json' : 'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = href; anchor.download = `aftertone-collection.${type}`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(href), 200);
  toast('Export created.');
}

/** The backup file contains only metadata and local choices, never audio. */
function downloadProgressBackup() {
  try {
    const payload=createProgressBackup(localStorage);
    const blob=new Blob([payload],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;
    anchor.download='aftertone-progress-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('Progress backup downloaded. Keep the file somewhere safe.');
  } catch(error) {
    toast(error.message || 'Could not create a progress backup.');
  }
}
async function importProgressBackupFile(file) {
  try {
    if(file.size>BACKUP_MAX_BYTES)throw new Error('Backup must be smaller than 4 MB.');
    const content=await file.text();
    const preview=inspectProgressBackup(content).summary;
    const optional=preview.version===1
      ? 'This older backup does not contain imported playlists or lyric timing adjustments. Those existing settings will stay unchanged.'
      : 'Also restore '+preview.playlistTracks+' imported playlist tracks and '+
        preview.lyricOffsets+' lyric timing adjustments.';
    const message='Restore '+preview.favorites+' saved tracks, '+preview.decisions+
      ' listening choices, and '+preview.tournaments+' tournaments?\n\n'+optional+'\n\n'+
      'This replaces your current AFTERTONE progress. Export a backup of your current progress first.';
    if(!window.confirm(message))return;
    restoreProgressBackup(localStorage,content);
    stopAudio();
    window.location.reload(); // Rehydrate the existing app from the validated saved state.
  } catch(error) {
    toast(error.message || 'Could not restore backup. No changes were made.');
  }
}

// Native artwork can expire or be blocked by the host. Never show a broken image.
// Removing it reveals the styled, honest "no artwork" fallback underneath.
document.addEventListener('error', (event) => {
  const target = event.target;
  if (target instanceof HTMLImageElement && target.matches('.current-cover-img, .tile-art img, .reveal-art img')) target.remove();
}, true);

// Event delegation avoids listener buildup across re-renders and page transitions.
document.addEventListener('click', async (event) => {
  const toggleTheme = event.target.closest('#theme-menu-toggle');
  if (toggleTheme) { setThemeMenuOpen($('#theme-menu')?.hidden); return; }
  const theme = event.target.closest('[data-set-theme]');
  if (theme) {
    if (THEME_IDS.includes(theme.dataset.setTheme)) {
      state.theme = theme.dataset.setTheme;
      persist(); updateChrome();
      if (modal?.kind === 'themes') renderModal();
      setThemeMenuOpen(false, true);
    }
    return;
  }
  if (!event.target.closest('#theme-picker')) setThemeMenuOpen(false);
  if (event.target.closest('[data-open-themes]')) return openModal('themes');
  const duelTheme=event.target.closest('[data-duel-theme]');
  if(duelTheme && view==='duels') {
    const hidden=$('#duel-theme-choice');
    if(hidden){hidden.value=duelTheme.dataset.duelTheme;refreshDuelAvailability();}
    return;
  }
  const duelPreview=event.target.closest('[data-duel-play]');
  if(duelPreview && view==='duels')return togglePlayback(duelTrack(duelPreview.dataset.duelPlay));
  const duelVote=event.target.closest('[data-duel-vote]');
  if(duelVote && view==='duels')return voteActiveDuel(duelVote.dataset.duelVote);
  const duelAction=event.target.closest('[data-duel-action]');
  if(duelAction && view==='duels')return handleDuelAction(duelAction.dataset.duelAction,duelAction.dataset.duelId);
  const navButton = event.target.closest('[data-view]');
  if (navButton) return goTo(navButton.dataset.view);
  const modalButton = event.target.closest('[data-modal]');
  if (modalButton) return handleModalAction(modalButton.dataset.modal);
  const answer = event.target.closest('[data-answer]');
  if (answer && modal?.phase === 'quiz') {
    modal.correct = modal.quiz.options[Number(answer.dataset.answer)] === modal.quiz.correct;
    modal.phase = 'reveal';
    renderModal();
    return;
  }
  const moodButton = event.target.closest('[data-mood]');
  if (moodButton && modal?.phase === 'mood') {
    modal.mood = moodButton.dataset.mood;
    modal.phase = 'reveal';
    renderModal();
    return;
  }
  const quizAnswer = event.target.closest('[data-quiz-answer]');
  if (quizAnswer && view === 'quiz' && quizSession?.answer === null) {
    const answer=Number(quizAnswer.dataset.quizAnswer);
    if (!Number.isInteger(answer) || answer<0 || answer>=quizSession.quiz.options.length) return;
    quizSession.answer=answer;
    quizStats.answered++;
    if(quizSession.quiz.options[answer] === quizSession.quiz.correct) quizStats.correct++;
    try {localStorage.setItem(quizStorageKey,JSON.stringify(quizStats));} catch {}
    return render();
  }
  const quizMood=event.target.closest('[data-quiz-mood]');
  if(quizMood && view==='quiz' && quizSession?.answer!==null) {
    const mood=quizMood.dataset.quizMood;
    if (!MOODS.includes(mood)) return;
    quizSession.mood=mood;
    // A mood check-in is optional and updates your taste without another like.
    state.history = state.history.map(h=>h.id===quizSession.id ? {...h,mood} : h);
    persist(); return render();
  }
  const preview = event.target.closest('[data-preview]');
  if (preview) return togglePlayback(lookup(preview.dataset.preview));
  const path=event.target.closest('[data-path]');
  if(path && ['familiar','balanced','explore'].includes(path.dataset.path)) {
    changeDiscoveryPath(path.dataset.path); // Distinct request and presentation pools.
    return;
  }
  const action = event.target.closest('[data-action]');
  if (!action) return;
  const id = action.dataset.id;
  switch (action.dataset.action) {
    case 'play-current': return togglePlayback(current);
    case 'retry-preview': return retryFailedPreview();
    case 'skip-unavailable': return skipUnavailablePreview();
    case 'focus-music-search': {
      if(view!=='discover') goTo('discover');
      document.body.classList.add('mobile-filters-open');
      $('#mobile-refine-toggle')?.setAttribute('aria-expanded','true');
      sidebarFiltersCollapsed=false;
      $('#sidebar-preferences')?.classList.remove('is-collapsed');
      $('#sidebar-preferences [data-action="toggle-side-filters"]')?.setAttribute('aria-expanded','true');
      const input=$('#music-search');
      if(!input) return;
      const body=$('#sidebar-filter-body');
      if(body?.hidden) body.hidden=false;
      input.scrollIntoView({behavior:'smooth',block:'center'});
      input.focus({preventScroll:true});
      return;
    }
    case 'import-playlist': return openModal('playlist');
    case 'open-intro': return openModal('onboarding');
    case 'use-saved-artists': return startArtistDiscovery(chosenArtists);
    case 'use-saved-playlist': return startPlaylistDiscovery();
    case 'fresh-discovery': return startFreshDiscovery();
    case 'stop-session': return stopContinuous();
    case 'lyrics-toggle':
      lyricsEnabled=!lyricsEnabled;
      if(!lyricsEnabled) {lyricTrackId=null;lyricPayload=null;lyricsRequestVersion++;}
      updateLyricView();
      if(lyricsEnabled && current) void requestCurrentLyrics(current);
      return;

    case 'load-more':
      // User-initiated retry recovers providers disabled after temporary errors.
      if (!getFeed().hasMore) { getFeed().exhausted.clear(); getFeed().hasMore = true; }
      return loadMore(state.genre, true);
    case 'toggle-blind': state.blind = !state.blind; persist(); return render();
    case 'passport-route': {
      const route = action.dataset.route;
      if (route === 'quiz') return goTo('quiz');
      if (route === 'discover') {
        if (view !== 'discover') return goTo('discover');
        $('#listening-card')?.scrollIntoView({behavior:'smooth',block:'center'});
        return;
      }
      if (['balanced','familiar','explore'].includes(route)) changeDiscoveryPath(route);
      return;
    }
    case 'toggle-side-filters': sidebarFiltersCollapsed = !sidebarFiltersCollapsed; return render();
    case 'quiz-start': return startQuizRound();
    case 'quiz-next': return startQuizRound();
    case 'use-mainstream':
      state.source = availableSources.includes('deezer') ? 'deezer' : 'featured'; state.discovery = 'hits'; rememberSource();
      persist(); stopContinuous(); current = null; chooseNext(); render(); maybeTopUp(); return;
    case 'reset-discovery-filters':
      // Only reset narrowed catalog filters; don't erase Keeps, history, or seed artists.
      state.genre='all'; state.language='all'; state.era='any';
      persist(); stopContinuous(); current=null;
      render(); void loadMore(state.genre,true);
      return;
    case 'clear-search': searchQuery = ''; searchDraft = ''; stopContinuous(); chooseNext(); render(); return maybeTopUp();
    case 'pass': return acceptChoice('pass');
    case 'like': return acceptChoice('like');
    case 'undo':
      if (challengeIds.length || !state.history.length) return;
      const lastId = state.history.at(-1).id; state = restoreLastChoice(state); persist(); stopContinuous(); current = lookup(lastId) || selectNext(catalog, state.history, state.genre); render(); return toast('Last choice undone.');
    case 'remove-favorite': state = removeFavorite(state, id); persist(); render(); return toast('Removed from collection.');
    case 'export-json': return exportLibrary('json');
    case 'export-csv': return exportLibrary('csv');
    case 'backup-progress': return downloadProgressBackup();
    case 'restore-progress': return $('#progress-backup-file')?.click();
    case 'share-challenge': return shareChallenge();
    case 'try-challenge': return playSampleChallenge();
    case 'exit-challenge': challengeIds = []; challengeResponses = []; history.replaceState(null, '', location.pathname); chooseNext(); return render();
    case 'reset-listens':
      if (!confirm('Restart discovery? Saved favorites will stay, but listening history and recognition scores will be cleared.')) return;
      state = { ...state, history: [] }; persist(); chooseNext(); return render();
    default: return;
  }
});

nav.addEventListener('click', (event) => { if (event.target.closest('[data-view]')) event.preventDefault(); });
$('#sound-toggle').addEventListener('click', () => { state = toggleMuteSetting(state); persist(); updateChrome(); });

// `input` fires continuously while the user drags, without re-rendering the
// card (which would interrupt the pointer gesture or playback).
main.addEventListener('input', (event) => {
  if (!event.target.matches('[data-volume-slider]')) return;
  state = updateVolumeSetting(state, event.target.value);
  persist();
  updateChrome(); // Sync navbar mute with the new level.
});
$('#help-button').addEventListener('click', () => openModal('help'));
$('#mobile-refine-toggle').addEventListener('click', () => {const opened=document.body.classList.toggle('mobile-filters-open'); $('#mobile-refine-toggle').setAttribute('aria-expanded',String(opened));});
$('.brand').addEventListener('click', (event) => { event.preventDefault(); goTo('discover'); });

main.addEventListener('error', (event) => {
  if (event.target.matches?.('.current-cover-img')) event.target.remove();
}, true);

document.addEventListener('change', (event) => {
  if(event.target.id==='progress-backup-file') {
    const file=event.target.files?.[0];
    event.target.value=''; // Allow selecting the same file after a failed attempt.
    if(file)void importProgressBackupFile(file);
    return;
  }
  if(view==='duels' && ['duel-size','duel-pool'].includes(event.target.id)) {
    refreshDuelAvailability();return;
  }
  if(view==='duels' && event.target.id==='duel-season') {
    hallSeason=event.target.value;stopAudio();render();return;
  }

  if (event.target.id === 'source-select') {
    if (seedActive) { seedActive = false; seedVersion++; seedRelated = []; relatedLookupStatus='idle'; expandedArtists.clear(); resetArtistRotation(); toast('Switched to fresh discovery; imported seeds are no longer applied.'); }
    state.source = 'deezer';
    if (state.source === 'charts') { state.genre = 'all'; state.era = 'any'; }
    rememberSource();
    persist(); stopContinuous(); chooseNext(); render(); maybeTopUp();
  }
  if (event.target.id === 'genre-select') {
    if (seedActive) { seedActive = false; seedVersion++; seedRelated = []; relatedLookupStatus='idle'; expandedArtists.clear(); resetArtistRotation(); toast('Switched to fresh genre discovery.'); }
    state.genre = allGenres.includes(event.target.value) ? event.target.value : 'all';
    if (state.source === 'charts' && state.genre !== 'all') { state.source = 'youtube'; toast('Genre filtering uses official-artist YouTube discovery. Global charts do not tag songs by genre.'); }
    persist(); stopContinuous(); chooseNext(); render(); maybeTopUp();
  }
  if (event.target.id === 'discovery-mix-select') {
    changeDiscoveryPath(event.target.value); return;
  }
  if (event.target.id === 'language-select') {
    state.language = ['en','en-strict','all','es','fr','pt','de','it','ja','ko','zh','hi','ar','ru'].includes(event.target.value) ? event.target.value : 'all';
    persist(); stopContinuous(); current = null; chooseNext(); render(); maybeTopUp();
  }
  if (event.target.id === 'era-select') {
    if (state.source === 'charts' && event.target.value !== 'any') { state.source = 'youtube'; toast('Decade filtering uses YouTube artist discovery. Global charts do not include release dates.'); }
    state.era = ['any','1980s','1990s','2000s','2010s','2020s'].includes(event.target.value) ? event.target.value : 'any';
    persist(); stopContinuous(); current = null; chooseNext(); render(); maybeTopUp();
  }
  if (event.target.id === 'discovery-select') {
    state.discovery = ['hits','variety'].includes(event.target.value) ? event.target.value : 'hits';
    persist(); stopContinuous(); current = null; chooseNext(); render(); maybeTopUp();
  }
  if (event.target.id === 'sort-select') { collectionSort = event.target.value; render(); }
});
document.addEventListener('submit', (event) => {
  if (event.target.id !== 'music-search-form') return;
  event.preventDefault();
  searchQuery = ($('#music-search')?.value || '').trim().slice(0, 90);
  searchDraft = searchQuery;
  stopContinuous(); current = null; render(); void loadMore(state.genre, true);
});
document.addEventListener('input', (event) => {
  if (event.target.id === 'lyrics-offset' && current) {
    storeLyricOffset(current,event.target.value);
    updateLyricView();
  }
  if (event.target.id === 'music-search') searchDraft = event.target.value;
  if (event.target.matches('[data-intro-artist]')) updateArtistCount();

  if (event.target.id === 'collection-search') {
    const focusPosition = event.target.selectionStart;
    collectionQuery = event.target.value;
    render();
    const input = $('#collection-search');
    if (input) { input.focus(); input.setSelectionRange(focusPosition, focusPosition); }
  }
});

window.addEventListener('keydown', (event) => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if (event.key === 'Escape' && !$('#theme-menu')?.hidden) { event.preventDefault(); return setThemeMenuOpen(false,true); }
  if (event.key === 'Escape' && modal) return closeModal();
  if (typing || modal) return;
  if(view==='duels') {
    const match=nextDuelMatch(duelTournaments.find(t=>t.id===selectedDuelId));
    if(match && ['1','2'].includes(event.key)) {event.preventDefault();voteActiveDuel(event.key==='1'?match.a:match.b);}
    return;
  }
  if(view !== 'discover') return;
  if (event.key.toLowerCase() === 'b') { event.preventDefault(); state.blind = !state.blind; persist(); render(); return; }
  if (event.key === 'ArrowLeft') { event.preventDefault(); acceptChoice('pass'); }
  if (event.key === 'ArrowRight') { event.preventDefault(); acceptChoice('like'); }
  if (event.code === 'Space') { event.preventDefault(); togglePlayback(current); }
});

// Gestures follow the pointer, reveal the stamp, then animate offscreen.
// Vertical scrolling stays native; the final decision only happens after a threshold.
main.addEventListener('pointerdown', (event) => {
  if (modal || animatingChoice || view !== 'discover' || !current || !event.target.closest('#listening-card') || event.target.closest('button, input, select, textarea, label, a, [data-volume-slider]')) return;
  pointerStart = { x: event.clientX, y: event.clientY, pointer: event.pointerId };
});
main.addEventListener('pointermove', (event) => {
  if (!pointerStart || pointerStart.pointer !== event.pointerId) return;
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  const card = $('#listening-card');
  if (!card || Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
  const bounded = Math.max(-170, Math.min(170, dx));
  card.classList.add('dragging');
  card.style.transform = `translateX(${bounded}px) rotate(${bounded * .035}deg)`;
  const stamp = $('#decision-stamp', card);
  if (stamp) {
    stamp.textContent = dx > 0 ? '♥' : 'NOPE';
    stamp.dataset.feedback = dx > 0 ? 'like' : 'pass';
    stamp.style.opacity = String(Math.min(1, Math.max(0, (Math.abs(dx) - 12) / 85)));
  }
});
main.addEventListener('pointerup', (event) => {
  if (!pointerStart || pointerStart.pointer !== event.pointerId) return;
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  pointerStart = null;
  const card = $('#listening-card');
  if (card) {
    card.classList.remove('dragging');
    card.style.transform = '';
    $('#decision-stamp', card)?.style.removeProperty('opacity');
  }
  if (Math.abs(dx) > 75 && Math.abs(dx) > Math.abs(dy) * 1.6) acceptChoice(dx > 0 ? 'like' : 'pass');
});
main.addEventListener('pointercancel', () => {
  pointerStart = null;
  const card = $('#listening-card');
  if (card) { card.classList.remove('dragging'); card.style.transform = ''; }
  $('#decision-stamp', card || main)?.style.removeProperty('opacity');
});

async function init() {
  main.innerHTML = `<div class="eyebrow">THE LISTENING ROOM</div><h1>Finding the <em>frequency...</em></h1><p class="lead">Tuning the record shelf.</p>`;
  try {
    const response = await apiFetch('/api/catalog');
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const payload = await response.json();
    starterShelf = Array.isArray(payload.tracks) ? payload.tracks : [];
    addToCatalog(state.savedTracks);
    // Restore all tournament entrants, even if the discovery catalog changed.
    // Deezer IDs resolve to fresh short-lived previews when played.
    for(const event of duelTournaments) addToCatalog(event.entries);
    availableSources = ['deezer'];
    state.source = 'deezer';
    // Existing sessions using the old audio mix were unintentionally presented
    // as Familiar Hits, although it never contained YouTube. Migrate that one
    // default only when a YouTube key exists and hits are requested. Keep an
    // explicit independent-music preference on subsequent starts.
    if (availableSources.includes('charts') && state.source === 'mix' && state.discovery === 'hits' && !sourceRemembered()) {
      state.source = 'charts'; state.genre = 'all'; persist();
    }
    // v0.4 first-run upgrade: do not present an independent upload mix as
    // mainstream discovery. One-time migration, not a permanent lock.
    try {
      if (!localStorage.getItem('aftertone:default-hits-migration:v040')) {
        if (availableSources.includes('charts') && state.source === 'mix' && state.discovery === 'hits') {
          state.source = 'charts'; state.genre = 'all'; persist();
        }
        localStorage.setItem('aftertone:default-hits-migration:v040','1');
      }
    } catch { /* Storage restricted; keep selected source. */ }
    // v0.4.1: one-time repair for installs unintentionally stranded on
    // independent/Commons music while the user requested Familiar hits.
    try {
      if (!localStorage.getItem('aftertone:mainstream-source-repair:v041')) {
        if (['mix','commons','audius'].includes(state.source) && state.discovery === 'hits') {
          state.source = availableSources.includes('youtube') ? 'youtube' : 'featured';
          state.genre = 'all'; persist();
        }
        localStorage.setItem('aftertone:mainstream-source-repair:v041','1');
      }
    } catch { /* Private browsing may disable storage. */ }
    // First-run ad-free upgrade: when a personal audio library exists, the
    // familiar-song feed uses it instead of forcing ads/unplayable YouTube embeds.
    try {
      if (availableSources.includes('library-hits') && !localStorage.getItem('aftertone:adfree-library-upgrade:v042')) {
        if (availableSources.includes('library-hits') && ['featured','youtube','charts','mix','commons','audius'].includes(state.source) && state.discovery === 'hits') {
          state.source = 'library-hits'; state.genre = 'all'; state.language = 'all';
          persist();
        }
        localStorage.setItem('aftertone:adfree-library-upgrade:v042','1');
      }
    } catch { /* Not fatal in private browsing. */ }
    // One-time migration away from the repeatedly broken Youtube/Commons
    // default. A manual source selection after this remains respected.
    try {
      if (!localStorage.getItem('aftertone:deezer-migration:v050')) {
        state.source='deezer'; state.genre='all'; state.language='all';
        persist(); localStorage.setItem('aftertone:deezer-migration:v050','1');
      }
    } catch { state.source='deezer'; }
    state.source = 'deezer';
    persist(); rememberSource();
    allGenres = payload.genres || ['all'];
    catalogWarning = payload.warning || '';
    catalogLive = Boolean(payload.live);
    // Only fetched live music is queued initially. Old search results remain outside the active discovery feed.
    if (!allGenres.includes(state.genre)) state.genre = 'all';
    if (challengeIds.length) {
      const available = challengeIds.filter((id) => Boolean(lookup(id)));
      if (available.length !== challengeIds.length) toast('Some shared tracks are not available from this catalog.');
      challengeIds = available;
    }
    // Portfolio entry links can open a requested discovery path directly.
    // Absent or invalid values preserve the listener's existing selection.
    const landingPath = new URLSearchParams(window.location.search).get('path');
    if (['familiar', 'balanced', 'explore'].includes(landingPath)) {
      state.discoveryMix = landingPath;
      persist();
    }
    // The free-app homepage can open Music Duels directly without changing
    // the saved listening path or permanently overriding any user preference.
    const landingView = new URLSearchParams(window.location.search).get('view');
    if (landingView === 'duels') view = 'duels';
    chooseNext();
    render();
    if (!challengeIds.length) {
      void loadMore(state.genre, true);
      if(state.discoveryMix!=='explore') void warmRelatedFromSaved(seedVersion);
      // Show the introduction once, without requiring an account or playlist.
      let shown = false;
      try { shown = Boolean(localStorage.getItem(INTRO_STORAGE_KEY)); } catch {}
      if (!shown && view === 'discover') openModal('onboarding');
    }
  } catch (error) {
    main.innerHTML = `<div class="empty-state"><div class="empty-icon">↯</div><h2>Couldn't open the listening room.</h2><p>Start the app with <code>npm start</code> and open the local URL shown in your terminal. ${html(error.message)}</p><button class="accent-button" onclick="location.reload()">Retry ↻</button></div>`;
  }
}

init();
