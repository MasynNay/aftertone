/** Regression for persistent, privacy-safe Music Duels preview recovery. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTournament} from '../app/src/duels.mjs';
import {renderDuels} from '../app/public/duels-view.js';

const source=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
const tracks=Array.from({length:4},(_,i)=>({
  id:`deezer:${9100000+i}`,source:'deezer',
  title:`Private Fixture Song ${i+1}`,
  artist:`Private Fixture Artist ${i+1}`,artwork:null,
}));

test('a current Duel bracket provides a polite live error status and keeps retry controls',()=>{
  const event=createTournament({
    id:'duel_preview_regression',name:'Fixture cup',
    themeId:'mystery',tracks,
  });
  const markup=renderDuels({tournaments:[event],selectedId:event.id,catalog:tracks});
  assert.match(markup,/<p id="duel-preview-feedback"[^>]*role="status" aria-live="polite"><\/p>/);
  assert.match(markup,/data-duel-play="deezer:9100000"/);
  assert.match(markup,/aria-label="Preview contender A"/);
  assert.doesNotMatch(markup,/Private Fixture Song/);
  assert.doesNotMatch(markup,/Private Fixture Artist/);
});

test('player reports both quota and browser permission denial without leaking Mystery Matchups names',()=>{
  const update=source.slice(source.indexOf('function updatePlaybackView()'),
    source.indexOf("audio.addEventListener('timeupdate'"));
  assert.match(update,/const contenderId=\[activeAudioId,failedAudioId,permissionBlockedTrackId\]/);
  assert.match(update,/isMysteryTournament\(selected\)/);
  assert.match(update,/Preview unavailable/);
  assert.match(update,/Deezer requests limited/);
  assert.match(update,/Browser blocked preview/);
  assert.match(update,/No vote was recorded/);
  assert.match(update,/Retry contender/);
  assert.doesNotMatch(update,/recordChoice|voteDuel\(/,
    'Playback status changes must never create tournament votes');
  const toggle=source.slice(source.indexOf('async function togglePlayback('),
    source.indexOf('function updatePlaybackView()'));
  assert.match(toggle,/\|\| view === 'duels'/,
    'Browser playback denial must remain visible inside Duels');
});
