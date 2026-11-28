/** Session-only playback of saved preview identities. No votes or downloads. */
export function buildSavedQueue(ids=[],favorites=[],catalog=[],{shuffle=false,random=Math.random}={}){
  const saved=new Set(favorites),byId=new Map(catalog.filter(t=>t?.id).map(t=>[t.id,t]));
  const queue=[...new Set(ids)].filter(id=>saved.has(id)&&byId.has(id)&&byId.get(id).source!=='youtube'&&!id.startsWith('youtube:'));
  if(shuffle)for(let i=queue.length-1;i>0;i--){
    const j=Math.max(0,Math.min(i,Math.floor(random()*(i+1))));
    [queue[i],queue[j]]=[queue[j],queue[i]];
  }
  return queue;
}
export function nextSavedIndex(queue,index,{direction=1,repeat=false}={}){
  if(!Array.isArray(queue)||!queue.length||!Number.isInteger(index)||index<0||index>=queue.length||![-1,1].includes(direction))return null;
  const next=index+direction;
  if(next>=0&&next<queue.length)return next;
  return repeat?(next<0?queue.length-1:0):null;
}
