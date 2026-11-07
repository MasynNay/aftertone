/**
 * AFTERTONE Portfolio demo's recommendation and tournament rules.
 * Pure functions are deliberately separate from DOM and Web Audio, making
 * demo behavior deterministic and easy to test without a browser.
 * The 12 recordings are fictional and the browser synthesizes its own audio.
 */
export const DEMO_VERSION = '1.0.1';

export const TRACKS = Object.freeze([
  {id:'orbit',title:'After the Signal',artist:'Static Patterns',genre:'Electronic',mood:'bright',era:'Modern',tags:['electronic','dreamy','uplifting'],color:['#173b58','#71d6ee'],notes:[0,3,7,10,7,3,5,7],root:220},
  {id:'amber',title:'Amber Hours',artist:'June Meridian',genre:'Indie Pop',mood:'warm',era:'Modern',tags:['indie','warm','melodic'],color:['#b75b54','#fec984'],notes:[0,4,7,9,7,4,2,4],root:196},
  {id:'mirrors',title:'Mirrors in Motion',artist:'Lowlight Assembly',genre:'Synth Pop',mood:'electric',era:'Modern',tags:['electronic','indie','energetic'],color:['#6255aa','#df8df0'],notes:[0,7,10,7,5,3,0,3],root:174.61},
  {id:'south',title:'Southbound Stars',artist:'The Velvets',genre:'Indie Rock',mood:'bold',era:'Modern',tags:['rock','warm','energetic'],color:['#775137','#f6bb72'],notes:[0,5,7,10,7,5,3,2],root:164.81},
  {id:'tide',title:'Open Water',artist:'Sundown Fiction',genre:'Ambient',mood:'calm',era:'Modern',tags:['ambient','dreamy','calm'],color:['#115d70','#6ad3ba'],notes:[0,2,5,9,7,5,2,0],root:146.83},
  {id:'blue',title:'Paper Satellites',artist:'Hollow Cinema',genre:'Alternative',mood:'reflective',era:'Modern',tags:['indie','reflective','melodic'],color:['#36507b','#c7d8ff'],notes:[0,3,5,7,5,3,-2,0],root:185},
  {id:'night',title:'Neon Cartography',artist:'Color Circuit',genre:'House',mood:'energetic',era:'Modern',tags:['electronic','dance','energetic'],color:['#a63c81','#ff9fbb'],notes:[0,7,5,10,7,12,10,7],root:246.94},
  {id:'calico',title:'Calico Morning',artist:'Rosa & The Pines',genre:'Folk',mood:'warm',era:'Modern',tags:['folk','warm','acoustic'],color:['#60784e','#f2d58e'],notes:[0,4,7,4,2,0,-3,0],root:164.81},
  {id:'aster',title:'Aster Field',artist:'Velour Maps',genre:'Jazz',mood:'playful',era:'Modern',tags:['jazz','playful','instrumental'],color:['#8e593c','#ffd39b'],notes:[0,3,7,9,10,7,3,5],root:233.08},
  {id:'pulse',title:'Parallel Heartbeats',artist:'Kinetic Bloom',genre:'Drum & Bass',mood:'intense',era:'Modern',tags:['electronic','dance','intense'],color:['#8b3e55','#ff917e'],notes:[0,12,7,3,10,7,5,12],root:261.63},
  {id:'wildflower',title:'Wildflower Radio',artist:'Meadowframe',genre:'Country',mood:'hopeful',era:'Modern',tags:['country','folk','melodic'],color:['#677238','#f4cf66'],notes:[0,2,4,7,9,7,4,2],root:196},
  {id:'gold',title:'Gold Current',artist:'Night Orchard',genre:'Soul',mood:'smooth',era:'Modern',tags:['soul','warm','groovy'],color:['#694a74','#efb5ab'],notes:[0,4,7,11,9,7,4,2],root:207.65}
]);
export const byId = id => TRACKS.find(t=>t.id===id);

/** Mode separation is intentional: it changes candidate eligibility, not just labels. */
export function candidatesFor(mode, tracks=TRACKS, savedIds=[], excludedIds=[]){
  const excluded=new Set(excludedIds);
  const available=tracks.filter(t=>!excluded.has(t.id));
  const saved=tracks.filter(t=>savedIds.includes(t.id));
  const likedTags=new Set(saved.flatMap(t=>t.tags));
  const likedArtists=new Set(saved.map(t=>t.artist));
  const likedGenres=new Set(saved.map(t=>t.genre));
  if (mode==='comfort') {
    if(!saved.length) return available.filter(t=>t.tags.includes('indie')||t.tags.includes('melodic')||t.tags.includes('electronic'));
    return available.filter(t=>likedArtists.has(t.artist)||t.tags.filter(tag=>likedTags.has(tag)).length>=2);
  }
  if (mode==='wild') {
    if(!saved.length) return available.filter(t=>['Jazz','Folk','Country','Soul','Drum & Bass'].includes(t.genre));
    return available.filter(t=>!likedArtists.has(t.artist)&&!likedGenres.has(t.genre)&&t.tags.filter(tag=>likedTags.has(tag)).length<=1);
  }
  // New Territory: related enough to make sense, new enough to surprise.
  if(!saved.length) return available.filter(t=>['Indie Pop','Synth Pop','Ambient','Alternative','House'].includes(t.genre));
  return available.filter(t=>!likedArtists.has(t.artist)&&t.tags.some(tag=>likedTags.has(tag)));
}
export function chooseNext(mode, savedIds=[], seenIds=[], previousId='', tracks=TRACKS){
  let pool=candidatesFor(mode,tracks,savedIds,seenIds);
  if(!pool.length) pool=candidatesFor(mode,tracks,savedIds,previousId?[previousId]:[]);
  if(!pool.length) pool=tracks.filter(t=>t.id!==previousId);
  if(!pool.length) return null;
  const previous=tracks.find(t=>t.id===previousId);
  const freshArtist=pool.filter(t=>t.artist!==previous?.artist);
  return (freshArtist.length?freshArtist:pool)[0];
}
export function whyTrack(mode,track,savedIds=[]){
  if(mode==='wild')return 'A deliberate detour from your usual sound';
  if(mode==='comfort')return savedIds.length?'Shares the sonic DNA of songs you saved':'An easy starting point, with room to branch out';
  return savedIds.length?'A new voice connected to your evolving taste':'A fresh artist beyond the obvious first picks';
}
export function createBracket(trackIds,kind='open'){
  const unique=[...new Set(trackIds)].filter(byId);
  if(unique.length!==4)throw new Error('Four unique tracks are required.');
  return {id:`cup-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,kind,createdAt:new Date().toISOString(),round:0,tracks:unique,semifinalWinners:[],semifinalLosers:[],bronze:null,final:null,podium:null};
}
/** Four-track bracket: two semifinals, bronze match, grand final. */
export function matchFor(cup){
  if(cup.podium)return null;
  if(cup.round===0)return {label:'Semifinal 1',left:cup.tracks[0],right:cup.tracks[1]};
  if(cup.round===1)return {label:'Semifinal 2',left:cup.tracks[2],right:cup.tracks[3]};
  if(cup.round===2)return {label:'Bronze Match',left:cup.semifinalLosers[0],right:cup.semifinalLosers[1]};
  if(cup.round===3)return {label:'Grand Final',left:cup.semifinalWinners[0],right:cup.semifinalWinners[1]};
  throw new Error('Invalid round');
}
export function vote(cup,winnerId){
  const match=matchFor(cup);
  if(!match||![match.left,match.right].includes(winnerId))throw new Error('Choose a contender in the active match.');
  const loser=match.left===winnerId?match.right:match.left;
  const next={...cup,semifinalWinners:[...cup.semifinalWinners],semifinalLosers:[...cup.semifinalLosers]};
  if(next.round<=1){next.semifinalWinners.push(winnerId);next.semifinalLosers.push(loser);}
  if(next.round===2)next.bronze=winnerId;
  if(next.round===3){next.final=winnerId;next.podium=[winnerId,loser,next.bronze];next.completedAt=new Date().toISOString();}
  next.round++;
  return next;
}
export function hallOfFame(cups){
  const scores=new Map();
  for(const cup of cups.filter(c=>Array.isArray(c.podium)))cup.podium.forEach((id,i)=>{
    const s=scores.get(id)||{id,gold:0,silver:0,bronze:0,points:0};
    if(i===0)s.gold++;if(i===1)s.silver++;if(i===2)s.bronze++;
    s.points+=[5,3,1][i];scores.set(id,s);
  });
  return [...scores.values()].sort((a,b)=>b.points-a.points||b.gold-a.gold);
}
export function chooseDuelTracks(savedIds=[],kind='open'){
  const pool=kind==='favorites'&&savedIds.length>=4?TRACKS.filter(t=>savedIds.includes(t.id)):TRACKS;
  return pool.slice(0,4).map(t=>t.id);
}
