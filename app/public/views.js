import { computeTaste } from '../src/taste.mjs';
import { getPassportProgress } from '../src/discovery/passport.mjs';
import { PATH_DESCRIPTIONS } from '../src/discovery/mode-engine.mjs';
import { html, plural, clamp, urlSafe, h32, shade, tag } from './view-utils.js';

/**
 * Side-effect-free page templates. The caller passes a state snapshot, making
 * rendering deterministic and easy to test independently of the DOM.
 */
export function createViews({ state, catalog, current, allGenres, challengeIds, challengeResponses, catalogWarning, catalogLive, collectionQuery, collectionSort, feed = {}, availableSources = ['mix', 'audius', 'commons'], searchQuery = '', sourceLabel = 'All sources', seedInfo = { active:false, kind:'playlist', ready:false, count:0, artists:0, related:0, hasArtists:false }, quizSession=null, quizStats={answered:0,correct:0} }) {
  const lookup = (id) => catalog.find((track) => track.id === id) ?? null;
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
  if (!current) {
    const challengeDone = challengeIds.length > 0 && challengeResponses.length >= challengeIds.length;
    const liked = challengeResponses.filter((item) => item.action === 'like').length;
    return `<div class="empty-state" style="min-height:390px"><div class="empty-icon">${challengeDone ? '✦' : feed.loading ? '♫' : '◎'}</div><h2>${challengeDone ? 'Challenge complete.' : feed.loading ? 'Finding your next song…' : feed.hasMore ? 'More music is on the way.' : 'Nothing else matched this search.'}</h2><p>${challengeDone ? `You kept ${liked} of ${challengeResponses.length} tracks. Your ears have spoken.` : feed.loading ? 'Fetching another batch from your chosen music sources. Your favorites are safe.' : feed.error ? html(feed.error) : searchQuery ? `No matching recordings were found for “${html(searchQuery)}” in the selected sources. Deezer search results can be limited by availability and filtering.` : 'Deezer has no more matching tracks right now. Try another artist, genre, or language.'}</p>${challengeDone ? `<button class="accent-button" data-action="exit-challenge">Back to discovery →</button>` : `<div class="empty-actions"><button class="accent-button" data-action="load-more" ${feed.loading ? 'disabled' : ''}>${feed.loading ? 'Searching…' : 'Find more songs ↻'}</button>${searchQuery ? '<button class="secondary-button" data-action="clear-search">Clear search</button>' : '<button class="secondary-button" data-action="reset-listens">Replay heard songs</button>'}</div>`}</div>`;
  }
  const trackReason = current.seedReason || (state.discoveryMix === 'explore' ? 'A surprise beyond your usual sound' : state.discoveryMix === 'familiar' ? 'Close to your saved favorites' : 'An open-ended discovery');
  const ordinal = challengeIds.length ? challengeResponses.length + 1 : state.history.length + 1;
  const deezerId = current.source === 'deezer' && /^deezer:(\d{1,20})$/.exec(current.id)?.[1];
  const art = `<div class="cover-fallback"><span>♫</span><small>NO ARTWORK AVAILABLE</small></div>${current.artwork ? `<img class="current-cover-img" src="${urlSafe(current.artwork)}" loading="eager" alt="Artwork for ${html(current.title)}" />` : ''}`;
  return `<div id="listening-card" class="listening-card ${isBlind ? 'blind-card' : 'known-card'} ${deezerId ? 'deezer-card' : ''}" role="group" aria-label="${isBlind ? 'Blind listening' : `${html(current.title)} by ${html(current.artist)}`}. Swipe left to pass, right to keep.">
    <div id="decision-stamp" class="decision-stamp" aria-hidden="true"></div>
    <div class="card-top"><span class="on-air"><i></i>${isBlind ? 'BLIND CHALLENGE' : 'NOW DISCOVERING'}</span><span class="card-number">${challengeIds.length ? `CHALLENGE ${String(ordinal).padStart(2, '0')} / ${challengeIds.length}` : `DISCOVERY ${String(ordinal).padStart(3, '0')}`}</span></div>
    <div class="record-visual ${isBlind ? '' : 'cover-visual'}">${isBlind ? '<div class="record-halo"></div><div class="vinyl" id="vinyl"><div class="record-sheen"></div></div>' : `<div class="current-cover">${art}</div>`}</div>
    ${isBlind ? '<div class="hidden-caption"><div class="hidden-overline">IDENTITY HIDDEN</div><strong>Who could it be?</strong><span>Listen first. Reveal after your choice.</span></div>' : `<div class="track-identity"><span class="track-source-chip">${html(current.source === 'jellyfin' ? 'YOUR LIBRARY' : current.source.toUpperCase())}</span><h2 title="${html(current.artist)} — ${html(current.title)}">${html(current.artist)} <span class="artist-title-separator">—</span> ${html(current.title)}</h2><p>${html(trackReason)}</p><div class="identity-tags">${current.genre !== 'unknown' ? tag(current.genre) : ''}${current.mood && current.mood !== 'Fresh' ? tag(current.mood) : ''}</div></div>`}
    <div class="waveform" id="waveform" aria-hidden="true">${waveform(current.id)}</div>
    <div class="playback-controls"><button id="stage-play" class="play-button" data-action="play-current" aria-label="Play preview">▶</button><div class="playback-copy">22-second listening preview<small id="audio-status">Press Play once, then swipe through songs</small></div><span class="playback-time" id="audio-time">0:00 / 0:22</span><button id="stop-session" class="stop-session" data-action="stop-session" title="Stop continuous listening" aria-label="Stop continuous listening" hidden>■ Stop</button></div><div class="progress-track" role="presentation"><div class="progress-fill" id="audio-progress"></div></div>
    <div class="preview-volume" role="group" aria-label="Preview volume"><label for="preview-volume"><span aria-hidden="true">♫</span> Volume</label><input id="preview-volume" data-volume-slider type="range" min="0" max="100" step="1" value="${clamp(Number(state.volume ?? 35),0,100)}" aria-label="Adjust music preview volume" /><output for="preview-volume" data-volume-value>${!state.sound ? 'Muted' : `${Math.round(Number(state.volume ?? 35))}%`}</output></div>
    <div class="lyric-panel"><button class="lyric-toggle" data-action="lyrics-toggle" aria-expanded="false" aria-label="Toggle synchronized lyrics">♫ Lyrics <span id="lyric-indicator">Optional</span></button><div id="live-lyrics" class="lyric-display" hidden><div id="lyric-line" role="status" aria-live="off">Loading synchronized lyrics…</div><div class="lyric-align" id="lyric-align" hidden><label for="lyrics-offset">Preview begins at <b id="lyric-offset-value">0:00</b> in the full song</label><input type="range" id="lyrics-offset" min="0" max="300" value="0" step="1" aria-label="Adjust the preview's position within the song" /><small>Adjust to match by ear · excerpt start is not supplied by Deezer</small></div><a href="https://lrclib.net" target="_blank" rel="noopener noreferrer" class="lyric-credit">Lyrics lookup: LRCLIB ↗</a></div></div>
    <div class="decision-row decision-row-in-card" aria-label="Rate this song"><button data-action="pass" title="Pass" aria-label="Pass on this song" class="decision-button decision-pass"><b aria-hidden="true">×</b></button><button data-action="undo" title="Undo last decision" aria-label="Undo last decision" class="decision-button decision-undo" ${state.history.length && !challengeIds.length ? '' : 'disabled'}><b aria-hidden="true">↶</b></button><button data-action="toggle-blind" title="${state.blind ? 'Turn blind mode off' : 'Turn blind mode on'}" aria-label="Blind mode" aria-pressed="${Boolean(state.blind)}" class="decision-button decision-blind ${state.blind?'is-on':''}"><b aria-hidden="true">◉</b><small>Blind</small></button><button data-action="like" title="Keep" aria-label="Keep this song in my favorites" class="decision-button decision-like"><b aria-hidden="true">♥</b></button></div>
    <div class="player-shortcuts"><span id="continuity-hint">Play to begin continuous listening</span><span>← Pass · → Keep · Space Play · B Blind</span></div>
  </div>`;
}

function renderDiscovery() {
  const taste = computeTaste(state.history, catalog);
  const passport = getPassportProgress(state.history, quizStats);
  const top = taste.genres.filter(([, score]) => score > 0).slice(0, 3);
  const isBlind = Boolean(state.blind || challengeIds.length > 0);
  const countCopy = feed.total && state.source === 'jellyfin' ? `${Number(feed.total).toLocaleString()} tracks in your library` : `${catalog.length.toLocaleString()} loaded this session`;
  return `<section><div class="eyebrow">THE LISTENING ROOM ${challengeIds.length ? ' / SHARED CHALLENGE' : '/ DISCOVER'}</div>
    <div class="heading-row streamlined-head"><div><h1>${isBlind ? 'Blind discovery.' : 'Find your next favorite.'}</h1><p class="lead">Listen. Swipe. Save. Explore deeper in Tune Lab when you want.</p><div class="discovery-invitation"><span>♡ The more different artists you <strong>Keep</strong>, the better AFTERTONE can find your sound.</span><button type="button" data-action="focus-music-search">Search a new artist ↗</button></div></div></div>
    ${seedInfo.active ? `<div class="discovery-mode-note">♫ ${seedInfo.kind==='artists'?'Your '+seedInfo.artists+' starting artists':'Your '+seedInfo.count+' imported songs'} · ${seedInfo.related ? seedInfo.related+' related artists found' : seedInfo.lookupStatus==='searching' ? 'Finding related artists…' : 'Mixing in chart discoveries'} <button data-action="fresh-discovery" class="secondary-button">Back to fresh</button></div>` : ''}
    ${(feed.error) ? `<p class="discovery-mode-note">${html(feed.error)}</p>` : ''}
    <div class="discovery-paths" aria-label="Choose your discovery path"><div class="path-heading"><span class="eyebrow">PICK A PATH</span><span>Change direction whenever you want</span></div><div class="path-options">
      ${[['familiar','◎','Comfort zone','Saved artists & neighbors'],['balanced','✳','New territory','Related music + broad hits'],['explore','↗','Wild card','Unfamiliar genres & voices']].map(([mode,icon,title,sub])=>`<button class="path-option ${state.discoveryMix===mode?'selected':''}" data-path="${mode}" aria-pressed="${state.discoveryMix===mode}"><span>${icon}</span><strong>${title}</strong><small>${sub}</small></button>`).join('')}
    </div><p class="path-explainer" role="status"><strong>${state.discoveryMix==='familiar'?'Comfort Zone':state.discoveryMix==='explore'?'Wild Card':'New Territory'}:</strong> ${html(PATH_DESCRIPTIONS[state.discoveryMix] || PATH_DESCRIPTIONS.balanced)} ${searchQuery ? 'You are searching manually; the path resumes when you clear the search.' : ''}</p></div>
    <div class="discovery-grid"><div>${renderListeningCard()}<div class="compact-queue"><span class="queue-light" aria-hidden="true"></span><span><b id="queue-count">${feed.available ?? 0}</b> songs ahead <small>Auto-refills every 3s when needed</small></span><span class="queue-loaded">${feed.ids?.size ?? catalog.length} loaded · Deezer</span></div></div>
    <aside class="right-column" aria-label="Your discovery journey"><div class="panel journey-panel"><div class="panel-heading"><span class="panel-title">Your journey</span><span class="panel-accent">✳</span></div><div class="journey-metrics"><div><strong>${taste.total}</strong><small>Explored</small></div><div><strong>${taste.liked}</strong><small>Kept</small></div><div><strong>${new Set(state.history.map(item=>item.artist).filter(Boolean)).size}</strong><small>Artists explored</small></div></div><div class="journey-progress"><span>Next milestone</span><b>${10 - (taste.total % 10)} listens away</b></div><div class="journey-meter"><i style="width:${(taste.total % 10)*10}%"></i></div><p class="journey-caption">Every ten songs is another step into your musical map.</p></div>
    <div class="panel"><div class="panel-heading"><span class="panel-title">Your sound</span><span style="color:var(--dim);font-size:12px">↗</span></div>${(()=>{const kept=state.history.filter(h=>h.action==='like'&&h.artist);const counts=new Map();for(const item of kept)counts.set(item.artist,(counts.get(item.artist)||0)+1);const best=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,3);return best.length ? `<div class="favorite-artists">${best.map(([artist,count])=>`<div><strong>${html(artist)}</strong><span>${count} kept</span></div>`).join('')}</div><p class="journey-caption">Based on songs you kept. Genre labels are only used when the catalog supplies them.</p>` : '<p class="empty-micro">Your choices will sketch your sound here.</p>';})()}</div>
    <section class="passport-panel" aria-label="Discovery Passport"><div class="passport-heading"><div><span class="eyebrow">YOUR DISCOVERY PASSPORT</span><strong>Earn your stamps.</strong></div><span class="passport-count" aria-label="${passport.earned} of ${passport.total} stamps earned">${passport.earned} / ${passport.total} ✦</span></div><p class="passport-intro">Tiny listening quests, no streak pressure. Explore on your own schedule.</p>
      <div class="passport-quests">${passport.quests.map(q=>`<article class="passport-quest ${q.completed?'completed':''}"><span class="passport-stamp" aria-hidden="true">${q.completed?'✓':'✧'}</span><div class="passport-quest-body"><strong>${html(q.title)}</strong><p>${html(q.detail)}</p><div class="passport-meter" role="progressbar" aria-label="${html(q.title)} progress" aria-valuenow="${q.progress}" aria-valuemin="0" aria-valuemax="${q.goal}"><i style="width:${100*q.progress/q.goal}%"></i></div></div><span class="passport-progress">${q.progress}/${q.goal}</span></article>`).join('')}</div>
      ${passport.quests.every(q=>q.completed) ? '<p class="passport-unlocked">✦ Passport complete. Your collection tells the story.</p><button class="passport-go" data-view="collection">Visit your collection ↗</button>' : (()=>{const next=passport.quests.find(q=>!q.completed);return `<button class="passport-go" data-action="passport-route" data-route="${next.action}">${html(next.actionLabel)} ↗</button>`;})()}
    </section>

    </section>`;
}

function renderSidebarPreferences() {
  const langNames = [['all','All languages'],['en','English preferred'],['en-strict','English-focused artists'],['es','Spanish'],['fr','French'],['pt','Portuguese'],['de','German'],['it','Italian'],['ja','Japanese'],['ko','Korean'],['zh','Chinese'],['hi','Hindi'],['ar','Arabic'],['ru','Russian']];
  return `<div class="sidebar-filter-head"><span>DISCOVERY SETTINGS</span><button type="button" data-action="toggle-side-filters" aria-expanded="true" aria-controls="sidebar-filter-body" title="Collapse or expand discovery settings">▾</button></div>
  <div class="sidebar-filter-body" id="sidebar-filter-body">
    <form id="music-search-form" class="sidebar-filter-form" role="search"><label for="music-search">FIND MUSIC</label><div class="sidebar-search"><input id="music-search" aria-label="Search tracks and artists" placeholder="Artist or song…" value="${html(searchQuery)}"/><button aria-label="Search music" type="submit">↗</button></div></form>
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
  return `<section class="quiz-lab"><div class="eyebrow">YOUR SPACE / TUNE LAB</div><div class="page-head"><div><h1>Get to know <em>your taste.</em></h1><p class="lead">Optional recognition questions about songs you've kept. No interruptions while discovering.</p></div></div>
  <div class="quiz-lab-intro"><span>♡ ${saved.length} saved songs</span><span>✦ ${quizStats.answered} answered</span><span>◎ ${quizStats.answered ? Math.round(quizStats.correct/quizStats.answered*100) : '—'}% recognition accuracy</span></div>
  ${!saved.length ? `<div class="empty-state"><h2>Save a few songs first.</h2><p>Then come back for recognition challenges and mood check-ins.</p><button class="accent-button" data-view="discover">Start discovering →</button></div>` : !quiz ? `<div class="quiz-feature"><span class="eyebrow">ON YOUR SCHEDULE</span><h2>Ready for a quick round?</h2><p>We’ll select a saved song and ask you a short question. Answer, skip, or return to discovery whenever you want.</p><button class="accent-button" data-action="quiz-start">Start Tune Lab →</button></div>` : (()=>{
    const track = lookup(quiz.id);
    if(!track) return '<div class="empty-state">Song unavailable. <button data-action="quiz-next">Try another</button></div>';
    const correct = quiz.answer !== null;
    const isArtist = quiz.quiz.field === 'artist';
    const answerList = quiz.quiz.options.length>1 ? quiz.quiz.options.map((option,i)=>`<button class="quiz-answer ${correct ? (option===quiz.quiz.correct?'correct':quiz.answer===i?'incorrect':'') : ''}" data-quiz-answer="${i}" ${correct?'disabled':''}>${html(option)}</button>`).join('') : `<p>Not enough distinct answer choices yet. Save more tracks to expand the game.</p>`;
    return `<div class="quiz-feature"><div class="quiz-track"><div class="quiz-track-art">${track.artwork ? `<img src="${urlSafe(track.artwork)}" alt="Cover art" />` : '<span>♫</span>'}</div><div><span class="eyebrow">FROM YOUR FAVORITES</span><h2>${isArtist ? html(track.title) : html(track.artist)}</h2><p>${quiz.quiz.label}</p></div></div><div class="quiz-answers">${answerList}</div>
    ${correct ? `<div class="quiz-feedback">${quiz.quiz.options[quiz.answer]===quiz.quiz.correct ? '✓ Correct!' : `The answer was ${html(quiz.quiz.correct)}.`}</div><div class="quiz-moods"><span>What feeling does this song bring?</span>${['Bright','Warm','Dreamy','Intense','Reflective','Hopeful'].map(m=>`<button data-quiz-mood="${m}" class="${quiz.mood===m?'selected':''}">${m}</button>`).join('')}</div><div class="quiz-bottom"><button class="accent-button" data-action="quiz-next">Next question →</button><button class="secondary-button" data-view="discover">Back to music</button></div>` : `<div class="quiz-bottom"><button class="secondary-button" data-action="quiz-next">Skip this question</button></div>`}</div>`;
  })()}
  </section>`;
}

function renderCollection() {
  const items = state.favorites.map(lookup).filter(Boolean);
  const filtered = items.filter((track) => `${track.title} ${track.artist} ${track.genre}`.toLowerCase().includes(collectionQuery.toLowerCase()));
  filtered.sort((a, b) => collectionSort === 'title' ? a.title.localeCompare(b.title) : collectionSort === 'artist' ? a.artist.localeCompare(b.artist) : state.favorites.indexOf(b.id) - state.favorites.indexOf(a.id));
  return `<section><div class="eyebrow">KEEP WHAT MOVES YOU</div><div class="page-head"><div><h1>Your collection<span style="color:var(--accent)">.</span></h1><p class="lead">No algorithms telling you what to love. Every track here earned its place.</p></div><button class="secondary-button" data-action="export-json" ${items.length ? '' : 'disabled'}>↧ Export library</button></div>
  ${items.length ? `<div class="collection-tools"><input id="collection-search" class="search-input" type="search" placeholder="Search songs, artists, genres…" aria-label="Search saved music" value="${html(collectionQuery)}" /><select class="select-input" id="sort-select" aria-label="Sort collection"><option value="recent" ${collectionSort === 'recent' ? 'selected' : ''}>Recently kept</option><option value="title" ${collectionSort === 'title' ? 'selected' : ''}>Song title</option><option value="artist" ${collectionSort === 'artist' ? 'selected' : ''}>Artist</option></select><button class="secondary-button" data-action="export-csv">CSV ↧</button></div>
  ${filtered.length ? `<div class="collection-grid">${filtered.map((track, index) => {
    const [a,b] = shade(track.id); const event = state.history.find((item) => item.id === track.id);
    return `<article class="track-tile"><div class="tile-art" style="--tone-a:${a};--tone-b:${b}">${track.artwork ? `<img loading="lazy" src="${urlSafe(track.artwork)}" alt="" />` : '<span class="art-glyph">◉</span>'}<span class="tile-count">${event?.recognized ? 'RECOGNIZED' : 'DISCOVERED'}</span></div><div class="tile-body"><strong title="${html(track.title)}">${html(track.title)}</strong><p>${html(track.artist)}</p><div class="tag-row">${tag(track.genre)}${tag(event?.mood || track.mood)}</div><div class="tile-actions"><button data-preview="${html(track.id)}" aria-label="Listen to ${html(track.title)}">▶ Listen</button><button data-action="remove-favorite" data-id="${html(track.id)}" class="remove-button" aria-label="Remove ${html(track.title)} from collection">×</button></div></div></article>`;
  }).join('')}</div>` : `<div class="empty-state"><h2>No matches.</h2><p>Try a different search.</p></div>`}
  <p style="font-size:11px;color:var(--dim);margin-top:22px">${plural(items.length,'saved track')} · Recordings provided by their source hosts. Visit the original source for attribution and licensing.</p>` : `<div class="empty-state"><div class="empty-icon">♡</div><h2>Nothing kept. Yet.</h2><p>Start swiping. The moment a track catches your ear, your collection comes to life.</p><button class="accent-button" data-view="discover">Go discover something →</button></div>`}</section>`;
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
  return `<section><div class="eyebrow">AN EXPERIMENT IN SELF-DISCOVERY</div><div class="page-head"><div><h1>Your taste, <em>visualized.</em></h1><p class="lead">A map that grows with your ears, not a personality quiz that ends after five questions.</p></div><button class="secondary-button" data-action="export-json">↧ Export your data</button></div>
  <div class="stat-cards"><div class="stat-card"><strong>${taste.total}</strong><span>Tracks explored</span></div><div class="stat-card"><strong>${taste.liked}</strong><span>Tracks kept</span></div><div class="stat-card"><strong>${taste.accuracy === null ? '—' : `${taste.accuracy}%`}</strong><span>Recognition accuracy</span></div></div>
  <div class="taste-overview"><div class="panel map-panel"><div class="panel-heading map-head"><div><span class="panel-title">The constellation</span><p style="font-size:11px;color:var(--muted);margin:6px 0 0">Each node is a genre you've connected with.</p></div><span class="panel-accent">✳</span></div>${createMapSvg(taste)}</div>
  <div class="right-column"><div class="panel"><div class="panel-heading"><span class="panel-title">Favorite frequencies</span><span class="panel-accent">≋</span></div>${genres.length ? `<div class="taste-bars">${genres.slice(0, 6).map(([genre, score]) => `<div><div class="bar-label"><strong style="text-transform:capitalize">${html(genre)}</strong><span>${score} pts</span></div><div class="meter"><span style="width:${score / genres[0][1] * 100}%"></span></div></div>`).join('')}</div>` : '<p class="empty-micro">Nothing mapped yet. Let the music find you.</p>'}</div>
  <div class="panel"><div class="panel-heading"><span class="panel-title">Your listening moods</span><span class="panel-accent">♡</span></div>${moods.length ? `<div class="tag-row">${moods.slice(0, 7).map(([mood]) => tag(mood)).join('')}</div>` : '<p class="empty-micro">Mood signals appear when you save tracks.</p>'}</div></div></div>
  <div class="panel" style="margin-top:22px"><div class="panel-heading"><span class="panel-title">How it gets smarter</span><span class="panel-accent">↗</span></div><div class="insight-list"><div class="insight"><strong>Preference isn't recognition</strong><p>Liking a new sound counts just as much as liking a familiar one. Trivia accuracy is tracked separately so obscure artists still get a fair shot.</p></div><div class="insight"><strong>A little unpredictability is a feature</strong><p>Suggestions balance your genre preferences with new styles and avoid repeatedly playing the same artist. You can still steer your session using a genre filter.</p></div><div class="insight"><strong>Your data belongs to you</strong><p>Your likes, passes and guesses stay in local browser storage. Export them whenever you want. There is no user account or analytics collection.</p></div></div></div></section>`;
}

function renderChallenges() {
  const saved = state.favorites.map(lookup).filter(Boolean);
  return `<section><div class="eyebrow">GOOD MUSIC IS BETTER SHARED</div><div class="page-head"><div><h1>Pass the <em>aux.</em></h1><p class="lead">Build a blind-listening challenge from tracks you've saved. Your friends hear the same clips, in the same order, without any spoilers.</p></div></div>
  <div class="challenge-hero"><div><div class="eyebrow">THE FIVE-SONG TEST</div><h2>Think you know my taste?</h2><p>Pick up to five favorites. Send a link. Find out who shares your ears and who surprises you.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="accent-button" data-action="share-challenge">↗ Make my challenge</button><button class="secondary-button" data-action="try-challenge">Try a sample →</button></div><p style="font-size:11px;margin:14px 0 0;color:var(--dim)">${saved.length ? `${saved.length} saved tracks available · Your five most recent shareable favorites are used. Personal Jellyfin tracks are excluded.` : 'Save songs first to create a personalized challenge.'}</p></div><div class="challenge-badge">✳</div></div>
  <div class="steps-grid"><div class="step-card"><span>01 / CURATE</span><strong>Find your favorites.</strong><p>Keep the tracks that make you feel something. Your collection holds every choice.</p></div><div class="step-card"><span>02 / SEND</span><strong>Share a single link.</strong><p>No sign-in, server database, or account necessary. The link holds just track IDs.</p></div><div class="step-card"><span>03 / COMPARE</span><strong>Let your friends decide.</strong><p>They hear the same recordings blind and see how many make their own cut.</p></div></div></section>`;
}


  return { renderDiscovery, renderCollection, renderTaste, renderChallenges, renderSidebarPreferences, renderQuizLab };
}
