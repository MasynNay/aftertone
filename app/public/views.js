import { computeTaste } from '../src/taste.mjs';
import {collectionPageModel} from '../src/collection-pagination.mjs';
import {eligibleChallengeTracks,challengeLibraryPage,defaultChallengeDraft,reconcileChallengeDraft,MAX_CHALLENGE_TRACKS} from '../src/challenge-draft.mjs';
import { getPassportProgress } from '../src/discovery/passport.mjs';
import { firstListenAction } from '../src/discovery/first-listen.mjs';
import { PATH_DESCRIPTIONS } from '../src/discovery/mode-engine.mjs';
import { html, plural, clamp, urlSafe, h32, shade, tag } from './view-utils.js';

/**
 * Side-effect-free page templates. The caller passes a state snapshot, making
 * rendering deterministic and easy to test independently of the DOM.
 */
export function createViews({ state, catalog, current, allGenres, challengeIds, challengeResponses, challengeSkippedIds=new Set(), challengeRecovery=null, challengeDraft=null, challengeFilterQuery='', challengePage=1, challengeDraftSaved=false, challengeDraftCustomized=false, catalogWarning, catalogLive, collectionQuery='', collectionSort='recent', collectionPage=1, removedFavorite = null, feed = {}, availableSources = ['mix', 'audius', 'commons'], searchQuery = '', searchDraft = searchQuery, sourceLabel = 'All sources', seedInfo = { active:false, kind:'playlist', ready:false, count:0, artists:0, related:0, hasArtists:false }, quizSession=null, quizStats={answered:0,correct:0} }) {
  // One index per render avoids searching the full catalog for every saved
  // song. Keep the FIRST matching entry, matching the previous .find behavior.
  const byId=new Map();
  for(const track of catalog)if(track?.id && !byId.has(track.id))byId.set(track.id,track);
  const lookup=id=>byId.get(id)??null;
function waveform(id) {
  let seed = h32(id);
  return Array.from({ length: 64 }, (_, i) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const height = 6 + Math.round((seed % 100) / 100 * (i > 5 && i < 59 ? 42 : 24));
    return `<i style="--height:${height}px;--delay:-${(i % 9) * 0.13}s" aria-hidden="true"></i>`;
  }).join('');
}

function renderListeningCard() {
  const isBlind = Boolean(state.blind || challengeIds.length > 0);
  if(challengeIds.length && challengeRecovery?.waiting) {
    const {available,requested,loading,canRetry,failed}=challengeRecovery;
    const status=loading
      ? 'Checking the shared songs with Deezer. No choices have been recorded.'
      : available
        ? available+' of '+requested+' shared songs available. The other '+(requested-available)+' '+(requested-available===1?'song is':'songs are')+' unavailable right now.'
        : 'None of the '+requested+' shared '+(requested===1?'song is':'songs are')+' available right now.';
    const heading=loading?'Checking Shared Songs…'
      : available?'Some Shared Songs Are Unavailable':'Shared Challenge Unavailable';
    const guidance=loading?''
      : failed?'The music provider could not complete the request. Your original challenge link is unchanged.'
      : !canRetry?'These recordings cannot be resolved through the current public music source.'
      : 'You can retry missing recordings without changing the link or making a vote.';
    return `<section class="empty-state discovery-empty-state challenge-recovery" role="region" aria-labelledby="challenge-recovery-heading">
      <div class="empty-icon" aria-hidden="true">${loading?'♫':'◎'}</div>
      <h2 id="challenge-recovery-heading" tabindex="-1">${heading}</h2>
      <p id="challenge-recovery-status" role="status" aria-live="polite" aria-atomic="true">${status}</p>
      ${guidance?`<p>${guidance}</p>`:''}
      <div class="empty-actions">
        ${canRetry?`<button type="button" class="accent-button" data-action="retry-shared-challenge" ${loading?'disabled':''}>${loading?'Checking…':'Retry Missing Songs'}</button>`:''}
        ${available?`<button type="button" class="${canRetry?'secondary-button':'accent-button'}" data-action="continue-shared-challenge" ${loading?'disabled':''}>Play ${available} Available ${available===1?'Song':'Songs'}</button>`:''}
        <button type="button" class="secondary-button" data-action="exit-challenge">Back to Discovery</button>
      </div>
    </section>`;
  }
  if (!current) {
    const failedClips=challengeIds.length ? challengeSkippedIds.size : 0;
    const challengeDone = challengeIds.length > 0 &&
      challengeResponses.length + failedClips >= challengeIds.length;
    const liked = challengeResponses.filter((item) => item.action === 'like').length;
    const narrowed=state.genre!=='all' || state.language!=='all' || state.era!=='any';
    const otherPath=state.discoveryMix==='familiar' ? 'balanced' : state.discoveryMix==='balanced' ? 'explore' : 'balanced';
    const otherName=otherPath==='explore' ? 'Wild Card' : 'New Territory';
    const heading=challengeDone ? (failedClips ? 'Challenge Finished' : 'Challenge Complete') : feed.loading ? 'Finding Your Next Song…' :
      feed.error ? 'Music Is Temporarily Unavailable' :
      searchQuery ? 'No Matching Songs Found' : 'Ready for a Different Direction?';
    const explanation=challengeDone ? `${challengeResponses.length
      ? 'You kept '+liked+' of '+challengeResponses.length+' rated songs.'
      : 'No songs were rated.'}${failedClips ? ' '+failedClips+' '+(failedClips===1?'preview was':'previews were')+' unplayable and not counted as '+(failedClips===1?'a Pass':'Passes')+'.' : ' Your ears have spoken.'}${challengeRecovery?.skipped ? ' '+challengeRecovery.skipped+' shared '+(challengeRecovery.skipped===1?'song was':'songs were')+' unavailable when the challenge started.' : ''}` :
      feed.loading ? 'Searching for real music from your selected provider. Your saved songs stay safe.' :
      feed.error ? html(feed.error)+(feed.retryFailures ? ' Automatic discovery retries slow down during repeated outages (up to three minutes). Retry Discovery remains available whenever you want to try again.' : '') :
      searchQuery ? `No recordings matched “${html(searchQuery)}” with the current filters. Try a broader search or listening path.` :
      'This listening path has no new matches right now. Try another path, broaden filters, or search an artist.';
    const actions=challengeDone ? '<button type="button" class="accent-button" data-action="exit-challenge">Back to Discovery →</button>' :
      `<div class="empty-actions">
        <button type="button" class="accent-button" data-action="load-more" ${feed.loading ? 'disabled' : ''}>${feed.loading ? 'Searching…' : feed.error ? 'Retry Discovery' : searchQuery ? 'Retry Search ↻' : 'Find More Songs ↻'}</button>
        ${!feed.loading && searchQuery ? '<button type="button" class="secondary-button" data-action="clear-search">Clear Search</button>' : ''}
        ${!feed.loading && narrowed ? '<button type="button" class="secondary-button" data-action="reset-discovery-filters">Broaden Filters</button>' : ''}
        ${!feed.loading ? `<button type="button" class="secondary-button" data-path="${otherPath}">Try ${otherName}</button>` : ''}
        ${!feed.loading && !searchQuery ? '<button type="button" class="secondary-button" data-action="focus-music-search">Search for an Artist</button>' : ''}
      </div>`;
    return `<div class="empty-state discovery-empty-state" role="status" aria-live="polite"><div class="empty-icon" aria-hidden="true">${challengeDone ? '✦' : feed.loading ? '♫' : '◎'}</div><h2>${heading}</h2><p>${explanation}</p>${actions}</div>`;
  }
  // Keep retry help truthful for the selected provider (local installs are not Deezer-only).
  const previewRecoveryHelp = challengeIds.length
    ? 'This shared preview could not play. Retry it, or skip this recording without counting a Pass.'
    : current.source === 'deezer'
    ? 'This Deezer preview is unavailable. Retry a fresh provider link or skip without counting it as a Pass.'
    : current.source === 'jellyfin'
      ? 'Your Jellyfin stream is unavailable. Check your media server, retry, or skip without counting it as a Pass.'
      : 'This preview is unavailable from its music source. Retry the preview or skip without counting it as a Pass.';
  const trackReason = current.seedReason || (state.discoveryMix === 'explore' ? 'A surprise beyond your usual sound' : state.discoveryMix === 'familiar' ? 'Close to your saved favorites' : 'An open-ended discovery');
  const ordinal = challengeIds.length ? challengeResponses.length + challengeSkippedIds.size + 1 : state.history.length + 1;
  const deezerId = current.source === 'deezer' && /^deezer:(\d{1,20})$/.exec(current.id)?.[1];
  const art = `<div class="cover-fallback"><span>♫</span><small>NO ARTWORK AVAILABLE</small></div>${current.artwork ? `<img class="current-cover-img" src="${urlSafe(current.artwork)}" loading="eager" alt="Artwork for ${html(current.title)}" />` : ''}`;
  return `${challengeRecovery?.skipped ? `<p class="challenge-short-notice">Playing ${challengeIds.length} available ${challengeIds.length===1?'song':'songs'} · ${challengeRecovery.skipped} unavailable in the original shared link.</p>` : ''}<div id="listening-card" class="listening-card ${isBlind ? 'blind-card' : 'known-card'} ${deezerId ? 'deezer-card' : ''}" role="group" aria-label="${isBlind ? 'Blind listening' : `${html(current.title)} by ${html(current.artist)}`}. Swipe left to pass, right to keep.">
    <div id="decision-stamp" class="decision-stamp" aria-hidden="true"></div>
    <div class="card-top"><span class="on-air"><i></i>${isBlind ? 'BLIND CHALLENGE' : 'NOW DISCOVERING'}</span><span class="card-number">${challengeIds.length ? `CHALLENGE ${String(ordinal).padStart(2, '0')} / ${challengeIds.length}` : `DISCOVERY ${String(ordinal).padStart(3, '0')}`}</span></div>
    <div class="record-visual ${isBlind ? '' : 'cover-visual'}">${isBlind ? '<div class="record-halo"></div><div class="vinyl" id="vinyl"><div class="record-sheen"></div></div>' : `<div class="current-cover">${art}</div>`}</div>
    ${isBlind ? '<div class="hidden-caption"><div class="hidden-overline">IDENTITY HIDDEN</div><strong>Who could it be?</strong><span>Listen first. Reveal after your choice.</span></div>' : `<div class="track-identity"><span class="track-source-chip">${html(current.source === 'jellyfin' ? 'YOUR LIBRARY' : current.source.toUpperCase())}</span><h2 title="${html(current.artist)} — ${html(current.title)}">${html(current.artist)} <span class="artist-title-separator">—</span> ${html(current.title)}</h2><p>${html(trackReason)}</p><div class="identity-tags">${current.genre !== 'unknown' ? tag(current.genre) : ''}${current.mood && current.mood !== 'Fresh' ? tag(current.mood) : ''}</div></div>`}
    <div class="waveform" id="waveform" aria-hidden="true">${waveform(current.id)}</div>
    <div class="playback-controls"><button id="stage-play" class="play-button" data-action="play-current" aria-label="Play preview">▶</button><div class="playback-copy">22-second listening preview<small id="audio-status" role="status" aria-live="polite" aria-atomic="true">Press Play once, then swipe through songs</small></div><span class="playback-time" id="audio-time">0:00 / 0:22</span><button id="stop-session" class="stop-session" data-action="stop-session" title="Stop continuous listening" aria-label="Stop continuous listening" hidden>■ Stop</button></div><div class="progress-track" role="presentation"><div class="progress-fill" id="audio-progress"></div></div>
    <div id="preview-recovery" class="preview-recovery" role="status" aria-live="polite" hidden><p>${previewRecoveryHelp}</p><div class="preview-recovery-actions"><button type="button" class="secondary-button" data-action="retry-preview">Retry Preview</button><button type="button" class="secondary-button" id="preview-skip" data-action="skip-unavailable">Skip Without Voting</button></div></div>
    <div class="preview-volume" role="group" aria-label="Preview volume"><label for="preview-volume"><span aria-hidden="true">♫</span> Volume</label><input id="preview-volume" data-volume-slider type="range" min="0" max="100" step="1" value="${clamp(Number(state.volume ?? 35),0,100)}" aria-label="Adjust music preview volume" /><output for="preview-volume" data-volume-value>${!state.sound ? 'Muted' : `${Math.round(Number(state.volume ?? 35))}%`}</output></div>
    <div class="lyric-panel"><button class="lyric-toggle" data-action="lyrics-toggle" aria-expanded="false" aria-label="Toggle synchronized lyrics">♫ Lyrics <span id="lyric-indicator">Optional</span></button><div id="live-lyrics" class="lyric-display" hidden><div id="lyric-line" role="status" aria-live="off">Loading synchronized lyrics…</div><div class="lyric-align" id="lyric-align" hidden><label for="lyrics-offset">Preview begins at <b id="lyric-offset-value">0:00</b> in the full song</label><input type="range" id="lyrics-offset" min="0" max="300" value="0" step="1" aria-label="Adjust the preview's position within the song" /><small>Adjust to match by ear · excerpt start is not supplied by Deezer</small></div><a href="https://lrclib.net" target="_blank" rel="noopener noreferrer" class="lyric-credit">Lyrics lookup: LRCLIB ↗</a></div></div>
    <div class="decision-row decision-row-in-card" aria-label="Rate this song"><button data-action="pass" title="Pass" aria-label="Pass on this song" class="decision-button decision-pass"><b aria-hidden="true">×</b></button><button data-action="undo" title="Undo last decision" aria-label="Undo last decision" class="decision-button decision-undo" ${state.history.length && !challengeIds.length ? '' : 'disabled'}><b aria-hidden="true">↶</b></button>${challengeIds.length ? '<span class="decision-button decision-blind is-on is-locked" role="note" aria-label="Blind mode is locked for this shared challenge" title="Shared challenges always keep song identities hidden"><b aria-hidden="true">◉</b><small>Locked</small></span>' : `<button type="button" data-action="toggle-blind" title="${state.blind ? 'Turn blind mode off' : 'Turn blind mode on'}" aria-label="Blind mode" aria-pressed="${Boolean(state.blind)}" class="decision-button decision-blind ${state.blind?'is-on':''}"><b aria-hidden="true">◉</b><small>Blind</small></button>`}<button data-action="like" title="Keep" aria-label="Keep this song in my favorites" class="decision-button decision-like"><b aria-hidden="true">♥</b></button></div>
    <div class="player-shortcuts"><span id="continuity-hint">${challengeIds.length ? 'Listen before deciding; failed clips can be skipped without a vote' : 'Play to begin continuous listening'}</span><span>← Pass · → Keep · Space Play · B Blind</span></div>
    ${challengeIds.length ? '<div class="challenge-early-exit"><button type="button" class="secondary-button" data-action="exit-challenge">Leave Challenge</button></div>' : ''}
  </div>`;
}

function renderDiscovery() {
  const taste = computeTaste(state.history, catalog);
  const passport = getPassportProgress(state.history, quizStats);
  const top = taste.genres.filter(([, score]) => score > 0).slice(0, 3);
  const isBlind = Boolean(state.blind || challengeIds.length > 0);
  const firstAction=firstListenAction({hasTrack:Boolean(current),loading:Boolean(feed.loading),error:feed.error});
  const countCopy = feed.total && state.source === 'jellyfin' ? `${Number(feed.total).toLocaleString()} tracks in your library` : `${catalog.length.toLocaleString()} loaded this session`;
  return `<section><div class="eyebrow">THE LISTENING ROOM ${challengeIds.length ? ' / SHARED CHALLENGE' : '/ DISCOVER'}</div>
    <div class="heading-row streamlined-head"><div><h1>${challengeIds.length ? 'Your Shared Challenge.' : isBlind ? 'Blind Discovery.' : 'Find Your Next Favorite.'}</h1><p class="lead">${challengeIds.length ? 'Hear the shared recordings in order. No spoilers, no account required.' : 'Listen. Swipe. Save. Explore deeper in Tune Lab when you want.'}</p>${challengeIds.length ? '' : '<div class="discovery-invitation"><span>♡ The more different artists you <strong>Keep</strong>, the better AFTERTONE can find your sound.</span><button type="button" data-action="focus-music-search">Search for an Artist ↗</button></div>'}</div></div>
    ${!state.history.length && !challengeIds.length ? `<section class="first-listen-guide" aria-label="How to start discovering music">
      <div class="first-listen-intro"><span class="eyebrow">YOUR FIRST LISTEN</span><strong>Three steps to find your sound.</strong></div>
      <ol><li><b>Choose a Path</b><span>Comfort Zone, New Territory, or Wild Card.</span></li><li><b>Press Play</b><span>Start a short music preview.</span></li><li><b>Keep or Pass</b><span>Guide the next discoveries. You can undo a choice.</span></li></ol>
      <p>Continuous listening begins after your first Play. You control the volume and can stop at any time.</p>
      <div class="first-listen-actions">${firstAction.action ? `<button type="button" class="accent-button" data-action="${firstAction.action}">${html(firstAction.label)} →</button>` : `<strong class="first-listen-state">${html(firstAction.label)}</strong>`}<p class="first-listen-action-help">${html(firstAction.help)}</p></div>
    </section>` : ''}
    ${seedInfo.active ? `<div class="discovery-mode-note">♫ ${seedInfo.kind==='artists'?'Your '+seedInfo.artists+' starting artists':'Your '+seedInfo.count+' imported songs'} · ${seedInfo.related ? seedInfo.related+' related artists found' : seedInfo.lookupStatus==='searching' ? 'Finding related artists…' : 'Mixing in chart discoveries'} <button data-action="fresh-discovery" class="secondary-button">Back to fresh</button></div>` : ''}
    ${(feed.error && current) ? `<div class="discovery-mode-note" role="status">${html(feed.error)} <button type="button" class="secondary-button" data-action="load-more" ${feed.loading ? 'disabled' : ''}>${feed.loading ? 'Retrying…' : 'Retry Discovery'}</button></div>` : ''}
    <div class="discovery-paths" aria-label="Choose your discovery path" ${challengeIds.length?'hidden':''}><div class="path-heading"><span class="eyebrow">PICK A PATH</span><span>Change direction whenever you want</span></div><div class="path-options">
      ${[['familiar','◎','Comfort Zone','Saved artists & neighbors'],['balanced','✳','New Territory','Related music + broad hits'],['explore','↗','Wild Card','Unfamiliar genres & voices']].map(([mode,icon,title,sub])=>`<button class="path-option ${state.discoveryMix===mode?'selected':''}" data-path="${mode}" aria-pressed="${state.discoveryMix===mode}"><span>${icon}</span><strong>${title}</strong><small>${sub}</small></button>`).join('')}
    </div><p class="path-explainer" role="status"><strong>${state.discoveryMix==='familiar'?'Comfort Zone':state.discoveryMix==='explore'?'Wild Card':'New Territory'}:</strong> ${html(PATH_DESCRIPTIONS[state.discoveryMix] || PATH_DESCRIPTIONS.balanced)} ${searchQuery ? 'You are searching manually; the path resumes when you clear the search.' : ''}</p></div>
    <div class="discovery-grid"><div>${renderListeningCard()}<div class="compact-queue" ${challengeIds.length?'hidden':''}><span class="queue-light" aria-hidden="true"></span><span><b id="queue-count">${feed.available ?? 0}</b> songs ahead <small>Refills automatically every 3 seconds</small></span><span class="queue-loaded">${feed.ids?.size ?? catalog.length} loaded · Deezer</span></div></div>
    <aside class="right-column" aria-label="Your discovery journey"><div class="panel journey-panel"><div class="panel-heading"><span class="panel-title">Your Journey</span><span class="panel-accent">✳</span></div><div class="journey-metrics"><div><strong>${taste.total}</strong><small>Explored</small></div><div><strong>${taste.liked}</strong><small>Kept</small></div><div><strong>${new Set(state.history.map(item=>item.artist).filter(Boolean)).size}</strong><small>Artists explored</small></div></div><div class="journey-progress"><span>Next Milestone</span><b>${10 - (taste.total % 10)} listens away</b></div><div class="journey-meter"><i style="width:${(taste.total % 10)*10}%"></i></div><p class="journey-caption">Every ten songs is another step into your musical map.</p></div>
    <div class="panel"><div class="panel-heading"><span class="panel-title">Your Sound</span><span style="color:var(--dim);font-size:12px">↗</span></div>${(()=>{const kept=state.history.filter(h=>h.action==='like'&&h.artist);const counts=new Map();for(const item of kept)counts.set(item.artist,(counts.get(item.artist)||0)+1);const best=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,3);return best.length ? `<div class="favorite-artists">${best.map(([artist,count])=>`<div><strong>${html(artist)}</strong><span>${count} kept</span></div>`).join('')}</div><p class="journey-caption">Based on songs you kept. Genre labels are only used when the catalog supplies them.</p>` : '<p class="empty-micro">Your choices will sketch your sound here.</p>';})()}</div>
    <section class="passport-panel" aria-label="Discovery Passport"><div class="passport-heading"><div><span class="eyebrow">YOUR DISCOVERY PASSPORT</span><strong>Earn your stamps.</strong></div><span class="passport-count" aria-label="${passport.earned} of ${passport.total} stamps earned">${passport.earned} / ${passport.total} ✦</span></div><p class="passport-intro">Tiny listening quests, no streak pressure. Explore on your own schedule.</p>
      <div class="passport-quests">${passport.quests.map(q=>`<article class="passport-quest ${q.completed?'completed':''}"><span class="passport-stamp" aria-hidden="true">${q.completed?'✓':'✧'}</span><div class="passport-quest-body"><strong>${html(q.title)}</strong><p>${html(q.detail)}</p><div class="passport-meter" role="progressbar" aria-label="${html(q.title)} progress" aria-valuenow="${q.progress}" aria-valuemin="0" aria-valuemax="${q.goal}"><i style="width:${100*q.progress/q.goal}%"></i></div></div><span class="passport-progress">${q.progress}/${q.goal}</span></article>`).join('')}</div>
      ${passport.quests.every(q=>q.completed) ? '<p class="passport-unlocked">✦ Passport complete. Your collection tells the story.</p><button class="passport-go" data-view="collection">View Your Collection ↗</button>' : (()=>{const next=passport.quests.find(q=>!q.completed);return `<button class="passport-go" data-action="passport-route" data-route="${next.action}">${html(next.actionLabel)} ↗</button>`;})()}
    </section>

    </section>`;
}

function renderSidebarPreferences() {
  const langNames = [['all','All languages'],['en','English preferred'],['en-strict','English-focused artists'],['es','Spanish'],['fr','French'],['pt','Portuguese'],['de','German'],['it','Italian'],['ja','Japanese'],['ko','Korean'],['zh','Chinese'],['hi','Hindi'],['ar','Arabic'],['ru','Russian']];
  return `<div class="sidebar-filter-head"><span>DISCOVERY SETTINGS</span><div class="sidebar-filter-head-actions"><button class="mobile-filter-close" type="button" data-action="close-mobile-filters" aria-label="Close discovery filters">Done ✓</button><button type="button" data-action="toggle-side-filters" aria-expanded="true" aria-controls="sidebar-filter-body" title="Collapse or expand discovery settings">▾</button></div></div>
  <div class="sidebar-filter-body" id="sidebar-filter-body">
    <form id="music-search-form" class="sidebar-filter-form" role="search"><label for="music-search">FIND MUSIC</label><div class="sidebar-search"><input id="music-search" aria-label="Search tracks and artists" placeholder="Artist or song…" value="${html(searchDraft)}"/><button aria-label="Search music" type="submit">↗</button></div></form>
    ${searchQuery ? `<button type="button" class="side-clear" data-action="clear-search">Clear search ×</button>` : ''}
    <label class="side-field" for="genre-select">GENRE<select id="genre-select" aria-label="Discovery genre">${allGenres.map(g=>`<option value="${html(g)}" ${g===state.genre?'selected':''}>${g==='all'?'All genres':g.charAt(0).toUpperCase()+g.slice(1)}</option>`).join('')}</select></label>
    <label class="side-field" for="language-select">LANGUAGE<select id="language-select" aria-label="Discovery language">${langNames.map(([code,name])=>`<option value="${code}" ${state.language===code?'selected':''}>${name}</option>`).join('')}</select></label>
    <div class="side-divider"></div>
    <span class="sidebar-filter-subtitle">PERSONALIZATION</span>
    <label class="side-field" for="discovery-mix-select">DISCOVERY MIX
      <select id="discovery-mix-select" aria-label="How adventurous should discovery be">
        <option value="balanced" ${(state.discoveryMix || 'balanced')==='balanced'?'selected':''}>Balanced · new music first</option>
        <option value="explore" ${state.discoveryMix==='explore'?'selected':''}>Adventurous · mostly surprises</option>
        <option value="familiar" ${state.discoveryMix==='familiar'?'selected':''}>Closer to my favorites</option>
      </select>
    </label>
    <span class="sidebar-filter-foot">${seedInfo.active ? `${seedInfo.related || 0} related artists found via Deezer. New performers are prioritized.` : 'Choose favorite artists or import a playlist to activate a personalized mix.'}</span>
    <button class="side-playlist" type="button" data-action="open-intro">✦ Choose favorite artists</button>
    <button class="side-playlist side-playlist-outline" type="button" data-action="import-playlist">↥ Import playlist</button>
    ${seedInfo.hasArtists && !seedInfo.active ? '<button class="side-clear" type="button" data-action="use-saved-artists">Use saved favorite artists</button>' : ''}
    ${seedInfo.active ? '<button class="side-clear" type="button" data-action="fresh-discovery">Use fresh discovery</button>' : seedInfo.ready ? '<button class="side-clear" type="button" data-action="use-saved-playlist">Use saved playlist</button>' : ''}
    <span class="sidebar-filter-foot">Fresh discovery starts automatically. Searches are temporary; only your choices influence your taste. Deezer previews stay on the listening card.</span>
  </div>`;
}

function renderQuizLab() {
  const saved = state.favorites.map(lookup).filter(Boolean);
  const quiz = quizSession;
  return `<section class="quiz-lab"><div class="eyebrow">YOUR SPACE / TUNE LAB</div><div class="page-head"><div><h1>Get to Know <em>Your Taste.</em></h1><p class="lead">Optional recognition questions about songs you've kept. No interruptions while discovering.</p></div></div>
  <div class="quiz-lab-intro"><span>♡ ${saved.length} saved songs</span><span>✦ ${quizStats.answered} answered</span><span>◎ ${quizStats.answered ? Math.round(quizStats.correct/quizStats.answered*100) : '—'}% recognition accuracy</span></div>
  ${!saved.length ? `<div class="empty-state"><h2>Save a few songs first.</h2><p>Then come back for recognition challenges and mood check-ins.</p><button class="accent-button" data-view="discover">Start Discovering →</button></div>` : !quiz ? `<div class="quiz-feature"><span class="eyebrow">ON YOUR SCHEDULE</span><h2>Ready for a Quick Round?</h2><p>We’ll select a saved song and ask you a short question. Answer, skip, or return to discovery whenever you want.</p><button class="accent-button" data-action="quiz-start">Start Tune Lab →</button></div>` : (()=>{
    const track = lookup(quiz.id);
    if(!track) return '<div class="empty-state">Song unavailable. <button data-action="quiz-next">Try another</button></div>';
    const correct = quiz.answer !== null;
    const isArtist = quiz.quiz.field === 'artist';
    const answerList = quiz.quiz.options.length>1 ? quiz.quiz.options.map((option,i)=>`<button class="quiz-answer ${correct ? (option===quiz.quiz.correct?'correct':quiz.answer===i?'incorrect':'') : ''}" data-quiz-answer="${i}" ${correct?'disabled':''}>${html(option)}</button>`).join('') : `<p>Not enough distinct answer choices yet. Save more tracks to expand the game.</p>`;
    return `<div class="quiz-feature"><div class="quiz-track"><div class="quiz-track-art">${track.artwork ? `<img src="${urlSafe(track.artwork)}" alt="Cover art" />` : '<span>♫</span>'}</div><div><span class="eyebrow">FROM YOUR FAVORITES</span><h2>${isArtist ? html(track.title) : html(track.artist)}</h2><p>${quiz.quiz.label}</p></div></div><div class="quiz-answers">${answerList}</div>
    ${correct ? `<div class="quiz-feedback" id="quiz-feedback" tabindex="-1" role="status" aria-live="polite">${quiz.quiz.options[quiz.answer]===quiz.quiz.correct ? '✓ Correct!' : `The answer was ${html(quiz.quiz.correct)}.`}</div><div class="quiz-moods" role="group" aria-label="What feeling does this song bring?"><span>What feeling does this song bring?</span>${['Bright','Warm','Dreamy','Intense','Reflective','Hopeful'].map(m=>`<button type="button" data-quiz-mood="${m}" class="${quiz.mood===m?'selected':''}" aria-pressed="${quiz.mood===m}">${m}</button>`).join('')}</div><div class="quiz-bottom"><button class="accent-button" data-action="quiz-next">Next question →</button><button class="secondary-button" data-view="discover">Back to Music</button></div>` : `<div class="quiz-bottom"><button class="secondary-button" data-action="quiz-next">Skip this question</button></div>`}</div>`;
  })()}
  </section>`;
}

function renderCollection() {
  const items = state.favorites.map(lookup).filter(Boolean);
  const paged=collectionPageModel(items,state.favorites,{
    query:collectionQuery,sort:collectionSort,page:collectionPage,
  });
  const pagingControls=(bottom=false)=>paged.pages<=1?'':`<nav class="collection-paging" aria-label="Saved song pages">
    ${bottom?`<span>Page ${paged.page} of ${paged.pages}</span>`
      :`<span id="collection-page-status" tabindex="-1" role="status" aria-live="polite" aria-atomic="true">Songs ${paged.start}–${paged.end} of ${paged.total} · Page ${paged.page} of ${paged.pages}</span>`}
    <div class="collection-paging-actions">
      <button type="button" class="secondary-button" data-action="collection-page" data-page="${paged.page-1}" ${paged.hasPrevious?'':'disabled'} aria-label="Previous saved songs page">← Previous</button>
      ${bottom?'':`<label>Page <select id="collection-page-select" aria-label="Choose saved songs page">${Array.from({length:paged.pages},(_,i)=>`<option value="${i+1}" ${paged.page===i+1?'selected':''}>${i+1} of ${paged.pages}</option>`).join('')}</select></label>`}
      <button type="button" class="secondary-button" data-action="collection-page" data-page="${paged.page+1}" ${paged.hasNext?'':'disabled'} aria-label="Next saved songs page">Next →</button>
    </div>
  </nav>`;
  return `<section><div class="eyebrow">KEEP WHAT MOVES YOU</div><div class="page-head"><div><h1>Your Collection<span style="color:var(--accent)">.</span></h1><p class="lead">No algorithms telling you what to love. Every track here earned its place.</p></div><div class="collection-header-actions"><button class="secondary-button" data-action="export-json" ${items.length ? '' : 'disabled'}>↧ Export Library</button><button class="secondary-button" data-action="backup-progress">↧ Backup Progress</button><button class="secondary-button" data-action="restore-progress" aria-describedby="collection-backup-note">↥ Restore Backup</button><input id="progress-backup-file" type="file" accept=".json,application/json" aria-label="Choose an AFTERTONE progress backup" hidden /></div></div>
  <p id="collection-backup-note" class="collection-backup-note">Restore replaces your current progress; download a backup first. Backup files are not encrypted. Your data stays in this browser unless you download a copy. Version 2 backups include saved tracks, listening choices, preferences, Music Duels, imported playlist song names and manual lyric timing offsets, but never audio files.</p><p id="progress-backup-status" class="collection-backup-note" role="status" aria-live="polite" aria-atomic="true" hidden></p>
  ${removedFavorite && !state.favorites.includes(removedFavorite.id) ? `<div class="collection-removal-notice"><p role="status" aria-live="polite">Removed “${html(removedFavorite.title)}” from Collection.</p><button type="button" class="secondary-button" data-action="undo-remove-favorite">Undo Remove</button></div>` : ''}
  ${items.length ? `<div class="collection-tools"><input id="collection-search" class="search-input" type="search" placeholder="Search songs, artists, genres…" aria-label="Search saved music" value="${html(collectionQuery)}" /><select class="select-input" id="sort-select" aria-label="Sort collection"><option value="recent" ${collectionSort === 'recent' ? 'selected' : ''}>Recently kept</option><option value="title" ${collectionSort === 'title' ? 'selected' : ''}>Song title</option><option value="artist" ${collectionSort === 'artist' ? 'selected' : ''}>Artist</option></select>${collectionQuery ? '<button type="button" class="secondary-button" data-action="clear-collection-search">Clear Search</button>' : ''}<button class="secondary-button" data-action="export-csv">CSV ↧</button></div>
  ${collectionQuery ? `<p class="collection-match-count">Showing ${paged.total} of ${items.length} saved ${items.length===1?'song':'songs'}.</p>` : ''}
  ${paged.total ? `${paged.pages>1?pagingControls():''}<div class="collection-grid">${paged.visible.map((track) => {
    const [a,b] = shade(track.id); const event = state.history.find((item) => item.id === track.id);
    return `<article class="track-tile"><div class="tile-art" style="--tone-a:${a};--tone-b:${b}">${track.artwork ? `<img loading="lazy" src="${urlSafe(track.artwork)}" alt="" />` : '<span class="art-glyph">◉</span>'}<span class="tile-count">${event?.recognized ? 'RECOGNIZED' : 'DISCOVERED'}</span></div><div class="tile-body"><strong title="${html(track.title)}">${html(track.title)}</strong><p>${html(track.artist)}</p><div class="tag-row">${tag(track.genre)}${tag(event?.mood || track.mood)}</div><div class="tile-actions"><button data-preview="${html(track.id)}" aria-label="Listen to ${html(track.title)}">▶ Listen</button><button data-action="remove-favorite" data-id="${html(track.id)}" class="remove-button" aria-label="Remove ${html(track.title)} from collection">×</button></div></div></article>`;
  }).join('')}</div>${pagingControls(true)}` : `<div class="empty-state"><h2>No Matches.</h2><p>No saved songs matched this search. Clear it to see your collection again.</p><button type="button" class="accent-button" data-action="clear-collection-search">Show All Saved Songs</button></div>`}
  <p style="font-size:11px;color:var(--dim);margin-top:22px">${plural(items.length,'saved track')} · Recordings provided by their source hosts. Visit the original source for attribution and licensing.</p>` : `<div class="empty-state"><div class="empty-icon">♡</div><h2>Nothing Saved Yet.</h2><p>Start swiping. The moment a track catches your ear, your collection comes to life.</p><button class="accent-button" data-view="discover">Explore Music →</button></div>`}</section>`;
}

function createMapSvg(taste) {
  const entries = taste.genres.filter(([, score]) => score > 0).slice(0, 7);
  if (!entries.length) {
    return `<div style="display:grid;place-items:center;min-height:290px;text-align:center;color:var(--muted);font-size:13px;line-height:1.7"><div><span style="display:block;font-size:60px;color:var(--accent);margin-bottom:17px">⬡</span>Your sound constellation is waiting.<br>Save a few tracks to light it up.</div></div>`;
  }
  const nodes = entries.map(([genre, value], index) => {
    const angle = index / entries.length * Math.PI * 2 - Math.PI / 2;
    const r = entries.length < 4 ? 108 : 135;
    return { genre, value, x: 250 + Math.cos(angle) * r, y: 205 + Math.sin(angle) * r };
  });
  const highest = Math.max(1, ...entries.map((item) => item[1]));
  return `<svg class="map-visual" viewBox="0 0 500 410" role="img" aria-label="Taste map showing ${html(entries.map(([genre]) => genre).join(', '))}"><circle class="map-ring" cx="250" cy="205" r="66"/><circle class="map-ring" cx="250" cy="205" r="145"/>${nodes.map((node) => `<line class="map-line" x1="250" y1="205" x2="${node.x.toFixed(1)}" y2="${node.y.toFixed(1)}" />`).join('')}<circle class="map-core" cx="250" cy="205" r="36"/><text x="250" y="209" text-anchor="middle" fill="var(--accent)" font-size="21" font-weight="700">✳</text>${nodes.map((node) => `<circle class="map-node ${node.value === highest ? 'strong-node' : ''}" cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="${clamp(14 + node.value / highest * 14, 15, 30)}"/><text class="map-node-title" x="${node.x.toFixed(1)}" y="${(node.y + 47).toFixed(1)}" text-anchor="middle">${html(node.genre)}</text>`).join('')}</svg>`;
}

function renderTaste() {
  const taste = computeTaste(state.history, catalog);
  const genres = taste.genres.filter(([, n]) => n > 0);
  const moods = taste.moods.filter(([, n]) => n > 0);
  return `<section><div class="eyebrow">AN EXPERIMENT IN SELF-DISCOVERY</div><div class="page-head"><div><h1>Your Taste, <em>Visualized.</em></h1><p class="lead">A map that grows with your ears, not a personality quiz that ends after five questions.</p></div><button class="secondary-button" data-action="export-json">↧ Export your data</button></div>
  <div class="stat-cards"><div class="stat-card"><strong>${taste.total}</strong><span>Tracks explored</span></div><div class="stat-card"><strong>${taste.liked}</strong><span>Tracks kept</span></div><div class="stat-card"><strong>${taste.accuracy === null ? '—' : `${taste.accuracy}%`}</strong><span>Recognition accuracy</span></div></div>
  <div class="taste-overview"><div class="panel map-panel"><div class="panel-heading map-head"><div><span class="panel-title">The constellation</span><p style="font-size:11px;color:var(--muted);margin:6px 0 0">Each node is a genre you've connected with.</p></div><span class="panel-accent">✳</span></div>${createMapSvg(taste)}</div>
  <div class="right-column"><div class="panel"><div class="panel-heading"><span class="panel-title">Favorite frequencies</span><span class="panel-accent">≋</span></div>${genres.length ? `<div class="taste-bars">${genres.slice(0, 6).map(([genre, score]) => `<div><div class="bar-label"><strong style="text-transform:capitalize">${html(genre)}</strong><span>${score} pts</span></div><div class="meter"><span style="width:${score / genres[0][1] * 100}%"></span></div></div>`).join('')}</div>` : '<p class="empty-micro">Nothing mapped yet. Let the music find you.</p>'}</div>
  <div class="panel"><div class="panel-heading"><span class="panel-title">Your listening moods</span><span class="panel-accent">♡</span></div>${moods.length ? `<div class="tag-row">${moods.slice(0, 7).map(([mood]) => tag(mood)).join('')}</div>` : '<p class="empty-micro">Mood signals appear when you save tracks.</p>'}</div></div></div>
  <div class="panel" style="margin-top:22px"><div class="panel-heading"><span class="panel-title">How it gets smarter</span><span class="panel-accent">↗</span></div><div class="insight-list"><div class="insight"><strong>Preference isn't recognition</strong><p>Liking a new sound counts just as much as liking a familiar one. Trivia accuracy is tracked separately so obscure artists still get a fair shot.</p></div><div class="insight"><strong>A little unpredictability is a feature</strong><p>Suggestions balance your genre preferences with new styles and avoid repeatedly playing the same artist. You can still steer your session using a genre filter.</p></div><div class="insight"><strong>Your data belongs to you</strong><p>Your likes, passes and guesses stay in local browser storage. Export them whenever you want. There is no user account or analytics collection.</p></div></div></div></section>`;
}

function renderChallenges() {
  const eligible=eligibleChallengeTracks(state.favorites,catalog);
  const chosen=reconcileChallengeDraft(challengeDraft??defaultChallengeDraft(eligible),eligible);
  const byId=new Map(eligible.map(track=>[track.id,track]));
  const matches=challengeLibraryPage(eligible,chosen,challengeFilterQuery,challengePage);
  const candidates=matches.tracks;
  const searchTerm=challengeFilterQuery.trim();
  return `<section><div class="eyebrow">GOOD MUSIC IS BETTER SHARED</div><div class="page-head"><div><h1>Pass the <em>Aux.</em></h1><p class="lead">Create a blind-listening challenge from your favorite recordings. Choose which songs to send and the order your friends will hear them.</p></div></div>
  <div class="challenge-hero"><div><div class="eyebrow">THE FIVE-SONG TEST</div><h2>Think you know my taste?</h2><p>Choose up to five saved songs. Change their order, send a link, and find out who shares your ears.</p><div class="challenge-hero-actions"><button type="button" class="accent-button" data-action="share-challenge" ${chosen.length?'':'disabled'}>↗ Share ${chosen.length || ''}${chosen.length===1?' Song':chosen.length?' Songs':' My Challenge'}</button><button type="button" class="secondary-button" data-action="try-challenge">Try a sample →</button></div><p class="challenge-share-hint">${eligible.length ? `${eligible.length} saved Deezer ${eligible.length===1?'song':'songs'} available. The five most recent start selected; customize your list below. Songs are shared by ID only.` : 'Keep a Deezer song in Discover to create your challenge. No account, private library or listening history is shared.'}</p></div><div class="challenge-badge" aria-hidden="true">✳</div></div>
  <section class="challenge-builder" aria-labelledby="challenge-builder-heading">
    <div class="challenge-builder-header"><div><span class="eyebrow">YOUR MIXTAPE</span><h2 id="challenge-builder-heading">Choose the listening order.</h2><p>${chosen.length} of ${MAX_CHALLENGE_TRACKS} tracks selected · First song at the top</p></div><button type="button" class="secondary-button" data-action="reset-challenge-draft" ${eligible.length?'':'disabled'}>Use Latest Five</button></div>
    ${chosen.length ? `<ol class="challenge-draft-list" aria-label="Chosen challenge songs, in sharing order">
      ${chosen.map((id,index)=>{const track=byId.get(id);return `<li class="challenge-draft-item" data-chosen-id="${html(id)}"><span class="challenge-draft-position">${String(index+1).padStart(2,'0')}</span><div class="challenge-draft-track"><strong>${html(track.title)}</strong><span>${html(track.artist)}</span></div><div class="challenge-draft-controls"><button type="button" class="secondary-button" data-action="move-challenge-up" data-id="${html(id)}" aria-label="Move ${html(track.title)} earlier" ${index===0?'disabled':''}>↑</button><button type="button" class="secondary-button" data-action="move-challenge-down" data-id="${html(id)}" aria-label="Move ${html(track.title)} later" ${index===chosen.length-1?'disabled':''}>↓</button><button type="button" class="secondary-button" data-action="remove-challenge-track" data-id="${html(id)}" aria-label="Remove ${html(track.title)} from challenge">Remove</button></div></li>`;}).join('')}
    </ol>` : '<p class="challenge-builder-empty">No songs selected. Add a saved Deezer song below to begin.</p>'}
    ${eligible.length ? `<div class="challenge-library"><label for="challenge-track-search">Find a saved song</label><input id="challenge-track-search" type="search" class="search-input" autocomplete="off" placeholder="Search saved titles or artists…" value="${html(challengeFilterQuery)}" aria-describedby="challenge-match-count" />
    <p id="challenge-match-count" class="challenge-match-count" role="status" aria-live="polite" aria-atomic="true" tabindex="-1">${matches.total} unselected ${matches.total===1?'song':'songs'} found${matches.total?' · Showing '+matches.start+'–'+matches.end+' of '+matches.total:''}. ${chosen.length===MAX_CHALLENGE_TRACKS?'Remove one to add another.':''}</p>
    ${candidates.length?`<ul id="challenge-library-results" class="challenge-library-list" aria-label="Saved songs available to add">
      ${candidates.map(track=>`<li class="challenge-library-item"><div><strong>${html(track.title)}</strong><span>${html(track.artist)}</span></div><button type="button" class="secondary-button" data-action="add-challenge-track" data-id="${html(track.id)}" aria-label="Add ${html(track.title)} to challenge" ${chosen.length>=MAX_CHALLENGE_TRACKS?'disabled':''}>+ Add</button></li>`).join('')}
    </ul>` : `<p class="challenge-builder-empty">${searchTerm?'No unselected saved recordings match your search.':'All saved recordings are already selected.'}</p>`}
    ${matches.pageCount>1 ? `<nav class="challenge-library-pages" aria-label="Saved song search pages"><button type="button" class="secondary-button" data-action="challenge-previous-page" aria-controls="challenge-library-results" ${matches.page===1?'disabled':''}>← Previous</button><span>Page ${matches.page} of ${matches.pageCount}</span><button type="button" class="secondary-button" data-action="challenge-next-page" aria-controls="challenge-library-results" ${matches.page===matches.pageCount?'disabled':''}>Next →</button></nav>` : ''}
    </div>` : '<p class="challenge-builder-empty">No public Deezer favorites yet. Save songs in Discover, then return here to build your challenge.</p>'}
    <p class="challenge-builder-privacy" role="status" aria-live="polite">Only Deezer track IDs and their order go into the link. ${challengeDraftSaved ? 'Your custom selection is saved for reloads in this tab only.' : challengeDraftCustomized ? 'Your selection is usable now, but this browser did not save it. Refreshing may reset your choices.' : 'Latest saved songs are ready. Custom selections can be saved in this tab.'} Nothing is posted to an account.</p>
  </section>
  <div class="steps-grid"><div class="step-card"><span>01 / CURATE</span><strong>Choose your five.</strong><p>Select your favorite recordings and set their listening order.</p></div><div class="step-card"><span>02 / SEND</span><strong>Share a single link.</strong><p>No sign-in, server database, or account necessary. The link holds just track IDs.</p></div><div class="step-card"><span>03 / COMPARE</span><strong>Let your friends decide.</strong><p>They hear your recordings blind and see how many make their own cut.</p></div></div></section>`;
}


  return { renderDiscovery, renderCollection, renderTaste, renderChallenges, renderSidebarPreferences, renderQuizLab };
}
