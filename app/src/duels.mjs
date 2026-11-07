/**
 * AFTERTONE Music Duels — deterministic, local-first knockout tournaments.
 *
 * All operations are pure: the UI owns playback and persistence. A match vote
 * never silently changes listening history or favorites; the listener can
 * explicitly save the resulting podium to their collection.
 *
 * Standard brackets: 4, 8, or 16 tracks. Champion Cups additionally support
 * two previous winners for an early head-to-head championship.
 */
import { tournamentTheme, songYear } from './tournament-themes.mjs';

export const DUEL_STORAGE_KEY = 'aftertone:duels:v1';
export const DUEL_MAX_ARCHIVES = 40;
export const DUEL_SIZES = Object.freeze([4, 8, 16]);
const ALLOWED_SOURCES = new Set(['deezer', 'audius', 'jamendo', 'commons', 'jellyfin']);
const validId = id => typeof id === 'string' && /^(deezer|audius|jamendo|commons|jellyfin):[\w-]+$/.test(id);

/** Compact snapshots keep brackets playable even when live discovery refreshes. */
export function trackSnapshot(track) {
  if (!track || !validId(track.id) || !String(track.title || '').trim() || !String(track.artist || '').trim()) return null;
  return {
    id: track.id, source: track.id.split(':')[0],
    title: String(track.title).slice(0,180), artist: String(track.artist).slice(0,180),
    genre: String(track.genre || 'unknown').slice(0,32),
    genreVerified: track.genreVerified===true,
    releaseYear: songYear(track),
    artwork: typeof track.artwork === 'string' && (/^https:\/\//.test(track.artwork) || /^\/api\/jellyfin-art\?id=[a-f\d]{32}$/i.test(track.artwork)) ? track.artwork.slice(0,1500) : null,
  };
}

const pairRound = (ids, roundNumber) => Array.from({length: ids.length/2}, (_,i) => ({
  id:`r${roundNumber}m${i}`, a:ids[2*i], b:ids[2*i+1], winner:null,
}));

export function createTournament({ id, name, tracks, kind='open', themeId='open', createdAt=Date.now() }) {
  if (!['open','champions'].includes(kind)) throw new Error('Unknown tournament type');
  const entries = (tracks || []).map(trackSnapshot);
  if (entries.some(t=>!t) || ![2,4,8,16].includes(entries.length) || (kind==='open' && entries.length<4))
    throw new Error('Select 4, 8 or 16 playable songs for a tournament');
  if (new Set(entries.map(t=>t.id)).size !== entries.length) throw new Error('Each song may enter a bracket only once');
  if (typeof id !== 'string' || !/^duel_[a-zA-Z0-9_-]{4,64}$/.test(id)) throw new Error('Invalid tournament ID');
  const title=String(name || (kind==='champions'?'Champions Cup':'Music Duels')).trim().slice(0,65) || 'Music Duels';
  return {
    version:1,id,name:title,kind,themeId:kind==='champions' ? 'champions' : tournamentTheme(themeId).id,createdAt,finishedAt:null,status:'active',
    entries,rounds:[pairRound(entries.map(t=>t.id),0)],thirdPlace:null,podium:null,
  };
}

const lastOf = tournament => tournament.rounds.length-1;
const losing = match => match.winner === match.a ? match.b : match.a;

/** Third-place playoff precedes the grand final, so the final ends the event. */
export function nextDuelMatch(tournament) {
  if (!tournament || tournament.status==='complete') return null;
  const last=lastOf(tournament);
  for (let r=0;r<tournament.rounds.length;r++) {
    const match=tournament.rounds[r].find(m=>!m.winner);
    if (!match) continue;
    if (r===last && tournament.rounds[r].length===1 && tournament.thirdPlace && !tournament.thirdPlace.winner)
      return {...tournament.thirdPlace,stage:'third',round:r};
    return {...match,stage:r===last && tournament.rounds[r].length===1?'final':'round',round:r};
  }
  return null;
}

/** Returns a NEW tournament. Rejects double votes and stale match submissions. */
export function voteDuel(tournament, matchId, winnerId, decidedAt=Date.now()) {
  const expected=nextDuelMatch(tournament);
  if (!expected || expected.id!==matchId || (winnerId!==expected.a && winnerId!==expected.b))
    throw new Error('This matchup is no longer active');
  const next=JSON.parse(JSON.stringify(tournament));
  if (expected.stage==='third') {
    next.thirdPlace.winner=winnerId;
    next.thirdPlace.decidedAt=decidedAt;
    return next;
  }
  const round=next.rounds[expected.round];
  const match=round.find(m=>m.id===matchId);
  match.winner=winnerId;
  match.decidedAt=decidedAt;
  if (!round.every(m=>m.winner)) return next;

  if (round.length>1) {
    // Semifinals are exactly two matches. Their losers fight for bronze.
    if (round.length===2 && next.entries.length>=4) {
      next.thirdPlace={id:'bronze',a:losing(round[0]),b:losing(round[1]),winner:null};
    }
    next.rounds.push(pairRound(round.map(m=>m.winner),expected.round+1));
    return next;
  }
  // Grand final is the last action, following the bronze match when present.
  next.status='complete';
  next.finishedAt=decidedAt;
  next.podium={first:winnerId,second:losing(match),third:next.thirdPlace?.winner || null};
  return next;
}

export function duelProgress(tournament) {
  const total=tournament.entries.length-1+(tournament.entries.length>=4 ? 1:0);
  const done=tournament.rounds.flat().filter(m=>Boolean(m.winner)).length+(tournament.thirdPlace?.winner?1:0);
  return {done,total,remaining:Math.max(0,total-done)};
}

/** Only concluded original tournaments seed the next generation's Cup. */
export function availableChampions(tournaments=[]) {
  const byTrack=new Map();
  for (const event of tournaments) {
    if (event?.status!=='complete' || event.kind!=='open' || !event.podium?.first) continue;
    const track=event.entries.find(x=>x.id===event.podium.first);
    if (track && !byTrack.has(track.id)) byTrack.set(track.id,{...track,from:event.name,tournamentId:event.id});
  }
  return [...byTrack.values()];
}

export function podiumTracks(tournament) {
  if (!tournament?.podium) return [];
  return ['first','second','third'].flatMap((place,index)=>{
    const track=tournament.entries.find(e=>e.id===tournament.podium[place]);
    return track ? [{...track,place:index+1}] : [];
  });
}

/** Roundtrip-safe, defensive storage: invalid or outdated brackets are ignored. */
export function loadDuelStore(storage) {
  try {
    const raw=JSON.parse(storage.getItem(DUEL_STORAGE_KEY)||'null');
    if (raw?.version!==1 || !Array.isArray(raw.tournaments)) return [];
    return raw.tournaments.slice(-DUEL_MAX_ARCHIVES).filter(t=>{
      if (!/^duel_[a-zA-Z0-9_-]{4,64}$/.test(t?.id||'') || !['open','champions'].includes(t.kind) || !['active','complete'].includes(t.status)) return false;
      if (!Array.isArray(t.entries) || ![2,4,8,16].includes(t.entries.length) || (t.kind==='open' && t.entries.length<4)) return false;
      if (t.entries.some(e=>!trackSnapshot(e)) || new Set(t.entries.map(e=>e.id)).size!==t.entries.length) return false;
      if (!Array.isArray(t.rounds) || !t.rounds.length || !Array.isArray(t.rounds[0]) || t.rounds[0].length!==t.entries.length/2) return false;
      const ids=new Set(t.entries.map(e=>e.id));
      if (t.rounds.some((round,i)=>!Array.isArray(round) || round.length!==t.entries.length / (2**(i+1)) || round.some(m=>!m || !ids.has(m.a) || !ids.has(m.b) || m.a===m.b || (m.winner && ![m.a,m.b].includes(m.winner))))) return false;
      if (t.thirdPlace && (!ids.has(t.thirdPlace.a) || !ids.has(t.thirdPlace.b) || (t.thirdPlace.winner && ![t.thirdPlace.a,t.thirdPlace.b].includes(t.thirdPlace.winner)))) return false;
      if (t.status==='complete' && (!t.podium || !ids.has(t.podium.first) || !ids.has(t.podium.second) || (t.entries.length>=4 && !ids.has(t.podium.third)))) return false;
      return true;
    });
  } catch { return []; }
}

export function saveDuelStore(storage, tournaments) {
  try {
    storage.setItem(DUEL_STORAGE_KEY, JSON.stringify({version:1,tournaments:tournaments.slice(-DUEL_MAX_ARCHIVES)}));
    return true;
  } catch { return false; }
}

/** CSV export is playlist-ready metadata, not an unauthorized audio download. */
export function podiumCsv(tournament) {
  const q=value=>'"'+String(value??'').replaceAll('"','""')+'"';
  return [['Rank','Track Name','Artist Name','Source','Tournament'],...podiumTracks(tournament).map(t=>[t.place,t.title,t.artist,t.source,tournament.name])]
    .map(row=>row.map(q).join(',')).join('\r\n')+'\r\n';
}


/** A season is a UTC calendar quarter (reproducible for listeners in any locale). */
export function tournamentSeason(timestamp) {
  const date = new Date(timestamp);
  if(!Number.isFinite(date.getTime())) return null;
  return `${date.getUTCFullYear()} Q${Math.floor(date.getUTCMonth()/3)+1}`;
}
export function availableHallSeasons(tournaments=[]) {
  return [...new Set(tournaments.filter(t=>t?.status==='complete').map(t=>tournamentSeason(t.finishedAt)).filter(Boolean))].sort().reverse();
}
/**
 * Hall of Fame is derived from completed results, never stored as another
 * mutable source of truth. Championship crowns are recorded separately from
 * normal cups and contribute to overall points.
 */
export function hallOfFame(tournaments=[],season='all') {
  const board=new Map();
  for(const t of tournaments) {
    if(t?.status!=='complete' || !t?.podium || (season!=='all' && tournamentSeason(t.finishedAt)!==season)) continue;
    for(const [position,place] of ['first','second','third'].entries()) {
      const track=t.entries.find(e=>e.id===t.podium?.[place]);
      if(!track) continue;
      let row=board.get(track.id);
      if(!row){row={...track,gold:0,silver:0,bronze:0,cups:0,points:0,events:0,lastWonAt:0};board.set(track.id,row);}
      if(position===0){row.gold++;row.points+=5;row.lastWonAt=Math.max(row.lastWonAt,t.finishedAt||0);if(t.kind==='champions'){row.cups++;row.points+=5;}}
      else if(position===1){row.silver++;row.points+=3;}
      else{row.bronze++;row.points++;}
      row.events++;
    }
  }
  return [...board.values()].sort((a,b)=>b.points-a.points || b.cups-a.cups || b.gold-a.gold || b.lastWonAt-a.lastWonAt || a.id.localeCompare(b.id));
}
/** Export Hall of Fame metadata without fetching or redistributing recordings. */
export function hallOfFameCsv(tournaments=[],season='all') {
  const q=value=>'"'+String(value??'').replaceAll('"','""')+'"';
  return [['Rank','Track Name','Artist Name','Gold','Silver','Bronze','Champions Cups','Points','Season'],
    ...hallOfFame(tournaments,season).map((t,i)=>[i+1,t.title,t.artist,t.gold,t.silver,t.bronze,t.cups,t.points,season])]
    .map(row=>row.map(q).join(',')).join('\r\n')+'\r\n';
}
