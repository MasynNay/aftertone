import test from 'node:test';
import assert from 'node:assert/strict';
import {DemoAudio} from '../assets/audio.js';
import {TRACKS} from '../src/demo-engine.mjs';

function fakeAudioRuntime(resumeHook=()=>Promise.resolve()) {
  const previous=globalThis.window;
  const timers=new Map();
  let timerId=1;
  class FakeNode {
    constructor() { this.frequency={value:0};this.gain={value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}; }
    start(){} stop(){} connect(){} disconnect(){}
  }
  class FakeContext {
    constructor() { this.currentTime=0;this.destination={}; }
    resume(){return resumeHook();}
    createOscillator(){return new FakeNode();}
    createGain(){return new FakeNode();}
  }
  globalThis.window={AudioContext:FakeContext,setTimeout(fn){const id=timerId++;timers.set(id,fn);return id;},setInterval(fn){const id=timerId++;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},clearInterval(id){timers.delete(id);}};
  return {timers,restore(){globalThis.window=previous;}};
}

test('original preview can play and stop without leaving timers or audio nodes',async()=>{
  const env=fakeAudioRuntime();
  try{
    const audio=new DemoAudio();audio.setVolume(.2);
    assert.equal(await audio.play(TRACKS[0]),true);
    assert.equal(audio.active,true);
    assert.equal(audio.bus.gain.value,.06);
    assert.equal(env.timers.size,2);
    audio.stop();assert.equal(audio.active,false);assert.equal(env.timers.size,0);assert.equal(audio.nodes.length,0);
  }finally{env.restore();}
});

test('a preview completion fires onEnd exactly once and supports the next track',async()=>{
  const env=fakeAudioRuntime();
  try{
    let ended=0;const audio=new DemoAudio(()=>ended++);
    await audio.play(TRACKS[0]);
    const completion=[...env.timers.values()][0];completion();
    assert.equal(ended,1);assert.equal(audio.active,false);assert.equal(env.timers.size,0);
    await audio.play(TRACKS[1]);assert.equal(audio.trackId,TRACKS[1].id);audio.stop();
  }finally{env.restore();}
});

test('late async Web Audio resume cannot restart after a Skip or Pause',async()=>{
  let resolveResume;
  const env=fakeAudioRuntime(()=>new Promise(resolve=>{resolveResume=resolve;}));
  try{
    const audio=new DemoAudio();const pending=audio.play(TRACKS[0]);
    audio.stop();resolveResume();
    assert.equal(await pending,false);
    assert.equal(audio.active,false);assert.equal(audio.nodes.length,0);assert.equal(env.timers.size,0);
  }finally{env.restore();}
});
