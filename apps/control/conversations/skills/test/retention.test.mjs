/** Canonical PostgreSQL store/protocol and actual original compiler guards; source-only. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createPostgresConversationStore} from '../../postgres-store.mjs';
import {createSelectedOutputRetention} from '../retention.mjs';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {storeFixture,id,versions} from '../../test/store-fixture.mjs';
import {selectSkill} from '../../../../../packages/skills/index.mjs';
import {createCommitmentsAuditCompiler} from '../../../document-application/commitments-audit/compose.mjs';
import {createRelationshipBriefCompiler} from '../../../document-application/relationship-brief/compose.mjs';
import * as commitments from '../../../document-application/commitments-audit/test/fixtures.mjs';
import * as relationships from '../../../document-application/relationship-brief/test/fixtures.mjs';
const check=()=>{};
async function fixture(skillId='quick_skill.commitments_audit'){
 const domain=skillId==='quick_skill.commitments_audit'?commitments:relationships,context=domain.unitContext(),selection=skillId==='quick_skill.commitments_audit'?domain.selection(context):domain.selected(context),
  selected=selectSkill(skillId,'1.0.0'),sourceBinding=context.binding,base=storeFixture(),outputs=new Map(),state={now:domain.NOW,accessCalls:[],revoked:false,sourceRevoked:false,afterMutate:null};
 const pool={async connect(){const c=await base.pool.connect();let snapshot;return {async query(sql,p=[]){
  if(sql==='BEGIN')snapshot=structuredClone(outputs);if(sql==='ROLLBACK'){outputs.clear();for(const [k,v]of snapshot)outputs.set(k,v);}
  if(sql.startsWith('SELECT * FROM meri_conversations.selected_outputs')){base.state.calls.push(sql);const row=outputs.get(p.slice(0,3).join(':'));return {rows:row?[structuredClone(row)]:[]};}
  if(sql.startsWith('INSERT INTO meri_conversations.selected_outputs')){base.state.calls.push(sql);outputs.set(p.slice(0,3).join(':'),{tenant_id:p[0],conversation_id:p[1],run_id:p[2],preparation_sha256:p[3],projection:structuredClone(p[4]),projection_sha256:p[5]});return {rows:[]};}
  return c.query(sql,p);},release:c.release};}};
 const store=createPostgresConversationStore({pool}),request={requestId:id(700),prompt:'Original research',skill:selected.pin,window:selection.window,windowRequest:null},at=new Date(state.now).toISOString(),scopes=context.scopes;
 const run={binding:sourceBinding,state:'queued',scopes,createdAt:at,policyRevision:scopes[0].policyRevision,versions},conversation={conversationId:sourceBinding.conversationId,owner:{tenantId:sourceBinding.tenantId,actorId:sourceBinding.actorId},scopes,createdAt:at,policyRevision:run.policyRevision};
 await store.accept({run,conversation,request,event:{contractVersion:'0.1.0',eventId:id(701),binding:sourceBinding,sequence:1,createdAt:at,scopes,type:'run.status',data:{state:'queued',reasonCode:null}}},check);
 let eventId=702;const status=state=>store.append(sourceBinding,{eventId:id(eventId++),createdAt:at,type:'run.status',data:{state,reasonCode:null}},check);
 await status('starting');await status('running');
 const reads=[],compiler=(skillId==='quick_skill.commitments_audit'?createCommitmentsAuditCompiler:createRelationshipBriefCompiler)({now:()=>state.now,defaultCongress:119,readSource:async call=>{
  const result=domain.sourcePage(call);reads.push({deliveryId:'compiler:'+hash({ordinal:reads.length,operation:call.operation,request:call.request}),operation:call.operation,request:call.request,resultSha256:hash(result),result});return result;}});
 const prepared=await compiler.prepare(domain.makeInput(),context,{selection});
 const pending={state:'awaiting-output-approval',sourceBinding,skill:selected.pin,requestSha256:hash(request),selectionSha256:hash(selection),inputSha256:prepared.provenance.inputSha256,
  preparationSha256:hash(prepared),artifactRequestSha256:hash(prepared.request),baseVersionId:prepared.baseVersionId,prepared};
 const outputBinding={...sourceBinding,runId:id(800),attemptId:id(801),workerId:id(802),writerFence:2};
 const currentOutputAccess=async call=>{state.accessCalls.push(call.phase);if(state.revoked||state.sourceRevoked)throw Object.assign(Error('ACCESS_REVOKED'),{code:'ACCESS_REVOKED'});
  const record={...call.pins,outputBinding,outputContextSha256:hash({...prepared.context,binding:outputBinding,deadlineMs:state.now+5000}),outputScopes:scopes,policyRevision:scopes[0].policyRevision,
   outputAllocationSha256:'a'.repeat(64),outputGrantId:id(810),approvalReceiptId:id(811),sourceAccessReceiptId:id(812),sessionReceiptId:id(813),checkedAtMs:state.now,expiresAtMs:state.now+5000};
  if(call.phase==='after'&&state.afterMutate)state.afterMutate(record);return record;};
 const owner=()=>createSelectedOutputRetention({journal:createPostgresConversationStore({pool}).selectedOutputs,currentOutputAccess,now:()=>state.now,maxRequestMs:1000});
 const retain=(o=owner(),change={})=>o.retain({pending,request,reads,...change});const load=(o=owner(),change={})=>o.load({sourceBinding,preparationSha256:pending.preparationSha256,...change});
 return {base,pool,store,outputs,state,sourceBinding,request,prepared,pending,reads,context,selection,owner,retain,load,status,currentOutputAccess,outputBinding};
}
for(const skill of ['quick_skill.commitments_audit','quick_skill.relationship_brief'])test(`${skill}: real original compiler guard retains exact JSON/SDK reads; restart recovers only after completed source with fresh output`,async()=>{
 const f=await fixture(skill),first=await f.retain(),replay=await f.retain();assert.equal(first.replayed,false);assert.equal(replay.replayed,true);assert.equal(f.outputs.size,1);
 await assert.rejects(f.load(),/SOURCE_STATE/);await f.status('completed');f.state.now=f.context.deadlineMs+100;
 const restarted=f.owner(),loaded=await f.load(restarted);assert.equal(hash(loaded.prepared),f.pending.preparationSha256);assert.deepEqual(loaded.reads,f.reads);assert.deepEqual(loaded.request,f.request);
 assert.deepEqual(f.state.accessCalls,['before','after']);assert.equal(loaded.prepared.context.deadlineMs,f.context.deadlineMs);
 restarted.admit(loaded.prepared,loaded.prepared.context)({request:loaded.prepared.request,context:loaded.prepared.context,baseVersionId:loaded.prepared.baseVersionId});
 const call=restarted.sourceCall(loaded.prepared);assert.equal(call.prepared,loaded.prepared);assert.deepEqual(call.binding,f.sourceBinding);assert.deepEqual(call.reads,f.reads);
 assert.throws(()=>restarted.admit(structuredClone(loaded.prepared),loaded.prepared.context),/RETAINED_PREPARATION/);assert.throws(()=>f.owner().admit(loaded.prepared,loaded.prepared.context),/RETAINED_PREPARATION/);
 assert.ok(f.base.state.calls.filter(s=>s.startsWith('SELECT pg_advisory')).length>=4);assert.equal(f.base.state.calls.some(s=>/CREATE|ALTER/u.test(s)),false);
});
test('copied/fabricated compiler preparation is refused before SQL allocation',async()=>{
 const f=await fixture(),calls=f.base.state.calls.length;await assert.rejects(f.retain(f.owner(),{pending:structuredClone(f.pending)}),/COMMITMENTS_CONFIGURATION/);
 assert.equal(f.base.state.calls.length,calls);assert.equal(f.outputs.size,0);
});
test('closed pending request/read/input/selection/preparation/source/scopes pins refuse retention',async()=>{
 for(const mutate of [p=>p.requestSha256='0'.repeat(64),p=>p.preparationSha256='0'.repeat(64),p=>p.selectionSha256='0'.repeat(64),p=>p.inputSha256='0'.repeat(64),
  p=>p.sourceBinding={...p.sourceBinding,writerFence:2},p=>p.skill={...p.skill,skillVersion:'2.0.0'},p=>p.artifactRequestSha256='0'.repeat(64)]){
  const f=await fixture(),p={...f.pending};mutate(p);await assert.rejects(f.retain(f.owner(),{pending:p}));assert.equal(f.outputs.size,0);}
 const f=await fixture();await assert.rejects(f.retain(f.owner(),{reads:[]}));assert.equal(f.outputs.size,0);
});
for(const state of ['paused','waiting-for-approval','failed','cancelled'])test(`${state} source cannot retain pending or load after a prior retention`,async()=>{
 const f=await fixture();await f.retain();await f.status(state);await assert.rejects(f.retain(),/SOURCE_STATE/);await assert.rejects(f.load(),/SOURCE_STATE/);
});
test('one immutable pending per source run rejects changed SDK ledger even with valid prepared identity',async()=>{
 const f=await fixture();await f.retain();const reads=structuredClone(f.reads);reads[0].deliveryId='sdk:'+'d'.repeat(64);
 await assert.rejects(f.retain(f.owner(),{reads}),/REPLAY_REFUSED/);assert.equal(f.outputs.size,1);
});
test('stored preparation/request/scopes/content digest tampering and changed source writer refuse restart',async()=>{
 for(const change of [row=>row.projection.prepared.request.title='forged',row=>row.projection_sha256='0'.repeat(64),row=>row.preparation_sha256='f'.repeat(64),
  row=>{row.projection.pending.sourceBinding.writerFence=2;row.projection_sha256=hash(row.projection);}]){
  const f=await fixture();await f.retain();await f.status('completed');change(f.outputs.values().next().value);await assert.rejects(f.load());}
 const f=await fixture();await f.retain();await f.status('completed');await assert.rejects(f.load(f.owner(),{sourceBinding:{...f.sourceBinding,actorId:'foreign'}}));
});
test('fresh resource revocation and distinct output grant/session/scope are required before/after recovery',async()=>{
 for(const change of [r=>r.sourceContextSha256='f'.repeat(64),r=>r.outputBinding={...r.sourceBinding},r=>r.outputBinding.actorId='other',r=>r.outputScopes=[],
  r=>r.sessionReceiptId=id(999),r=>r.outputGrantId=id(999),r=>r.approvalReceiptId=id(999),r=>r.outputAllocationSha256='f'.repeat(64),r=>r.sourceAccessReceiptId=id(999),r=>r.expiresAtMs=0]){
  const f=await fixture();await f.retain();await f.status('completed');f.state.afterMutate=change;await assert.rejects(f.load(),/ACCESS_REFUSED/);}
 for(const key of ['revoked','sourceRevoked']){const f=await fixture();await f.retain();await f.status('completed');f.state[key]=true;await assert.rejects(f.load(),/ACCESS_REFUSED/);}
});
test('loaded brand prevents changed request/context/base and expires with current output access',async()=>{
 const f=await fixture();await f.retain();await f.status('completed');const owner=f.owner(),loaded=await f.load(owner),guard=owner.admitRetained(loaded.prepared,loaded.prepared.context);
 for(const change of [i=>i.request={...i.request,title:'changed'},i=>i.context={...i.context,binding:{...i.context.binding,runId:id(900)}},i=>i.baseVersionId=id(900)]){
  const intent={request:loaded.prepared.request,context:loaded.prepared.context,baseVersionId:loaded.prepared.baseVersionId};change(intent);assert.throws(()=>guard(intent),/SUBSTITUTION/);}
 f.state.now+=6000;assert.throws(()=>owner.sourceCall(loaded.prepared),/RETAINED_PREPARATION/);assert.throws(()=>guard({request:loaded.prepared.request,context:loaded.prepared.context,baseVersionId:loaded.prepared.baseVersionId}));
});
test('lost commit ACK retains uncertainty and exact replay recovers one immutable record',async()=>{
 const f=await fixture();f.base.state.commitUnknown=true;await assert.rejects(f.retain(),/COMMIT_UNKNOWN/);assert.equal(f.outputs.size,1);
 f.base.state.commitUnknown=false;assert.equal((await f.retain()).replayed,true);assert.equal(f.outputs.size,1);
});
test('cancelled/parked access never brands or releases retained JSON',async()=>{
 const f=await fixture();await f.retain();await f.status('completed');const controller=new AbortController();controller.abort();await assert.rejects(f.load(f.owner(),{signal:controller.signal}));
 const parked=createSelectedOutputRetention({journal:f.store.selectedOutputs,currentOutputAccess:()=>new Promise(()=>{}),now:()=>f.state.now,maxRequestMs:20});
 await assert.rejects(f.load(parked),/DEADLINE/);assert.throws(()=>parked.admit(f.prepared,f.context),/RETAINED_PREPARATION/);
});
test('old context deadline does not authorize recovery; changed current session alone blocks it',async()=>{
 const f=await fixture();await f.retain();await f.status('completed');f.state.now=f.context.deadlineMs+1000;
 f.state.afterMutate=r=>r.sessionReceiptId=id(999);await assert.rejects(f.load(),/ACCESS_REFUSED/);assert.equal(f.outputs.size,1);
});
test('direct journal cannot bypass the original compiler admission owner',async()=>{
 const f=await fixture(),before=f.base.state.calls.length,{prepared,...pending}=f.pending;
 await assert.rejects(f.store.selectedOutputs.retain({recipe:'original-selected-output-retention/1',pending,prepared,request:f.request,reads:f.reads},check),/PREPARATION_REFUSED/);
 assert.equal(f.base.state.calls.length,before);assert.equal(f.outputs.size,0);
});
test('source stored request/window/scopes corruption is refused even when row hashes are recomputed',async()=>{
 for(const kind of ['request','scopes','skill']){const f=await fixture();await f.retain();await f.status('completed');const row=f.base.state.runs.values().next().value;
  if(kind==='request')row.request.prompt='changed';if(kind==='skill')row.request.skill={...row.request.skill,proseSha256:'f'.repeat(64)};
  if(kind==='scopes')row.projection.scopes=[];row.request_sha256=hash(row.request);row.projection_sha256=hash(row.projection);await assert.rejects(f.load());}
});
test('credential/provider/opaque properties and duplicate SDK read identities are never persisted',async()=>{
 for(const key of ['credential','opaqueSession','providerData']){const f=await fixture(),reads=structuredClone(f.reads),extra=structuredClone(reads[0]);
  extra.deliveryId='sdk:'+'f'.repeat(64);extra.result[key]='SYNTHETIC_PRIVATE_CONTROL_VALUE';extra.resultSha256=hash(extra.result);reads.push(extra);
  await assert.rejects(f.retain(f.owner(),{reads}),/PRIVATE_DATA/);assert.equal(f.outputs.size,0);}
 const f=await fixture();await assert.rejects(f.retain(f.owner(),{reads:[...f.reads,f.reads[0]]}),/READS_REFUSED/);assert.equal(f.outputs.size,0);
});
test('model booleans and opaque callback properties cannot act as current output access',async()=>{
 const f=await fixture();await f.retain();await f.status('completed');
 for(const record of [true,{allowed:true},{credential:'SYNTHETIC'},{...f.pending}]){const owner=createSelectedOutputRetention({journal:f.store.selectedOutputs,currentOutputAccess:async()=>record,now:()=>f.state.now});await assert.rejects(f.load(owner));}
});
test('original pointer with hostile context getters is rejected without getter execution or SQL allocation',async()=>{
 const f=await fixture();let effects=0;const p={...f.prepared};Object.defineProperty(p,'context',{enumerable:true,get(){effects++;return f.context;}});
 const before=f.base.state.calls.length;await assert.rejects(f.retain(f.owner(),{pending:{...f.pending,prepared:p}}));assert.equal(effects,0);assert.equal(f.base.state.calls.length,before);
});
test('concurrent exact retention uses canonical transaction serialization and creates one immutable pending',async()=>{
 const f=await fixture(),results=await Promise.all([f.retain(),f.retain()]);assert.equal(f.outputs.size,1);assert.equal(results.filter(r=>r.replayed).length,1);
});
test('foreign journal and private native owner diagnostics are rejected without exposing details',async()=>{
 const f=await fixture();assert.throws(()=>createSelectedOutputRetention({journal:{retain:async()=>{},load:async()=>f.prepared},currentOutputAccess:f.currentOutputAccess,now:()=>f.state.now}),/CONFIGURATION/);
 await f.retain();await f.status('completed');const owner=createSelectedOutputRetention({journal:f.store.selectedOutputs,currentOutputAccess:async()=>{throw Error('SYNTHETIC_PRIVATE_OWNER_DIAGNOSTIC');},now:()=>f.state.now});
 await assert.rejects(f.load(owner),e=>e.message==='SELECTED_OUTPUT_ACCESS_REFUSED'&&!e.message.includes('PRIVATE'));
});
