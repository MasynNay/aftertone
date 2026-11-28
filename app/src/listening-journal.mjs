/** A read-only, bounded history view. Never invent a title for older events
 * whose metadata is missing, or count an unrated preview as a decision. */
export const JOURNAL_PAGE_SIZE=20;
export const JOURNAL_FILTERS=Object.freeze(['all','like','pass']);
const clean=value=>typeof value==='string'?value.trim():'';
const pathLabels={familiar:'Comfort Zone',balanced:'New Territory',explore:'Wild Card'};
export function listeningJournal(history=[],catalog=[],{filter='all',page=1}={}) {
  const byId=new Map(catalog.filter(t=>t?.id).map(t=>[t.id,t]));
  const counts={all:0,like:0,pass:0};
  const paths=Object.entries(pathLabels).map(([id,label])=>({id,label,like:0,pass:0}));
  paths.push({id:'search',label:'Manual search',like:0,pass:0},{id:'legacy',label:'Earlier / unspecified',like:0,pass:0});
  const byPath=new Map(paths.map(path=>[path.id,path]));
  const valid=history.filter(e=>e?.id && ['like','pass'].includes(e.action));
  for(const event of valid) {
    counts.all++;counts[event.action]++;
    const path=byPath.get(event.context==='search'?'search':event.route)||byPath.get('legacy');
    path[event.action]++;
  }
  const selected=JOURNAL_FILTERS.includes(filter)?filter:'all';
  const matching=selected==='all'?valid:valid.filter(e=>e.action===selected);
  const total=matching.length,pages=Math.max(1,Math.ceil(total/JOURNAL_PAGE_SIZE));
  const current=Math.max(1,Math.min(pages,Number.isSafeInteger(page)?page:1));
  const start=(current-1)*JOURNAL_PAGE_SIZE;
  const entries=matching.slice(Math.max(0,total-start-JOURNAL_PAGE_SIZE),total-start).reverse().map(event=>{
    const track=byId.get(event.id);
    const path=byPath.get(event.context==='search'?'search':event.route)||byPath.get('legacy');
    const at=Number.isSafeInteger(event.at)&&event.at>0&&event.at<=8640000000000000?event.at:null;
    return {action:event.action,title:clean(event.title)||clean(track?.title)||null,
      artist:clean(event.artist)||clean(track?.artist)||null,path:path.label,at};
  });
  return {filter:selected,counts,paths:paths.filter(p=>p.like+p.pass>0),entries,
    total,pages,page:current,start:total?start+1:0,end:start+entries.length};
}
