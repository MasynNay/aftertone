import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');

test('opening a dialog cancels pending preview metadata before rendering its content',()=>{
  const block=source.slice(source.indexOf('function openModal(kind, extra = {})'),
    source.indexOf('function recordDecision(',source.indexOf('function openModal(kind, extra = {})')));
  assert.match(block,/continuousListening = false;/,
    'Opening a dialog must stop the automatic listening session');
  assert.match(block,/consecutivePlaybackFailures = 0;/);
  assert.match(block,/if \(isLoadingAudio\) stopAudio\(\)/,
    'An in-flight preview must be canceled, not merely paused');
  assert.match(block,/else audio\.pause\(\)/,
    'A loaded preview should pause without losing its playback position');
  assert.match(block,/updatePlaybackView\(\);/);
  assert.match(block,/renderModal\(\);/);
  assert.ok(block.indexOf('if (isLoadingAudio) stopAudio()') <
    block.indexOf('renderModal()'),'Cancel before showing the dialog');
});

test('stopping audio invalidates outstanding requests and playback generations',()=>{
  const block=source.slice(source.indexOf('function stopAudio()'),
    source.indexOf('async function resolveAudio(',source.indexOf('function stopAudio()')));
  assert.match(block,/audioGeneration\+\+/);
  assert.match(block,/previewRequestScope\.cancelAll\(\)/);
  assert.match(block,/audio\.pause\(\)/);
  assert.match(block,/audio\.removeAttribute\('src'\)/);
  assert.match(block,/isLoadingAudio = false/);
  assert.match(source,/if \(activeAudioId !== track\.id \|\| generation !== audioGeneration\) return/);
});
