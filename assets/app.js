import {TRACKS,byId,chooseNext,whyTrack,createBracket,matchFor,vote,hallOfFame} from '../src/demo-engine.mjs';
import {DemoAudio} from './audio.js';

// The public showcase intentionally has no fetch() calls or third-party SDKs.
const KEY='aftertone:portfolio-demo:v1';
const defaultState=()=>({favorites:[],history:[],cups:[],cup:null,mode:'territory',seen:[],currentId:null,volume:35,blind:false,autoplay:true});
function read(){try{const v=JSON.parse(localStorage.getItem(KEY)||'null');if(!v||typeof v!=='object')return defaultState();return {...defaultState(),...v,favorites:Array.isArray(v.favorites)?v.favorites.filter(byId):[],history:Array.isArray(v.history)?v.history.slice(-250):[],seen:Array.isArray(v.seen)?v.seen.filter(byId).slice(-120):[],cups:Array.isArray(v.cups)?v.cups.slice(-20):[],autoplay:v.autoplay!==false};}catch{return defaultState();}}
let state=read();let view='discover';let previous=null;let toastTimeout=0;let continuous=false;let duelPreviewId=null;
const $=id=>document.getElementById(id);
const audio=new DemoAudio(()=>{
  if(view==='discover'&&continuous&&state.autoplay){nextSong(true);} else {continuous=false;duelPreviewId=null;refreshPlayButton();}
});
audio.setVolume(state.volume/100);
audio.onTick=seconds=>{if(view==='discover'){$('progressInner').style.width=`${seconds/8*100}%`;$('nowTime').textContent=`0:${String(Math.floor(seconds)).padStart(2,'0')}`;}};

function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{announce('Your browser could not save demo progress.');}}
function announce(message){const box=$('toast');box.textContent=message;box.classList.add('shown');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>box.classList.remove('shown'),2800);}
function artStyle(track,el){if(!track||!el)return;el.style.setProperty('--art1',track.color[0]);el.style.setProperty('--art2',track.color[1]);}
function current(){return byId(state.currentId)||chooseNext(state.mode,state.favorites,state.seen,'')||TRACKS[0];}
function refreshPlayButton(){const btn=$('playButton');const playing=audio.active&&audio.trackId===state.currentId;btn.innerHTML=playing?'Ⅱ <span>Pause</span>':'▶ <span>Play preview</span>';btn.setAttribute('aria-label',playing?'Pause original audio preview':'Play original audio preview');}
function renderDiscover(){
  const t=current();state.currentId=t.id;
  $('trackTitle').textContent=t.title;$('trackArtist').textContent=t.artist;$('trackGenre').textContent=`${t.genre.toUpperCase()} · ${t.mood.toUpperCase()}`;
  $('songWhy').textContent=whyTrack(state.mode,t,state.favorites);
  artStyle(t,$('trackArt'));
  const labels={comfort:'COMFORT ZONE',territory:'NEW TERRITORY',wild:'WILD CARD'};$('modeLabel').textContent=labels[state.mode];
  document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===state.mode);b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode));});
  $('swipeCard').classList.toggle('blind-active',state.blind);$('blindButton').setAttribute('aria-pressed',String(state.blind));
  $('blindButton').title=state.blind?'Reveal artist and title':'Hide artist and title';
  $('volumeSlider').value=state.volume;$('volumeLabel').value=`${state.volume}%`;$('volumeLabel').textContent=`${state.volume}%`;
  const wave=$('waveLine');if(!wave.childElementCount){for(let i=0;i<42;i++){const s=document.createElement('span');s.style.setProperty('--h',`${4+((i*17+i*i*3)%19)}px`);wave.appendChild(s);}}
  $('exploredCount').textContent=state.history.length;$('savedCount').textContent=state.favorites.length;
  $('undoButton').disabled=!previous;$('autoplayButton').setAttribute('aria-pressed',String(state.autoplay));$('autoplayButton').textContent=state.autoplay?'⟳ Autoplay: On':'⟳ Autoplay: Off';refreshPlayButton();
}
async function startAudio(track){try{await audio.play(track);refreshPlayButton();}catch(e){continuous=false;announce('Audio is unavailable in this browser.');refreshPlayButton();console.warn(e);}}
function nextSong(auto=false){
  audio.stop();$('progressInner').style.width='0%';$('nowTime').textContent='0:00';
  const next=chooseNext(state.mode,state.favorites,state.seen,state.currentId);
  if(next){state.currentId=next.id;state.seen.push(next.id);if(state.seen.length>90)state.seen=state.seen.slice(-90);}
  save();renderDiscover();
  if(auto&&continuous&&state.autoplay&&next)void startAudio(next);
}
function showReaction(kind){const el=$('reaction');el.textContent=kind==='keep'?'♡':'NOPE';el.style.color=kind==='keep'?'#d6fb77':'#ffc5ba';el.classList.remove('show');void el.offsetWidth;el.classList.add('show');}
function decision(kind){
  if(view!=='discover')return;
  const track=current();const shouldAuto=continuous&&state.autoplay;
  previous=structuredClone(state);
  state.history.push({id:track.id,action:kind,at:Date.now()});
  if(state.history.length>250)state.history=state.history.slice(-250);
  if(kind==='keep'&&!state.favorites.includes(track.id))state.favorites.push(track.id);
  if(kind==='pass')state.favorites=state.favorites.filter(id=>id!==track.id);
  showReaction(kind);nextSong(shouldAuto);
  announce(kind==='keep'?`Saved: ${track.title}`:`Passed: ${track.title}`);
}
function undo(){if(!previous){announce('Nothing to undo yet.');return;}audio.stop();continuous=false;state=previous;previous=null;save();renderDiscover();renderCollection();announce('Last choice undone.');}
function changeMode(mode){if(!['comfort','territory','wild'].includes(mode))return;const keepPlaying=continuous&&state.autoplay;const previousId=state.currentId;audio.stop();state.mode=mode;const first=chooseNext(mode,state.favorites,state.seen,previousId);state.currentId=first?.id||null;if(first){state.seen.push(first.id);state.seen=state.seen.slice(-90);}save();renderDiscover();announce(`${{comfort:'Comfort Zone',territory:'New Territory',wild:'Wild Card'}[mode]} · a new route`);if(keepPlaying&&first)void startAudio(first);}
function switchView(next){if(!['discover','duels','collection'].includes(next))return;audio.stop();continuous=false;duelPreviewId=null;view=next;document.querySelectorAll('.demo-tabs [data-view]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.view===view)));for(const name of ['discover','duels','collection']){$(`${name}View`).hidden=name!==view;}renderDiscover();if(view==='duels')renderDuels();if(view==='collection')renderCollection();}
function renderCollection(){const list=$('collectionList');list.replaceChildren();const liked=state.favorites.map(byId).filter(Boolean);
  if(!liked.length){const p=document.createElement('p');p.className='collection-empty';p.textContent='No favorites yet. Listen to a track and hit Keep to begin your collection.';list.appendChild(p);return;}
  for(const t of liked){const item=document.createElement('div');item.className='collection-row';const art=document.createElement('div');art.className='collection-icon';art.textContent='♫';artStyle(t,art);const meta=document.createElement('div');const title=document.createElement('strong');title.textContent=t.title;const artist=document.createElement('p');artist.textContent=`${t.artist} · ${t.genre}`;meta.append(title,artist);item.append(art,meta);list.appendChild(item);}
}
const node=(tag,className,txt='')=>{const el=document.createElement(tag);if(className)el.className=className;el.textContent=txt;return el;};
function renderPodium(cup,root){const podium=node('div','podium');cup.podium.forEach((id,i)=>{const t=byId(id);const item=node('div');item.append(node('b','',["🥇","🥈","🥉"][i]),node('span','',t?.title||''),node('small','',t?.artist||''));podium.appendChild(item);});root.appendChild(podium);}
function renderDuels(){const stage=$('duelArena');const archive=$('duelArchive');stage.replaceChildren();archive.replaceChildren();
  const champions=[...new Set(state.cups.filter(c=>c.podium).map(c=>c.podium[0]))];$('startChampions').hidden=champions.length<4;
  const cup=state.cup;
  $('duelProgress').textContent=cup?(cup.podium?'Tournament complete':`${matchFor(cup)?.label||''} · Match ${Math.min(cup.round+1,4)} of 4`):'Choose a tournament to begin.';
  $('duelProgress').className='duel-progress';
  if(!cup){stage.className='duel-arena';const empty=node('div','collection-empty','Four songs. Two semifinals. One bronze match. One champion. Start a tournament to play.');empty.style.gridColumn='1/-1';stage.appendChild(empty);}
  else if(cup.podium){stage.className='duel-arena';const done=node('div');done.style.gridColumn='1/-1';done.append(node('h4','',cup.kind==='champions'?'Champions Cup podium':'Your tournament podium'));renderPodium(cup,done);stage.appendChild(done);}
  else{
    const match=matchFor(cup);stage.className='duel-arena';
    for(const id of [match.left,match.right]){
      const t=byId(id);const card=node('article','duel-card');const art=node('div','duel-art','♫');artStyle(t,art);const heading=node('h4','',t.title);const by=node('p','',t.artist);
      const controls=node('div','duel-actions');const listen=node('button','','▶ Preview');listen.type='button';listen.setAttribute('aria-label',`Preview ${t.title}`);listen.addEventListener('click',()=>{duelPreviewId=id;void startAudio(t);announce(`Previewing ${t.title} · original audio`);});
      const advance=node('button','vote-go','Advance →');advance.type='button';advance.setAttribute('aria-label',`Advance ${t.title}`);advance.addEventListener('click',()=>{audio.stop();duelPreviewId=null;state.cup=vote(state.cup,id);if(state.cup.podium){state.cups.push(state.cup);state.cups=state.cups.slice(-20);announce(`${t.title} crowned champion!`);}save();renderDuels();});
      controls.append(listen,advance);card.append(art,heading,by,controls);stage.appendChild(card);
    }
  }
  const rankings=hallOfFame(state.cups);
  if(rankings.length){archive.appendChild(node('h4','','HALL OF FAME · DEMO'));rankings.slice(0,4).forEach((s,i)=>{const t=byId(s.id);const row=node('div','cup-history-item',`${i+1}. ${t?.title} — ${s.gold} gold · ${s.points} points`);archive.appendChild(row);});}
}
function makeCup(kind='open'){
  audio.stop();continuous=false;
  let ids;if(kind==='champions'){ids=[...new Set(state.cups.filter(c=>c.podium).map(c=>c.podium[0]))].slice(-4);}
  else{const start=(state.cups.filter(c=>c.kind!=='champions').length*3)%TRACKS.length;ids=Array.from({length:4},(_,i)=>TRACKS[(start+i)%TRACKS.length].id);}
  if(ids.length!==4){announce('Finish more tournaments to unlock the Champions Cup.');return;}
  state.cup=createBracket(ids,kind);save();renderDuels();announce(kind==='champions'?'The Champions Cup begins!':'New tournament ready!');
}
// Stable event listeners: rerenders only update content, not DOM ownership.
$('playButton').addEventListener('click',()=>{if(audio.active&&audio.trackId===state.currentId){audio.stop();continuous=false;refreshPlayButton();}else{continuous=true;void startAudio(current());}});
$('autoplayButton').addEventListener('click',()=>{state.autoplay=!state.autoplay;save();renderDiscover();announce(state.autoplay?'Autoplay is on · the next preview will start automatically':'Autoplay is off · previews stop after one song');});
$('skipButton').addEventListener('click',()=>{nextSong(continuous&&state.autoplay);announce('Skipped without voting.');});
$('keepButton').addEventListener('click',()=>decision('keep'));
$('passButton').addEventListener('click',()=>decision('pass'));
$('undoButton').addEventListener('click',undo);
$('blindButton').addEventListener('click',()=>{state.blind=!state.blind;save();renderDiscover();});
$('volumeSlider').addEventListener('input',event=>{state.volume=Number(event.target.value);audio.setVolume(state.volume/100);$('volumeLabel').textContent=`${state.volume}%`;save();});
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>changeMode(b.dataset.mode)));
document.querySelectorAll('.demo-tabs [data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
$('startCup').addEventListener('click',()=>makeCup());$('startChampions').addEventListener('click',()=>makeCup('champions'));
function exportCollection(format){
  const entries=state.favorites.map(byId).filter(Boolean).map(t=>({title:t.title,artist:t.artist,genre:t.genre,mood:t.mood,id:t.id}));
  let content,mime;
  if(format==='csv'){
    const header=['Title','Artist','Genre','Mood','ID'];
    const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
    content=[header.map(quote).join(','),...entries.map(e=>[e.title,e.artist,e.genre,e.mood,e.id].map(quote).join(','))].join('\r\n');
    mime='text/csv;charset=utf-8';
  }else{content=JSON.stringify({product:'AFTERTONE portfolio',version:1,exportedAt:new Date().toISOString(),tracks:entries},null,2);mime='application/json';}
  const url=URL.createObjectURL(new Blob([content],{type:mime}));const link=document.createElement('a');link.href=url;link.download=`aftertone-collection.${format}`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);announce(`${entries.length} favorites exported as ${format.toUpperCase()}.`);
}
$('exportJson').addEventListener('click',()=>exportCollection('json'));
$('exportCsv').addEventListener('click',()=>exportCollection('csv'));
$('resetDemo').addEventListener('click',()=>{if(!window.confirm('Reset only your AFTERTONE portfolio demo choices?'))return;audio.stop();continuous=false;state=defaultState();previous=null;save();switchView('discover');announce('Demo progress reset.');});
window.addEventListener('keydown',e=>{
  if(view!=='discover'||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.altKey||e.metaKey||e.ctrlKey)return;
  if(e.key==='ArrowLeft'){e.preventDefault();decision('pass');}if(e.key==='ArrowRight'){e.preventDefault();decision('keep');}
  if(e.key.toLowerCase()==='b'){e.preventDefault();$('blindButton').click();}
  if(e.key.toLowerCase()==='s'){e.preventDefault();$('skipButton').click();}
  if(e.code==='Space'){e.preventDefault();$('playButton').click();}
});
let pointerX=null;
$('swipeCard').addEventListener('pointerdown',e=>{if(e.target.closest('button,input,label'))return;pointerX=e.clientX;});
$('swipeCard').addEventListener('pointerup',e=>{if(pointerX===null)return;const dx=e.clientX-pointerX;pointerX=null;if(Math.abs(dx)>90)decision(dx>0?'keep':'pass');});
window.addEventListener('pagehide',()=>audio.stop());
if(!byId(state.currentId))state.currentId=chooseNext(state.mode,state.favorites,state.seen,'')?.id||TRACKS[0].id;
renderDiscover();renderDuels();save();
