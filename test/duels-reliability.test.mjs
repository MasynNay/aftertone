import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  createTournament,voteDuel,nextDuelMatch,duelProgress,
  saveDuelStore,loadDuelStore,loadDuelSelection,saveDuelSelection,
  DUEL_SELECTION_KEY,DUEL_STORAGE_KEY,podiumCsv,hallOfFameCsv,
} from '../app/src/duels.mjs';
import {
  TOURNAMENT_THEMES,tournamentAvailability,pickThemedEntries,
  tournamentStatusLabel,isMysteryTournament,
} from '../app/src/tournament-themes.mjs';
import {renderDuels} from '../app/public/duels-view.js';

const songs=Array.from({length:40},(_,i)=>({
  id:'deezer:'+(950000+i),source:'deezer',title:'Fixture Song '+(i+1),
  artist:'Fixture Artist '+(i+1),
  genre:i%2===0?'pop':'rock',genreVerified:true,
  releaseYear:i<32?2005:null,artwork:null,
}));
const favorites=songs.slice(0,20).map(song=>song.id);
function storage(){
  const map=new Map();
  return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),
    removeItem:key=>map.delete(key),entries:()=>Object.fromEntries(map)};
}
const select=(themeId,size)=>pickThemedEntries({
  themeId,tracks:songs,favoriteIds:favorites,size,random:()=>.22,
});
function finishAndReload(event,store){
  let count=0,bronze=false,grandFinal=false;
  while(event.status==='active' && count<20) {
    const match=nextDuelMatch(event);
    assert.ok(match,'every active bracket must have a current match');
    if(match.stage==='third')bronze=true;
    if(match.stage==='final') {
      assert.equal(event.entries.length===2||bronze,true,'bronze precedes grand final');
      grandFinal=true;
    }
    event=voteDuel(event,match.id,match.a,1762900000000+count);
    assert.equal(saveDuelStore(store,[event]),true);
    // Simulate a complete browser reload after EVERY individual vote.
    const loaded=loadDuelStore(store);
    assert.equal(loaded.length,1);
    assert.deepEqual(duelProgress(loaded[0]),duelProgress(event));
    assert.deepEqual(nextDuelMatch(loaded[0]),nextDuelMatch(event));
    event=loaded[0];
    count++;
  }
  assert.equal(event.status,'complete');
  assert.equal(grandFinal,true);
  assert.equal(count,event.entries.length);
  assert.equal(bronze,event.entries.length>=4);
  assert.equal(duelProgress(event).remaining,0);
  return event;
}
test('all six arenas complete 4, 8 and 16 brackets with reloads and correct podiums',()=>{
  assert.equal(TOURNAMENT_THEMES.length,6);
  for(const theme of TOURNAMENT_THEMES){
    for(const size of [4,8,16]){
      const available=tournamentAvailability({themeId:theme.id,tracks:songs,favoriteIds:favorites,size});
      assert.equal(available.ready,true,theme.id+' at '+size);
      const entries=select(theme.id,size);
      assert.equal(entries.length,size);
      assert.equal(new Set(entries.map(t=>t.id)).size,size);
      if(theme.id==='favorites') assert.ok(entries.every(t=>favorites.includes(t.id)));
      if(theme.id==='fresh') assert.ok(entries.every(t=>!favorites.includes(t.id)));
      if(theme.id==='pop-rock')
        assert.deepEqual(entries.map(t=>t.genre),Array.from({length:size},(_,i)=>i%2?'rock':'pop'));
      if(theme.id==='throwback-2000s')
        assert.ok(entries.every(t=>t.releaseYear>=2000 && t.releaseYear<=2009));
      const id='duel_'+theme.id.replace(/[^a-zA-Z0-9_-]/g,'')+'_'+size;
      const event=createTournament({id,name:'Fixture Cup',tracks:entries,themeId:theme.id});
      const restored=finishAndReload(event,storage());
      assert.equal(new Set(Object.values(restored.podium)).size,3);
      assert.equal(isMysteryTournament(restored),false);
      assert.match(podiumCsv(restored),/"Rank","Track Name","Artist Name"/);
      const csv=hallOfFameCsv([restored]);
      assert.match(csv,/"Points"/);
      assert.match(csv,/Fixture Song/);
    }
  }
});
test('all arenas show insufficient-library guidance for chosen size without fabricating entrants',()=>{
  for(const theme of TOURNAMENT_THEMES) {
    const tracks=songs.slice(0,3);
    const status=tournamentAvailability({themeId:theme.id,tracks,favoriteIds:favorites,size:8});
    assert.equal(status.ready,false,theme.id);
    assert.ok(status.message.length>20,theme.id+' needs meaningful guidance');
    assert.throws(()=>pickThemedEntries({themeId:theme.id,tracks,favoriteIds:favorites,size:8}),Error);
    const label=tournamentStatusLabel(status,theme.id,8);
    if(theme.id==='pop-rock')assert.match(label,/Pop \d+\/4 · Rock \d+\/4/);
    else assert.match(label,/\/8 eligible/);
    assert.doesNotMatch(label,/Ready for/);
  }
  const unknown=songs.map(t=>({...t,genreVerified:false,releaseYear:null}));
  for(const themeId of ['pop-rock','throwback-2000s'])
    assert.equal(tournamentAvailability({themeId,tracks:unknown,size:4}).ready,false);
});
test('arena tiles initially reflect eight-song availability, and setup provides help',()=>{
  const markup=renderDuels({catalog:songs.slice(0,5),favorites:[],tournaments:[]});
  assert.equal((markup.match(/data-duel-status/g)||[]).length,6);
  assert.match(markup,/5\/8 eligible/);
  assert.doesNotMatch(markup,/Ready for 4/);
  assert.match(markup,/data-duel-action="discover-more"/);
  assert.match(markup,/id="duel-eligibility"/);
});
test('closing, reopening and deleting tournaments yield sensible selection across refreshes',()=>{
  const saved=storage();
  const a=createTournament({id:'duel_sel_0001',tracks:songs.slice(0,4)});
  const b=createTournament({id:'duel_sel_0002',tracks:songs.slice(4,8)});
  assert.equal(saveDuelStore(saved,[a,b]),true);
  assert.equal(loadDuelSelection(saved,loadDuelStore(saved)),b.id,'newest unfinished bracket resumes by default');
  assert.equal(saveDuelSelection(saved,a.id),true);
  assert.equal(loadDuelSelection(saved,loadDuelStore(saved)),a.id);
  assert.equal(saved.getItem(DUEL_SELECTION_KEY),a.id);
  assert.equal(saveDuelSelection(saved,null),true);
  assert.equal(loadDuelSelection(saved,loadDuelStore(saved)),null,'explicit Close stays closed');
  assert.equal(saveDuelSelection(saved,b.id),true);
  assert.equal(saveDuelStore(saved,[a]),true);
  assert.equal(loadDuelSelection(saved,loadDuelStore(saved)),a.id,'deleted selection recovers a remaining bracket');
  assert.match(saved.getItem(DUEL_STORAGE_KEY),/duel_sel_0001/);
});
test('Mystery Matchups hides artists until finished while saved brackets stay playable',()=>{
  const saved=storage();
  const event=createTournament({id:'duel_hidden_x1',themeId:'mystery',tracks:songs.slice(0,4)});
  assert.equal(saveDuelStore(saved,[event]),true);
  const reloaded=loadDuelStore(saved)[0];
  const card=renderDuels({tournaments:[reloaded],selectedId:event.id,catalog:[],favorites:[]});
  assert.match(card,/Mystery contender A/);
  assert.doesNotMatch(card,/Fixture Artist 1/);
  const finished=finishAndReload(reloaded,saved);
  const result=renderDuels({tournaments:[finished],selectedId:event.id,catalog:[],favorites:[]});
  assert.match(result,/Fixture Artist 1/);
  assert.match(result,/Add Podium to Collection/);
});
test('application only updates in-memory bracket after successful persistence',()=>{
  const source=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
  assert.match(source,/loadDuelSelection\(localStorage,duelTournaments\)/);
  assert.match(source,/if\(!writeDuelArchive\(\[\.\.\.duelTournaments,event\]\)\)return/);
  assert.match(source,/if\(!writeDuelArchive\(duelTournaments\.map\(/);
  assert.match(source,/saveDuelSelection\(localStorage,id\)/);
  assert.match(source,/case 'duels': main\.innerHTML = renderDuels/);
  assert.match(source,/tournamentStatusLabel\(availability,arena,size\)/);
});
