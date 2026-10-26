/** Scripted PostgreSQL protocol through the real store/service. No native DB claim. */
import {applicationFixture,binding,scopes,versions,id} from './application-fixture.mjs';
import {storeFixture} from './store-fixture.mjs';
import {hash} from '../boundary.mjs';
import {savedUsage} from '../usage-read/test/fixture.mjs';
import pgUtils from 'pg/lib/utils.js';
export {binding,scopes,id};
export async function feedbackFixture(){
 const db=storeFixture(),pool={async connect(){const client=await db.pool.connect();return {release:error=>client.release(error),async query(sql,p=[]){
  if(sql==='SELECT * FROM meri_conversations.events WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 ORDER BY sequence LIMIT 10001')return client.query('SELECT * FROM meri_conversations.events WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND sequence>$4 ORDER BY sequence LIMIT $5',[...p,0,10001]);
  if(sql.startsWith('UPDATE meri_conversations.runs SET feedback=')){
   db.state.calls.push(sql);const r=db.state.runs.get(p.slice(0,3).join(':'));
   // Exercise the installed driver's parameter serialization before the JSONB readback.
   if(!r)return {rows:[]};r.feedback=JSON.parse(pgUtils.prepareValue(p[3]));r.feedback_sha256=p[4];return {rows:[{feedback_sha256:p[4]}]};
  }
  return client.query(sql,p);
 }}}};
 const app=await applicationFixture({pool}),at='2026-10-26T06:00:00.000Z';
 const run={binding,scopes,state:'completed',createdAt:at,policyRevision:'policy1',versions};
 const request={requestId:id(6),prompt:'Synthetic request',skill:null,window:null};
 const types=[['run.status',{state:'queued',reasonCode:null}],['run.status',{state:'starting',reasonCode:null}],['run.status',{state:'running',reasonCode:null}],
  ['message.delta',{messageId:id(20),text:'The saved '}],['message.delta',{messageId:id(20),text:'answer.'}],
  ['artifact.available',{artifactId:id(30),versionId:id(31)}],['run.status',{state:'completed',reasonCode:null}]];
 const rows=types.map(([type,data],i)=>{const event={contractVersion:'0.1.0',eventId:id(100+i),binding,scopes,sequence:i+1,createdAt:at,type,data};return {tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,sequence:i+1,event_id:event.eventId,event,event_sha256:hash(event)};});
 const usage=savedUsage(),key=[binding.tenantId,binding.conversationId,binding.runId].join(':');
 db.state.runs.set(key,{tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,projection:run,projection_sha256:hash(run),request,request_sha256:hash(request),request_id:request.requestId,last_sequence:rows.length,sequence_base:0,sequence_end:null,sdk_usage:usage,sdk_usage_sha256:hash(usage),feedback:null,feedback_sha256:null});
 db.state.events.set(key,rows);
 const input={requestId:id(50),target:{kind:'message',runId:binding.runId,throughSequence:rows.length,messageId:id(20)},sourceEventId:null,signal:{kind:'factual_correction',proposedCorrection:'The recorded date should be 26 October.'}};
 return {...app,db:db.state,input,rows,row:()=>db.state.runs.get(key)};
}
