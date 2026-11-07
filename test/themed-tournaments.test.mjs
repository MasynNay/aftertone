import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTournament, voteDuel, nextDuelMatch, hallOfFame, hallOfFameCsv, availableHallSeasons, loadDuelStore, saveDuelStore} from '../src/duels.mjs';
import {TOURNAMENT_THEMES, pickThemedEntries, tournamentAvailability, songYear, isMysteryTournament} from '../src/tournament-themes.mjs';
import {renderDuels} from '../public/duels-view.js';

const songs=Array.from({length:32},(_,i)=>({id:`deezer:${i+1}`,source:'deezer',artist:`Artist ${i+1}`,title:`Track ${i+1}`,genre:i%2?'rock':'pop',genreVerified:true,releaseYear:i<12?2005:null,artwork:null}));
const random=()=>.25;
const finish=(event,at)=>{
  while(event.status==='active'){
    const match=nextDuelMatch(event);
    assert.ok(match);
    event=voteDuel(event,match.id,match.a,at);
  }
  return event;
};

test('all six presets have stable unique IDs and plain-language descriptions',()=>{
  assert.equal(TOURNAMENT_THEMES.length,6);
  assert.equal(new Set(TOURNAMENT_THEMES.map(t=>t.id)).size,6);
  assert.ok(TOURNAMENT_THEMES.every(t=>t.description && t.tagline));
});

test('favorites cup only selects actual saved favorites, including from older sessions',()=>{
  const favorites=songs.slice(2,7).map(t=>t.id);
  const result=pickThemedEntries({themeId:'favorites',tracks:songs,favoriteIds:favorites,size:4,random});
  assert.equal(result.length,4);
  assert.ok(result.every(t=>favorites.includes(t.id)));
  const notEnough=tournamentAvailability({themeId:'favorites',tracks:songs,favoriteIds:[songs[0].id],size:4});
  assert.equal(notEnough.ready,false);
  assert.match(notEnough.message,/Keep more songs/);
});

test('Fresh Faces excludes saved tracks and the performers of saved songs',()=>{
  const withSecondSong={...songs[25],id:'deezer:900',artist:songs[0].artist};
  const chosen=pickThemedEntries({themeId:'fresh',tracks:[...songs,withSecondSong],favoriteIds:[songs[0].id],size:8,random});
  assert.equal(chosen.length,8);
  assert.ok(chosen.every(t=>t.artist!==songs[0].artist));
  assert.ok(chosen.every(t=>t.id!==songs[0].id));
});

test('Pop vs Rock brackets alternate correctly tagged performers and reject untagged songs',()=>{
  const chosen=pickThemedEntries({themeId:'pop-rock',tracks:songs,size:16,random});
  assert.deepEqual(chosen.map(t=>t.genre),Array.from({length:16},(_,i)=>i%2?'rock':'pop'));
  assert.equal(tournamentAvailability({themeId:'pop-rock',tracks:songs.map(t=>({...t,genre:'unknown'})),size:4}).ready,false);
  assert.match(tournamentAvailability({themeId:'pop-rock',tracks:songs.slice(0,5),size:8}).message,/Pop .* Rock/);
});

test('2000s Throwback requires supplied real year, never inferred era or title',()=>{
  assert.equal(songYear({releaseYear:'2008'}),2008);
  assert.equal(songYear({releaseYear:'0'}),null);
  assert.equal(songYear({era:'2000s',title:'2005 Hits'}),null);
  const chosen=pickThemedEntries({themeId:'throwback-2000s',tracks:songs,size:8,random});
  assert.ok(chosen.every(t=>t.releaseYear===2005));
  assert.equal(tournamentAvailability({themeId:'throwback-2000s',tracks:songs.map(t=>({...t,releaseYear:null})),size:4}).ready,false);
});

test('Mystery Matchups hide identity and artwork in both active tiles and bracket',()=>{
  const t=createTournament({id:'duel_mystery123',themeId:'mystery',tracks:songs.slice(0,4)});
  assert.ok(isMysteryTournament(t));
  let page=renderDuels({tournaments:[t],selectedId:t.id,catalog:songs,favorites:[]});
  assert.match(page,/Mystery contender A/);
  assert.doesNotMatch(page,/Artist 1 — Track 1/);
  assert.match(page,/duel-mystery-cover/);
  const completed=finish(t,Date.UTC(2026,8,1));
  assert.equal(isMysteryTournament(completed),false);
  page=renderDuels({tournaments:[completed],selectedId:t.id,catalog:songs,favorites:[]});
  assert.match(page,/Track 1/);
});

test('all-time and quarterly hall rankings count podiums, Champions Cup crowns, and points',()=>{
  const spring=finish(createTournament({id:'duel_spring123',tracks:songs.slice(0,4)}),Date.UTC(2026,3,1));
  const autumn=finish(createTournament({id:'duel_autumn123',tracks:songs.slice(4,8)}),Date.UTC(2026,9,2));
  const cup=finish(createTournament({id:'duel_champ123',kind:'champions',tracks:[spring.entries[0],autumn.entries[0]]}),Date.UTC(2026,9,3));
  const board=hallOfFame([spring,autumn,cup]);
  assert.equal(board[0].gold,2);
  assert.equal(board[0].cups,1);
  assert.equal(board[0].points,15); // Two golds + Champions Cup bonus.
  assert.deepEqual(availableHallSeasons([spring,autumn,cup]),['2026 Q4','2026 Q2']);
  const q2=hallOfFame([spring,autumn,cup],'2026 Q2');
  assert.equal(q2.some(r=>r.id===autumn.podium.first),false);
  const csv=hallOfFameCsv([spring,autumn,cup]);
  assert.match(csv,/"Champions Cups"/);
  assert.match(csv,/"Track 1"/);
});

test('existing v1 tournament archives load with no themeId and new themed archives persist',()=>{
  const storage=new Map();
  const adapter={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
  const legacy=createTournament({id:'duel_legacy123',tracks:songs.slice(0,4)});
  delete legacy.themeId;
  const modern=createTournament({id:'duel_modern123',themeId:'fresh',tracks:songs.slice(4,8)});
  assert.equal(saveDuelStore(adapter,[legacy,modern]),true);
  const loaded=loadDuelStore(adapter);
  assert.equal(loaded.length,2);
  assert.equal(loaded[0].themeId,undefined);
  assert.equal(loaded[1].themeId,'fresh');
});

test('theme and Hall of Fame controls are wired to the browser controller',()=>{
  const main=readFileSync(new URL('../public/main.js',import.meta.url),'utf8');
  assert.match(main,/data-duel-theme/);
  assert.match(main,/pickThemedEntries/);
  assert.match(main,/duel-season/);
  assert.match(main,/export-hall/);
  assert.match(main,/save-champions/);
  const page=renderDuels({tournaments:[],catalog:songs,favorites:[]});
  assert.match(page,/data-duel-theme="throwback-2000s"/);
  assert.match(page,/data-duel-action="export-hall"/);
  assert.match(page,/id="duel-theme-choice"/);
});


test('artist search lanes must not masquerade as verified genres',()=>{
  const inferred=songs.map(t=>({...t,genreVerified:false}));
  assert.equal(tournamentAvailability({themeId:'pop-rock',tracks:inferred,size:4}).ready,false);
});
