/** Read-only progression from real local data; no independent unlock state. */
import {artistKey} from './discovery/rotation.mjs';
import {collectionSearchKey,collectionFacets} from './collection-pagination.mjs';
const DAY=86400000;
const placeholders=new Set(['','unknown','unknown artist','various artists','all','fresh']);
const identified=value=>typeof value==='string'&&!placeholders.has(collectionSearchKey(value));
const count=value=>Number.isSafeInteger(value)&&value>=0?value:0;
export const ACHIEVEMENT_GROUPS=Object.freeze([
  {id:'discovery',label:'Discovery'}, {id:'collection',label:'Collection'}, {id:'practice',label:'Tune Lab & Duels'}
]);
export const ACHIEVEMENT_FILTERS=Object.freeze(['all','earned','in-progress','discovery','collection','practice']);
export function achievementCabinet({state={},catalog=[],quizStats={},tournaments=[],now=Date.now()}={}){
  const byId=new Map([...(state.savedTracks||[]),...catalog].filter(t=>t?.id).map(t=>[t.id,t]));
  const events=new Map();
  for(const e of state.history||[])if(e?.id&&['like','pass'].includes(e.action))events.set(e.id,e);
  const decisions=[...events.values()],kept=decisions.filter(e=>e.action==='like');
  const discovery=decisions.filter(e=>!['search','challenge'].includes(e.context));
  const wild=discovery.filter(e=>e.route==='explore');
  const paths=new Set(discovery.map(e=>e.route).filter(r=>['balanced','familiar','explore'].includes(r)));
  const artists=new Set(kept.map(e=>identified(e.artist)?e.artist:byId.get(e.id)?.artist).filter(identified).map(artistKey).filter(Boolean));
  const genres=new Set(kept.map(e=>identified(e.genre)?e.genre:byId.get(e.id)?.genre).filter(identified).map(collectionSearchKey));
  const days=new Set(decisions.filter(e=>Number.isSafeInteger(e.at)&&e.at>0&&e.at<=now).map(e=>Math.floor(e.at/DAY)));
  const favorites=[...new Set((state.favorites||[]).filter(id=>typeof id==='string'&&id))],saved=new Set(favorites);
  const tracks=favorites.map(id=>byId.get(id)).filter(Boolean);
  const facets=collectionFacets(tracks,decisions);
  const lists=(state.personalPlaylists||[]).filter(p=>p?.trackIds?.some(id=>saved.has(id)));
  const completed=tournaments.filter(t=>t?.status==='complete'&&t.podium?.first);
  const cup=completed.filter(t=>t.kind==='champions').length;
  const league=completed.filter(t=>t.format==='league').length;
  const answered=count(quizStats.answered),correct=Math.min(answered,count(quizStats.correct));
  const cards=[];
  function add(group,id,title,detail,value,goal,view){
    cards.push({group,id,title,detail,value,goal,progress:Math.min(value,goal),earned:value>=goal,view});
  }
  add('discovery','first-choice','First contact','Make your first Keep or Pass decision.',decisions.length,1,'discover');
  add('discovery','fifty-choices','Deep listener','Rate 50 different songs in retained history.',decisions.length,50,'discover');
  add('discovery','hundred-choices','Century of sound','Rate 100 different songs in retained history.',decisions.length,100,'discover');
  add('discovery','ten-artists','New horizons','Keep songs by 10 identified artists.',artists.size,10,'discover');
  add('discovery','five-genres','Across the spectrum','Keep songs from five recorded genres.',genres.size,5,'discover');
  add('discovery','wild-twenty','Off the beaten path','Rate 20 songs in Wild Card discovery, excluding searches and shared challenges.',wild.length,20,'discover');
  add('discovery','all-paths','Three roads','Record a decision on each of the three discovery paths.',paths.size,3,'discover');
  add('discovery','seven-days','On your schedule','Make decisions on seven different UTC calendar days; they need not be consecutive.',days.size,7,'discover');
  add('collection','ten-saved','Record shelf','Have 10 distinct saved songs.',favorites.length,10,'collection');
  add('collection','fifty-saved','Personal library','Have 50 distinct saved songs.',favorites.length,50,'collection');
  add('collection','hundred-saved','The archive','Have 100 distinct saved songs.',favorites.length,100,'collection');
  add('collection','three-playlists','Curator','Create three personal playlists containing at least one currently saved song each.',lists.length,3,'collection');
  add('collection','four-moods','Color palette','Have saved songs with four recorded moods.',facets.moods.length,4,'collection');
  add('practice','quiz-ten','Ear training','Answer 10 Tune Lab questions.',answered,10,'quiz');
  add('practice','quiz-correct','Sharp listener','Answer 10 Tune Lab questions correctly.',correct,10,'quiz');
  add('practice','duel-first','Arena debut','Complete one Music Duels tournament.',completed.length,1,'duels');
  add('practice','duel-five','Arena regular','Complete five Music Duels tournaments.',completed.length,5,'duels');
  add('practice','league-first','League champion','Finish a round-robin league.',league,1,'duels');
  add('practice','champions-cup','Among legends','Complete a Champions Cup.',cup,1,'duels');
  const earned=cards.filter(c=>c.earned).length;
  const groups=ACHIEVEMENT_GROUPS.map(g=>({...g,total:cards.filter(c=>c.group===g.id).length,earned:cards.filter(c=>c.group===g.id&&c.earned).length}));
  const next=[...cards].filter(c=>!c.earned).sort((a,b)=>b.progress/b.goal-a.progress/a.goal)[0]||null;
  return {cards,groups,earned,total:cards.length,next};
}
export function filterAchievements(cabinet,filter='all'){
  if(filter==='earned')return cabinet.cards.filter(c=>c.earned);
  if(filter==='in-progress')return cabinet.cards.filter(c=>!c.earned);
  if(ACHIEVEMENT_GROUPS.some(g=>g.id===filter))return cabinet.cards.filter(c=>c.group===filter);
  return cabinet.cards;
}
