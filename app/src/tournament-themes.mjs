/**
 * Music Duels entry policy.
 *
 * Themed tournaments MUST use real catalog metadata. In particular, unknown
 * release dates and unknown genres never qualify for an era/genre tournament.
 * Selection is deterministic when a caller supplies a deterministic random
 * function, enabling reproducible tests without depending on Deezer uptime.
 */
export const TOURNAMENT_THEMES = Object.freeze([
  {id:'open',name:'Open Stage',tagline:'A little of everything',description:'A mix of playable discoveries.'},
  {id:'favorites',name:'Favorites Face-Off',tagline:'Your saved songs compete',description:'Only songs you previously kept can enter.'},
  {id:'fresh',name:'Fresh Faces',tagline:'Meet someone new',description:'Avoids artists you already saved where possible.'},
  {id:'mystery',name:'Mystery Matchups',tagline:'Hear it before you see it',description:'Titles and artwork stay hidden during the tournament.'},
  {id:'pop-rock',name:'Pop vs Rock',tagline:'Two genres. One champion.',description:'Equal teams of tracks with verified Pop and Rock genres.'},
  {id:'throwback-2000s',name:'2000s Throwback',tagline:'A decade duel',description:'Only tracks with confirmed 2000–2009 release years.'},
]);
export const tournamentTheme = id => TOURNAMENT_THEMES.find(t=>t.id===id) || TOURNAMENT_THEMES[0];
export const isMysteryTournament = t => t?.themeId==='mystery' && t.status!=='complete';

const canonical = value => String(value || '').normalize('NFKC').toLocaleLowerCase('en').trim();
const shuffle = (tracks,random) => {
  const array=[...tracks];
  for(let i=array.length-1;i>0;i--){const j=Math.floor(Math.min(.999999,Math.max(0,random()))*(i+1));[array[i],array[j]]=[array[j],array[i]];}
  return array;
};
const yearOf = track => {
  const raw=track?.releaseYear ?? track?.year;
  const year=Number(raw);
  return Number.isInteger(year) && year>=1900 && year<=2100 ? year : null;
};
export const songYear = yearOf;
function unique(tracks) {
  const seen=new Set();
  return (tracks||[]).filter(t=>{
    if(!t || t.source!=='deezer' || !/^deezer:\d+$/.test(String(t.id)) || !String(t.artist||'').trim() || !String(t.title||'').trim() || seen.has(t.id))return false;
    seen.add(t.id); return true;
  });
}
function favoriteArtistKeys(tracks,favorites) {
  return new Set(tracks.filter(t=>favorites.has(t.id)).map(t=>canonical(t.artist)));
}
/** Preview real eligibility before exposing a Create button. */
export function tournamentAvailability({themeId='open',tracks=[],favoriteIds=[],size=8}={}) {
  const entries=unique(tracks);
  const saved=new Set(favoriteIds);
  const theme=tournamentTheme(themeId).id;
  let eligible=[];
  if(theme==='favorites') eligible=entries.filter(t=>saved.has(t.id));
  else if(theme==='fresh') {
    const familiar=favoriteArtistKeys(entries,saved);
    eligible=entries.filter(t=>!saved.has(t.id) && !familiar.has(canonical(t.artist)));
  } else if(theme==='throwback-2000s') eligible=entries.filter(t=>yearOf(t)>=2000 && yearOf(t)<=2009);
  else if(theme==='pop-rock') eligible=entries.filter(t=>t.genreVerified===true && ['pop','rock'].includes(canonical(t.genre)));
  else eligible=entries;
  const groups=theme==='pop-rock' ? {
    pop:eligible.filter(t=>canonical(t.genre)==='pop').length,
    rock:eligible.filter(t=>canonical(t.genre)==='rock').length,
  } : {};
  const validSize=[4,8,16].includes(size);
  const ready=validSize && eligible.length>=size && (theme!=='pop-rock' || (groups.pop>=size/2 && groups.rock>=size/2));
  let message=ready ? `${eligible.length} eligible songs ready.` : `Need ${size} eligible songs; ${eligible.length} available.`;
  if(theme==='pop-rock' && !ready) message=`Pop ${groups.pop} · Rock ${groups.rock}. Need ${size/2} of each, with verified genre tags.`;
  if(theme==='throwback-2000s' && !ready) message=`${eligible.length} tracks have verified 2000–2009 release dates. Untagged songs aren't guessed.`;
  if(theme==='favorites' && !ready) message=`${eligible.length} saved songs available. Keep more songs to unlock this cup.`;
  if(theme==='fresh' && !ready) message=`${eligible.length} songs by unfamiliar artists available. Discover more to unlock this cup.`;
  return {ready,eligible,groups,message};
}

/** Diversify one-per-artist before repeating performers. Balanced Pop/Rock in rival events. */
function diversified(tracks,size,random) {
  const shuffled=shuffle(tracks,random);
  const first=[],repeats=[],seen=new Set();
  for(const t of shuffled){const key=canonical(t.artist); if(seen.has(key)) repeats.push(t); else{seen.add(key);first.push(t);}}
  return [...first,...repeats].slice(0,size);
}
export function pickThemedEntries({themeId='open',tracks=[],favoriteIds=[],size=8,random=Math.random}={}) {
  const availability=tournamentAvailability({themeId,tracks,favoriteIds,size});
  if(!availability.ready) throw new Error(availability.message);
  const theme=tournamentTheme(themeId).id;
  if(theme==='pop-rock') {
    // Alternating genres makes each opening matchup a true Pop-vs-Rock duel.
    const pop=diversified(availability.eligible.filter(t=>canonical(t.genre)==='pop'),size/2,random);
    const rock=diversified(availability.eligible.filter(t=>canonical(t.genre)==='rock'),size/2,random);
    return pop.flatMap((t,i)=>[t,rock[i]]);
  }
  return diversified(availability.eligible,size,random);
}

/** Size-aware arena card indicator; no 4-song readiness promise for a 16-song cup. */
export function tournamentStatusLabel(available,themeId,size) {
  if(available.ready)return `Ready for ${size} · ${available.eligible.length} eligible`;
  if(themeId==='pop-rock')return `Pop ${available.groups.pop}/${size/2} · Rock ${available.groups.rock}/${size/2}`;
  return `${available.eligible.length}/${size} eligible`;
}
