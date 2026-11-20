import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../app/public/main.js',import.meta.url),'utf8');
const handler=source.slice(source.indexOf("audio.addEventListener('error', async () => {"),
  source.indexOf("\nfunction chooseNext()",source.indexOf("audio.addEventListener('error', async () => {")));

test('media-error recovery has a session-specific generation guard',()=>{
  assert.match(handler,/const generation = audioGeneration/);
  assert.match(handler,/const isCurrent = \(\) => activeAudioId === activeId && generation === audioGeneration/);
  assert.match(handler,/const source = await resolveAudio\(track\);\s*if \(!isCurrent\(\)\) return true;/);
  assert.match(handler,/audio\.src = nextUrl;\s*await audio\.play\(\);\s*if \(!isCurrent\(\)\) return true;/);
  assert.match(handler,/catch \(error\) \{\s*if \(!isCurrent\(\)\) return true;/);
  assert.match(handler,/if \(isCurrent\(\) && !isLoadingAudio\) \{/);
});

test('Deezer refresh and Audius fallback both become manually cancelable',()=>{
  assert.match(handler,/async function recoverWithUrl\(selectUrl, warning\) \{\s*isLoadingAudio = true;\s*updatePlaybackView\(\);/);
  assert.match(handler,/finally \{\s*if \(isCurrent\(\)\) \{\s*isLoadingAudio = false;\s*updatePlaybackView\(\);/);
  assert.match(handler,/recoverWithUrl\(source => source\.url, 'Deezer preview URL refresh failed:'\)/);
  assert.match(handler,/recoverWithUrl\(source => source\.fallbackUrl, 'Audius local stream fallback failed:'\)/);
  const toggle=source.slice(source.indexOf('async function togglePlayback('),
    source.indexOf('function updatePlaybackView()'));
  assert.match(toggle,/if \(isLoadingAudio && activeAudioId === track\.id\) \{[\s\S]*?if \(!automatic\) stopContinuous\(\);/);
  const stop=source.slice(source.indexOf('function stopAudio()'),source.indexOf('async function resolveAudio('));
  assert.match(stop,/audioGeneration\+\+/);
  assert.match(stop,/previewRequestScope\.cancelAll\(\)/);
});

test('failed refresh only applies to active playback and never records an unrequested vote',()=>{
  assert.match(handler,/if \(isCurrent\(\) && !isLoadingAudio\) \{/);
  assert.doesNotMatch(handler,/recordChoice|recordDecision|state\.history\s*=/);
  assert.match(handler,/if \(continuousListening && current\?\.id === activeId\)/);
});
