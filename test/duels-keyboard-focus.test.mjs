import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTournament,voteDuel,nextDuelMatch} from '../app/src/duels.mjs';
import {renderDuels} from '../app/public/duels-view.js';
const main=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
const songs=Array.from({length:4},(_,i)=>({
  id:'deezer:'+(970001+i),source:'deezer',title:'Fixture '+i,
  artist:'Artist '+i,genre:'pop'
}));
test('Duels markup has usable matchup controls and a focusable podium destination',()=>{
  let event=createTournament({id:'duel_accessible',name:'Accessible Cup',tracks:songs});
  assert.match(renderDuels({tournaments:[event],selectedId:event.id,catalog:songs}),
    /id="duel-active-event"[\s\S]*data-duel-play/);
  for(let i=0;i<4;i++) {
    const match=nextDuelMatch(event);
    event=voteDuel(event,match.id,match.a);
  }
  assert.equal(event.status,'complete');
  const markup=renderDuels({tournaments:[event],selectedId:event.id,catalog:songs});
  assert.match(markup,/id="duel-podium-heading" tabindex="-1"/);
  assert.match(markup,/data-duel-action="dismiss"/);
  assert.match(markup,/data-duel-action="open"/);
});
test('controller restores keyboard focus only after successful bracket transitions',()=>{
  const vote=main.slice(main.indexOf('function voteActiveDuel('),
    main.indexOf('function exportLibrary('));
  assert.match(vote,/if\(!writeDuelArchive[\s\S]*?return/);
  assert.match(vote,/stopAudio\(\);render\(\);focusDuelStage\(\)/);
  const actions=main.slice(main.indexOf('function handleDuelAction('),
    main.indexOf('function voteActiveDuel('));
  assert.match(actions,/action==='open'[\s\S]*?focusDuelStage\(\)/);
  assert.match(actions,/action==='dismiss'[\s\S]*?focusDuelArchive\(previousId\)/);
  assert.match(actions,/action==='delete'[\s\S]*?focusDuelArchive\(id\)/);
  assert.match(main,/focusedDuelSeason=view==='duels'/);
  assert.match(main,/querySelector\('#duel-season'\)\?\.focus/);
  assert.match(main,/function focusDuelStage\(\)/);
  assert.match(main,/function focusDuelArchive\(id\)/);
});
