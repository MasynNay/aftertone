/** Local-only, read-only listening recap. UTC calendar days are explicit so
 * daylight-saving changes and cross-device time zones cannot move buckets.
 * Only actual Keep/Pass decisions count; no estimated listening minutes. */
import {collectionSearchKey} from './collection-pagination.mjs';
export const RECAP_PERIODS=Object.freeze(['7','30','all']);
const DAY=86400000;
const validTime=at=>Number.isSafeInteger(at)&&at>0&&at<=8640000000000000;
const label=value=>typeof value==='string'?value.trim():'';
const known=value=>{const text=label(value);return text&&!['unknown','unknown artist','various artists','all','fresh'].includes(collectionSearchKey(text))?text:'';};
const emptyCounts=()=>({kept:0,passed:0,total:0});
function add(count,action){count.total++;count[action==='like'?'kept':'passed']++;}
function group(map,value,action){
  if(!value)return;
  const key=collectionSearchKey(value);
  if(!map.has(key))map.set(key,{label:value,...emptyCounts()});
  add(map.get(key),action);
}
const rank=map=>[...map.values()].sort((a,b)=>b.kept-a.kept||b.total-a.total||a.label.localeCompare(b.label)).slice(0,6);
export function listeningRecap(history=[],catalog=[],{period='all',now=Date.now()}={}){
  const selected=RECAP_PERIODS.includes(period)?period:'all';
  const clock=validTime(now)?now:Date.now();
  const today=Math.floor(clock/DAY)*DAY;
  const days=selected==='all'?14:Number(selected);
  const chartStart=today-(days-1)*DAY;
  const cutoff=selected==='all'?null:chartStart;
  const byId=new Map(catalog.filter(t=>t?.id).map(t=>[t.id,t]));
  const activity=Array.from({length:days},(_,i)=>({date:new Date(chartStart+i*DAY).toISOString().slice(0,10),...emptyCounts()}));
  const artists=new Map(),genres=new Map(),artistKeys=new Set();
  const total=emptyCounts();
  let undated=0,dated=0,unknownArtist=0;
  for(const e of history){
    if(!e?.id||!['like','pass'].includes(e.action))continue;
    const at=validTime(e.at)&&e.at<=clock?e.at:null;
    if(at===null)undated++;
    if(cutoff!==null&&(at===null||at<cutoff))continue;
    add(total,e.action);
    const track=byId.get(e.id);
    const artist=known(e.artist)||known(track?.artist);
    const genre=known(e.genre)||known(track?.genre);
    if(artist){artistKeys.add(collectionSearchKey(artist));group(artists,artist,e.action);}else unknownArtist++;
    group(genres,genre,e.action);
    if(at!==null){
      dated++;
      const bucket=Math.floor((at-chartStart)/DAY);
      if(bucket>=0&&bucket<days)add(activity[bucket],e.action);
    }
  }
  return {period:selected,...total,keepRate:total.total?Math.round(100*total.kept/total.total):null,
    artists:artistKeys.size,unknownArtist,undated,dated,activity,activeDays:activity.filter(d=>d.total).length,
    chartDays:days,topArtists:rank(artists),topGenres:rank(genres)};
}
