/** Round robin schedule and standings, shared by live votes and archive validation.
 * A tied win total is ordered by wins against the tied group, then initial
 * draw order. A seed tiebreak is disclosed rather than invented as a vote. */
export function leagueSchedule(ids){
  const ring=[...ids],rounds=[];
  if(ring.length<2||ring.length%2||new Set(ring).size!==ring.length)return rounds;
  for(let r=0;r<ids.length-1;r++){
    rounds.push(Array.from({length:ids.length/2},(_,i)=>{
      const pair=[ring[i],ring[ring.length-1-i]];
      if((r+i)%2)pair.reverse();
      return {id:`l${r}m${i}`,a:pair[0],b:pair[1],winner:null};
    }));
    ring.splice(1,0,ring.pop());
  }
  return rounds;
}
export function leagueStandings(tournament){
  const rows=tournament.entries.map((track,seed)=>({id:track.id,seed:seed+1,played:0,wins:0,losses:0,tiebreakWins:0}));
  const byId=new Map(rows.map(row=>[row.id,row]));
  const matches=tournament.rounds.flat().filter(m=>m.winner===m.a||m.winner===m.b);
  for(const m of matches){
    const a=byId.get(m.a),b=byId.get(m.b);
    if(!a||!b)continue;
    a.played++;b.played++;
    byId.get(m.winner).wins++;
    byId.get(m.winner===m.a?m.b:m.a).losses++;
  }
  const tied=new Map();
  for(const row of rows){if(!tied.has(row.wins))tied.set(row.wins,new Set());tied.get(row.wins).add(row.id);}
  for(const m of matches){
    const a=byId.get(m.a),b=byId.get(m.b);
    if(a&&b&&a.wins===b.wins)byId.get(m.winner).tiebreakWins++;
  }
  return rows.sort((a,b)=>b.wins-a.wins||b.tiebreakWins-a.tiebreakWins||a.seed-b.seed)
    .map((row,index)=>({...row,rank:index+1,tied:tied.get(row.wins).size>1}));
}
export function leaguePodium(tournament){
  const rows=leagueStandings(tournament);
  return {first:rows[0].id,second:rows[1].id,third:rows[2]?.id||null};
}
export function consistentLeague(t){
  if(t.kind!=='open'||![4,8,16].includes(t.entries.length)||t.thirdPlace!==null)return false;
  const schedule=leagueSchedule(t.entries.map(e=>e.id));
  if(!Array.isArray(t.rounds)||t.rounds.length!==schedule.length)return false;
  let pending=false;
  for(let r=0;r<schedule.length;r++){
    const expected=schedule[r],round=t.rounds[r];
    if(!Array.isArray(round)||round.length!==expected.length)return false;
    for(let i=0;i<expected.length;i++){
      const m=round[i],e=expected[i];
      if(!m||m.id!==e.id||m.a!==e.a||m.b!==e.b||![null,e.a,e.b].includes(m.winner))return false;
      if(m.winner===null)pending=true;
      else if(pending)return false;
    }
  }
  if(pending)return t.status==='active'&&t.podium===null&&t.finishedAt===null;
  if(t.status!=='complete'||!t.podium)return false;
  const expected=leaguePodium(t);
  return ['first','second','third'].every(k=>t.podium[k]===expected[k]);
}
