/**
 * AFTERTONE's three discovery paths.
 *
 * Separation matters: request policy chooses WHICH catalog lane to fetch;
 * presentation policy chooses WHICH loaded performer is allowed on screen.
 * A random-number tweak to one shared pool is not a meaningful mode.
 * This module is intentionally pure so test fixtures can verify differences.
 */
import { artistKey, laneKey } from './rotation.mjs';

const SCHEDULES = Object.freeze({
  // Stay near music the listener explicitly saved, occasionally reconnecting
  // with an onboarding artist. Fall back to charts when those are unavailable.
  familiar: Object.freeze(['liked','related','liked','related','favorite','liked','related','liked','related','broad']),
  // Bridges and broad listening both matter. No automatic seed replays.
  balanced: Object.freeze(['related','broad','related','broad','related','broad','related','broad','related','broad']),
  // Mostly explore unfamiliar genre neighborhoods; never request seed replays.
  explore: Object.freeze(['wild','wild','wild','broad','wild','wild','wild','broad','wild','wild']),
});

// Genres with curated, catalog-backed artist-search lanes. These are *search*
// categories, not guaranteed audio genre tags for individual recordings.
export const WILDCARD_GENRES = Object.freeze(['electronic','rock','jazz','hiphop','folk','indie','funk','classical','ambient','cinematic','pop']);
export const PATH_DESCRIPTIONS = Object.freeze({
  familiar: 'Your saved artists and their neighbors. Until you save songs, wider tracks fill the gap.',
  balanced: 'New performers around your taste, plus popular songs from outside your starting five.',
  explore: 'Unfamiliar performers, rotating through genres beyond your usual orbit.',
});
const modes = new Set(Object.keys(SCHEDULES));
const safeMode = value => modes.has(value) ? value : 'balanced';
const cleanIndex = value => Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):0;
const available = (list,exhausted,kind) => {
  const seen=new Set();
  return (list||[]).filter(x=>{
    const key=artistKey(x?.artist);
    if(!key||seen.has(key)||exhausted.has(`${kind}:${laneKey(x)}`))return false;
    seen.add(key);return true;
  });
};
// Count occurrences of a lane, not absolute request positions. With two
// neighbors and related slots at 0,2,4,... absolute modulo starves one.
function laneOrdinal(schedule,kind,index) {
  const cycles=Math.floor(index/schedule.length);
  const perCycle=schedule.filter(slot=>slot===kind).length;
  return cycles*perCycle+schedule.slice(0,index%schedule.length).filter(slot=>slot===kind).length;
}
const genreKey=value=>typeof value==='string'?value.trim().toLowerCase():'';
function wildcardGroups(history=[]) {
  const liked=new Set(history.filter(x=>x?.action==='like').map(x=>genreKey(x.genre)));
  return [WILDCARD_GENRES.filter(g=>!liked.has(g)),WILDCARD_GENRES.filter(g=>liked.has(g))];
}
function nextWildcard(index,history,selectedGenre,exhausted) {
  const groups=selectedGenre==='all'?wildcardGroups(history):[[selectedGenre]];
  for(const group of groups) {
    for(let step=0;step<group.length;step++){
      const genre=group[(index+step)%group.length];
      if(!exhausted.has(`wild:${genre}`))return {kind:'wild',lane:null,genre};
    }
  }
  return null;
}

/** Exclude your usual recorded genres before picking a cross-genre wildcard. */
export function chooseWildcardGenre(position=0, history=[], selectedGenre='all') {
  if(selectedGenre !== 'all') return selectedGenre; // Respect an explicit genre choice.
  const [unseen,known]=wildcardGroups(history||[]);
  const sequence=unseen.length ? unseen : known;
  // Different positions get different catalog lanes instead of all showing Pop.
  return sequence[cleanIndex(position)%sequence.length];
}

/**
 * Picks a single catalog request. With no usable relationship graph, we make
 * that limitation visible by requesting wider catalogs, NEVER more seed songs.
 */
export function planDiscoveryRequest({mode='balanced',requestNumber=0,seeds=[],related=[],liked=[],history=[],selectedGenre='all',exhausted=new Set()}={}) {
  mode=safeMode(mode);
  const index=cleanIndex(requestNumber);
  const schedule=SCHEDULES[mode];
  const desired=schedule[index%schedule.length];
  const candidates={liked:available(liked,exhausted,'liked'),related:available(related,exhausted,'related'),favorite:available(seeds,exhausted,'favorite')};
  const broad=()=>exhausted.has('broad')?null:{kind:'broad',lane:null,genre:selectedGenre};
  const wildcard=()=>nextWildcard(laneOrdinal(schedule,'wild',index),history||[],selectedGenre,exhausted);
  const artistLane=kind=>{
    const options=candidates[kind];
    if(!options?.length)return null;
    const ordinal=desired===kind?laneOrdinal(schedule,kind,index):index;
    return {kind,lane:options[ordinal%options.length],genre:selectedGenre};
  };
  // Honor a scheduled broad slot. Comfort must not replace every chart slot
  // with another familiar performer while there are usable broad results.
  const planned=desired==='wild'?wildcard():desired==='broad'?broad():artistLane(desired);
  if(planned)return planned;
  if(mode==='explore') {
    // Wild Card never fetches a known graph neighbor as a fallback. Explore
    // every permitted genre cursor before reporting complete exhaustion.
    return broad()||wildcard()||{kind:'none',lane:null,genre:selectedGenre};
  }
  if(mode==='familiar'&&desired!=='broad') {
    for(const kind of ['liked','related','favorite']){
      const next=artistLane(kind);if(next)return next;
    }
  }
  const wider=broad();if(wider)return wider;
  for(const kind of (mode==='familiar'?['liked','related','favorite']:['related'])){
    const next=artistLane(kind);if(next)return next;
  }
  return {kind:'none',lane:null,genre:selectedGenre};
}


/** Effective artists include actual Keeps, independent of seed activation. */
export function familiarArtistKeys({history=[],seeds=[],related=[]}={}) {
  const liked=(history||[]).filter(x=>x.action==='like').map(x=>x.artist);
  return {saved:new Set(liked.map(artistKey).filter(Boolean)),
    seeds:new Set(seeds.map(x=>artistKey(x.artist||x)).filter(Boolean)),
    related:new Set(related.map(x=>artistKey(x.artist||x)).filter(Boolean))};
}

/**
 * This is a hard presentation policy, not another scoring bonus. It only uses
 * metadata we truly have. Wild Card must never be called "new" when the only
 * available track is from the five seed artists or somebody already saved.
 * Empty means: fetch another page, don't silently replay old favorites.
 */
export function filterPoolForPath(tracks,mode='balanced',context={}) {
  const pool=Array.isArray(tracks)?tracks:[];
  const identity=familiarArtistKeys(context);
  const key=t=>artistKey(t.artist);
  if(mode==='explore') {
    return pool.filter(t=>!identity.saved.has(key(t)) && !identity.seeds.has(key(t)) && !identity.related.has(key(t)));
  }
  if(mode==='balanced') {
    const newVoices=pool.filter(t=>!identity.saved.has(key(t)) && !identity.seeds.has(key(t)));
    // Presentation alternates graph neighbors and wider discoveries when both
    // exist. Otherwise a large chart page can drown out a smaller related page.
    // The count checker uses the *same position* as the on-screen selector.
    if(Number.isInteger(context.position)) {
      const neighbors=newVoices.filter(t=>identity.related.has(key(t)));
      const wider=newVoices.filter(t=>!identity.related.has(key(t)));
      if(neighbors.length && wider.length) return context.position%2===0 ? neighbors : wider;
    }
    return newVoices; // Don't silently replay favorites in a discovery-only path.
  }
  if(mode==='familiar') {
    const neighbors=pool.filter(t=>identity.saved.has(key(t)) || identity.seeds.has(key(t)) || identity.related.has(key(t)));
    return neighbors.length ? neighbors : pool;
  }
  return pool;
}

/** Display precise provenance, with no unsupported claims about audio traits. */
export function explainDiscovery({kind='broad',lane=null,genre='all',artist=''}={}) {
  if(kind==='favorite') return `A song by one of your starting artists`;
  if(kind==='liked') return `Because you saved songs by ${lane?.artist||artist}`;
  if(kind==='related') return lane?.because ? `Related to ${lane.because} · Deezer artist network` : `A Deezer-related artist to explore`;
  if(kind==='wild') return `Wild Card · a ${genre==='all'?'different':genre} music lane outside your usual artists`;
  return 'A wider pick, away from your original five';
}

export const DISCOVERY_SCHEDULES = SCHEDULES;
