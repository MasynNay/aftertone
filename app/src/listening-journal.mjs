/** A read-only, bounded history view. Never invent a title for older events
 * whose metadata is missing, or count an unrated preview as a decision. */
import {collectionSearchKey} from './collection-pagination.mjs';
export const JOURNAL_PAGE_SIZE=20;
export const JOURNAL_FILTERS=Object.freeze(['all','like','pass']);
const clean=value=>typeof value==='string'?value.trim():'';
const pathLabels={familiar:'Comfort Zone',balanced:'New Territory',explore:'Wild Card',search:'Manual search',challenge:'Shared challenge',legacy:'Earlier / unspecified'};
export const JOURNAL_PATHS=Object.freeze(['all',...Object.keys(pathLabels)]);
const eventPath=event=>['search','challenge'].includes(event.context)?event.context:['familiar','balanced','explore'].includes(event.route)?event.route:'legacy';
export function listeningJournal(history=[],catalog=[],{filter='all',page=1,path='all',query=''}={}) {
  const byId=new Map(catalog.filter(t=>t?.id).map(t=>[t.id,t]));
  const counts={all:0,like:0,pass:0};
  const paths=Object.entries(pathLabels).map(([id,label])=>({id,label,like:0,pass:0}));
  const byPath=new Map(paths.map(path=>[path.id,path]));
  const valid=history.filter(e=>e?.id && ['like','pass'].includes(e.action));
  for(const event of valid) {
    counts.all++;counts[event.action]++;
    const path=byPath.get(eventPath(event));
    path[event.action]++;
  }
  const selected=JOURNAL_FILTERS.includes(filter)?filter:'all';
  const selectedPath=JOURNAL_PATHS.includes(path)?path:'all';
  const search=collectionSearchKey(typeof query==='string'?query.slice(0,120):'');
  const names=event=>{const track=byId.get(event.id);return {title:clean(event.title)||clean(track?.title)||null,artist:clean(event.artist)||clean(track?.artist)||null};};
  const matching=valid.filter(event=>{
    if(selected!=='all'&&event.action!==selected)return false;
    if(selectedPath!=='all'&&eventPath(event)!==selectedPath)return false;
    if(!search)return true;
    const {title,artist}=names(event);
    return collectionSearchKey([title,artist].filter(Boolean).join(' ')).includes(search);
  });
  const total=matching.length,pages=Math.max(1,Math.ceil(total/JOURNAL_PAGE_SIZE));
  const current=Math.max(1,Math.min(pages,Number.isSafeInteger(page)?page:1));
  const start=(current-1)*JOURNAL_PAGE_SIZE;
  const entries=matching.slice(Math.max(0,total-start-JOURNAL_PAGE_SIZE),total-start).reverse().map(event=>{
    const path=byPath.get(eventPath(event));
    const at=Number.isSafeInteger(event.at)&&event.at>0&&event.at<=8640000000000000?event.at:null;
    return {action:event.action,...names(event),path:path.label,at};
  });
  return {filter:selected,path:selectedPath,query:typeof query==='string'?query.slice(0,120):'',counts,paths:paths.filter(p=>p.like+p.pass>0||p.id===selectedPath),entries,
    total,pages,page:current,start:total?start+1:0,end:start+entries.length};
}
