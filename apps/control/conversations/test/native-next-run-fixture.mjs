/** Synthetic SQL rows for the real journal; no PostgreSQL/physical-stop claim. */
import {fixture,check} from './next-run-recovery-fixture.mjs';
import {binding,scopes,id} from './lifecycle-fixture.mjs';
import {hash} from '../boundary.mjs';
export {binding,scopes,id,check};
export const rowKey=b=>[b.tenantId,b.conversationId,b.runId].join(':');
export async function nativeFixture(){
 const x=await fixture();await x.first();
 const sessionKey={projectKey:'-workspace-conversation',sessionId:id(800)};
 const transcripts=[{entries:Array.from({length:20},(_,n)=>({type:n%2?'assistant':'user',uuid:id(1000+n),message:{role:n%2?'assistant':'user',content:n===0?'Remember the cobalt paper crane.':`synthetic retained entry ${n}`},opaque:{nested:[null,n,{kept:true}]}}))},{subpath:'subagents/original',entries:[{type:'system',opaque:{child:'first'}},{type:'assistant',uuid:id(1200),opaque:{child:'second'}}]}];
 function seed(b,parts=transcripts){
  const row={tenant_id:b.tenantId,conversation_id:b.conversationId,run_id:b.runId,session_id:sessionKey.sessionId,project_key:sessionKey.projectKey};
  const owner={binding:b,scopes,selectedClientId:id(5),policyRevision:'policy1',key:sessionKey,allocationSha256:'d'.repeat(64),expiresAtMs:1};
  const entries=parts.flatMap(p=>p.entries.map((entry,i)=>({...row,subpath:p.subpath??'',sequence:i+1,entry_uuid:entry.uuid??null,entry:structuredClone(entry),entry_sha256:hash(entry)})));
  x.f.state.sdkSessions.set(rowKey(b),{...row,owner,owner_sha256:hash(owner),entries_count:entries.length,bytes:entries.reduce((n,e)=>n+Buffer.byteLength(JSON.stringify(e.entry)),0)});
  x.f.state.sdkStreams.push(...parts.map(p=>({...row,subpath:p.subpath??'',last_sequence:p.entries.length})));
  x.f.state.sdkEntries.push(...entries);return x.f.state.sdkSessions.get(rowKey(b));
 }
 async function complete(b=binding,parts=transcripts){await x.running(b);seed(b,parts);await x.f.store.append(b,x.status('completed'),check);await x.retire(b);}
 return {...x,sessionKey,transcripts,seed,complete,async second(){await complete();const target=(await x.select()).binding;await x.accept(target,'What should you remember?');return target;},snapshot:target=>x.f.store.nextRuns.sessionSnapshot({binding:target,scopes,selectedClientId:id(5)},check)};
}
