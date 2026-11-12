/**
 * Music Duels presentation. All user/provider strings are escaped.
 * The view is deliberately passive: vote/save/export actions live in main.js;
 * tournament state transitions stay in src/duels.mjs.
 */
import { availableChampions, availableHallSeasons, duelProgress, hallOfFame, nextDuelMatch, podiumTracks } from '../src/duels.mjs';
import { TOURNAMENT_THEMES, isMysteryTournament, tournamentAvailability, tournamentTheme, tournamentStatusLabel } from '../src/tournament-themes.mjs';
import { html, urlSafe } from './view-utils.js';

const medals=['🥇','🥈','🥉'];
const cover=(track)=> `<div class="duel-cover">${track?.artwork ? `<img loading="lazy" src="${urlSafe(track.artwork)}" alt="Album artwork for ${html(track.title)}"/>` : '<span aria-hidden="true">♫</span>'}</div>`;
const dateLabel=time=>{const date=new Date(time);return Number.isFinite(date.getTime())?date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'Date unknown';};

function trackTile(track,side,mystery=false) {
  const title=mystery?`Mystery contender ${side}`:html(track.title);
  const artist=mystery?'Listen first. Choose what you love.':html(track.artist);
  return `<article class="duel-contender ${mystery?'is-mystery':''}">
    <div class="duel-contender-portrait">${mystery?'<div class="duel-cover duel-mystery-cover" aria-hidden="true"><span>?</span></div>':cover(track)}<div><span class="duel-side-label">CONTENDER ${side}</span><h3>${title}</h3><p>${artist}</p></div></div>
    <div class="duel-contender-buttons"><button type="button" class="secondary-button duel-play" data-duel-play="${html(track.id)}" aria-label="Preview contender ${side}">▶ Preview ${side}</button><button type="button" class="accent-button duel-vote" data-duel-vote="${html(track.id)}" aria-label="Advance contender ${side}">Choose ${side} <span aria-hidden="true">↗</span></button></div>
  </article>`;
}
function roundName(t,r) {
  const n=t.rounds[r]?.length||1;
  if(n===1)return 'Grand Final';
  if(n===2)return 'Semifinals';
  if(n===4)return 'Quarterfinals';
  return 'Opening Round';
}
function bracket(t) {
  const mystery=isMysteryTournament(t);
  const entrant=id=>mystery?'Mystery track':html(t.entries.find(x=>x.id===id)?.artist||'Unknown');
  return `<div class="duel-bracket" aria-label="Full tournament bracket">${t.rounds.map((round,r)=>`<section class="duel-bracket-round"><h3>${roundName(t,r)}</h3>${round.map(m=>`<div class="duel-bracket-match ${m.winner?'decided':''}"><div class="${m.winner===m.a?'winner':''}">${entrant(m.a)}<span>${m.winner===m.a?'✓':'A'}</span></div><div class="${m.winner===m.b?'winner':''}">${entrant(m.b)}<span>${m.winner===m.b?'✓':'B'}</span></div></div>`).join('')}</section>`).join('')}
  ${t.thirdPlace?`<section class="duel-bracket-round"><h3>Bronze Match</h3><div class="duel-bracket-match ${t.thirdPlace.winner?'decided':''}">${[t.thirdPlace.a,t.thirdPlace.b].map(id=>`<div class="${t.thirdPlace.winner===id?'winner':''}">${entrant(id)}<span>${t.thirdPlace.winner===id?'✓':'•'}</span></div>`).join('')}</div></section>`:''}</div>`;
}
function podium(t) {
  const tracks=podiumTracks(t);
  return `<section class="duel-podium"><div class="duel-section-title"><span class="eyebrow">THE FINAL STANDINGS</span><h2>${html(t.name)} winners</h2><p>These tracks earned their place. Keep the podium, export it, or bring the champion back for a new battle.</p></div><div class="duel-podium-grid">${tracks.map((track,i)=>`<article class="duel-podium-tile place-${track.place}"><div class="duel-medal">${medals[i]||'★'}</div>${cover(track)}<strong>${html(track.title)}</strong><small>${html(track.artist)}</small><span>${['Champion','Runner-up','Third place'][i]}</span></article>`).join('')}</div>
  <div class="duel-finish-actions"><button class="accent-button" data-duel-action="save-podium" data-duel-id="${html(t.id)}">♡ Add Podium to Collection</button><button class="secondary-button" data-duel-action="export-podium" data-duel-id="${html(t.id)}">↧ Export Podium Playlist CSV</button></div></section>`;
}
function hallPanel(tournaments,season) {
  const seasons=availableHallSeasons(tournaments);
  const chosen=season==='all'||seasons.includes(season)?season:'all';
  const ranking=hallOfFame(tournaments,chosen);
  return `<section class="duel-hall"><div class="duel-hall-heading"><div><span class="eyebrow">03 / HALL OF FAME</span><h2>Legends Are Made Here.</h2><p>Every podium counts. Tournament champions earn five points; a Champions Cup crown earns five extra. Runners-up earn three, third place earns one.</p></div><label>Leaderboard Period<select id="duel-season" aria-label="Choose Hall of Fame season"><option value="all" ${chosen==='all'?'selected':''}>All Time</option>${seasons.map(s=>`<option value="${html(s)}" ${s===chosen?'selected':''}>${html(s)}</option>`).join('')}</select></label></div>
    ${ranking.length?`<div class="duel-hall-leaders">${ranking.slice(0,3).map((t,i)=>`<article class="duel-hall-leader"><span class="duel-hall-position">${['01','02','03'][i]}</span>${cover(t)}<div><strong>${html(t.title)}</strong><span>${html(t.artist)}</span><small>${t.gold} wins · ${t.cups} Champions Cups · ${t.events} podiums</small></div><b>${t.points} pts</b></article>`).join('')}</div>
      <div class="duel-hall-table-wrap"><table class="duel-hall-table"><thead><tr><th>Rank</th><th>Song</th><th>Gold</th><th>Silver</th><th>Bronze</th><th>Points</th></tr></thead><tbody>${ranking.slice(0,25).map((t,i)=>`<tr><td>${i+1}</td><td><strong>${html(t.title)}</strong><small>${html(t.artist)}</small></td><td>${t.gold}</td><td>${t.silver}</td><td>${t.bronze}</td><td>${t.points}</td></tr>`).join('')}</tbody></table></div>`:
      `<div class="duel-hall-empty">Your first finished bracket begins the Hall of Fame. Every champion has a starting point.</div>`}
    <div class="duel-finish-actions"><button class="secondary-button" data-duel-action="export-hall" ${ranking.length?'':'disabled'}>↧ Export Leaderboard CSV</button><button class="secondary-button" data-duel-action="save-champions" ${hallOfFame(tournaments).some(t=>t.gold)?'':'disabled'}>♡ Save Champions to Collection</button></div>
  </section>`;
}
function themePicker(tracks,favorites,size=8) {
  return `<div class="duel-arena-picker" role="group" aria-label="Tournament themes">${TOURNAMENT_THEMES.map(theme=>{
    const available=tournamentAvailability({themeId:theme.id,tracks,favoriteIds:favorites,size});
    return `<button type="button" class="duel-arena-option ${theme.id==='open'?'selected':''}" data-duel-theme="${theme.id}" aria-pressed="${theme.id==='open'}"><span>${html(theme.name)}</span><small>${html(theme.tagline)}</small><em data-duel-status data-ready="${available.ready}">${html(tournamentStatusLabel(available,theme.id,size))}</em></button>`;
  }).join('')}</div>`;
}
export function renderDuels({tournaments=[],selectedId=null,catalog=[],favorites=[],savedTracks=[],volume=35,sound=true,hallSeason='all'}) {
  const selected=tournaments.find(t=>t.id===selectedId)||null;
  const champions=availableChampions(tournaments);
  const playable=[...new Map([...catalog,...savedTracks].filter(t=>t?.source==='deezer' && t?.id && t?.title && t?.artist).map(t=>[t.id,t])).values()];
  const favoriteIds=new Set(favorites);
  const saved=playable.filter(t=>favoriteIds.has(t.id));
  const counts=tournaments.filter(t=>t.status==='complete');
  const countLabel=count=>`${count.toLocaleString()} songs`;
  const selectedTheme=selected?.themeId==='champions'?'Champions Cup':tournamentTheme(selected?.themeId).name;
  return `<section class="duels-page">
    <div class="eyebrow">AFTERTONE / MUSIC DUELS</div>
    <div class="page-head duels-head"><div><h1>Make a Little <em>History.</em></h1><p class="lead">A song can become a champion. Challenge it again, build rivalries, and discover the records that never lose their spark.</p></div></div>
    <div class="duels-summary"><span><strong>${tournaments.length}</strong> tournaments</span><span><strong>${counts.length}</strong> completed</span><span><strong>${champions.length}</strong> distinct champions</span></div>
    <section class="duel-setup"><div class="duel-section-title"><span class="eyebrow">01 / CHOOSE YOUR ARENA</span><h2>What Kind of Battle?</h2><p>Pick a theme, then build a 4-, 8-, or 16-song bracket. Genre and decade cups require verified metadata; we'll never pretend unrelated songs match a theme.</p></div>
      ${themePicker(playable,favorites)}
      <input type="hidden" id="duel-theme-choice" value="open"/>
      <div class="duel-setup-form"><label>Tournament Name<input type="text" id="duel-name" maxlength="65" placeholder="Friday Night Favorites" value=""/></label><label>Contestants<select id="duel-size"><option value="4">4 songs · Quick Cup</option><option value="8" selected>8 songs · Main Event</option><option value="16">16 songs · Marathon</option></select></label><label>Song Pool<select id="duel-pool"><option value="all">Discovery songs (${countLabel(playable.length)})</option><option value="favorites">My favorites (${countLabel(saved.length)})</option></select></label><button class="accent-button" data-duel-action="create">✦ Start Bracket</button></div>
      <div class="duel-availability-row"><p id="duel-eligibility" class="duel-hint" role="status" aria-live="polite">${html(tournamentAvailability({themeId:'open',tracks:playable,favoriteIds:favorites,size:8}).message)}</p><button type="button" class="secondary-button" data-duel-action="discover-more">Find More Songs ↗</button></div>
      <p class="duel-hint">Not enough songs? Visit Discover and Keep favorites, then come back. Genre and decade cups need verified catalog metadata. Matchups use the same short Deezer previews as Discover; votes don't change your taste profile.</p>
    </section>
    <section class="duel-cup-setup"><div><span class="eyebrow">02 / THE CHAMPIONS CUP</span><h2>Champions Face Champions.</h2><p>${champions.length>=2?`${champions.length} different tournament winners are ready. A two-song showdown is possible now; complete more cups to build a larger final.`:`Finish ${2-champions.length} more tournament${2-champions.length===1?'':'s'} with a new winner to unlock your first Champions Cup.`}</p></div><button data-duel-action="create-cup" class="secondary-button" ${champions.length>=2?'':'disabled'}>⚡ ${champions.length>=2?'Launch Champions Cup':'Need 2 Champions'}</button></section>
    ${selected?`<section class="duel-active-event" id="duel-active-event"><div class="duel-event-top"><div><span class="eyebrow">${html(selectedTheme.toUpperCase())} / ${selected.status==='complete'?'COMPLETED':'IN PROGRESS'}</span><h2>${html(selected.name)}</h2><p>${selected.entries.length} contenders · ${duelProgress(selected).done} of ${duelProgress(selected).total} matchups decided</p></div><button class="secondary-button" data-duel-action="dismiss">Close Bracket</button></div>
      ${selected.status==='complete'?podium(selected):(()=>{const match=nextDuelMatch(selected);const a=selected.entries.find(t=>t.id===match?.a);const b=selected.entries.find(t=>t.id===match?.b);const stage=match?.stage==='third'?'Third-place playoff':match?.stage==='final'?'THE GRAND FINAL':roundName(selected,match?.round);return `<div class="duel-match-heading"><span class="eyebrow">CURRENT MATCH / ${html(stage)}</span><h3>${isMysteryTournament(selected)?'Which Mystery Track Wins?':'Who Deserves to Advance?'}</h3><p>${isMysteryTournament(selected)?'Both identities stay hidden until the event ends. Let the music decide.':'Preview both contenders, then choose the stronger track.'}</p></div><div class="duel-match-grid">${trackTile(a,'A',isMysteryTournament(selected))}<span class="duel-versus" aria-hidden="true">VS</span>${trackTile(b,'B',isMysteryTournament(selected))}</div><div class="duel-audio-status" role="status" aria-live="off"><span id="duel-now-playing">▶ Choose a contender to preview</span><span id="duel-preview-time">0:00 / 0:22</span><div class="duel-preview-progress"><i id="duel-preview-fill"></i></div></div><div class="duel-volume"><div class="preview-volume" role="group" aria-label="Tournament preview volume"><label for="duel-volume"><span aria-hidden="true">♫</span> Volume</label><input id="duel-volume" type="range" data-volume-slider min="0" max="100" step="1" value="${Number.isFinite(Number(volume))?Math.max(0,Math.min(100,Math.round(Number(volume)))):35}" aria-label="Adjust tournament preview volume" /><output for="duel-volume" data-volume-value>${sound?`${Math.round(volume)}%`:'Muted'}</output></div></div><div class="duel-match-guidance"><span>▶ Play either 22-second preview</span><span>1 / 2 to choose · Votes don't change your favorites</span></div>`;})()}
      <details class="duel-bracket-details"><summary>View Full Bracket and Results</summary>${bracket(selected)}</details>
    </section>`:`<div class="duel-placeholder"><span aria-hidden="true">✧</span><h2>Your Stage Is Ready.</h2><p>Choose a theme above, or resume an event from tournament history.</p></div>`}
    ${hallPanel(tournaments,hallSeason)}
    <section class="duel-history"><div class="duel-section-title"><span class="eyebrow">04 / YOUR ARCHIVE</span><h2>Tournament History</h2><p>Every bracket is saved locally, even when unfinished. Return for the rematch whenever you want.</p></div>
    ${tournaments.length?`<div class="duel-history-grid">${[...tournaments].reverse().map(t=>`<article class="duel-history-card ${t.id===selectedId?'is-open':''}"><div class="duel-history-top"><span>${t.kind==='champions'?'⚡ CHAMPIONS CUP':html(tournamentTheme(t.themeId).name.toUpperCase())}</span><span>${t.status==='complete'?'FINISHED':'IN PROGRESS'}</span></div><h3>${html(t.name)}</h3>${t.podium?`<p class="duel-history-winner">♕ ${html(t.entries.find(e=>e.id===t.podium.first)?.artist||'')} — ${html(t.entries.find(e=>e.id===t.podium.first)?.title||'')}</p><p class="duel-history-other">${podiumTracks(t).slice(1).map((p,i)=>`${i===0?'🥈':'🥉'} ${html(p.artist)}`).join(' · ')}</p>`:`<p>${duelProgress(t).remaining} matches left · ${t.entries.length} songs</p>`}<small class="duel-history-date">${html(dateLabel(t.finishedAt||t.createdAt))}</small><div class="duel-history-buttons"><button data-duel-action="open" data-duel-id="${html(t.id)}" class="secondary-button">${t.status==='complete'?'View Podium':'Resume Tournament'}</button><button data-duel-action="delete" data-duel-id="${html(t.id)}" class="duel-delete" aria-label="Delete ${html(t.name)}">✕</button></div></article>`).join('')}</div>`:'<div class="duel-no-history">No tournaments played yet. Your first champion is waiting.</div>'}</section>
  </section>`;
}
