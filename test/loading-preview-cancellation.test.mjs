import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const main=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');

test('manual second Play cancels same-track loading; automatic resume stays idempotent',()=>{
  const toggle=main.slice(main.indexOf('async function togglePlayback('),
    main.indexOf('function updatePlaybackView()'));
  assert.match(toggle,/if \(!track\) return;/);
  assert.match(toggle,/if \(isLoadingAudio && activeAudioId === track\.id\) \{\s*\/\/[\s\S]*?if \(!automatic\) stopContinuous\(\);\s*return;\s*\}/);
  assert.match(toggle,/const generation = audioGeneration/);
  assert.match(toggle,/if \(activeAudioId !== track\.id \|\| generation !== audioGeneration\) return/);
  assert.doesNotMatch(toggle,/isLoadingAudio && activeAudioId === track\.id\) return;/);
});

test('loading preview exposes a cancel action and accurately announces recovery',()=>{
  const view=main.slice(main.indexOf('function updatePlaybackView()'),
    main.indexOf("audio.addEventListener('timeupdate'"));
  assert.match(view,/loadingThisTrack=isLoadingAudio && activeAudioId===current\.id/);
  assert.match(view,/button\.textContent = loadingThisTrack \? '×'/);
  assert.match(view,/button\.setAttribute\('aria-label', loadingThisTrack \? 'Cancel loading preview'/);
  assert.match(view,/button\.title = loadingThisTrack \? 'Cancel loading preview'/);
  assert.match(view,/Finding the recording… Activate Cancel loading preview to stop/);
  assert.match(view,/button\.textContent=isLoadingAudio && activeAudioId===id \? '× Cancel loading'/);
});

test('canceling a preview never records a Keep/Pass or leaves stale audio in place',()=>{
  const stop=main.slice(main.indexOf('function stopContinuous()'),
    main.indexOf('function maybeResumeContinuous()'));
  const stopAudio=main.slice(main.indexOf('function stopAudio()'),
    main.indexOf('async function resolveAudio('));
  assert.match(stop,/continuousListening = false/);
  assert.match(stop,/stopAudio\(\)/);
  assert.match(stopAudio,/audioGeneration\+\+/);
  assert.match(stopAudio,/previewRequestScope\.cancelAll\(\)/);
  assert.match(stopAudio,/audio\.removeAttribute\('src'\)/);
  assert.doesNotMatch(stop,/recordDecision|recordChoice|history\.push/);
});
