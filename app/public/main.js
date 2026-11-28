import {eligibleChallengeTracks,defaultChallengeDraft,reconcileChallengeDraft,toggleChallengeDraft,moveChallengeDraft,challengeLibraryPage,MAX_CHALLENGE_TRACKS} from '../src/challenge-draft.mjs';
import {readChallengeDraft,saveChallengeDraft,clearChallengeDraft} from '../src/challenge-draft-store.mjs';
import {apiFetch} from './api-browser.js';
import { createInitialState, computeTaste, selectNext, recordChoice, removeFavorite, restoreRemovedFavorite, restoreLastChoice, MOODS, setSavedTrackMood } from '/src/taste.mjs';
import { makeRecognitionQuiz } from '/src/quiz.mjs';
import {loadQuizStats,saveQuizStats,nextQuizStats} from '/src/quiz-progress.mjs';
import { loadState, saveState } from '/src/persistence.mjs';
import { BACKUP_MAX_BYTES, createProgressBackup, inspectProgressBackup, compareProgressSummaries, compareProgressContents, restoreProgressBackup } from '/src/progress-backup.mjs';
import { encodeChallenge, decodeChallenge, isPublicDeezerChallengeId } from '/src/challenge.mjs';
import { createViews } from './views.js';
import { html, urlSafe, tag, setTextIfChanged } from './view-utils.js';
import { THEMES, THEME_IDS } from '/src/themes.mjs';
import { matchesLanguage, likelyMusicRecording } from '/src/recording-quality.mjs';
import { parsePlaylist, buildSeedProfile, buildSeedLanes, trackIdentity } from '/src/playlist-import.mjs';
import { parseFavoriteArtists, artistSeedProfile, likedArtistLanes } from '/src/discovery-personalization.mjs';
import {readSavedPlaylist,readSavedArtists,preparePlaylistImport,savePlaylist,saveFavoriteArtists} from '/src/personalization-store.mjs';
import { artistKey, laneKey, splitSeedLanes } from '/src/discovery/rotation.mjs';
import { planDiscoveryRequest, explainDiscovery, PATH_DESCRIPTIONS } from '/src/discovery/mode-engine.mjs';
import { belongsToDiscoveryFeed } from '/src/discovery/queue.mjs';
import { selectRouteQueue, isActiveRequest } from '/src/discovery/route-session.mjs';
import { mergeRelatedArtists, interleaveArtistBranches } from '/src/discovery/graph.mjs';
import { createRelatedRequestScope } from '/src/discovery/related-request-scope.mjs';
import { createPreviewRequestScope } from '/src/discovery/preview-request-scope.mjs';
import { REFILL_INTERVAL_MS, shouldRefill,countUpcoming,queueStatus } from '/src/discovery/auto-refill.mjs';
import {rememberUnratedPreview,previousUnratedPreview,removeUnratedPreview} from '/src/discovery/preview-history.mjs';
import { nextDiscoveryRetry } from '/src/discovery/retry-policy.mjs';
import { eligibleProviders } from '/src/discovery/provider-availability.mjs';
import { createTournament, voteDuel, nextDuelMatch, availableChampions, podiumTracks, podiumCsv, hallOfFame, hallOfFameCsv, loadDuelStore, saveDuelStore, loadDuelSelection, saveDuelSelection } from '/src/duels.mjs';
import { renderDuels } from './duels-view.js';
import { pickThemedEntries, tournamentAvailability, tournamentTheme, isMysteryTournament, tournamentStatusLabel } from '/src/tournament-themes.mjs';
import { normalizeVolume, updateVolumeSetting, toggleMuteSetting } from '/src/volume.mjs';
import { csvRows } from '/src/csv.mjs';
import {collectionSearchKey} from '/src/collection-pagination.mjs';
import {addCollectionTracks,MAX_FAVORITE_IDS} from '/src/collection-capacity.mjs';
import {collectionRecoveryPlan,prepareRecoveredFavorites} from '/src/collection-recovery.mjs';
import {JOURNAL_FILTERS} from '/src/listening-journal.mjs';

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
function readPlaylist() {return readSavedPlaylist(localStorage);}
let importedPlaylist = readPlaylist();
let playlistProfile = importedPlaylist ? buildSeedProfile(importedPlaylist) : null;
let seedActive = false;
let seedKind = 'playlist';
const FAVORITE_ARTIST_LIMIT = 5;
const INTRO_STORAGE_KEY = 'aftertone:intro-shown:v054';
let chosenArtists = readSavedArtists(localStorage);
let seedRelated = [];
let seedVersion = 0;
const relatedRequestScope=createRelatedRequestScope();
function advanceSeedVersion() {
  // A profile switch invalidates every graph lookup from the old session.
  // Signals propagate to both static JSONP and the local server's fetch.
  relatedRequestScope.advance();
  return ++seedVersion;
}
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
function showPersonalizationStatus(id,message,error=true) {
  const status=$('#'+id,modalRoot);
  if(status) {
    status.textContent=message;
    status.classList.toggle('is-error',error);
    status.hidden=false;
  } else toast(message);
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
let inFlightDiscovery = null;
// A route or artist-search switch invalidates the old provider request before
// its JSONP callback can populate shared catalog metadata or start more pages.
function cancelStaleDiscovery(activeFeed=getFeed()) {
  if (inFlightDiscovery && inFlightDiscovery.feed !== activeFeed) {
    inFlightDiscovery.controller.abort();
    inFlightDiscovery.feed.loading = false;
    inFlightDiscovery = null;
  }
}
let animatingChoice = false;
let pendingChoice = null;
let allGenres = [];
let view = 'discover';
let duelTournaments = loadDuelStore(localStorage);
let selectedDuelId = loadDuelSelection(localStorage,duelTournaments); // Active bracket reopens after refresh.
let hallSeason = 'all'; // Season filter only affects the leaderboard, not stored results.
let sidebarFiltersCollapsed = false;
let quizSession = null;
let quizStats = loadQuizStats(localStorage);
let current = null;
let renderedListeningTrackId = null; // private: never expose blind-mode identity in card HTML
// Per-timeupdate progress may change, but hundreds of Collection buttons do
// not. Resync controls only on playback changes or a full view rebuild.
let previewButtonStateKey = null;
let modal = null;
let playlistLinkFlight = null;
let playlistFileFlight = null;
// Closing or replacing a playlist dialog must stop its in-flight provider
// request before it can import stale data into a later dialog.
function cancelPlaylistLinkFlight() {
  playlistFileFlight=null; // File.text() cannot be aborted; invalidate its token.
  const flight=playlistLinkFlight;
  if(!flight) return;
  playlistLinkFlight=null;
  flight.controller.abort();
}
let modalReturnFocus = null; // Original opener survives nested dialogs.
let activeAudioId = null;
let continuousListening = false; // Starts only on a user-initiated Play in Discover.
let autoAdvanceEnabled=true; // Optional single-preview mode; session-only, default unchanged.
const unvotedPreviews = new Set(); // Auto-advanced previews aren't falsely recorded as dislikes.
let advancingPreview = false;
let consecutivePlaybackFailures = 0;
let audioGeneration = 0;
let isLoadingAudio = false;
let activeAudioFallback = false;
let failedAudioId = null;
let failedAudioQuota = false; // Rate limits need different recovery guidance from a broken CDN.
let permissionBlockedTrackId = null; // A browser permission denial is never a broken source or a vote.
let permissionBlockedWasAutomatic = false;
let resolved = new Map();
const previewRequestScope=createPreviewRequestScope();
let failedSources = new Set();
const deezerRefreshedOnce = new Set(); // A signed preview can expire; retry once with a fresh URL.
const LYRIC_OFFSET_KEY='aftertone:lyric-offsets:v1';
let lyricsEnabled=false;
let lyricTrackId=null;
let lyricPayload=null;
let lyricsRequestVersion=0;
let lyricsController=null;
// Disabling lyrics or replacing the song must stop the actual network work,
// not just hide old results and leave the provider request running.
function cancelCurrentLyrics() {
  lyricsController?.abort();
  lyricsController=null;
  lyricsRequestVersion++;
  lyricTrackId=null;
  lyricPayload=null;
}
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
  if(!lyricsEnabled || view!=='discover' || !track || lyricTrackId===track.id) return;
  cancelCurrentLyrics();
  const token=lyricsRequestVersion;
  const controller=new AbortController();
  lyricsController=controller;
  lyricTrackId=track.id;
  lyricPayload={status:'loading',lines:[]};
  updateLyricView();
  try {
    const q=new URLSearchParams({artist:track.artist,title:track.title,duration:String(track.duration||0)});
    const response=await apiFetch(`/api/lyrics?${q}`,{signal:controller.signal});
    const payload=await response.json();
    if(controller.signal.aborted || token!==lyricsRequestVersion ||
       !lyricsEnabled || view!=='discover' || current?.id!==track.id) return;
    lyricPayload=response.ok ? payload:{status:'error',lines:[]};
  } catch {
    if(controller.signal.aborted || token!==lyricsRequestVersion ||
       !lyricsEnabled || view!=='discover' || current?.id!==track.id) return;
    lyricPayload={status:'error',lines:[]};
  } finally {
    if(lyricsController===controller) lyricsController=null;
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
let collectionGenre = 'all'; // Browse-only facet; never persisted or included in backups.
let collectionMood = 'all';
let collectionPage = 1; // Browsing position stays in this tab, not in backup data.
let collectionRecoveryFlight=null,collectionRecoveryMessage='';
const collectionRecoveryAttempted=new Set();
let journalFilter='all',journalPage=1; // Read-only Taste Map browsing.
// Undo for the most recent removal remains visible while this tab is open.
let lastRemovedFavorite = null;
let pointerStart = null;
let startedAt = Date.now();
const initialChallenge = decodeChallenge(new URL(location.href).searchParams.get('challenge'));
let challengeIds = initialChallenge;
let challengeResponses = [];
// A failed audio preview is neither a Keep nor a Pass. Only this tab needs it.
let challengeSkippedIds = new Set();
// A saved draft survives accidental refresh in the same tab only. Read it
// before initial rendering; saved tracks are hydrated before reconciliation.
let restoredChallengeDraft=null;
try {restoredChallengeDraft=readChallengeDraft(sessionStorage);}catch{}
let challengeDraftIds = restoredChallengeDraft ?? [];
let challengeDraftCustomized = restoredChallengeDraft !== null;
let challengeDraftSaved = restoredChallengeDraft !== null;
let challengeFilterQuery = '';
let challengePage = 1; // Transient paging only; never shared or stored with the ID-only draft.
function storeChallengeDraft() {
  try {challengeDraftSaved=saveChallengeDraft(sessionStorage,challengeDraftIds);}
  catch {challengeDraftSaved=false;}
}
function resetChallengeDraft() {
  challengeDraftCustomized=false;
  challengeDraftSaved=false;
  try {clearChallengeDraft(sessionStorage);} catch {}
}
function syncChallengeDraft() {
  const eligible=eligibleChallengeTracks(state.favorites,catalog);
  challengeDraftIds=challengeDraftCustomized
    ? reconcileChallengeDraft(challengeDraftIds,eligible)
    : defaultChallengeDraft(eligible);
  return eligible;
}
// Preserve the original shared IDs until the visitor chooses a shorter match.
// Never silently fall through into ordinary discovery when a provider is down.
let challengeRecovery = null;
let challengeLookupController = null;
let challengeLookupSerial = 0;

const $ = (selector, root = document) => root.querySelector(selector);
const lookup = (id) => catalog.find((track) => track.id === id) ?? null;
const persist = () => {
  const saved=saveState(localStorage,state);
  if(!saved) toast('Browser storage did not save your progress. Check site data permissions.');
  return saved;
};
/** Keep the current song/favorites intact if a browser drops a write.
 * Persist the proposed state BEFORE installing it in memory, so a false
 * success cannot advance to a new recording or remove a saved favorite.
 */
function commitSessionChange(next) {
  if(!saveState(localStorage,next)) {
    toast('Your change was NOT saved. Check browser storage, then try again.');
    return false;
  }
  state=next;
  return true;
}
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
    provider: state.source, added: 0, requests: 0, ids: new Set(), reasons: new Map(), total: null, emptyRefills:0, retryAt:0, retryFailures:0, note:'', primed:false,
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
function upcomingCount(genre=state.genre) {return countUpcoming(routeCandidates(genre).tracks,current?.id);}
function discoveryQueueSnapshot(feed=getFeed(),ready=upcomingCount()) {
  return queueStatus({ready,loaded:feed.ids.size,loading:feed.loading,hasMore:feed.hasMore,retryAt:feed.retryAt,
    searching:Boolean(searchQuery),visible:!document.hidden,active:view==='discover'&&!modal,
    sourceLabel:SOURCE_LABEL[state.source]||'Music provider'});
}
/** Refill status updates must never replace the playing card or steal focus. */
function updateQueueView(snapshot=null) {
  const counter=$('#queue-count');
  if(view!=='discover'||challengeIds.length||!counter)return;
  const status=snapshot||discoveryQueueSnapshot();
  setTextIfChanged(counter,String(status.ready));
  setTextIfChanged($('#queue-refill-status'),status.message);
  setTextIfChanged($('.queue-loaded'),status.loadedLabel);
  const queue=$('.compact-queue');
  if(queue&&queue.dataset.queueState!==status.state)queue.dataset.queueState=status.state;
  const button=$('#queue-refill-button');
  if(button){const disabled=String(status.state==='loading');if(button.getAttribute('aria-disabled')!==disabled)button.setAttribute('aria-disabled',disabled);}
}
function sourceOrder() {
  // YouTube is opt-in: do not silently introduce video ads into the audio mix.
  return state.source === 'mix' ? ['audius', 'jellyfin', 'jamendo', 'commons'].filter((x) => availableSources.includes(x)) : [state.source];
}
/** A rebuilt listening card must not strand a keyboard user on document.body.
 * Focus is restored only for a user-initiated, focused recovery action.
 */
function focusDiscoveryRecovery() {
  const target=$('#stage-play') ||
    $('#main-content .discovery-empty-state [data-action="load-more"]:not(:disabled)') ||
    main;
  target.focus({preventScroll:true});
}
/** Fetch new batches progressively. Counters represent loaded songs, not provider catalog sizes. */
async function loadMore(genre = state.genre, showStatus = false, prioritizeRelated = false, restoreKeyboardFocus = false) {
  if (challengeIds.length || (!showStatus && view!=='discover')) return;
  const feed = getFeed(genre);
  cancelStaleDiscovery(feed);
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
    updateQueueView();
    return;
  }
  feed.retryAt=0;
  // Manual retries are an explicit override: reset the increasing automatic
  // cooldown. Never make a listener wait because a background retry failed.
  if(showStatus) {feed.emptyRefills=0;feed.retryFailures=0;}
  const controller = new AbortController();
  const flight = {feed,controller};
  inFlightDiscovery = flight;
  feed.activeFlight = flight;
  const isCurrent = () => !controller.signal.aborted &&
    genre === state.genre && isActiveRequest(feed,getFeed(genre));
  feed.loading = true;
  feed.error = '';
  if (showStatus || !current) render();
  else updateQueueView();
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
    // A failed source is skipped only within this request. Keep it eligible
    // for the next manual Retry Discovery or the bounded background refill.
    const failedThisBatch = new Set();
    for (let attempt = 0; attempt < (state.source==='deezer' && !requestSearch ? 6 : 5); attempt++) {
      if (!isCurrent()) break;
      const providers = eligibleProviders(sourceOrder(), feed.exhausted, failedThisBatch);
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
        const response = await apiFetch(`/api/discover?${query}`,{signal:controller.signal});
        if (!isCurrent()) break;
        const result = await response.json();
        if (!isCurrent()) break;
        if (!response.ok) {
          const failure=new Error(result?.error || `HTTP ${response.status}`);
          failure.status=response.status;
          throw failure;
        }
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
        // A canceled route is not a provider outage. Never show its error or
        // add its results to the new path's shared discovery fallback.
        if (!isCurrent()) break;
        // Do not permanently exhaust a provider on a temporary outage.
        feed.error = `${SOURCE_LABEL[source]} could not load: ${error.message}`;
        if (lane && /HTTP (400|404)\b/.test(String(error.message))) {
          feed.exhausted.add(cursorKey); continue;
        }
        // 429s, timeouts and provider outages are temporary. The batch-level
        // policy below schedules a progressively longer automatic cooldown,
        // never permanently exhausting a useful lane.
        if (state.source !== 'mix') break;
        // Only skip this source for the current fetch. A temporary outage
        // must never make Retry Discovery permanently lose that provider.
        failedThisBatch.add(source);
      }
      // A usable first page is enough to present a real mode-specific card.
      // The 3-second replenisher brings in deeper catalog pages afterward.
      if (successes >= 1 && availableCount(genre) >= (prioritizeRelated ? 8 : 12)) break;
    }
    if (!isCurrent()) return;
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
    if(feed.error && !successes) {
      const retry=nextDiscoveryRetry(feed.retryFailures,Date.now());
      feed.retryFailures=retry.failures;
      feed.retryAt=retry.retryAt;
    }
    if (successes) {
      // A successful provider page (even if it has no matching songs) proves
      // the outage is over. Clear the cooldown for the active feed only.
      feed.retryFailures=0;
      feed.retryAt=0;
      feed.error='';
    }
    if (state.source === 'mix' && state.discovery === 'variety' && !current && !availableCount(genre) && !successes && !catalog.length && !requestSearch) {
      addToCatalog(starterShelf);
      feed.error = 'Live music is temporarily unavailable. Showing the offline starter shelf.';
    }
    if (!feed.hasMore && !availableCount(genre) && showStatus) toast('No more matching songs from selected sources. Change the filter or source.');
  } finally {
    if (inFlightDiscovery === flight) inFlightDiscovery = null;
    // A rapidly revisited path may already have issued a replacement fetch.
    // Its loading flag must not be cleared by the canceled old request.
    if (feed.activeFlight === flight) {
      feed.loading = false;
      // Aborted requests never produced a genuine first page. Reopening that
      // route must still fetch its own results before using shared fallback.
      if (!controller.signal.aborted) feed.primed = true;
    }
    if (feed.activeFlight === flight && isCurrent()) {
      // Auto-refill must not replace the playing card's DOM every three
      // seconds: that would steal focus from the lyrics slider, interrupt
      // gestures and make the page jump while someone is listening.
      const neededCard = !current;
      if (neededCard) chooseNext();
      if (neededCard || showStatus) render();
      else updateQueueView();
      maybeResumeContinuous();
      // A keyboard Retry/Filter action can replace the focused button twice:
      // once for loading and again for the result. Return to Play or Retry only
      // if the listener did not move focus elsewhere while the fetch ran.
      if (restoreKeyboardFocus && view === 'discover' &&
          document.activeElement === main && requestSearch === searchQuery)
        focusDiscoveryRecovery();
    }
    // Similarity lookups may finish during a chart fetch. Never lose the
    // background related-artist refill just because a request was in flight.
    if (feed.activeFlight === flight && isCurrent() && feed.relatedUpdatePending) {
      feed.relatedUpdatePending = false;
      if (feed.hasMore) void loadMore(genre,false,true);
    }
  }
}
/** Regular check, not an unconditional API request. Keeps a deep queue for
 * quick swipe sessions; no timers are created by individual card renders. */
function autoRefillTick() {
  // Do not rebuild the candidate pool every three seconds on unrelated pages
  // or while the tab is hidden. This check does not start or stop audio.
  if(view!=='discover'||modal||challengeIds.length||document.hidden)return;
  const feed=getFeed();
  const ready=upcomingCount(state.genre);
  const active=!searchQuery;
  updateQueueView(discoveryQueueSnapshot(feed,ready));
  if(Date.now()>=feed.retryAt && shouldRefill({ready,loaded:feed.ids.size,loading:feed.loading,hasMore:feed.hasMore,
    visible:true,active,challenge:false})) {
    void loadMore(state.genre,false);
  }
}
setInterval(autoRefillTick,REFILL_INTERVAL_MS);
document.addEventListener('visibilitychange',()=>{
  // No audio side effects; when returning to the tab, resume refill checks.
  if(document.hidden)updateQueueView();
  else autoRefillTick();
});
function maybeTopUp(restoreKeyboardFocus = false) {
  if (challengeIds.length) return;
  const feed = getFeed();
  if (upcomingCount(state.genre) < 12 && feed.hasMore && !feed.loading && Date.now()>=feed.retryAt)
    void loadMore(state.genre,false,false,restoreKeyboardFocus);
  else if (restoreKeyboardFocus && document.activeElement === main)
    focusDiscoveryRecovery();
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
  document.querySelectorAll('[data-view]').forEach((button) => {
    const active=button.dataset.view===view;
    button.classList.toggle('active',active);
    if(button.matches('#main-nav button'))button.setAttribute('aria-current',active?'page':'false');
  });
  const viewLabel = ({ discover: 'Discover', collection: 'Collection', taste: 'Taste Map', challenges: 'Challenges', quiz: 'Tune Lab', duels: 'Music Duels' })[view];
  $('#current-view-label').textContent = viewLabel.toUpperCase();
  // Name only the focused landmark, not every dynamically rendered descendant.
  main.setAttribute('aria-label', `${viewLabel} section`);
  document.title = `${viewLabel} — AFTERTONE`;
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
  // Abandoned on-demand metadata requests must stop at the Deezer adapter,
  // not merely have their eventual results ignored by audioGeneration.
  previewRequestScope.cancelAll();
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  activeAudioId = null;
  isLoadingAudio = false;
  activeAudioFallback = false;
  failedAudioId = null;
  failedAudioQuota = false;
  permissionBlockedTrackId = null;
  permissionBlockedWasAutomatic = false;
}

async function resolveAudio(track) {
  if (resolved.has(track.id)) {
    const item = resolved.get(track.id);
    if (!item.expiresAt || Date.now() < item.expiresAt) return item;
    resolved.delete(track.id);
  }
  // An in-flight Play for the same song reuses its request. On a song change,
  // Stop or navigation, cancelAll aborts provider traffic and releases the
  // entry immediately so a fresh Play cannot join an abandoned request.
  return previewRequestScope.run(track.id, async signal => {
    const response = await apiFetch(`/api/audio?id=${encodeURIComponent(track.id)}`,{signal});
    const payload = await response.json();
    signal.throwIfAborted(); // Do not cache a late response after cancellation.
    if (!response.ok || !payload.url) {
      const error = new Error(payload.detail || payload.error || 'No playable file');
      error.status = response.status; // Preserve 429 without exposing provider text as HTML.
      throw error;
    }
    if (resolved.size >= 320) resolved.delete(resolved.keys().next().value);
    if (payload.ttlSeconds) payload.expiresAt = Date.now() + payload.ttlSeconds * 1000;
    resolved.set(track.id, payload);
    return payload;
  });
}

function prewarm(track) {
  // Deezer preview URLs are short-lived. Merely rendering a card or bracket
  // must not trigger a provider request before the listener asks to play:
  // repeated re-renders during quota limits otherwise create extra 429s.
  // Explicit Play and Retry Preview still resolve a fresh URL on demand.
  if (!track || track.source === 'deezer') return;
  if (track.source !== 'youtube' && !resolved.has(track.id) && !failedSources.has(track.id)) {
    resolveAudio(track).catch(() => { /* Let the play action surface a retryable error. */ });
  }
}

function stopContinuous() {
  cancelPendingChoice();
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
  // The recovery controls are hidden while audio reloads. Transfer focus to
  // the persistent Play/Pause button first instead of leaving keyboard users
  // focused on a button inside a hidden status region.
  const returnFocus = $('#preview-recovery')?.contains(document.activeElement);
  if (returnFocus) $('#stage-play')?.focus({preventScroll:true});
  resolved.delete(current.id);
  failedSources.delete(current.id);
  deezerRefreshedOnce.delete(current.id);
  stopAudio();
  void togglePlayback(current, false);
}
/** A failed preview is not a vote. Leave collection and history unchanged. */
function skipUnavailablePreview() {
  if (!current || view !== 'discover' || failedAudioId !== current.id ||
      challengeRecovery?.waiting) return;
  const returnFocus = $('#preview-recovery')?.contains(document.activeElement);
  if(challengeIds.length) {
    // This preview truly failed; count it only as unavailable in this attempt.
    // Do not touch history, collection, taste signals, or the original share URL.
    challengeSkippedIds.add(current.id);
  } else unvotedPreviews.add(current.id);
  continuousListening=false;
  stopAudio();
  chooseNext();
  render();
  // Skipping rebuilds the listening card. Keyboard focus must not be lost.
  if (returnFocus) (current ? $('#stage-play') :
    main.querySelector('[data-action="exit-challenge"]') || main)?.focus({preventScroll:true});
  if (!challengeIds.length) maybeTopUp();
}
function advancePreview() {
  if (animatingChoice || advancingPreview || !current || view !== 'discover' || modal || !continuousListening) return;
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
/** Explicit navigation and completed previews are neutral, not rating actions.
 * Only successful/intentional skips can be revisited; broken media is excluded. */
function rememberCurrentUnrated() {
  if(!current||challengeIds.length||failedSources.has(current.id)||failedAudioId===current.id)return;
  const feed=getFeed();
  feed.recentUnrated=rememberUnratedPreview(feed.recentUnrated,current.id);
}
function revisitablePreview() {
  if(view!=='discover'||challengeIds.length)return null;
  const feed=getFeed();
  if(!feed.recentUnrated?.length)return null;
  const heard=new Set(state.history.map(event=>event.id));
  const id=previousUnratedPreview(feed.recentUnrated,id=>{
    const track=lookup(id);
    return id!==current?.id && unvotedPreviews.has(id) && !heard.has(id) &&
      !failedSources.has(id) && track && matchesFeed(track,state.genre);
  });
  return id?lookup(id):null;
}
function nextUnratedPreview(returnFocus=false) {
  if(view!=='discover'||modal||challengeIds.length||!current||animatingChoice)return;
  rememberCurrentUnrated();
  unvotedPreviews.add(current.id);
  stopContinuous();
  chooseNext();render();
  if(returnFocus) ($('#stage-play') || main).focus({preventScroll:true});
  maybeTopUp(returnFocus);
}
function revisitUnratedPreview(returnFocus=false) {
  if(modal||animatingChoice)return;
  const track=revisitablePreview();
  if(!track)return;
  const feed=getFeed();
  feed.recentUnrated=removeUnratedPreview(feed.recentUnrated,track.id);
  unvotedPreviews.delete(track.id);
  stopContinuous();
  current={...track,seedReason:'Returning to an unrated preview · no decision was recorded'};
  render();
  if(returnFocus)$('#stage-play')?.focus({preventScroll:true});
}
function completePreview() {
  if(animatingChoice||advancingPreview||!continuousListening||!current||view!=='discover'||modal||challengeIds.length)return;
  rememberCurrentUnrated();
  advancePreview();
}
function togglePreviewMode() {
  if(view!=='discover'||challengeIds.length||modal||animatingChoice)return;
  autoAdvanceEnabled=!autoAdvanceEnabled;
  // Turning off automatic advancement does not interrupt the current clip.
  // Turning it on never starts sound; the next explicit Play enables radio.
  if(!autoAdvanceEnabled)continuousListening=false;
  updatePlaybackView();
}
async function togglePlayback(track, automatic = false) {
  if (!track || (view==='discover' && animatingChoice)) return;
  if (isLoadingAudio && activeAudioId === track.id) {
    // A second *manual* Play is an explicit cancel, not a dead button.
    // Automatic resume checks must still avoid interrupting their own lookup.
    if (!automatic) stopContinuous();
    return;
  }
  // Switching contestants while a prior preview is resolving cancels the stale
  // request and invalidates its eventual reply via audioGeneration.
  if (track.source === 'youtube') {
    continuousListening = false;
    return openModal('youtube', { id: track.id, from: view });
  }
  if (!automatic && failedAudioId === track.id) {
    // A failed media element may still retain its last src and a resolved
    // preview URL. The primary Play control must be as useful as Retry:
    // discard the broken link and resolve a fresh one on deliberate replay.
    resolved.delete(track.id);
    failedSources.delete(track.id);
    deezerRefreshedOnce.delete(track.id);
    stopAudio();
  }
  if (activeAudioId === track.id && !audio.paused) {
    if (!automatic) continuousListening = false; // Explicit pause ends the autoplay session.
    audio.pause();
    updatePlaybackView();
    return;
  }
  if (!automatic && view === 'discover' && current?.id === track.id) {
    // A listener's first manual retry after the browser denied autoplay
    // previews just THIS song. Do not immediately restart a continuous session
    // that the browser refused: otherwise a delayed old media event can skip
    // another unheard track before the user has a chance to listen.
    continuousListening = !challengeIds.length && autoAdvanceEnabled && permissionBlockedTrackId !== track.id;
  } else if (!automatic) continuousListening = false; // Collection playback is manual.
  const sameTrack = activeAudioId === track.id;
  if (!sameTrack) stopAudio();
  const generation = audioGeneration;
  activeAudioId = track.id;
  activeAudioFallback = false;
  failedAudioId = null;
  failedAudioQuota = false;
  if (!automatic) permissionBlockedTrackId = null;
  isLoadingAudio = true;
  updatePlaybackView();
  try {
    const source = await resolveAudio(track);
    if (activeAudioId !== track.id || generation !== audioGeneration) return;
    if (!sameTrack || !audio.src) {
      audio.src = source.url;
      audio.currentTime = 0;
    } else if (audio.ended || audio.currentTime >= previewLength - 0.1) {
      audio.currentTime = 0; // Replay a finished clip from the beginning.
    }
    applySavedVolume();
    try {
      await audio.play();
    } catch (directError) {
      // Firefox/Zen and other browsers sometimes reject an upstream redirect.
      // Retry Audius using our bounded, same-origin streaming endpoint.
      if (directError?.name === 'NotAllowedError' ||
          !source.fallbackUrl || activeAudioId !== track.id || generation !== audioGeneration) throw directError;
      activeAudioFallback = true;
      audio.src = source.fallbackUrl;
      audio.currentTime = 0;
      await audio.play();
    }
    failedSources.delete(track.id);
    if (deezerRefreshedOnce.size > 300) deezerRefreshedOnce.clear();
    // play() can resolve before the browser decodes any audio. Do not reset
    // the failure streak yet: an immediate media error after a nominally
    // successful play must still count toward the three-failure safety cap.
  } catch (error) {
    // NotAllowedError means the browser denied a playback gesture. This is
    // neither a provider outage nor evidence that the song is unavailable.
    // Even deliberate manual Play can be rejected by browser media policy.
    // Never blacklist the recording, advance the queue, or create a vote.
    if (generation !== audioGeneration) return; // Old stream was canceled by a swipe.
    if (error?.name === 'NotAllowedError') {
      continuousListening = false;
      consecutivePlaybackFailures = 0;
      stopAudio();
      if ((view === 'discover' && current?.id === track.id) || view === 'duels') {
        // Bracket previews also need a persistent, non-voting explanation.
        permissionBlockedTrackId = track.id;
        permissionBlockedWasAutomatic = automatic;
      }
      updatePlaybackView();
      toast(automatic
        ? 'Automatic playback was blocked. Press Play to hear this song; nothing was skipped.'
        : 'Your browser blocked playback. Check media permissions, then press Play again; this song was not marked unavailable.');
      return;
    }
    // A missing Commons upload or blocked format should never trap the player.
    if (activeAudioId === track.id) {
      audio.pause();
      activeAudioId = null;
    }
    // A provider quota limit is not evidence that this recording is broken.
    // Never blacklist it or start a chain of additional automatic requests.
    // Hold the current song so the listener can explicitly retry later.
    const rateLimited = track.source === 'deezer' && error?.status === 429;
    if (!rateLimited) {
      if (failedSources.size >= 320) failedSources.delete(failedSources.values().next().value);
      failedSources.add(track.id);
    }
    failedAudioId = track.id;
    failedAudioQuota = rateLimited;
    toast(failedAudioQuota
      ? 'Deezer is temporarily limiting requests. Wait a moment before Retry Preview, or skip without voting.'
      : `${SOURCE_LABEL[track.source] || 'This source'} could not play this recording. Try again or skip without voting.`);
    if (rateLimited) {
      continuousListening = false;
      consecutivePlaybackFailures = 0;
    } else if (automatic && continuousListening && generation === audioGeneration) {
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
  const mode=$('#preview-mode');
  if(mode) {
    const pressed=String(autoAdvanceEnabled);
    if(mode.getAttribute('aria-pressed')!==pressed)mode.setAttribute('aria-pressed',pressed);
    setTextIfChanged(mode,autoAdvanceEnabled?'Auto-advance: On':'Auto-advance: Off');
    setTextIfChanged($('#first-listen-playback-mode'),autoAdvanceEnabled?'Continuous listening begins after your first Play. You control the volume and can stop at any time.':'Single-preview mode waits for your decision. You control the volume and can stop at any time.');
  }
  const stop = $('#stop-session');
  if (stop) stop.hidden = !continuousListening;
  const hint = $('#continuity-hint');
  if (hint) hint.textContent = current?.id === permissionBlockedTrackId
    ? (permissionBlockedWasAutomatic
      ? 'Automatic playback blocked by your browser · Press Play to continue'
      : 'Browser blocked playback · Check media permissions, then press Play')
    : challengeIds.length
      ? 'Listen, then Keep or Pass. Failed clips can be skipped without a vote.'
      : continuousListening ? '● Auto-playing · Stop to end' : autoAdvanceEnabled ? (activeAudioId===current?.id && !audio.paused ? 'Auto-advance enabled · starts on your next Play' : '▶ Play once for continuous listening') : 'Single preview · stays on this song until you decide';
  const button = $('#stage-play');
  if (button && current) {
    if (current.source === 'youtube') {
      button.textContent = '▶';
      button.setAttribute('aria-label', 'Open YouTube video preview');
      const status = $('#audio-status');
      setTextIfChanged(status, 'Watch a 22-second clip in the YouTube player; ads may appear');
      const time = $('#audio-time');
      if (time) time.textContent = '22 sec';
      const fill = $('#audio-progress');
      if (fill) fill.style.width = '0%';
      return;
    }
    const playing = activeAudioId === current.id && !audio.paused;
    const loadingThisTrack=isLoadingAudio && activeAudioId===current.id;
    button.textContent = loadingThisTrack ? '×' : playing ? 'Ⅱ' : '▶';
    button.setAttribute('aria-label', loadingThisTrack ? 'Cancel loading preview' : playing ? 'Pause preview' : 'Play preview');
    button.title = loadingThisTrack ? 'Cancel loading preview' : playing ? 'Pause preview' : 'Play preview';
    $('#waveform')?.classList.toggle('playing', playing);
    $('#vinyl')?.classList.toggle('spin', playing);
    const seconds = activeAudioId === current.id ? Math.min(previewLength, audio.currentTime || 0) : 0;
    const fill = $('#audio-progress');
    const time = $('#audio-time');
    if (fill) fill.style.width = `${seconds / previewLength * 100}%`;
    if (time) time.textContent = `0:${String(Math.floor(seconds)).padStart(2, '0')} / 0:${previewLength}`;
    const status = $('#audio-status');
    setTextIfChanged(status, loadingThisTrack ? 'Finding the recording… Activate Cancel loading preview to stop' : playing ? (continuousListening ? 'Continuous listening · playing now' : 'Listening in progress') : permissionBlockedTrackId === current.id ? (permissionBlockedWasAutomatic ? 'Autoplay blocked — press Play to hear this song' : 'Browser blocked playback — check permissions and press Play again') : failedAudioId === current.id ? (failedAudioQuota ? 'Deezer requests limited — wait before retrying' : 'Stream unavailable — try another song or source') : 'Press play to sample this track');
  }
  // Recoverable failure controls belong to the discovery card, never the saved collection.
  const recovery=$('#preview-recovery');
  if(recovery && current) {
    recovery.hidden = isLoadingAudio || failedAudioId !== current.id;
    if (!recovery.hidden && current.source === 'deezer') {
      // Recovery UI is retained while retrying. Never leave an old quota
      // warning on screen after the new request fails for another reason.
      setTextIfChanged(recovery.querySelector('p'), failedAudioQuota
        ? 'Deezer is temporarily limiting requests. Wait a moment before Retry Preview, or skip without counting it as a Pass.'
        : challengeIds.length
          ? 'This shared preview could not play. Retry it, or skip this recording without counting a Pass.'
          : 'This Deezer preview is unavailable. Retry a fresh provider link or skip without counting it as a Pass.');
    }
  }
  // Neutral skipping is essential when a shared clip fails after metadata
  // successfully loaded. Hiding it trapped visitors on an unplayable song.
  // Tournament previews have their own, quiet status bar. Never accidentally
  // start continuous radio playback while the user is evaluating contenders.
  const duelStatus=$('#duel-now-playing');
  if(duelStatus && view==='duels') {
    const selected=duelTournaments.find(t=>t.id===selectedDuelId);
    const match=nextDuelMatch(selected);
    // The active audio ID is cleared after failed metadata resolution.
    // Retain the failed/permission-blocked contender in the UI so it never
    // masquerades as an untouched match or an ordinary paused recording.
    const matchIds=[match?.a,match?.b];
    const contenderId=[activeAudioId,failedAudioId,permissionBlockedTrackId]
      .find(id=>id && matchIds.includes(id));
    const contender=selected?.entries.find(t=>t.id===contenderId);
    const side=match?.a===contender?.id ? 'A' : 'B';
    const previewFailed=Boolean(contender && failedAudioId===contender.id && !isLoadingAudio);
    const permissionDenied=Boolean(contender && permissionBlockedTrackId===contender.id && !isLoadingAudio);
    // In Mystery Matchups neither the card nor the status message may
    // disclose the track identity before the bracket has finished.
    const contenderLabel=isMysteryTournament(selected)
      ? `Mystery contender ${side}`
      : contender ? `${contender.artist} — ${contender.title}` : '';
    duelStatus.textContent=contender
      ? isLoadingAudio ? `Loading ${contenderLabel}…`
        : previewFailed ? `${failedAudioQuota ? 'Deezer requests limited' : 'Preview unavailable'} · Contender ${side}`
        : permissionDenied ? `Browser blocked preview · Contender ${side}`
        : audio.paused ? `Paused · ${contenderLabel}` : `♪ Playing ${contenderLabel}`
      : '▶ Choose a contender to preview';
    const feedback=$('#duel-preview-feedback');
    if(feedback) setTextIfChanged(feedback,
      previewFailed
        ? failedAudioQuota
          ? `Deezer is temporarily limiting previews. Wait before retrying contender ${side}; no vote was recorded.`
          : `Contender ${side} could not play. Retry this preview or try the other contender. No vote was recorded.`
        : permissionDenied
          ? `Your browser blocked contender ${side}'s preview. Check media permissions and retry; no vote was recorded.`
          : '');
    const elapsed=contender?Math.min(previewLength,Number(audio.currentTime)||0):0;
    const time=$('#duel-preview-time');if(time)time.textContent=`0:${String(Math.floor(elapsed)).padStart(2,'0')} / 0:${previewLength}`;
    const fill=$('#duel-preview-fill');if(fill)fill.style.width=`${elapsed/previewLength*100}%`;
  }
  // Collection and Duel buttons do not depend on currentTime. On mobile,
  // scanning and rewriting every saved-track button for every media timeupdate
  // can make a large Collection sluggish and repeatedly disturb accessibility
  // labels. A full render explicitly invalidates this key below.
  const buttonKey=[view,activeAudioId,audio.paused,isLoadingAudio,
    failedAudioId,permissionBlockedTrackId].join('|');
  if(previewButtonStateKey!==buttonKey) {
    previewButtonStateKey=buttonKey;
    document.querySelectorAll('[data-preview], [data-duel-play]').forEach((button) => {
      const id=button.dataset.preview || button.dataset.duelPlay;
      const playing=activeAudioId===id && !audio.paused;
      const loading=isLoadingAudio && activeAudioId===id;
      const side=button.dataset.duelPlay
        ? button.closest('.duel-contender')?.querySelector('.duel-side-label')?.textContent?.slice(-1)
        : null;
      const needsRetry=Boolean(side && (failedAudioId===id || permissionBlockedTrackId===id) && !loading);
      const text=loading ? '× Cancel loading' :
        playing ? 'Ⅱ Pause' : side ? needsRetry ? `↻ Retry ${side}` : `▶ Preview ${side}` : '▶ Listen';
      setTextIfChanged(button,text);
      // A Collection button starts as "Listen to SONG". Without updating
      // aria-label, a screen reader announces "Listen" even when it PAUSES or
      // CANCELS loading. Never attach hidden Mystery Duels metadata here.
      const trackTitle=side ? null : button.closest('.track-tile')
        ?.querySelector('.tile-body strong')?.textContent?.trim();
      const accessible=side
        ? loading ? `Cancel loading contender ${side} preview`
          : playing ? `Pause contender ${side} preview`
          : needsRetry ? `Retry contender ${side} preview`
          : `Preview contender ${side}`
        : trackTitle
          ? loading ? `Cancel loading ${trackTitle} preview`
            : playing ? `Pause ${trackTitle} preview`
            : `Listen to ${trackTitle}`
          : loading ? 'Cancel loading preview'
            : playing ? 'Pause preview' : 'Listen to preview';
      if(button.getAttribute('aria-label')!==accessible)
        button.setAttribute('aria-label',accessible);
    });
  }
}

audio.addEventListener('timeupdate', () => {
  if (lyricsEnabled) updateLyricView();
  // A stream is only proven audible after its time position has actually
  // advanced. A play() promise that resolves then fails at 0 seconds must
  // not reset consecutivePlaybackFailures and drain the whole discovery queue.
  if (!isLoadingAudio && !audio.paused && audio.currentTime >= 1 &&
      activeAudioId && (view !== 'discover' || current?.id === activeAudioId))
    consecutivePlaybackFailures = 0;
  if (audio.currentTime >= previewLength) {
    // During a Firefox source handoff, a stale timeupdate can still carry
    // the OLD clip's 22-second position. Never advance the NEW song until
    // its own play() has completed and it is actively playing.
    if (isLoadingAudio) return;
    if (continuousListening && !audio.paused && view === 'discover' &&
        current?.id === activeAudioId && !modal) { completePreview(); return; }
    audio.pause();
    try { audio.currentTime = previewLength; } catch { /* media unloaded */ }
  }
  updatePlaybackView();
});
audio.addEventListener('ended', () => {
  // A canceled/old media source may deliver a delayed ended event after
  // the next track has started. Never skip that unheard recording. Genuine
  // short clips (under 22 seconds) still advance when the current audio ends.
  if (continuousListening && !isLoadingAudio && audio.ended &&
      view === 'discover' && !modal && current?.id === activeAudioId)
    completePreview();
  else updatePlaybackView();
});
audio.addEventListener('play', updatePlaybackView);
audio.addEventListener('pause', updatePlaybackView);
audio.addEventListener('error', async () => {
  // Media elements can fire a late error from the previous source while the
  // listener's Keep/Pass animation is switching tracks. During a new play()
  // request, its promise reports genuine load/permission errors separately.
  // Do not let either transition event trigger recursive automatic skips.
  if (!activeAudioId || animatingChoice || isLoadingAudio) return;
  const activeId = activeAudioId;
  const track = lookup(activeId);
  const generation = audioGeneration;
  const isCurrent = () => activeAudioId === activeId && generation === audioGeneration;
  // Media errors can arrive after a preview has started successfully. While
  // refreshing a failed URL, expose the same cancelable loading control used
  // by the initial Play. Stop, navigation and a second manual Play then abort
  // the request rather than allowing an old retry to start sound later.
  async function recoverWithUrl(selectUrl, warning) {
    isLoadingAudio = true;
    updatePlaybackView();
    try {
      const source = await resolveAudio(track);
      if (!isCurrent()) return true; // An obsolete recovery is already canceled.
      const nextUrl = selectUrl(source);
      if (!nextUrl) throw new Error('No local stream fallback');
      audio.src = nextUrl;
      await audio.play();
      if (!isCurrent()) return true; // A delayed play() must not change new state.
      failedAudioId = null;
      return true;
    } catch (error) {
      if (!isCurrent()) return true; // No stale warnings or failure state.
      // A fresh preview link refused due to quota must stay retryable. Do
      // not misclassify an upstream throttle as a damaged audio recording.
      if (track?.source === 'deezer' && error?.status === 429) failedAudioQuota = true;
      console.warn(warning, error);
      return false;
    } finally {
      if (isCurrent()) {
        isLoadingAudio = false;
        updatePlaybackView();
      }
    }
  }
  if (track?.source === 'deezer' && !isLoadingAudio && !deezerRefreshedOnce.has(activeId)) {
    deezerRefreshedOnce.add(activeId);
    resolved.delete(activeId);
    if (await recoverWithUrl(source => source.url, 'Deezer preview URL refresh failed:')) return;
  }
  if (track?.source === 'audius' && !activeAudioFallback && !isLoadingAudio && isCurrent()) {
    activeAudioFallback = true;
    if (await recoverWithUrl(source => source.fallbackUrl, 'Audius local stream fallback failed:')) return;
  }
  if (isCurrent() && !isLoadingAudio) {
    if(failedAudioId===activeId) return; // A failed media element can emit more than one error.
    failedAudioId = activeId;
    // A terminal error should never leave a previous source playing while
    // announcing that the same recording is unavailable.
    audio.pause();
    if (!failedAudioQuota) failedSources.add(activeId);
    toast(failedAudioQuota
      ? 'Deezer is temporarily limiting requests. Wait before Retry Preview; this song was not skipped.'
      : `${SOURCE_LABEL[track?.source] || 'Music provider'} could not deliver this audio.`);
    if (failedAudioQuota) {
      continuousListening = false;
      consecutivePlaybackFailures = 0;
    } else if (continuousListening && current?.id === activeId) {
      consecutivePlaybackFailures++;
      if (consecutivePlaybackFailures >= 3) { continuousListening = false; toast('Several tracks failed playback. Continuous listening stopped.'); }
      else advancePreview();
    }
    updatePlaybackView();
  }
});

function chooseNext() {
  cancelPendingChoice();
  if (challengeIds.length && challengeRecovery?.waiting) {
    current=null; // An incomplete link needs a decision before any blind votes.
    return;
  }
  if (challengeIds.length) {
    const completed = new Set([...challengeResponses.map(item=>item.id),...challengeSkippedIds]);
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
  // render() preserves focus on the selected path button. Do not jump the
  // keyboard to Play or the main landmark just for changing a setting.
  render();
  if(wasSearching) toast('Search closed · loading your new discovery path.');
  if(!feed.primed || !availableCount(state.genre))
    void loadMore(state.genre,false,true);
  if(mode!=='explore') void warmRelatedFromSaved(seedVersion);
}

/** JavaScript-triggered scrolling must honor reduced-motion preferences too.
 * CSS media rules alone cannot override a JavaScript-requested smooth scroll.
 */
function motionSafeScroll() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

/** Keep the small-screen settings panel and its accessible toggle in sync.
 * Opening focuses a visible close control, not an editable input that would
 * immediately raise the phone's software keyboard.
 */
function setMobileFiltersOpen(open, focusTarget='') {
  const toggle=$('#mobile-refine-toggle');
  const side=$('#sidebar-preferences');
  const expanded=Boolean(open && view==='discover' &&
    matchMedia('(max-width: 900px)').matches && side && !side.hidden);
  document.body.classList.toggle('mobile-filters-open',expanded);
  toggle?.setAttribute('aria-expanded',String(expanded));
  // The fixed mobile drawer behaves as a dialog only while it covers the
  // listening room. Desktop discovery settings stay an ordinary region.
  if (side) {
    if (expanded) {
      side.setAttribute('role','dialog');
      side.setAttribute('aria-modal','true');
    } else {
      side.removeAttribute('role');
      side.removeAttribute('aria-modal');
    }
  }
  if (expanded && focusTarget==='close')
    side.querySelector('[data-action="close-mobile-filters"]')?.focus({preventScroll:true});
  if (!expanded && focusTarget==='toggle' && toggle?.getClientRects().length)
    toggle.focus({preventScroll:true});
}

// Trap keyboard focus inside the fixed Filters drawer on narrow screens.
// Background navigation and the listening card must not become hidden Tab
// stops while a dialog covers them. Escape and Done remain easy ways out.
function trapMobileFiltersTab(event) {
  const side=$('#sidebar-preferences');
  if (!side) return;
  const controls=[...side.querySelectorAll(
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
  )].filter(element=>element.getClientRects().length &&
    !element.closest('[hidden], [inert]') && !element.disabled);
  if (!controls.length) {
    event.preventDefault();
    side.setAttribute('tabindex','-1');
    side.focus({preventScroll:true});
    return;
  }
  const first=controls[0], last=controls[controls.length-1];
  if (event.shiftKey && (document.activeElement===first || !side.contains(document.activeElement))) {
    event.preventDefault();
    last.focus({preventScroll:true});
  } else if (!event.shiftKey && (document.activeElement===last || !side.contains(document.activeElement))) {
    event.preventDefault();
    first.focus({preventScroll:true});
  }
}
window.addEventListener('resize', () => {
  if (document.body.classList.contains('mobile-filters-open') &&
      matchMedia('(min-width: 901px)').matches) setMobileFiltersOpen(false);
});
function goTo(nextView) {
  setThemeMenuOpen(false);
  if (!['discover', 'collection', 'taste', 'challenges', 'quiz', 'duels'].includes(nextView)) return;
  if(nextView!=='collection')cancelCollectionRecovery();
  if (modal) closeModal();
  stopContinuous();
  const previousView=view;
  if(previousView==='discover'&&nextView!=='discover')cancelStaleDiscovery(null);
  view = nextView;
  setMobileFiltersOpen(false);
  render();
  // Moving focus to the named main landmark announces the destination once.
  main.focus({preventScroll:true});
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  if(nextView==='discover'&&previousView!=='discover'&&!challengeIds.length)maybeTopUp();
}

function render() {
  // A navigation or empty-state transition must also cancel a pending lyric
  // lookup even when there is no next listening card to trigger a new request.
  if(lyricsController && (!lyricsEnabled || view!=='discover' || !current)) cancelCurrentLyrics();
  // The existing card can be replaced by provider updates mid-drag. The next
  // pointerup must never rate a different song after that replacement.
  clearSwipeGesture();
  // Stop old provider work immediately on mode/search/filter switches, even
  // when the newly selected path already has enough cached songs.
  cancelStaleDiscovery();
  // Catalog refreshes may rerender the sidebar while a search is being typed.
  // Keep the unfinished text and its caret; only a deliberate submit commits it.
  // The active listening card is rebuilt on background provider updates.
  // Only restore an interactive player's focus if it is still the SAME song.
  // A navigation, deliberate new song or hidden control must not steal focus.
  const focusedOldControl=document.activeElement;
  // Live provider updates rebuild sidebar HTML even when the mobile Filters
  // dialog is open. Keep focus on the same Done/expand control after redraw.
  const focusedMobileFilterAction=view==='discover' &&
    document.body.classList.contains('mobile-filters-open') &&
    focusedOldControl?.closest?.('#sidebar-preferences') &&
    ['close-mobile-filters','toggle-side-filters'].includes(focusedOldControl.dataset.action)
      ? focusedOldControl.dataset.action : null;
  const previousCard=focusedOldControl?.closest?.('#listening-card');
  const sameListeningTrack=view==='discover' && current &&
    Boolean(previousCard) && renderedListeningTrackId===String(current.id);
  const focusedListeningControl=sameListeningTrack && (
    ['stage-play','preview-volume','lyrics-offset','preview-mode','next-unrated','previous-unrated'].includes(focusedOldControl.id) ||
    focusedOldControl.matches?.('[data-action="lyrics-toggle"],[data-action="toggle-blind"]')
  ) ? (focusedOldControl.matches?.('[data-action="toggle-blind"]')
    ? 'blind-toggle' : (focusedOldControl.id || 'lyrics-toggle')) : null;
  // Choosing a path rebuilds its own buttons. Keep keyboard context on
  // that option instead of moving focus to Play or to the document body.
  const focusedPath=view==='discover' &&
    focusedOldControl?.matches?.('.discovery-paths .path-option[data-path]') &&
    ['familiar','balanced','explore'].includes(focusedOldControl.dataset.path)
    ? focusedOldControl.dataset.path : null;
  // Tune Lab mood choices are replaced when the preference is saved. Keep
  // the selected button focused so keyboard users can compare another mood.
  const focusedQuizMood=view==='quiz' && focusedOldControl?.matches?.('[data-quiz-mood]')
    ? focusedOldControl.dataset.quizMood : null;
  // Hall of Fame redraws its dropdown on a period change. Keep keyboard
  // focus in that dropdown rather than resetting to the browser body.
  const focusedDuelSeason=view==='duels' && focusedOldControl?.id==='duel-season';
  const focusedFilterId=view==='discover' &&
    ['genre-select','language-select','discovery-mix-select'].includes(document.activeElement?.id)
    ? document.activeElement.id : null;
  const focusedSearch=view==='discover' && document.activeElement?.id==='music-search'
    ? document.activeElement : null;
  const searchSelection=focusedSearch
    ? {start:focusedSearch.selectionStart,end:focusedSearch.selectionEnd,direction:focusedSearch.selectionDirection}
    : null;
  const focusedChallengeSearch=view==='challenges' &&
    document.activeElement?.id==='challenge-track-search' ? document.activeElement : null;
  const challengeSearchSelection=focusedChallengeSearch
    ? {start:focusedChallengeSearch.selectionStart,end:focusedChallengeSearch.selectionEnd,
       direction:focusedChallengeSearch.selectionDirection} : null;
  // The whole editor is rebuilt on a provider or state refresh, not only
  // when a listener clicks a button. Remember their exact chosen-song action
  // so a background rerender cannot strand keyboard focus on document.body.
  const focusedChallengeAction=view==='challenges' &&
    focusedOldControl?.matches?.('.challenge-hero [data-action], .challenge-builder [data-action]')
    ? {action:focusedOldControl.dataset.action, id:focusedOldControl.dataset.id || null}
    : null;
  const eligibleForChallenge=syncChallengeDraft();
  // Favorites can change while browsing. Clamp the current results page so
  // removing/adding a track never leaves the visitor on an empty phantom page.
  challengePage=challengeLibraryPage(eligibleForChallenge,challengeDraftIds,challengeFilterQuery,challengePage).page;
  updateChrome();
  const activeFeed=view==='discover'?getFeed():null;
  const queue=view==='discover'&&!challengeIds.length?discoveryQueueSnapshot(activeFeed):null;
  const pages = createViews({ state, catalog, current, allGenres, challengeIds, challengeResponses, challengeSkippedIds, challengeRecovery, challengeDraft:challengeDraftIds, challengeFilterQuery, challengePage, challengeDraftSaved, challengeDraftCustomized, catalogWarning, catalogLive, collectionQuery, collectionSort, collectionPage, collectionGenre, collectionMood, journalFilter,journalPage,removedFavorite: lastRemovedFavorite,
    collectionRecovery:view==='collection'?{...collectionRecoveryPlan(state,catalog,collectionRecoveryAttempted),busy:Boolean(collectionRecoveryFlight),message:collectionRecoveryMessage}:null,
    feed: activeFeed?{ ...activeFeed, loading: activeFeed.loading || (!activeFeed.primed && !current), available:queue?.ready??0,queue,autoAdvanceEnabled,canRevisit:Boolean(revisitablePreview()) }:{}, availableSources, searchQuery, searchDraft, sourceLabel: SOURCE_LABEL[state.source], seedInfo: playlistInfo(), quizSession, quizStats });
  const side = $('#sidebar-preferences');
  if (side) { side.innerHTML = view === 'discover' ? pages.renderSidebarPreferences() : ''; side.hidden = view !== 'discover'; side.classList.toggle('is-collapsed', sidebarFiltersCollapsed); const toggle = side.querySelector('[data-action=toggle-side-filters]'); if(toggle) {toggle.setAttribute('aria-expanded',String(!sidebarFiltersCollapsed));toggle.textContent = sidebarFiltersCollapsed ? '▸' : '▾';}}
  if (focusedMobileFilterAction && side && document.body.classList.contains('mobile-filters-open')) {
    side.querySelector('[data-action="'+focusedMobileFilterAction+'"]')?.focus({preventScroll:true});
  }
  if (focusedFilterId) {
    // Sidebar preferences are rebuilt when a filter changes. Keep keyboard
    // focus on the new select instead of leaving it on the document body.
    $('#'+focusedFilterId)?.focus({preventScroll:true});
  }
  if (searchSelection && view==='discover') {
    const replacement=$('#music-search');
    if (replacement) {
      replacement.focus({preventScroll:true});
      replacement.setSelectionRange(searchSelection.start,searchSelection.end,searchSelection.direction);
    }
  }
  switch (view) {
    case 'collection':
      main.innerHTML = pages.renderCollection();
      // The view clamps stale positions after deletions or collection changes.
      collectionPage=Number(main.querySelector('#collection-page-select')?.value||1);
      collectionGenre=main.querySelector('#collection-genre')?.value||'all';
      collectionMood=main.querySelector('#collection-mood')?.value||'all';
      break;
    case 'taste':
      main.innerHTML=pages.renderTaste();
      journalPage=Number(main.querySelector('#journal-page-status')?.dataset.page||1);
      break;
    case 'challenges': main.innerHTML = pages.renderChallenges(); break;
    case 'quiz': main.innerHTML = pages.renderQuizLab(); break;
    case 'duels': main.innerHTML = renderDuels({tournaments:duelTournaments,selectedId:selectedDuelId,catalog,favorites:state.favorites,savedTracks:state.savedTracks,volume:state.volume,sound:state.sound,hallSeason}); break;
    default: main.innerHTML = pages.renderDiscovery();
  }
  if(challengeSearchSelection && view==='challenges') {
    const replacement=main.querySelector('#challenge-track-search');
    if(replacement) {
      replacement.focus({preventScroll:true});
      replacement.setSelectionRange(challengeSearchSelection.start,
        challengeSearchSelection.end,challengeSearchSelection.direction);
    }
  }
  if(focusedChallengeAction && view==='challenges') {
    // Never substitute a different song merely because search/pagination
    // changed; prefer that song's remaining control, then the named search.
    const buttons=[...main.querySelectorAll(
      '.challenge-hero [data-action], .challenge-builder [data-action]')];
    const usable=button=>Boolean(button && !button.disabled &&
      button.getClientRects().length && !button.closest('[hidden], [inert]'));
    const same=buttons.find(button=>
      button.dataset.action===focusedChallengeAction.action &&
      (button.dataset.id || null)===focusedChallengeAction.id && usable(button));
    const sameTrack=focusedChallengeAction.id
      ? buttons.find(button=>button.dataset.id===focusedChallengeAction.id && usable(button))
      : null;
    const fallback=main.querySelector('#challenge-track-search') || main;
    (same || sameTrack || fallback).focus({preventScroll:true});
  }
  applySavedVolume();
  // render() replaced the controls: reapply the currently active Play state
  // even when the player itself has not changed.
  previewButtonStateKey=null;
  updatePlaybackView();
  if(focusedQuizMood && view==='quiz') {
    const replacement=main.querySelector('[data-quiz-mood="'+focusedQuizMood+'"]');
    if(replacement && !replacement.disabled && replacement.getClientRects().length)
      replacement.focus({preventScroll:true});
  }
  if(focusedDuelSeason && view==='duels')
    main.querySelector('#duel-season')?.focus({preventScroll:true});
  if(focusedPath && view==='discover') {
    const replacement=$('.discovery-paths .path-option[data-path="'+focusedPath+'"]');
    if(replacement && !replacement.disabled && replacement.getClientRects().length &&
       !replacement.closest('[hidden], [inert]'))
      replacement.focus({preventScroll:true});
  }
  if (view === 'discover') {
    if (current && lyricsEnabled) void requestCurrentLyrics(current);
    updateLyricView();
  }
  // Track what we actually rendered for the NEXT refresh; a new card or
  // leaving Discover resets the continuity check without exposing track IDs.
  renderedListeningTrackId=view==='discover' && $('#listening-card')
    ? String(current?.id ?? '') : null;
  if(focusedListeningControl && view==='discover' && renderedListeningTrackId) {
    const replacement=focusedListeningControl==='lyrics-toggle'
      ? $('#listening-card [data-action="lyrics-toggle"]')
      : focusedListeningControl==='blind-toggle'
        ? $('#listening-card [data-action="toggle-blind"]')
        : $('#'+focusedListeningControl);
    if(replacement && !replacement.disabled &&
       !replacement.closest('[hidden], [inert]') && replacement.getClientRects().length)
      replacement.focus({preventScroll:true});
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
    const hadDialog=Boolean(modalRoot.querySelector('[role="dialog"]'));
    modalRoot.innerHTML='';
    $('.shell').inert=false;
    if(hadDialog) {
      const opener=modalReturnFocus?.isConnected && !modalReturnFocus.closest('[hidden], [inert]')
        ? modalReturnFocus : main;
      modalReturnFocus=null;
      opener.focus({preventScroll:true});
    }
    return;
  }
  $('.shell').inert=true;
  // A live palette refresh must not throw keyboard users back to the close button.
  const previousTheme=modalRoot.contains(document.activeElement)
    ? document.activeElement?.getAttribute('data-set-theme') : null;
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
        <div class="intro-artist-actions"><span id="intro-artist-count" role="status" aria-live="polite">${chosenArtists.length} of ${FAVORITE_ARTIST_LIMIT} selected</span><button class="accent-button" data-modal="onboarding-artists">Find my music →</button></div><p id="intro-save-status" class="playlist-link-status" role="status" aria-live="polite" hidden></p>
      </div>
      <div class="intro-alternatives"><div class="intro-choice"><div class="intro-choice-title"><strong>02 · Start without favorites</strong><span>Build your taste from scratch through your swipes.</span></div><button class="secondary-button" data-modal="onboarding-fresh">Just discover →</button></div>
      <div class="intro-choice"><div class="intro-choice-title"><strong>03 · Import a playlist</strong><span>Use a Deezer link, CSV/JSON export, or paste songs you already love.</span></div><button class="secondary-button" data-modal="onboarding-playlist">Import playlist →</button></div></div>
      <p class="playlist-import-hint">The artists are stored locally. You can change your choice later under Personalization. Fresh discovery is the default each time you reopen AFTERTONE.</p>`;
  } else if (modal.kind === 'playlist') {
    const existing = {ready:Boolean(playlistProfile?.totalSongs),count:playlistProfile?.totalSongs||0,
      artists:playlistProfile?.artistCount||0,active:seedActive&&seedKind==='playlist'};
    body = `<div class="eyebrow">OPTIONAL · YOUR MUSIC, YOUR RULES</div><h2>Teach AFTERTONE your taste.</h2><p class="modal-copy">Fresh discovery always comes first. Importing is optional and local to this browser. The songs you bring are used as clues to find <strong>different songs and related artists</strong>—not added automatically to your favorites.</p>
      <div class="playlist-import-panel"><label for="playlist-link">Import a playlist link</label>
      <div class="playlist-link-row"><input id="playlist-link" type="url" inputmode="url" autocomplete="url" placeholder="https://www.deezer.com/playlist/… or Spotify playlist URL" maxlength="2048" /><button class="secondary-button" type="button" data-modal="playlist-link-import">Import link</button></div>
      <p id="playlist-link-status" class="playlist-link-status" role="status" aria-live="polite">Public Deezer links import songs directly, with no account setup. Spotify URLs are recognized, but importing their track list requires authorization Spotify does not offer to this music game.</p>
      <label for="playlist-file">Choose a playlist CSV or JSON export</label><input id="playlist-file" type="file" accept=".csv,.json,.txt,text/csv,application/json,text/plain"/><p class="playlist-import-hint">For Spotify, export your own playlist as a CSV/JSON, or paste its artist–song list below. Spotify links alone cannot provide track details under the current platform rules.</p>
      <label for="playlist-paste">Or paste a list of songs</label><textarea id="playlist-paste" rows="6" placeholder="Paramore - Still Into You&#10;Charlie Puth - How Long&#10;The Weeknd - Blinding Lights"></textarea><p class="playlist-import-hint">One <strong>Artist - Song</strong> per line; CSVs with Track Name / Artist Name columns also work. Up to 5,000 input rows are read, and up to 3,000 unique songs can be saved. Larger playlists must be reduced before replacing your import.</p><p id="playlist-file-status" class="playlist-link-status" role="status" aria-live="polite" hidden></p></div>
      ${existing.ready ? `<p class="playlist-loaded-note">Saved in this browser: ${existing.count.toLocaleString()} songs from ${existing.artists.toLocaleString()} artists · ${existing.active ? 'Tailoring is active' : 'Not active until you choose it'}</p><div class="modal-actions"><button class="secondary-button" data-modal="playlist-clear">Delete saved import</button><button class="secondary-button" data-modal="playlist-use-saved">Use saved playlist</button></div>` : ''}
      <div class="modal-actions"><button class="secondary-button" data-modal="close">Maybe later · keep it fresh</button><button class="accent-button" data-modal="playlist-import">Import & tailor discovery ↗</button></div><p class="playlist-import-hint">Song names stay in your browser; when tailoring is active, selected artist names are sent to the locally running server for Deezer discovery and public related-artist lookups. You can switch back to fresh mode any time.</p>`;
  } else if (modal.kind === 'help') {
    body = `<div class="eyebrow">A QUICK INTRO</div><h2>Discover on your terms.</h2><p class="modal-copy">See the title, artist and cover before pressing Play to hear a 22-second preview. Swipe left (or press ←) to pass, or right (→) to keep it. Keeping a song saves it immediately and moves on. Play recognition games whenever you feel like it in Tune Lab.</p><div class="insight-list"><div class="insight"><strong>Blind mode is optional</strong><p>Use the switch in the left sidebar to hide the card title and artwork. The listening card hides the details until you choose.</p></div><div class="insight"><strong>Recognition is optional</strong><p>Tune Lab has optional recognition questions and mood ratings from songs you saved. Swipe decisions never require a quiz.</p></div><div class="insight"><strong>Start fresh or import a playlist</strong><p>Fresh discovery is always the default. Choose five artists, import a public Deezer playlist link, or bring a CSV/JSON export to add optional clues. Your initial artists do not dominate Balanced mode. Searching for a specific song is temporary; only your actual choices help shape the long-term taste profile.</p></div><div class="insight"><strong>Big catalogs, loaded in pages</strong><p>Deezer is the single visible discovery source. Its short-lived public preview links play directly in AFTERTONE. Press Play once to enable continuous discovery and Stop to end. Public game usage still requires permission from Deezer.</p></div></div><div class="sidebar-label" style="margin:22px 0 13px">PERSONALIZE YOUR ROOM</div><button class="secondary-button" data-modal="themes">Explore all 20 color themes →</button><div class="modal-actions"><button class="accent-button" data-modal="close">Let's listen →</button></div>`;
  } else if (modal.kind === 'themes') {
    body = `<div class="eyebrow">MAKE IT YOURS / 20 PALETTES</div><h2>Find your frequency.</h2><p class="modal-copy">Pick a look that feels right. Your choice saves automatically in this browser.</p><div class="theme-gallery" role="group" aria-label="Choose a color theme">${THEMES.map((t) => themeSwatch(t, true)).join('')}</div><div class="modal-actions"><button class="accent-button" data-modal="close">Done →</button></div>`;
  } else if (modal.kind === 'share-link') {
    body = `<div class="eyebrow">PASS THE AUX / SHARING</div><h2>Copy your challenge link.</h2>
      <p class="modal-copy">This browser blocked automatic clipboard access. You can still share the exact challenge you built: select and copy the link below.</p>
      <label for="share-link-value">Your shareable challenge link</label>
      <input id="share-link-value" class="share-link-input" type="text" inputmode="url" readonly value="${html(modal.link)}" aria-describedby="share-link-help" />
      <p id="share-link-help" class="modal-copy">The entire link is selected. Press Ctrl+C (or Command+C on Mac), then paste it into a message. Only the ordered public Deezer song IDs are in the link.</p>
      <div class="modal-actions"><button type="button" class="accent-button" data-modal="close">Done</button></div>`;
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
  modalRoot.innerHTML = `<div class="modal ${modal.kind === 'themes' ? 'modal-themes' : modal.kind === 'youtube' ? 'modal-youtube' : modal.kind === 'onboarding' ? 'modal-onboarding' : ''}" role="dialog" aria-modal="true" aria-label="${modal.kind === 'help' ? 'How to play' : modal.kind === 'themes' ? 'Appearance themes' : modal.kind === 'onboarding' ? 'Set up your music taste' : modal.kind === 'playlist' ? 'Import a playlist' : modal.kind === 'youtube' ? 'YouTube music preview' : modal.kind === 'share-link' ? 'Copy challenge link' : 'Music recognition challenge'}"><button class="modal-close" data-modal="close" aria-label="Close dialog">×</button>${body}</div>`;
  const restoreTheme=previousTheme
    ? [...modalRoot.querySelectorAll('[data-set-theme]')].find(button=>button.dataset.setTheme===previousTheme)
    : null;
  if (modal.kind === 'share-link') {
    const field=modalRoot.querySelector('#share-link-value');
    field?.focus({preventScroll:true});
    field?.select(); // Native keyboard copy, even when browser clipboard APIs are denied.
  } else (restoreTheme || modalRoot.querySelector('button[data-modal],button[data-answer],button[data-mood]'))?.focus();
}
/** Keep Tab inside the active dialog; focus returns to its opener on close. */
function trapModalTab(event) {
  const dialog=modalRoot.querySelector('[role="dialog"]');
  if(!dialog)return;
  const controls=[...dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
    .filter(element=>element.getClientRects().length && !element.closest('[hidden], [inert]'));
  if(!controls.length) {
    event.preventDefault();
    dialog.setAttribute('tabindex','-1');
    dialog.focus();
    return;
  }
  const first=controls[0], last=controls[controls.length-1];
  if(event.shiftKey && (document.activeElement===first || !dialog.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if(!event.shiftKey && (document.activeElement===last || !dialog.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
}

async function findRelatedForPlaylist(version) {
  const signal=relatedRequestScope.signal;
  if (signal.aborted || version!==seedVersion || !activeSeedProfile() || !seedActive) return;
  relatedLookupStatus='searching'; render();
  // This work is non-blocking. Deezer charts are already playable while the
  // artist graph loads. Two concurrent lookups limit API pressure.
  const choices=activeSeedProfile()?.artists.slice(0,FAVORITE_ARTIST_LIMIT) || [];
  let nextIndex=0;
  const worker=async () => {
    while(nextIndex<choices.length && seedActive && version===seedVersion && !signal.aborted) {
      const candidate=choices[nextIndex++];
      try {
        const response=await apiFetch(`/api/related-artists?artist=${encodeURIComponent(candidate.artist)}`,{signal});
        if(!response.ok) continue;
        const data=await response.json();
        if (signal.aborted || !seedActive || version!==seedVersion || !Array.isArray(data.related)) return;
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
  if(!signal.aborted && seedActive && version===seedVersion) {
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
  const signal=relatedRequestScope.signal;
  if(signal.aborted || version!==seedVersion) return;
  const seeds=likedArtistLanes(state.history,5).map(x=>x.artist)
    .filter(name=>!expandedArtists.has(artistKey(name)));
  if(!seeds.length) return;
  await Promise.all(seeds.slice(0,3).map(async name=>{
    const key=artistKey(name);
    expandedArtists.add(key);
    try {
      const response=await apiFetch(`/api/related-artists?artist=${encodeURIComponent(name)}`,{signal});
      if(!response.ok || signal.aborted || version!==seedVersion) return;
      const data=await response.json();
      if(signal.aborted || version!==seedVersion || !Array.isArray(data.related)) return;
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
  const signal=relatedRequestScope.signal;
  if(signal.aborted || track?.source!=='deezer' || version!==seedVersion) return;
  const artist=String(track.artist || '').trim();
  const norm=artistKey(artist);
  if(!norm || expandedArtists.has(norm) || expandedArtists.size >= 12) return;
  expandedArtists.add(norm);
  try {
    const response=await apiFetch(`/api/related-artists?artist=${encodeURIComponent(artist)}`,{signal});
    if(!response.ok || signal.aborted || version!==seedVersion) return;
    const data=await response.json();
    if(signal.aborted || version!==seedVersion || !Array.isArray(data.related)) return;
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
  seedActive = true; seedKind = 'playlist'; advanceSeedVersion(); seedRelated = []; relatedLookupStatus='idle'; expandedArtists.clear(); resetArtistRotation();
  state.source = availableSources.includes('deezer') ? 'deezer' : 'featured';
  state.genre = 'all'; state.language = 'all';
  searchQuery = ''; searchDraft = '';
  persist(); rememberSource(); stopContinuous(); current = null;
  cancelPlaylistLinkFlight();
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
  const nextArtists=parseFavoriteArtists(artists);
  if (!nextArtists.length) return showPersonalizationStatus('intro-save-status','Add at least one artist you love to begin.');
  if (!saveFavoriteArtists(localStorage,nextArtists))
    return showPersonalizationStatus('intro-save-status','Artist preferences could not be confirmed as saved. Check browser storage and try again. Your active profile has not changed.');
  chosenArtists=nextArtists;
  seedActive=true; seedKind='artists'; advanceSeedVersion(); seedRelated=[]; relatedLookupStatus='idle'; expandedArtists.clear(); resetArtistRotation();
  state.source='deezer'; state.genre='all'; state.language='all';
  searchQuery='';searchDraft='';stopContinuous();current=null;
  persist(); modal=null;renderModal();render();void loadMore(state.genre,true);
  void findRelatedForPlaylist(seedVersion);
  toast(`Finding songs based on ${chosenArtists.slice(0,3).join(', ')}${chosenArtists.length>3?' and more':''}. Switch to fresh anytime.`);
}
function startFreshDiscovery() {
  seedActive = false; advanceSeedVersion(); seedRelated = []; relatedLookupStatus='idle'; expandedArtists.clear(); resetArtistRotation();
  searchQuery=''; searchDraft=''; state.genre='all'; persist();
  stopContinuous(); current = null; chooseNext(); render(); maybeTopUp();
  toast('Fresh discovery is on. No artist or playlist seeds are active.');
}
function finishPlaylistImport(data) {
  // Validate and verify the replacement before changing the active profile.
  // The file/link dialog remains open on failure, with all inputs intact.
  const next=preparePlaylistImport(data);
  const profile=buildSeedProfile(next);
  if(!profile.totalSongs)throw new Error('No valid playlist songs were found.');
  if(!savePlaylist(localStorage,next))
    throw new Error('Playlist could not be confirmed as saved. Check browser storage and try again. Your active profile has not changed.');
  importedPlaylist=next;
  playlistProfile=profile;
  startPlaylistDiscovery();
  return next.tracks.length;
}

async function importPlaylistFromDialog() {
  const dialog=modal;
  if(dialog?.kind!=='playlist' || playlistFileFlight || playlistLinkFlight)return;
  const file = $('#playlist-file', modalRoot)?.files?.[0];
  const pasted = $('#playlist-paste', modalRoot)?.value?.trim();
  if (file && file.size > 3_000_000) return showPersonalizationStatus('playlist-file-status','The file must be under 3 MB.');
  const flight={dialog};
  playlistFileFlight=flight;
  const button=$('[data-modal="playlist-import"]',modalRoot);
  if(button)button.disabled=true;
  showPersonalizationStatus('playlist-file-status','Checking playlist…',false);
  try {
    const content=file ? await file.text() : pasted;
    // File reads can finish after Escape or after a different dialog opens.
    if(modal!==dialog || dialog?.kind!=='playlist') return;
    if(playlistFileFlight!==flight)return;
    finishPlaylistImport(parsePlaylist(content));
  } catch(error) {
    if(modal===dialog && playlistFileFlight===flight)
      showPersonalizationStatus('playlist-file-status',error.message);
  } finally {
    if(playlistFileFlight===flight)playlistFileFlight=null;
    if(modal===dialog && button?.isConnected)button.disabled=false;
  }
}

/** A link is resolved by our same-origin server, never fetched from a visitor URL directly. */
async function importPlaylistLinkFromDialog() {
  const dialog=modal;
  if(dialog?.kind!=='playlist' || playlistLinkFlight || playlistFileFlight) return;
  const link = $('#playlist-link', modalRoot)?.value?.trim();
  const status = $('#playlist-link-status', modalRoot);
  const button = $('[data-modal="playlist-link-import"]',modalRoot);
  if (!link) { if(status) {status.textContent='Paste a playlist link first.';status.classList.add('is-error');} return; }
  const controller=new AbortController();
  const flight={dialog,controller};
  playlistLinkFlight=flight;
  if (button) { button.disabled=true;button.textContent='Reading playlist…'; }
  if (status) {status.textContent='Checking the public playlist…';status.classList.remove('is-error');}
  try {
    const response=await apiFetch(`/api/playlist-link?url=${encodeURIComponent(link)}`,{signal:controller.signal});
    const result=await response.json();
    // A newly opened playlist dialog is not the dialog that requested this
    // data. Ignore late results even if a provider disregards cancellation.
    if(controller.signal.aborted || modal!==dialog || playlistLinkFlight!==flight) return;
    if (!response.ok || !Array.isArray(result.tracks) || !result.tracks.length) throw new Error(result.error || 'No songs available from this link.');
    const savedCount=finishPlaylistImport(result);
    toast(`Imported ${savedCount.toLocaleString()} tracks from ${result.playlistTitle || 'Deezer'}${result.truncated ? ' (first 2,000 provider entries)' : ''}.`);
  } catch(error) {
    if(!controller.signal.aborted && modal===dialog && playlistLinkFlight===flight && status?.isConnected) {
      status.textContent=error.message;status.classList.add('is-error');
    }
  } finally {
    if(playlistLinkFlight===flight) playlistLinkFlight=null;
    if(modal===dialog && !controller.signal.aborted && button?.isConnected) {
      button.disabled=false;button.textContent='Import link';
    }
  }
}

function openModal(kind, extra = {}) {
  cancelPendingChoice();
  cancelPlaylistLinkFlight();
  setThemeMenuOpen(false);
  const focusedBefore=document.activeElement;
  const wasMobileDrawerAction=document.body.classList.contains('mobile-filters-open') &&
    Boolean(focusedBefore?.closest?.('#sidebar-preferences'));
  // Avoid two simultaneous aria-modal dialogs if an action opens Help or
  // another full dialog while the mobile discovery drawer is visible.
  if (document.body.classList.contains('mobile-filters-open')) setMobileFiltersOpen(false);
  if(!modal) {
    // An opener inside the now-hidden drawer is not a useful focus return
    // target. Restore to the visible Filters toggle when that modal closes.
    const opener=wasMobileDrawerAction ? $('#mobile-refine-toggle') : focusedBefore;
    modalReturnFocus=opener instanceof HTMLElement && opener!==document.body &&
      !modalRoot.contains(opener) ? opener : main;
  }
  modal = { kind, ...extra };
  // A dialog is an explicit interruption. A slow on-demand preview must not
  // finish loading and begin playing behind an inert application shell.
  continuousListening = false;
  consecutivePlaybackFailures = 0;
  if (isLoadingAudio) stopAudio(); // Abort pending metadata and invalidate its generation.
  else audio.pause(); // Keep an already-loaded preview's position for a later manual Play.
  updatePlaybackView();
  updateQueueView();
  renderModal();
}

function recordDecision(id, action, extra = {}) {
  const meta=lookup(id);
  let next=recordChoice(state,{id,action,genre:meta?.genre,artist:meta?.artist,title:meta?.title,
    context:challengeIds.length?'challenge':searchQuery?'search':'discovery',route:state.discoveryMix,...extra});
  if(action==='like' && next!==state) {
    try { next=addCollectionTracks(next,meta?[meta]:[]); }
    catch(error) { stopContinuous();render();toast(error.message);return false; }
  }
  // A failed/quota-limited or silently ignored write must not count as a
  // Keep/Pass, change the active song, or advance a shared challenge.
  if(!commitSessionChange(next)) {
    render(); // Restore the card after its swipe feedback was applied.
    return false;
  }
  if(challengeIds.length)challengeResponses.push({id,action});
  if(action==='like' && meta)void expandRelatedFromLike(meta,seedVersion);
  stopAudio();
  chooseNext();
  render();
  maybeTopUp();
  maybeResumeContinuous();
  return true;
}

function closeModal() {
  if (!modal) return;
  cancelPlaylistLinkFlight();
  if (modal.kind === 'onboarding') { try {localStorage.setItem(INTRO_STORAGE_KEY,'1');} catch {} }
  const wasChoice = modal.kind === 'choice';
  const choice = modal;
  modal = null;
  renderModal();
  updateQueueView();
  if (wasChoice && choice.id) recordDecision(choice.id, 'like', { recognized: choice.recognized, correct: choice.correct, mood: choice.mood });
}

/** The decision buttons live inside a card replaced on Keep, Pass and Undo.
 * Preserve focus only when the user actually activated one of those buttons;
 * gesture/shortcut users should keep their current keyboard context.
 */
function restoreDecisionFocus(action) {
  const button = current ? $('#listening-card [data-action="' + action + '"]') : null;
  (button && !button.disabled ? button : main).focus({preventScroll:true});
}

/** Cancel an unfinished visual decision when leaving its listening context.
 * A delayed callback must never rate a different song or a new challenge. */
function cancelPendingChoice() {
  const choice=pendingChoice;
  if(!choice)return;
  pendingChoice=null;
  animatingChoice=false;
  clearTimeout(choice.timer);
  choice.card?.classList.remove('swipe-like','swipe-pass');
  const stamp=choice.card?.querySelector('#decision-stamp');
  if(stamp){stamp.textContent='';delete stamp.dataset.feedback;}
}

function acceptChoice(action) {
  if (view !== 'discover' || !current || modal || animatingChoice ||
      !['like','pass'].includes(action)) return;
  animatingChoice = true;
  const selected = current.id;
  const card = $('#listening-card');
  const origin = card?.querySelector('[data-action="' + action + '"]');
  const returnFocus = document.activeElement === origin;
  // Bind to the exact listening context, even if an obsolete callback runs
  // after clearTimeout or the same track ID reappears in a different queue.
  const choice={card,selected,action,timer:null,challenge:challengeIds,
    feed:getFeed(),origin,returnFocus};
  pendingChoice=choice;
  if (card) {
    const stamp = $('#decision-stamp', card);
    if (stamp) { stamp.textContent = action === 'like' ? '♥' : 'NOPE'; stamp.dataset.feedback = action; }
    card.classList.add(action === 'like' ? 'swipe-like' : 'swipe-pass');
  }
  // A pending metadata request must not restart audio during the animation.
  if(isLoadingAudio)stopAudio();else audio.pause();
  const finish = () => {
    if(pendingChoice!==choice)return;
    if(view!=='discover' || modal || current?.id!==selected ||
        challengeIds!==choice.challenge || getFeed()!==choice.feed) {
      cancelPendingChoice();
      return;
    }
    const restoreFocus=choice.returnFocus &&
      (document.activeElement===choice.origin || document.activeElement===document.body);
    pendingChoice=null;
    animatingChoice=false;
    recordDecision(selected,action);
    if (restoreFocus) restoreDecisionFocus(action);
  };
  // One bounded timer per gesture; honor the reduced-motion preference.
  choice.timer=setTimeout(finish, matchMedia('(prefers-reduced-motion: reduce)').matches ? 15 : 190);
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
    if (action === 'playlist-use-saved' && !playlistFileFlight && !playlistLinkFlight) return startPlaylistDiscovery();
    if (action === 'playlist-clear') {
      if(playlistFileFlight || playlistLinkFlight)return;
      if(!savePlaylist(localStorage,null))
        return showPersonalizationStatus('playlist-file-status','Playlist deletion could not be confirmed. Your active profile has not changed. Check browser storage and try again.');
      const wasActive=seedActive && seedKind==='playlist';
      importedPlaylist=null; playlistProfile=null;
      closeModal();
      if(wasActive) {
        seedRelated=[]; seedActive=false; advanceSeedVersion(); relatedLookupStatus='idle'; expandedArtists.clear(); resetArtistRotation();
        stopContinuous(); current=null; chooseNext(); render(); maybeTopUp();
      } else render();
      toast(wasActive?'Saved playlist deleted. Fresh mode is active.':'Saved playlist deleted. Your current discovery mode is unchanged.');
      return;
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
  const returnFocus=view==='quiz' && document.activeElement?.matches?.(
    '[data-action="quiz-start"], [data-action="quiz-next"]');
  const ids=state.favorites.filter(id=>Boolean(lookup(id)));
  if (!ids.length) {quizSession=null; render(); return;}
  const candidates = ids.filter(id=>id!==quizSession?.id);
  const chosen = (candidates.length ? candidates : ids)[Math.floor(Math.random()*(candidates.length||ids.length))];
  const track=lookup(chosen);
  const savedMood=state.savedTracks.find(t=>t.id===chosen)?.mood;
  const priorMood=state.history.findLast(h=>h.id===chosen)?.mood;
  const mood=[savedMood,priorMood,track?.mood].find(value=>MOODS.includes(value))||null;
  quizSession={id:chosen,quiz:makeRecognitionQuiz(track,catalog),answer:null,mood};
  render();
  // Start / Next replace their own button. Move only a keyboard-initiated
  // action to an answer or the visible Skip control on the new question.
  if(returnFocus)
    (main.querySelector('[data-quiz-answer]:not(:disabled)') ||
     main.querySelector('[data-action="quiz-next"]') || main).focus({preventScroll:true});
}

function cancelSharedChallengeLookup() {
  challengeLookupSerial++;
  challengeLookupController?.abort();
  challengeLookupController=null;
}

/** Preserve the full link on partial/outage failures. Resolve only public
 * Deezer IDs; old provider IDs cannot be resolved on the Deezer-only site.
 * Every response is generation-checked before it may enter the catalog.
 */
async function hydrateSharedChallenge({initial=false,returnFocus=false}={}) {
  if(!challengeIds.length)return;
  cancelSharedChallengeLookup();
  const serial=challengeLookupSerial;
  const missing=challengeIds.filter(id=>!lookup(id));
  const deezerMissing=missing.filter(isPublicDeezerChallengeId);
  const controller=new AbortController();
  challengeLookupController=controller;
  challengeRecovery={
    waiting:true,loading:Boolean(deezerMissing.length),requested:challengeIds.length,
    available:challengeIds.length-missing.length,missing,
    canRetry:Boolean(deezerMissing.length),failed:false,
  };
  if(!initial) {
    current=null;
    stopContinuous();
    stopAudio();
    render();
    if(returnFocus) (main.querySelector('#challenge-recovery-heading') || main)
      .focus({preventScroll:true});
  }
  let failed=false;
  if(deezerMissing.length) {
    try {
      const response=await apiFetch('/api/challenge-tracks?ids='+encodeURIComponent(deezerMissing.join(',')),
        {signal:controller.signal});
      if(!response.ok)throw new Error('Shared-track lookup rejected');
      const payload=await response.json();
      if(controller.signal.aborted || serial!==challengeLookupSerial)return;
      const allowed=new Set(deezerMissing);
      if(Array.isArray(payload.tracks))
        addToCatalog(payload.tracks.filter(track=>allowed.has(track?.id)));
    }catch(error) {
      if(controller.signal.aborted || serial!==challengeLookupSerial)return;
      failed=true; // Keep a persistent retry action instead of a disappearing toast.
    }
  }
  if(controller.signal.aborted || serial!==challengeLookupSerial)return;
  challengeLookupController=null;
  const remaining=challengeIds.filter(id=>!lookup(id));
  challengeRecovery=remaining.length ? {
    waiting:true,loading:false,requested:challengeIds.length,
    available:challengeIds.length-remaining.length,missing:remaining,
    canRetry:remaining.some(isPublicDeezerChallengeId),failed,
  } : null;
  chooseNext();
  if(!initial) {
    render();
    if(returnFocus) {
      (main.querySelector('[data-action="retry-shared-challenge"]') ||
        main.querySelector('#stage-play') || main).focus({preventScroll:true});
    }
  }
}

function continueSharedChallenge(returnFocus=false) {
  if(!challengeRecovery?.waiting || challengeRecovery.loading)return;
  const playable=challengeIds.filter(id=>Boolean(lookup(id)));
  if(!playable.length)return; // No synthetic votes or empty bracket.
  const skipped=challengeIds.length-playable.length;
  challengeIds=playable;
  challengeRecovery=skipped ? {waiting:false,skipped} : null;
  chooseNext();
  render();
  if(returnFocus) (main.querySelector('#stage-play')||main).focus({preventScroll:true});
  toast('Playing '+playable.length+' available '+(playable.length===1?'song':'songs')+
    (skipped ? '; '+skipped+' unavailable in this link.' : '.'));
}

function exitSharedChallenge(returnFocus=false) {
  cancelSharedChallengeLookup();
  stopContinuous();
  stopAudio();
  challengeIds=[];
  challengeResponses=[];
  challengeSkippedIds.clear();
  challengeRecovery=null;
  history.replaceState(null,'',location.pathname);
  chooseNext();
  render();
  // Shared links skip normal startup discovery. Refill it when leaving.
  void loadMore(state.genre,true,false,returnFocus);
  if(returnFocus) (main.querySelector('#stage-play')||main).focus({preventScroll:true});
}

function playSampleChallenge() {
  const ids=catalog.filter(track=>isPublicDeezerChallengeId(track?.id))
    .slice(0,5).map(track=>track.id);
  const value=encodeChallenge(ids);
  if(!value)return toast('No sample songs loaded yet. Visit Discover, then try again.');
  cancelSharedChallengeLookup();
  challengeRecovery=null;
  challengeIds=ids;
  challengeResponses=[];
  challengeSkippedIds.clear();
  history.replaceState(null,'',location.pathname+'?challenge='+encodeURIComponent(value));
  current=null;
  chooseNext();
  goTo('discover');
  toast('Sample challenge activated · '+ids.length+' blind '+(ids.length===1?'track':'tracks')+' ready.');
}

async function shareChallenge() {
  // Revalidate against the CURRENT saved public catalog, not stale draft DOM.
  // No private paths, saved preferences, history, or preview URLs are shared.
  const eligible=syncChallengeDraft();
  const ids=reconcileChallengeDraft(challengeDraftIds,eligible);
  const value=encodeChallenge(ids);
  if(!value)return toast('Select a saved Deezer song to make a shared challenge.');
  const link=new URL(location.pathname,location.origin);
  link.searchParams.set('challenge',value);
  await copy(link.toString(),ids.length+'-song challenge link copied. Send it to a friend!');
}

async function copy(value, message) {
  try {
    await navigator.clipboard.writeText(value);
    toast(message);
  } catch {
    // A denied clipboard API is common on mobile/restricted browsers. The
    // legacy copy command may fail or throw, so always clean up the temporary
    // element and give the listener a selectable link as a last resort.
    const input = document.createElement('textarea');
    input.value = value;
    input.style.position = 'fixed'; input.style.opacity = '0';
    document.body.append(input); input.select();
    let copied = false;
    try { copied = Boolean(document.execCommand('copy')); }
    catch { /* Clipboard denied; offer a manual route. */ }
    finally { input.remove(); }
    if (copied) return toast(message);
    // The asynchronous clipboard request might finish after navigation. Never
    // interrupt a different view or an existing dialog with an old share link.
    if (view !== 'challenges' || modal) return;
    const opener=main.querySelector('[data-action="share-challenge"]');
    opener?.focus({preventScroll:true});
    openModal('share-link',{link:value});
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
/** After a bracket rebuild, announce the new reachable stage by moving focus
 * to its first preview, or to the final podium heading. No audio is started. */
function focusDuelStage() {
  if(view!=='duels') return;
  const target=main.querySelector('#duel-active-event [data-duel-play]') ||
    main.querySelector('#duel-podium-heading');
  target?.focus({preventScroll:true});
}
/** Closing/deleting a bracket should return the keyboard to a usable archive
 * action, not leave focus on a removed Close/Delete button. */
function focusDuelArchive(id) {
  const target=[...main.querySelectorAll('.duel-history [data-duel-action="open"]')]
    .find(button=>button.dataset.duelId===id) ||
    main.querySelector('.duel-history [data-duel-action="open"]') ||
    main.querySelector('[data-duel-theme]') || main;
  target.focus({preventScroll:true});
}
function registerTournament(event) {
  if (duelTournaments.length>=40) {
    toast('The tournament archive is full (40). Delete an old event to create another.');
    return;
  }
  if(!writeDuelArchive([...duelTournaments,event]))return;
  setDuelSelection(event.id);
  stopContinuous();render();focusDuelStage();
  document.querySelector('#duel-active-event')?.scrollIntoView({behavior:motionSafeScroll(),block:'start'});
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
    let next;
    try { next=addCollectionTracks(state,winners); }
    catch(error){return toast(error.message);}
    const added=next.favorites.length-state.favorites.length;
    if(!commitSessionChange(next))return;
    for(const track of winners)if(!catalogIds.has(track.id))addToCatalog([track]);
    render();
    return toast(added?`${added} champions added to your Collection.`:'All champions are already saved.');
  }
  if(action==='create-cup') {
    const champions=availableChampions(duelTournaments);
    const size=[16,8,4,2].find(n=>champions.length>=n);
    if(!size) return toast('Finish at least two tournaments with different winners.');
    try {registerTournament(createTournament({id:createDuelId(),name:`Champions Cup · ${new Date().toLocaleDateString()}`,kind:'champions',tracks:randomizeTracks(champions).slice(0,size)}));}
    catch(error){toast(error.message);}
    return;
  }
  if(action==='open') {if(!duelTournaments.some(t=>t.id===id))return;setDuelSelection(id);stopAudio();render();focusDuelStage();return;}
  if(action==='dismiss') {const previousId=selectedDuelId;setDuelSelection(null);stopAudio();render();focusDuelArchive(previousId);return;}
  if(action==='delete') {
    const event=duelTournaments.find(t=>t.id===id);
    if(!event || !confirm(`Delete tournament “${event.name}”? This cannot be undone.`)) return;
    if(!writeDuelArchive(duelTournaments.filter(t=>t.id!==id)))return;
    if(selectedDuelId===id)setDuelSelection(null);
    stopAudio();render();focusDuelArchive(id);return;
  }
  const event=duelTournaments.find(t=>t.id===id);
  if(!event || event.status!=='complete')return;
  if(action==='export-podium')return exportDuelPodium(event);
  if(action==='save-podium') {
    const entries=podiumTracks(event);
    let next;
    try { next=addCollectionTracks(state,entries); }
    catch(error){return toast(error.message);}
    if(!commitSessionChange(next))return;
    for(const track of entries)if(!catalogIds.has(track.id))addToCatalog([track]);
    render();
    return toast('The podium tracks are in your Collection.');
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
    stopAudio();render();focusDuelStage();
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
    : csvRows([['Title','Artist','Genre','Mood','Source URL'], ...items.map((item) => [item.title, item.artist, item.genre, item.mood, item.link])]);
  const blob = new Blob([data], { type: type === 'json' ? 'application/json' : 'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = href; anchor.download = `aftertone-collection.${type}`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(href), 200);
  toast('Export created.');
}

/** Recovery is opt-in, five identities at a time. Reuse the bounded public
 * Deezer metadata endpoint; no preview audio or search queries are requested. */
function cancelCollectionRecovery() {
  if(!collectionRecoveryFlight)return;
  collectionRecoveryFlight.abort();
  collectionRecoveryFlight=null;
  collectionRecoveryMessage='Recovery canceled. Saved songs were not changed by the unfinished request.';
}
async function recoverCollectionMetadata(returnFocus=false) {
  if(view!=='collection'||collectionRecoveryFlight||progressRestoreBusy)return;
  const plan=collectionRecoveryPlan(state,catalog,collectionRecoveryAttempted);
  if(!plan.ids.length)return;
  if(plan.retry)collectionRecoveryAttempted.clear();
  const controller=new AbortController();
  collectionRecoveryFlight=controller;
  collectionRecoveryMessage='Checking '+plan.ids.length+' saved song '+(plan.ids.length===1?'identity':'identities')+'…';
  render();
  if(returnFocus)$('#collection-recovery-status')?.focus({preventScroll:true});
  let remote=[],providerIssue=false;
  try {
    if(plan.remote.length) {
      try {
        const response=await apiFetch('/api/challenge-tracks?ids='+encodeURIComponent(plan.remote.join(',')),{signal:controller.signal});
        if(!response.ok)throw new Error(response.status===429?'Deezer is limiting requests.':'Provider metadata unavailable.');
        const payload=await response.json();
        if(!Array.isArray(payload.tracks))throw new Error('Provider metadata unavailable.');
        const allowed=new Set(plan.remote);
        remote=payload.tracks.filter(t=>allowed.has(t?.id)&&t.source==='deezer');
      }catch(error) {
        if(controller.signal.aborted)return;
        providerIssue=true;
      }
    }
    if(controller.signal.aborted||collectionRecoveryFlight!==controller||view!=='collection')return;
    const {next,tracks}=prepareRecoveredFavorites(state,plan.ids,[...plan.local,...remote]);
    if(tracks.length&&!commitSessionChange(next))throw new Error('Recovery was not saved. Check browser storage and try again.');
    if(tracks.length)addToCatalog(tracks);
    for(const id of plan.ids)collectionRecoveryAttempted.add(id);
    const remaining=collectionRecoveryPlan(state,catalog,collectionRecoveryAttempted).missing;
    collectionRecoveryMessage=(tracks.length?'Recovered and saved details for '+tracks.length+' '+(tracks.length===1?'song.':'songs.'):'No new song details could be recovered.')+
      (remaining?' '+remaining+' saved '+(remaining===1?'identity still needs':'identities still need')+' details.':' All saved songs now have stored details.')+
      (providerIssue?' Deezer could not complete the lookup. Retry when the service is available.':'')+
      ' Favorites and listening choices were preserved.';
  }catch(error) {
    if(controller.signal.aborted||collectionRecoveryFlight!==controller)return;
    collectionRecoveryMessage=error.message||'Recovery could not be saved. Your favorites were preserved.';
  }finally {
    if(collectionRecoveryFlight===controller) {
      collectionRecoveryFlight=null;
      if(view==='collection'){
        const restoreFocus=document.activeElement?.id==='collection-recovery-status'||document.activeElement===document.body;
        render();
        if(restoreFocus)$('#collection-recovery-status')?.focus({preventScroll:true});
      }
    }
  }
}

/** Persistent action feedback stays available after the temporary toast fades. */
function announceProgressBackup(message) {
  const status=$('#progress-backup-status');
  if (!status) return;
  status.hidden=false;
  status.textContent=message;
}

/** The backup file contains only metadata and local choices, never audio. */
function downloadProgressBackup() {
  try {
    const payload=createProgressBackup(localStorage);
    const {summary}=inspectProgressBackup(payload);
    const blob=new Blob([payload],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;
    anchor.download='aftertone-progress-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    const missing=summary.missingFavoriteMetadata || 0;
    const message='Progress backup downloaded. Keep the file somewhere safe.'+
      (missing ? ' Note: '+missing+' favorite '+(missing===1?'ID lacks':'IDs lack')+
        ' saved song names. These favorites are included as IDs but may not appear in Collection until their track details are found again.' : '');
    announceProgressBackup(message);
    toast(message);
  } catch(error) {
    const message=error.message || 'Could not create a progress backup.';
    announceProgressBackup(message);
    toast(message);
  }
}
let progressRestoreBusy=false;
async function importProgressBackupFile(file) {
  // File.text() is asynchronous. Guard against overlapping restore attempts.
  if (progressRestoreBusy) return;
  const wasRecovering=Boolean(collectionRecoveryFlight);
  cancelCollectionRecovery();
  progressRestoreBusy=true;
  if(wasRecovering&&view==='collection')render();
  const restoreButton=$('[data-action="restore-progress"]');
  if (restoreButton) restoreButton.disabled=true;
  try {
    announceProgressBackup('Checking backup file…');
    if(file.size>BACKUP_MAX_BYTES)throw new Error('Backup must be smaller than 4 MB.');
    const content=await file.text();
    const incomingPlan=inspectProgressBackup(content);
    const preview=incomingPlan.summary;
    const optional=preview.version===1
      ? 'This older backup does not contain imported playlists or lyric timing adjustments. Those existing settings will stay unchanged.'
      : 'Also restore '+preview.playlistTracks+' imported playlist tracks and '+
        preview.lyricOffsets+' lyric timing adjustments.';
    const missing=preview.missingFavoriteMetadata || 0;
    const metadataNotice=missing
      ? '\n\nImportant: '+missing+' saved favorite '+(missing===1?'ID has':'IDs have')+
        ' no song title or artist metadata in this file. The favorite IDs and listening decisions can be restored, but those songs may not appear in Collection until their details are found again. No titles will be invented.'
      : '';
    // The incoming file was validated without writes. If current browser
    // progress is readable, compare every category before asking permission
    // to replace it; corrupted local data must not be shown as empty.
    let comparisonText='Current browser progress could not be verified. The backup may replace existing data.';
    try {
      const currentPlan=inspectProgressBackup(createProgressBackup(localStorage));
      const current=currentPlan.summary;
      const comparison=compareProgressSummaries(current,preview);
      const identityChanges=compareProgressContents(currentPlan,incomingPlan);
      comparisonText='Current → backup (not a merge):\n'+comparison.lines.join('\n');
      if(comparison.reductions.length)
        comparisonText+='\n\nWARNING: Restoring would reduce: '+comparison.reductions.join(', ')+'.';
      if(identityChanges.length)
        comparisonText+='\n\nWARNING: Existing items would be removed or changed, even if the totals stay the same:\n'+identityChanges.map(item=>item.label+': '+item.count).join('\n');
    } catch {
      comparisonText+=' Export a current backup if possible before continuing.';
    }
    const message='Restore '+preview.favorites+' saved favorites, '+preview.decisions+
      ' listening choices, '+preview.tournaments+' tournaments, '+
      preview.artists+' favorite artist'+(preview.artists===1?'':'s')+' and Tune Lab '+preview.quizCorrect+
      '/'+preview.quizAnswered+' correct?\n\n'+comparisonText+'\n\n'+
      optional+metadataNotice+'\n\n'+
      'This replaces your current AFTERTONE progress. Export a backup of your current progress first.';
    if(!window.confirm(message)) {
      announceProgressBackup('Restore canceled. Your existing progress was not changed.');
      return;
    }
    restoreProgressBackup(localStorage,content);
    announceProgressBackup('Progress restored. Reloading AFTERTONE…');
    stopAudio();
    window.location.reload(); // Rehydrate the existing app from the validated saved state.
  } catch(error) {
    const message=error.message || 'Could not restore backup. Check your current saved progress.';
    announceProgressBackup(message);
    toast(message);
  } finally {
    progressRestoreBusy=false;
    // The file picker itself is hidden. Return keyboard focus to a real
    // visible button after cancel, validation failure or confirmation.
    const action=$('[data-action="restore-progress"]');
    if (action) {
      action.disabled=false;
      if (view==='collection') action.focus({preventScroll:true});
    }
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
      if (modal?.kind === 'themes') {
        // Keep focus on the re-rendered selected tile while the dialog remains
        // modal; the header theme toggle is inert behind its backdrop.
        renderModal();
      } else {
        // The non-modal header palette does close and return focus to its toggle.
        setThemeMenuOpen(false, true);
      }
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
    const returnFocus=document.activeElement===quizAnswer;
    const answer=Number(quizAnswer.dataset.quizAnswer);
    if (!Number.isInteger(answer) || answer<0 || answer>=quizSession.quiz.options.length) return;
    const nextStats=nextQuizStats(quizStats,quizSession.quiz.options[answer]===quizSession.quiz.correct);
    if(!nextStats || !saveQuizStats(localStorage,nextStats)) {
      quizSession.saveError=true;
      render();
      if(returnFocus)main.querySelector('[data-quiz-answer="'+answer+'"]')?.focus({preventScroll:true});
      return;
    }
    quizStats=nextStats;
    quizSession.answer=answer;
    quizSession.saveError=false;
    render();
    // Answer buttons are disabled after selection. Move focus to the result
    // instead of leaving it on a detached/disabled element.
    if(returnFocus) (main.querySelector('#quiz-feedback') || main).focus({preventScroll:true});
    return;
  }
  const quizMood=event.target.closest('[data-quiz-mood]');
  if(quizMood && view==='quiz' && quizSession && quizSession.answer!==null) {
    const mood=quizMood.dataset.quizMood;
    if (!MOODS.includes(mood)) return;
    // A mood check-in should not look saved if storage rejects the change.
    if(!quizSession || !state.favorites.includes(quizSession.id))return;
    const track=lookup(quizSession.id);
    if(!track)return;
    let next;
    try { next=setSavedTrackMood(state,track,mood); }
    catch(error){quizSession.moodSaveError=error.message;return render();}
    if(next===state)return;
    if(!commitSessionChange(next)){
      quizSession.moodSaveError='Your mood was not saved. Check browser storage, then try again.';
      return render();
    }
    // Catalog is an in-memory index; update only after verified persistence.
    track.mood=mood;
    quizSession.moodSaveError='';
    quizSession.mood=mood;
    return render();
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
    case 'first-listen-play': {
      // A first-listen guide is only a shortcut to the same native Play action.
      // Never fabricate a vote or bypass consent for audible media. Keep
      // keyboard focus on the real player, including while metadata loads.
      if(view!=='discover' || modal || challengeIds.length || state.history.length || !current)return;
      $('#stage-play')?.focus({preventScroll:true});
      return togglePlayback(current,false);
    }
    case 'play-current': return togglePlayback(current);
    case 'toggle-preview-mode': return togglePreviewMode();
    case 'next-unrated': return nextUnratedPreview(document.activeElement===action);
    case 'previous-unrated': return revisitUnratedPreview(document.activeElement===action);
    case 'retry-preview': return retryFailedPreview();
    case 'skip-unavailable': return skipUnavailablePreview();
    case 'close-mobile-filters': return setMobileFiltersOpen(false,'toggle');
    case 'focus-music-search': {
      if(view!=='discover') goTo('discover');
      setMobileFiltersOpen(true);
      sidebarFiltersCollapsed=false;
      $('#sidebar-preferences')?.classList.remove('is-collapsed');
      $('#sidebar-preferences [data-action="toggle-side-filters"]')?.setAttribute('aria-expanded','true');
      const input=$('#music-search');
      if(!input) return;
      const body=$('#sidebar-filter-body');
      if(body?.hidden) body.hidden=false;
      input.scrollIntoView({behavior:motionSafeScroll(),block:'center'});
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
      if(!lyricsEnabled) cancelCurrentLyrics();
      updateLyricView();
      if(lyricsEnabled && current) void requestCurrentLyrics(current);
      return;

    case 'load-more': {
      if(view!=='discover'||modal||getFeed().loading||action.getAttribute('aria-disabled')==='true')return;
      const restoreKeyboardFocus=document.activeElement===action;
      // The active retry button disappears while its feed is loading.
      if (restoreKeyboardFocus) main.focus({preventScroll:true});
      // User-initiated retry recovers providers disabled after temporary errors.
      if (!getFeed().hasMore) { getFeed().exhausted.clear(); getFeed().hasMore = true; }
      return loadMore(state.genre,true,false,restoreKeyboardFocus);
    }
    case 'toggle-blind': {
      // In shared challenges, identities stay hidden by design. Ignore stale
      // event targets instead of silently editing the user's blind preference.
      if(view!=='discover' || !current || challengeIds.length) return;
      state.blind = !state.blind;
      persist();
      return render(); // Same-track focus continuity handles the toggle.
    }
    case 'passport-route': {
      const route = action.dataset.route;
      if (route === 'quiz') return goTo('quiz');
      if (route === 'discover') {
        if (view !== 'discover') return goTo('discover');
        $('#listening-card')?.scrollIntoView({behavior:motionSafeScroll(),block:'center'});
        return;
      }
      if (['balanced','familiar','explore'].includes(route)) changeDiscoveryPath(route,document.activeElement===action);
      return;
    }
    case 'toggle-side-filters': sidebarFiltersCollapsed = !sidebarFiltersCollapsed; return render();
    case 'quiz-start': return startQuizRound();
    case 'quiz-next': return startQuizRound();
    case 'use-mainstream':
      state.source = availableSources.includes('deezer') ? 'deezer' : 'featured'; state.discovery = 'hits'; rememberSource();
      persist(); stopContinuous(); current = null; chooseNext(); render(); maybeTopUp(); return;
    case 'reset-discovery-filters': {
      const restoreKeyboardFocus=document.activeElement===action;
      // Only reset narrowed catalog filters; don't erase Keeps, history, or seed artists.
      state.genre='all'; state.language='all'; state.era='any';
      persist(); stopContinuous(); current=null;
      render();
      if (restoreKeyboardFocus) main.focus({preventScroll:true});
      void loadMore(state.genre,true,false,restoreKeyboardFocus);
      return;
    }
    case 'clear-search': {
      const restoreKeyboardFocus=document.activeElement===action;
      searchQuery=''; searchDraft=''; stopContinuous(); chooseNext(); render();
      if (restoreKeyboardFocus) main.focus({preventScroll:true});
      return maybeTopUp(restoreKeyboardFocus);
    }
    case 'pass': return acceptChoice('pass');
    case 'like': return acceptChoice('like');
    case 'undo': {
      if (challengeIds.length || !state.history.length) return;
      cancelPendingChoice();
      const returnFocus = document.activeElement === action;
      const lastId = state.history.at(-1).id;
      if(!commitSessionChange(restoreLastChoice(state)))return;
      stopContinuous();
      current = lookup(lastId) || selectNext(catalog, state.history, state.genre);
      render();
      if (returnFocus) restoreDecisionFocus('undo');
      return toast('Last choice undone.');
    }
    case 'journal-filter': {
      if(view!=='taste'||!JOURNAL_FILTERS.includes(action.dataset.filter))return;
      const focused=document.activeElement===action;
      journalFilter=action.dataset.filter;journalPage=1;render();
      if(focused)main.querySelector('[data-action="journal-filter"][data-filter="'+journalFilter+'"]')?.focus({preventScroll:true});
      return;
    }
    case 'journal-page': {
      if(view!=='taste'||action.disabled)return;
      const next=Number(action.dataset.page);
      if(!Number.isSafeInteger(next)||next<1)return;
      journalPage=next;render();
      main.querySelector('#journal-page-status')?.focus();
      return;
    }
    case 'collection-page': {
      if(view!=='collection' || action.disabled) return;
      const targetPage=Number(action.dataset.page);
      if(!Number.isSafeInteger(targetPage) || targetPage<1) return;
      collectionPage=targetPage;
      render();
      // Focus the result count near the new first tile, so keyboard users
      // do not remain at a removed button below the previous page.
      (main.querySelector('#collection-page-status') || main).focus();
      return;
    }
    case 'collection-quick-filter': {
      if(view!=='collection')return;
      const kind=action.dataset.filterKind;
      const value=action.dataset.filterValue;
      if(!['genre','mood'].includes(kind) || !value)return;
      // Quick filtering is view-only. The original saved library is untouched.
      const wasFocused=document.activeElement===action;
      const currentValue=kind==='genre'?collectionGenre:collectionMood;
      const chosen=collectionSearchKey(currentValue)===collectionSearchKey(value)?'all':value;
      if(kind==='genre')collectionGenre=chosen;
      else collectionMood=chosen;
      collectionPage=1;
      render();
      if(wasFocused) {
        const replacement=[...main.querySelectorAll('[data-action="collection-quick-filter"]')]
          .find(button=>button.dataset.filterKind===kind && button.dataset.filterValue===value);
        (replacement||main.querySelector(kind==='genre'?'#collection-genre':'#collection-mood')||main)
          .focus({preventScroll:true});
      }
      return;
    }
    case 'clear-collection-filters': {
      if(view!=='collection')return;
      const returnFocus=document.activeElement===action;
      collectionQuery='';collectionGenre='all';collectionMood='all';collectionPage=1;
      render();
      if(returnFocus)$('#collection-search')?.focus({preventScroll:true});
      return;
    }
    case 'clear-collection-search': {
      const returnFocus=document.activeElement===action;
      collectionQuery='';
      collectionPage=1;
      render();
      if (returnFocus) $('#collection-search')?.focus({preventScroll:true});
      return;
    }
    case 'remove-favorite': {
      if (!state.favorites.includes(id)) return;
      const returnFocus=document.activeElement===action;
      const removed={id,index:state.favorites.indexOf(id),title:lookup(id)?.title || 'Song'};
      if(!commitSessionChange(removeFavorite(state,id)))return;
      lastRemovedFavorite=removed;
      render();
      if (returnFocus) ($('[data-action="undo-remove-favorite"]') || main).focus({preventScroll:true});
      return;
    }
    case 'undo-remove-favorite': {
      if (!lastRemovedFavorite) return;
      const returnFocus=document.activeElement===action;
      const {id:removedId,index}=lastRemovedFavorite;
      let restored=restoreRemovedFavorite(state,removedId,index);
      if(restored!==state) {
        if(restored.favorites.length>MAX_FAVORITE_IDS)return toast('Collection is full. Remove a song before restoring this favorite.');
        const metadata=lookup(removedId);
        try { restored=addCollectionTracks(restored,metadata?[metadata]:[]); }
        catch(error){return toast(error.message);}
        if(!commitSessionChange(restored))return;
      }
      lastRemovedFavorite=null;
      render();
      if (returnFocus) ($('#collection-search') || main).focus({preventScroll:true});
      return;
    }
    case 'recover-collection-metadata': return recoverCollectionMetadata(document.activeElement===action);
    case 'cancel-collection-recovery': {
      cancelCollectionRecovery();render();$('#collection-recovery-status')?.focus({preventScroll:true});return;
    }
    case 'export-json': return exportLibrary('json');
    case 'export-csv': return exportLibrary('csv');
    case 'backup-progress': return downloadProgressBackup();
    case 'restore-progress': return $('#progress-backup-file')?.click();
    case 'share-challenge': return shareChallenge();
    case 'reset-challenge-draft': {
      const focused=document.activeElement===action;
      resetChallengeDraft();
      syncChallengeDraft();
      render();
      if(focused)main.querySelector('[data-action="reset-challenge-draft"]')?.focus({preventScroll:true});
      return;
    }
    case 'challenge-next-page':
    case 'challenge-previous-page': {
      if(view!=='challenges')return;
      const wasFocused=document.activeElement===action;
      const selected=syncChallengeDraft();
      const paging=challengeLibraryPage(selected,challengeDraftIds,challengeFilterQuery,challengePage);
      const delta=action.dataset.action==='challenge-next-page'?1:-1;
      const next=Math.min(paging.pageCount,Math.max(1,paging.page+delta));
      if(next===paging.page)return;
      challengePage=next;
      render();
      // The original page button might become disabled. Announce the new
      // range from a focusable status before the first new track, rather than
      // dropping keyboard users at the top of the whole document.
      if(wasFocused)main.querySelector('#challenge-match-count')?.focus();
      return;
    }
    case 'add-challenge-track':
    case 'remove-challenge-track':
    case 'move-challenge-up':
    case 'move-challenge-down': {
      const focused=document.activeElement===action;
      const eligible=syncChallengeDraft();
      if(!eligible.some(track=>track.id===id))return;
      if(action.dataset.action==='add-challenge-track' &&
          challengeDraftIds.length>=MAX_CHALLENGE_TRACKS) {
        toast('A challenge holds up to five songs. Remove one to add another.');
        return;
      }
      challengeDraftCustomized=true;
      const kind=action.dataset.action;
      challengeDraftIds=kind==='add-challenge-track' || kind==='remove-challenge-track'
        ? toggleChallengeDraft(challengeDraftIds,id,eligible)
        : moveChallengeDraft(challengeDraftIds,id,
            kind==='move-challenge-up'?-1:1,eligible);
      storeChallengeDraft(); // Save only after deliberate add/remove/reorder.
      render();
      if(focused) {
        const selector=kind==='remove-challenge-track'
          ? '[data-action="add-challenge-track"][data-id="'+id+'"]'
          : kind==='add-challenge-track'
            ? '[data-action="remove-challenge-track"][data-id="'+id+'"]'
            : '[data-action="'+kind+'"][data-id="'+id+'"]';
        const replacement=main.querySelector(selector);
        const fallback=main.querySelector('[data-action="remove-challenge-track"][data-id="'+id+'"]')
          || main.querySelector('#challenge-track-search') || main;
        (replacement && !replacement.disabled?replacement:fallback)
          .focus({preventScroll:true});
      }
      return;
    }
    case 'try-challenge': return playSampleChallenge();
    case 'retry-shared-challenge':
      if(challengeRecovery?.waiting && !challengeRecovery.loading)
        return void hydrateSharedChallenge({returnFocus:document.activeElement===action});
      return;
    case 'continue-shared-challenge':
      return continueSharedChallenge(document.activeElement===action);
    case 'exit-challenge': return exitSharedChallenge(document.activeElement===action);
    case 'reset-listens':
      if (!confirm('Restart discovery? Listening history will be cleared. Saved favorites and Tune Lab scores will stay.')) return;
      if(!commitSessionChange({...state,history:[]}))return;
      chooseNext();return render();
    default: return;
  }
});

nav.addEventListener('click', (event) => { if (event.target.closest('[data-view]')) event.preventDefault(); });
$('#sound-toggle').addEventListener('click', () => { state = toggleMuteSetting(state); persist(); updateChrome(); });

// `input` fires continuously while the user drags, without re-rendering the
// card (which would interrupt the pointer gesture or playback).
main.addEventListener('input', (event) => {
  if(event.target.id==='challenge-track-search' && view==='challenges') {
    challengeFilterQuery=event.target.value.slice(0,90);
    challengePage=1; // Search changes always start with the first matching page.
    render(); // Preserve input and cursor across filtered-list redraws.
    return;
  }
  if (!event.target.matches('[data-volume-slider]')) return;
  state = updateVolumeSetting(state, event.target.value);
  persist();
  updateChrome(); // Sync navbar mute with the new level.
});
$('#help-button').addEventListener('click', () => openModal('help'));
$('#mobile-refine-toggle').addEventListener('click', () => {
  const opened=document.body.classList.contains('mobile-filters-open');
  setMobileFiltersOpen(!opened,'close');
});
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
    if (seedActive) { seedActive = false; advanceSeedVersion(); seedRelated = []; relatedLookupStatus='idle'; expandedArtists.clear(); resetArtistRotation(); toast('Switched to fresh discovery; imported seeds are no longer applied.'); }
    state.source = 'deezer';
    if (state.source === 'charts') { state.genre = 'all'; state.era = 'any'; }
    rememberSource();
    persist(); stopContinuous(); chooseNext(); render(); maybeTopUp();
  }
  if (event.target.id === 'genre-select') {
    if (seedActive) { seedActive = false; advanceSeedVersion(); seedRelated = []; relatedLookupStatus='idle'; expandedArtists.clear(); resetArtistRotation(); toast('Switched to fresh genre discovery.'); }
    state.genre = allGenres.includes(event.target.value) ? event.target.value : 'all';
    if (state.source === 'charts' && state.genre !== 'all') { state.source = 'youtube'; toast('Genre filtering uses official-artist YouTube discovery. Global charts do not tag songs by genre.'); }
    persist(); stopContinuous(); chooseNext(); render(); maybeTopUp();
  }
  if (event.target.id === 'discovery-mix-select') {
    changeDiscoveryPath(event.target.value,document.activeElement===event.target); return;
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
  if (event.target.id === 'collection-page-select') {
    if(view!=='collection')return;
    const next=Number(event.target.value);
    if(!Number.isSafeInteger(next)||next<1)return;
    collectionPage=next;
    render();
    (main.querySelector('#collection-page-status') || main).focus();
    return;
  }
  if(event.target.id==='collection-genre' || event.target.id==='collection-mood') {
    if(view!=='collection')return;
    const previousId=event.target.id;
    if(previousId==='collection-genre')collectionGenre=event.target.value;
    else collectionMood=event.target.value;
    collectionPage=1;
    render();
    // The select has been replaced by render(). Preserve keyboard context.
    $('#'+previousId)?.focus({preventScroll:true});
    return;
  }
  if (event.target.id === 'sort-select') {
    const returnFocus=document.activeElement===event.target;
    collectionSort=['recent','title','artist'].includes(event.target.value) ? event.target.value : 'recent';
    collectionPage=1;
    render();
    if (returnFocus) $('#sort-select')?.focus({preventScroll:true});
  }
});
document.addEventListener('submit', (event) => {
  if (event.target.id !== 'music-search-form') return;
  event.preventDefault();
  searchQuery = ($('#music-search')?.value || '').trim().slice(0, 90);
  searchDraft = searchQuery;
  const fromMobileFilters=document.body.classList.contains('mobile-filters-open');
  if (fromMobileFilters) {
    setMobileFiltersOpen(false);
    // Results are below the former overlay. Dismiss the software keyboard
    // and announce the newly rendered discovery section instead.
    main.focus({preventScroll:true});
  }
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
    const selection={start:event.target.selectionStart,end:event.target.selectionEnd,
      direction:event.target.selectionDirection};
    collectionQuery = event.target.value;
    collectionPage=1;
    render();
    const input = $('#collection-search');
    if (input) {
      input.focus({preventScroll:true});
      input.setSelectionRange(selection.start,selection.end,selection.direction);
    }
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !$('#theme-menu')?.hidden) { event.preventDefault(); return setThemeMenuOpen(false,true); }
  if (modal) {
    if(event.key==='Escape') {event.preventDefault();closeModal();return;}
    if(event.key==='Tab')trapModalTab(event);
    return;
  }
  if (document.body.classList.contains('mobile-filters-open')) {
    if (event.key==='Escape') {
      event.preventDefault();
      setMobileFiltersOpen(false,'toggle');
    } else if (event.key==='Tab') trapMobileFiltersTab(event);
    // The drawer is a focused dialog. Background rating shortcuts must not
    // run, even if pointer input or a redraw briefly moved focus outside it.
    return;
  }
  // Do not hijack browser/assistive-technology shortcuts or let holding
  // an arrow silently rate multiple tracks. Only standalone key presses act.
  if (event.defaultPrevented || event.isComposing || event.repeat ||
      event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  // Native button/link/slider keyboard controls always win over game shortcuts.
  const active=document.activeElement;
  const interactive=active?.isContentEditable || active?.closest('button,a[href],input,textarea,select,summary,[contenteditable],[role="button"],[role="slider"],[role="switch"],[role="combobox"],[role="tab"]');
  if(interactive)return;
  if(view==='duels') {
    const match=nextDuelMatch(duelTournaments.find(t=>t.id===selectedDuelId));
    if(match && ['1','2'].includes(event.key)) {event.preventDefault();voteActiveDuel(event.key==='1'?match.a:match.b);}
    return;
  }
  if(view !== 'discover') return;
  if (event.key.toLowerCase() === 'b') {
    if(challengeIds.length || !current) return; // Shared challenges lock blindness.
    event.preventDefault();
    state.blind = !state.blind;
    persist(); render(); return;
  }
  if (event.key === 'ArrowLeft') { event.preventDefault(); acceptChoice('pass'); }
  if (event.key === 'ArrowRight') { event.preventDefault(); acceptChoice('like'); }
  if (event.code === 'Space') { event.preventDefault(); togglePlayback(current); }
});

// Keep every gesture tied to the exact card, song and primary pointer that
// started it. A rerender, browser scroll/cancel, second finger or right-click
// must never turn into an accidental Keep or Pass.
function clearSwipeGesture(pointerId=null) {
  const gesture=pointerStart;
  if (!gesture || (pointerId!==null && gesture.pointer!==pointerId)) return null;
  pointerStart=null;
  const card=gesture.card;
  card.classList.remove('dragging');
  card.style.transform='';
  card.querySelector('#decision-stamp')?.style.removeProperty('opacity');
  if (card.hasPointerCapture?.(gesture.pointer)) {
    try {card.releasePointerCapture(gesture.pointer);} catch {}
  }
  return gesture;
}

// A second finger can land anywhere on the page, outside the listening card.
// Cancel the original swipe immediately: just ignoring the new finger still
// lets the first finger's eventual pointerup record an accidental vote.
document.addEventListener('pointerdown', (event) => {
  if (pointerStart && event.pointerId!==pointerStart.pointer &&
      event.pointerType==='touch') clearSwipeGesture();
}, true);

// Vertical scrolling stays native. Capture only a started primary drag so a
// release just outside the card still reaches this handler.
main.addEventListener('pointerdown', (event) => {
  const card=event.target.closest('#listening-card');
  if (pointerStart || event.isPrimary===false || event.button!==0 || modal ||
      animatingChoice || view!=='discover' || !current || !card ||
      event.target.closest('button, input, select, textarea, label, a, [data-volume-slider]')) return;
  pointerStart={x:event.clientX,y:event.clientY,pointer:event.pointerId,
    card,trackId:current.id};
  try {card.setPointerCapture?.(event.pointerId);} catch {}
});
main.addEventListener('pointermove', (event) => {
  const gesture=pointerStart;
  if (!gesture || gesture.pointer!==event.pointerId) return;
  if (!gesture.card.isConnected || current?.id!==gesture.trackId || view!=='discover' || modal) {
    clearSwipeGesture(event.pointerId);
    return;
  }
  const dx=event.clientX-gesture.x;
  const dy=event.clientY-gesture.y;
  const card=gesture.card;
  if (Math.abs(dx)<10 || Math.abs(dx)<Math.abs(dy)*1.3) {
    // A diagonal gesture that turns into vertical scrolling must restore the
    // card immediately, rather than leaving a partial Keep/Pass preview.
    card.classList.remove('dragging');
    card.style.transform='';
    card.querySelector('#decision-stamp')?.style.removeProperty('opacity');
    return;
  }
  const bounded=Math.max(-170,Math.min(170,dx));
  card.classList.add('dragging');
  card.style.transform=`translateX(${bounded}px) rotate(${bounded*.035}deg)`;
  const stamp=card.querySelector('#decision-stamp');
  if (stamp) {
    stamp.textContent=dx>0?'♥':'NOPE';
    stamp.dataset.feedback=dx>0?'like':'pass';
    stamp.style.opacity=String(Math.min(1,Math.max(0,(Math.abs(dx)-12)/85)));
  }
});
main.addEventListener('pointerup', (event) => {
  const gesture=clearSwipeGesture(event.pointerId);
  if (!gesture || !gesture.card.isConnected || current?.id!==gesture.trackId ||
      view!=='discover' || modal || animatingChoice) return;
  const dx=event.clientX-gesture.x;
  const dy=event.clientY-gesture.y;
  if (Math.abs(dx)>75 && Math.abs(dx)>Math.abs(dy)*1.6)
    acceptChoice(dx>0?'like':'pass');
});
main.addEventListener('pointercancel', (event) => {clearSwipeGesture(event.pointerId);});
main.addEventListener('lostpointercapture', (event) => {clearSwipeGesture(event.pointerId);});
window.addEventListener('blur', () => {clearSwipeGesture();});

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
    if(challengeIds.length)await hydrateSharedChallenge({initial:true});
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
