/**
 * Short original browser-synthesized motifs for the PUBLIC DEMO only.
 * No Deezer, Spotify, YouTube, third-party recordings, downloaded audio,
 * external hosts or licensed music are used by this file.
 */
export class DemoAudio {
  constructor(onEnd=()=>{}){this.ctx=null;this.volume=.35;this.active=false;this.nodes=[];this.schedules=[];this.startAt=0;this.duration=8;this.trackId=null;this.onEnd=onEnd;this.endedTimer=0;this.tickTimer=0;this.onTick=()=>{};this.generation=0;}
  async play(track){
    this.stop();
    const playGeneration=this.generation;
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextClass)throw new Error('Your browser does not support Web Audio.');
    this.ctx??=new AudioContextClass();
    await this.ctx.resume();
    // A late resume must never restart audio after a skip, pause or view change.
    if(playGeneration!==this.generation)return false;
    this.active=true;this.trackId=track.id;this.startAt=this.ctx.currentTime;
    const gain=this.ctx.createGain();gain.gain.value=this.volume*.3;gain.connect(this.ctx.destination);this.bus=gain;
    const waveform=track.tags.includes('acoustic')||track.tags.includes('folk')?'triangle':track.tags.includes('intense')?'sawtooth':'sine';
    for(let i=0;i<16;i++){
      const note=track.notes[i%track.notes.length];
      const start=this.ctx.currentTime+i*.48;
      const o=this.ctx.createOscillator();const g=this.ctx.createGain();
      o.type=waveform;o.frequency.value=track.root*Math.pow(2,note/12);
      g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(.22,start+.018);g.gain.exponentialRampToValueAtTime(.002,start+.37);
      o.connect(g);g.connect(gain);o.start(start);o.stop(start+.41);this.nodes.push(o,g);
      // Original lightweight bass pulse, not a recognizable composition.
      if(i%2===0){const b=this.ctx.createOscillator(),bg=this.ctx.createGain();b.type='triangle';b.frequency.value=track.root/2;bg.gain.setValueAtTime(.07,start);bg.gain.exponentialRampToValueAtTime(.001,start+.32);b.connect(bg);bg.connect(gain);b.start(start);b.stop(start+.34);this.nodes.push(b,bg);}
    }
    this.endedTimer=window.setTimeout(()=>{if(this.active){this.stop();this.onEnd();}},this.duration*1000);
    this.tickTimer=window.setInterval(()=>{if(this.active)this.onTick(Math.min(this.duration,this.ctx.currentTime-this.startAt));},80);
    this.onTick(0);
    return true;
  }
  stop(){
    this.generation++;
    this.active=false;window.clearTimeout(this.endedTimer);window.clearInterval(this.tickTimer);
    for(const node of this.nodes){try{if(node.stop)node.stop();}catch{}try{node.disconnect();}catch{}}
    this.nodes=[];
    if(this.bus){try{this.bus.disconnect();}catch{}this.bus=null;}
    this.trackId=null;this.onTick(0);
  }
  setVolume(n){this.volume=Math.max(0,Math.min(1,Number(n)||0));if(this.bus)this.bus.gain.value=this.volume*.3;}
}
