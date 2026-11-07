import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../app/src/taste.mjs';
import { createViews } from '../app/public/views.js';
import { normalizeDeezerTrack } from '../app/src/deezer.mjs';

const track = normalizeDeezerTrack({ id: 12345, title:'bad guy', title_short:'bad guy', readable:true, duration:194, rank:900000,preview:'https://cdnt-preview.dzcdn.net/api/1/1/12345.mp3', artist:{name:'Billie Eilish'}, album:{cover_big:'https://e-cdns-images.dzcdn.net/a.jpg'} });
function view(blind=false, current=track) {
  return createViews({state:{...createInitialState(), source:'deezer', blind}, catalog:[track], current,
    allGenres:['all','pop'], challengeIds:[], challengeResponses:[], catalogWarning:'', catalogLive:true,
    collectionQuery:'', collectionSort:'recent', feed:{available:5, hasMore:true},
    availableSources:['deezer']}).renderDiscovery();
}
test('Deezer previews use the in-card native Play button, without a widget or new tab', () => {
  const markup=view();
  assert.match(markup,/id="stage-play"/);
  assert.match(markup,/data-action="play-current"/);
  assert.doesNotMatch(markup,/deezer-discovery-iframe|widget\.deezer/);
  assert.match(markup,/data-action="pass"/);
  assert.match(markup,/data-action="like"/);
});
test('blind mode is enabled for a Deezer track and conceals card identity with first-party controls', () => {
  const markup = view(true);
  assert.match(markup, /data-action="toggle-blind"[^>]*aria-pressed="true"/);
  assert.match(markup, /Who could it be\?/);
  assert.match(markup, /BLIND CHALLENGE/);
  assert.doesNotMatch(markup, /Billie Eilish/);
  assert.doesNotMatch(markup, /bad guy/);
  assert.match(markup, /id="stage-play"/);
  assert.match(markup, /id="stage-play"/);
});
test('Deezer blind toggle is available even before activating it', () => {
  const markup=view(false);
  assert.match(markup, /data-action="toggle-blind"[^>]*aria-pressed="false"/);
  assert.doesNotMatch(markup, /data-action="toggle-blind"[^>]*disabled/);
});
test('invalid Deezer IDs never become player URLs', () => {
  const malformed={...track, id:'deezer:11" onload=alert(1)'};
  const markup=view(false,malformed);
  assert.match(markup, /id="stage-play"/);
  assert.doesNotMatch(markup, /widget\.deezer\.com/);
});
