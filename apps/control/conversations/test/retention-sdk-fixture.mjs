/** Bounded scripted SQL for the actual inventory/SDK owners; no PostgreSQL claim. */
import {nativeFixture,binding,id} from './native-next-run-fixture.mjs';
import {rawInventory} from './retention-content-fixture.mjs';
import {sdkRetentionTables} from '../retention-sdk-rows.mjs';
export {binding,id};
export async function sdkRetentionFixture({count=22,text='synthetic retained SDK entry',substream=false}={}){
 const x=await nativeFixture(),entries=Array.from({length:count},(_,i)=>({type:i%2?'assistant':'user',uuid:id(1000+i),message:{content:text}}));
 x.seed(binding,substream?[{entries:entries.slice(0,Math.ceil(count/2))},{subpath:'subagents/original',entries:entries.slice(Math.ceil(count/2))}]:[{entries}]);
 const raw=rawInventory(x.f.state,binding);return {raw,entries,close:()=>x.f.close(),reader:createSdkRetentionReader(raw)};
}
const keyCompare=(a,b,keys)=>{for(const [key,type] of keys){if(a[key]===b[key])continue;const n=type==='bigint'?Number(a[key])-Number(b[key]):type==='uuid'?(a[key]<b[key]?-1:1):Buffer.compare(Buffer.from(a[key]),Buffer.from(b[key]));if(n)return n;}return 0;};
export function createSdkRetentionReader(raw){
 const definitions=new Map(sdkRetentionTables.map(t=>[t.name,t])),calls=[],ordered=new Map();
 const ordinary={conversations:[raw.conversation],runs:raw.runs,events:raw.events,controls:raw.controls,checkpoints:raw.checkpoints,completion_checkpoints:raw.completionCheckpoints,next_runs:raw.nextRuns};
 return {calls,async query(sql,args=[]){calls.push({sql,args});
  if(!sql.startsWith('SELECT'))return {rows:[]};
  const table=sql.match(/FROM ([a-z_]+\.[a-z_]+)/u)?.[1],t=definitions.get(table);
  let rows=raw.contentRows[table]??ordinary[table?.split('.')[1]]??[];
  if(t){const session=sql.includes('AND r.run_id=$3::uuid AND r.session_id=$4::uuid'),source=raw.contentRows[table],cacheKey=JSON.stringify([table,...args.slice(0,session?4:2)]);let cached=ordered.get(cacheKey);
   const reusable=cached&&cached.source===source&&cached.length===source.length;
   rows=reusable?cached.rows:rows.filter(r=>r.tenant_id===args[0]&&r.conversation_id===args[1]&&(!session||r.run_id===args[2]&&r.session_id===args[3]));
   if(sql.includes('AS orphan')){const parent=sql.includes('FROM meri_conversations.sdk_session_streams p')?sdkRetentionTables[1]:sdkRetentionTables[0],parents=raw.contentRows[parent.name];
    return {rows:rows.some(r=>!parents.some(p=>p.tenant_id===r.tenant_id&&p.conversation_id===r.conversation_id&&parent.keys.every(([k])=>p[k]===r[k])))?[{orphan:1}]:[]};}
   if(sql.includes('AS present'))return {rows:rows.length?[{present:1}]:[]};
   if(!reusable){cached={source,length:source.length,rows:rows.slice().sort((a,b)=>keyCompare(a,b,t.keys))};ordered.set(cacheKey,cached);}
   rows=cached.rows;let offset=session?4:2,start=0,end=rows.length;
   const after=key=>{let lo=0,hi=rows.length;while(lo<hi){const mid=(lo+hi)>>>1;if(keyCompare(rows[mid],key,t.keys)<=0)lo=mid+1;else hi=mid;}return lo;};
   if(sql.includes(')>(')){const cursor=Object.fromEntries(t.keys.map(([k],i)=>[k,args[offset+i]]));start=after(cursor);offset+=t.keys.length;}
   if(sql.includes(')<=(')){const upper=Object.fromEntries(t.keys.map(([k],i)=>[k,args[offset+i]]));end=after(upper);}
   rows=rows.slice(start,Math.min(end,start+Number(sql.match(/LIMIT (\d+)/u)?.[1]??1)));
   if(sql.includes('AS retention_row_bytes'))rows=rows.map(r=>({...Object.fromEntries(t.keys.map(([k])=>[k,r[k]])),retention_row_bytes:String(Buffer.byteLength(JSON.stringify(r)))}));
   return {rows};
  }
  if(args[2]!=null&&rows.length>32){const key=sql.match(/ORDER BY (?:r\.)?([a-z_]+)/u)?.[1];rows=rows.filter(r=>r[key]>args[2]);}
  return {rows:rows.slice(0,33)};
 }};
}
