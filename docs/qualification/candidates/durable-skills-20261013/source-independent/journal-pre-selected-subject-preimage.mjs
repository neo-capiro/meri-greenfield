/** Actual lifecycle journal decoder; synthetic SQL rows, no database. */
import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;assert.ok(root);
const {createLifecycleJournal}=await import(pathToFileURL(root+'/apps/control/conversations/lifecycle/journal.mjs'));
const {canonicalSha256:hash}=await import(pathToFileURL(root+'/packages/contracts/validate.mjs'));
const id=n=>`${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`;
const NOW='2026-10-13T15:45:00.000Z',clone=structuredClone;
async function fixture(){
 const binding={tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:id('1'),runId:id('2'),attemptId:id('3'),workerId:id('4'),writerFence:7};
 const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:id('6'),policyRevision:'synthetic-policy'}];
 const versions={imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'};
 const request={requestId:id('7'),prompt:'Synthetic original',window:null,windowRequest:null,skill:null};
 const projection={binding,scopes,versions,policyRevision:scopes[0].policyRevision,state:'running',createdAt:NOW};
 const run={tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,request_id:request.requestId,projection,projection_sha256:hash(projection),request,request_sha256:hash(request),last_sequence:'3',hold_control_id:null};
 let row;const calls=[];
 const client={async query(sql,args=[]){calls.push(sql);
  if(sql.startsWith('SELECT * FROM meri_conversations.runs'))return {rows:[clone(run)]};
  if(sql.startsWith('SELECT * FROM meri_conversations.controls'))return {rows:row?[clone(row)]:[]};
  if(sql.startsWith('INSERT INTO meri_conversations.controls')){row={tenant_id:args[0],control_id:args[1],conversation_id:args[2],run_id:args[3],projection:clone(args[4]),projection_sha256:args[5],control_sequence:'1'};return {rows:[clone(row)]};}
  throw Error('Unallocated SQL in independent fixture: '+sql);
 }};
 const journal=createLifecycleJournal({tx:async(_binding,check,body)=>{check();const result=await body(client);check();return result;},rowRun:value=>value});
 const input={controlId:id('5'),intent:'steer',text:'Synthetic steering'},command={controlId:input.controlId,action:'steer',binding,contextSha256:hash({window:request.window,skill:request.skill,scopes}),prompt:input.text};
 const saved=await journal.begin({binding,scopes,input,command},()=>{});
 return {binding,scopes,saved,journal,calls,row:()=>row,read:()=>journal.controls({binding,scopes,after:0},()=>{})};
}
test('Actual journal creates and decodes a healthy immutable source control',async()=>{
 const f=await fixture(),rows=await f.read();assert.equal(rows.length,1);assert.equal(rows[0].controlSequence,1);
 assert.deepEqual(rows[0].sourceBinding,f.binding);assert.deepEqual(rows[0].scopes,f.scopes);
 assert.equal(rows[0].sourceRequestSha256,hash(rows[0].sourceRequest));assert.equal(rows[0].commandSha256,hash(rows[0].command));
});
for(const [name,mutate,rehashed] of [
 ['SQL conversation ID',r=>r.conversation_id=id('f'),false],['SQL run ID',r=>r.run_id=id('f'),false],
 ['zero SQL sequence',r=>r.control_sequence='0',false],['non-numeric SQL sequence',r=>r.control_sequence='NaN',false],
 ['unsafe SQL sequence',r=>r.control_sequence='9007199254740992',false],
 ['source-request hash',r=>r.projection.sourceRequestSha256='f'.repeat(64),true],
 ['command hash',r=>r.projection.commandSha256='f'.repeat(64),true],
 ['source scope',r=>r.projection.scopes[0].tenantId='other-tenant',true],
 ['worker context digest',r=>r.projection.command.contextSha256='f'.repeat(64),true],
 ['source writer binding',r=>r.projection.sourceBinding.writerFence++,true],
])test('Actual journal refuses coherently corrupted '+name,async()=>{
 const f=await fixture(),row=f.row();mutate(row);if(rehashed)row.projection_sha256=hash(row.projection);
 await assert.rejects(f.read(),/STORE_CORRUPT|SCOPE_REFUSED|STALE_WRITER|LIFECYCLE|COMMAND|CONTEXT/);
 assert.equal(f.calls.filter(sql=>sql.startsWith('INSERT')).length,1,'read refusal creates no second control');
});
