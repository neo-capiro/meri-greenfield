/** Real runtime/session/preparation/lifecycle owners; SQL/Temporal are scripted here. PostgreSQL proof is separate. */
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createActionSessionOwner,routineManagementSessions} from '../../action-host/session/owner.mjs';
import {createRoutineManagementContextOwner} from '../runtime-context.mjs';
import {createRoutineManagementPreparations} from '../management-preparations.mjs';
import {createRoutinesService} from '../application.mjs';
import {createRoutinesApplication} from '../application-http.mjs';
import {receiveRoutinesResponse} from '../../../../packages/contracts/dist/intents-application.mjs';
import {applicationFixture,binding,clientId,id} from './application-fixture.mjs';
const versions={imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'};
// Seed a coherent historical projection and its acknowledged generation together.
function historicalScopes(h,scopes){const row=[...h.f.sql.state.projections.values()][0];row.projection.scopes=structuredClone(scopes);row.projection_sha256=hash(row.projection);const intent=[...h.f.sql.state.intents.values()][0];intent.intent.projection=structuredClone(row.projection);intent.intent_sha256=hash(intent.intent);return row.projection;}
function preparationPool(){const rows=new Map(),state={loseCommit:false,claimed:0,failFailedSettlement:false};const pk=v=>v.slice(0,4).join('|');
 return {rows,state,async connect(){return {async query(sql,v=[]){
  if(sql==='COMMIT'){if(state.loseCommit){state.loseCommit=false;throw Error('synthetic commit acknowledgement loss');}return {rows:[]};}
  if(sql.startsWith('BEGIN')||sql==='ROLLBACK'||sql.startsWith('SET LOCAL'))return {rows:[]};
  if(sql.startsWith('INSERT INTO meri_schedules.management_preparations')){if(rows.has(pk(v)))return {rows:[],rowCount:0};state.claimed++;rows.set(pk(v),{tenant_id:v[0],actor_id:v[1],scope_sha256:v[2],request_id:v[3],claim_id:v[4],record:structuredClone(v[5]),record_sha256:v[6],state:'PENDING',proposal_id:null,outcome:null});return {rows:[],rowCount:1};}
  if(sql.startsWith('SELECT tenant_id,actor_id,scope_sha256')){const row=sql.includes('proposal_id=$4')?[...rows.values()].find(r=>r.tenant_id===v[0]&&r.actor_id===v[1]&&r.scope_sha256===v[2]&&r.proposal_id===v[3]):rows.get(pk(v));return {rows:row?[structuredClone(row)]:[]};}
  if(sql.startsWith('UPDATE meri_schedules.management_preparations')){if(state.failFailedSettlement&&v[4]==='FAILED')throw Error('synthetic failed settlement');const row=rows.get(pk(v));Object.assign(row,{state:v[4],proposal_id:v[5],outcome:structuredClone(v[6])});return {rows:[structuredClone(row)],rowCount:1};}
  throw Error('unexpected preparation SQL');
 },release(){}};}};
}
async function fixture(){
 const f=await applicationFixture(),created=await f.prepare();await f.approve(created);const pool=preparationPool(),preparations=createRoutineManagementPreparations({pool}),state={versions:{...versions},policyCalls:[],modelCalls:0,policyAllowed:true,revokedScope:null,refusePhase:null,refuseCode:null};
 const forbidden=()=>{state.modelCalls++;throw Error('no execution identity');};
 function sessionOwner(){return createActionSessionOwner({mode:'process-local',verifyIdentity:forbidden,resolveContext:forbidden,now:f.now,refusals:()=>{},limits:{maxSessions:4,maxRequestMs:5000,maxTtlMs:30000,maxFactBytes:65536},management:{versions:state.versions,policyRevision:f.state.policyRevision,async readCurrent({clientId:choice}){
  const current={kind:'routine-management',principal:{tenantId:binding.tenantId,actorId:binding.actorId},scopes:choice===null?[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:f.state.policyRevision}]:f.scopes(),selectedClientId:choice,membershipRevision:'a'.repeat(64)};
  return {...current,contextRevision:hash(current),checkedAtMs:f.now(),expiresAtMs:f.now()+30000};}}});}
 const owners=[];
 async function login(selectedClientId=clientId){const sessions=sessionOwner();owners.push(sessions);const session=await routineManagementSessions(sessions).issue({identityCredential:'synthetic-native',clientId:selectedClientId});
  const contextOwner=createRoutineManagementContextOwner({sessions,scheduleOwner:f.owner,now:f.now,newId:f.newId,template:f.contextConfiguration.template,workflow:f.contextConfiguration.workflow,limits:f.contextConfiguration.limits,policy:{async check(call){state.policyCalls.push(call.selection);if(call.selection.phase==='resolve'&&state.refuseCode)throw Object.assign(Error(state.refuseCode),{code:state.refuseCode,...(state.refuseCode==='ROUTINES_UNAVAILABLE'?{outcome:'NOT_DISPATCHED'}:{})});const resources=[call.selection.currentSchedule,call.selection.proposal,call.selection.scheduleBinding?.resource].filter(Boolean);return {authorized:state.policyAllowed&&call.selection.phase!==state.refusePhase&&!resources.some(resource=>(resource.projection??resource).scopes?.some(scope=>scope.resourceId===state.revokedScope)),selectionSha256:call.selectionSha256,current:call.selection.current,destinationResolution:null,limits:null,checkedAtMs:f.now(),expiresAtMs:f.now()+5000};}}});
  const service=createRoutinesService({...f.config,contextOwner,managementPreparations:preparations,retention:{assertServable:forbidden}});
  const http=createRoutinesApplication({service,now:f.now,limits:{maxRequestMs:4000,maxRequestBytes:131072,maxResponseBytes:2097152}});
  return {session,sessions,http:request=>http.handle(new Request('https://synthetic.invalid/api/routines/prepare',{method:'POST',headers:{authorization:'Bearer '+session.credential,'content-type':'application/json'},body:JSON.stringify(request)})),call:(method,request)=>service[method]({credential:session.credential,request,deadlineMs:f.now()+4500})};
 }
 const request={scheduleId:created.proposal.projection.scheduleId,mode:'pause',running:'leave',runs:[],note:'Stop future firings'},body=requestId=>({requestId,operation:'cancel_scheduled_task',request});
 const decision=p=>({operation:'cancel_scheduled_task',request,proposalId:p.proposal.proposalId,intentSha256:p.proposal.intentSha256,decision:'approved'});
 return {f,pool,state,login,request,body,decision,close(){for(const owner of owners)owner.close();f.close();}};
}
test('claim precedes one immutable proposal; exact replay/new sign-in uses fresh authority and a single existing effect',async()=>{
 const h=await fixture();try{const a=await h.login(),prepared=await a.call('prepare',h.body('review-1')),count=h.pool.state.claimed;
  assert.deepEqual(await a.call('prepare',h.body('review-1')),prepared);assert.equal(h.pool.state.claimed,count);
  await assert.rejects(a.call('prepare',{...h.body('review-1'),request:{...h.request,note:'different'}}));
  a.sessions.close();const b=await h.login();assert.deepEqual(await b.call('prepare',h.body('review-1')),prepared);
  const result=await b.call('approve',h.decision(prepared));assert.equal(result.status,'acknowledged');assert.equal(result.receipt.projection.state,'paused');
  assert.deepEqual(await b.call('approve',h.decision(prepared)),result);assert.equal(h.state.modelCalls,0);
  const claim=h.state.policyCalls.find(x=>x.phase==='before_claim');assert.equal(claim.scheduleBinding.approval.decision,'approved');assert.equal(claim.scheduleBinding.intent.cancel.running,'leave');assert.deepEqual(claim.scheduleBinding.intent.cancel.runs,[]);
 }finally{h.close();}
});
test('image-only successor can recover; non-image version/policy/scope and mismatched proposal refuse before mutation',async()=>{
 const h=await fixture();try{const a=await h.login(),prepared=await a.call('prepare',h.body('review-2'));a.sessions.close();
  h.state.versions.imageDigest='sha256:'+'d'.repeat(64);const image=await h.login();assert.deepEqual(await image.call('prepare',h.body('review-2')),prepared);
  h.state.versions.skillsDigest='e'.repeat(64);const incompatible=await h.login();await assert.rejects(incompatible.call('approve',h.decision(prepared)));
  h.state.versions={...versions};const general=await h.login(null);await assert.rejects(general.call('approve',h.decision(prepared)));
  const good=await h.login();await assert.rejects(good.call('approve',{...h.decision(prepared),intentSha256:'0'.repeat(64)}));assert.equal(h.state.modelCalls,0);
 }finally{h.close();}
});
test('unknown preparation commit never remints; approved ACK loss never dispatches a second effect',async()=>{
 const h=await fixture();try{const a=await h.login();h.pool.state.loseCommit=true;await assert.rejects(a.call('prepare',h.body('uncertain')),e=>e.outcome==='UNKNOWN');
  await assert.rejects(a.call('prepare',h.body('uncertain')),e=>e.outcome==='UNKNOWN');assert.equal(h.pool.state.claimed,1);
  const prepared=await a.call('prepare',h.body('effect'));h.f.state.loseScheduleCommit=true;await assert.rejects(a.call('approve',h.decision(prepared)));
  const before={...h.f.temporal.calls};const second=await a.call('approve',h.decision(prepared));assert.equal(second.status,'acknowledged');assert.deepEqual(h.f.temporal.calls,before);
 }finally{h.close();}
});

test('legacy multi-scope routine preserves its original scopes/generation and requires every scope through approval',async()=>{
 const h=await fixture();try{
  const row=[...h.f.sql.state.projections.values()][0],secondary={...h.f.scopes()[0],resourceId:id(80)};
  const original=structuredClone(historicalScopes(h,[...row.projection.scopes,secondary])),a=await h.login();
  const listed=await a.call('list',{});assert.equal(listed.page.rows.length,1);assert.deepEqual(listed.page.rows[0].projection.scopes,original.scopes);
  const prepared=await a.call('prepare',h.body('legacy-multiple'));
  assert.deepEqual(prepared.proposal.projection.scopes,original.scopes);assert.equal(prepared.proposal.expectedGeneration,original.generation);
  h.state.revokedScope=secondary.resourceId;const before={...h.f.temporal.calls};
  await assert.rejects(a.call('list',{}));
  await assert.rejects(a.call('approve',h.decision(prepared)));assert.deepEqual(h.f.temporal.calls,before);
  h.state.revokedScope=null;const result=await a.call('approve',h.decision(prepared));assert.equal(result.status,'acknowledged');assert.deepEqual(result.receipt.projection.scopes,original.scopes);
  const claim=h.state.policyCalls.find(x=>x.phase==='before_claim');assert.deepEqual(claim.scheduleBinding.intent.projection.scopes,original.scopes);
  assert.equal(h.state.modelCalls,0);
 }finally{h.close();}
});

test('legacy secondary-scope refusal and wrong selected-client anchor do not prepare or dispatch',async()=>{
 const h=await fixture();try{
  const row=[...h.f.sql.state.projections.values()][0],secondary={...h.f.scopes()[0],resourceId:id(80)};
  historicalScopes(h,[...row.projection.scopes,secondary]);const a=await h.login(),before={...h.f.temporal.calls};
  h.state.revokedScope=secondary.resourceId;await assert.rejects(a.call('prepare',h.body('revoked-secondary')));
  h.state.revokedScope=null;historicalScopes(h,[secondary]);
  await assert.rejects(a.call('prepare',h.body('wrong-anchor')));assert.deepEqual(h.f.temporal.calls,before);assert.equal(h.state.modelCalls,0);
 }finally{h.close();}
});

test('definite post-claim preparation refusal settles FAILED and exact replay returns its stored refusal without reminting',async()=>{
 const h=await fixture();try{const a=await h.login(),before={...h.f.temporal.calls};h.state.refusePhase='resolve';
  await assert.rejects(a.call('prepare',h.body('refused')),error=>error.code==='ROUTINES_ACCESS_DENIED'&&error.outcome==='NOT_DISPATCHED');
  assert.equal(h.pool.state.claimed,1);const row=[...h.pool.rows.values()][0];assert.equal(row.state,'FAILED');assert.deepEqual(row.outcome,{code:'REFUSED'});assert.equal(row.proposal_id,null);
  h.state.refusePhase=null;const ids=h.f.state.ids;
  await assert.rejects(a.call('prepare',h.body('refused')),error=>error.code==='ROUTINES_ACCESS_DENIED'&&error.outcome==='NOT_DISPATCHED');
  assert.equal(h.f.state.ids,ids);assert.equal(h.pool.state.claimed,1);assert.deepEqual(h.f.temporal.calls,before);
 }finally{h.close();}
});

test('unestablished failed settlement retains PENDING/UNKNOWN and no identical retry remints or dispatches',async()=>{
 const h=await fixture();try{const a=await h.login(),before={...h.f.temporal.calls};h.state.refusePhase='resolve';h.pool.state.failFailedSettlement=true;
  await assert.rejects(a.call('prepare',h.body('failed-settlement')),error=>error.outcome==='UNKNOWN');
  assert.equal([...h.pool.rows.values()][0].state,'PENDING');h.state.refusePhase=null;h.pool.state.failFailedSettlement=false;const ids=h.f.state.ids;
  await assert.rejects(a.call('prepare',h.body('failed-settlement')),error=>error.outcome==='UNKNOWN');
  assert.equal(h.f.state.ids,ids);assert.equal(h.pool.state.claimed,1);assert.deepEqual(h.f.temporal.calls,before);
 }finally{h.close();}
});

for(const [cause,stored,code,status]of [
 ['SCHEDULE_CONTEXT_ACCESS_DENIED','REFUSED','ROUTINES_ACCESS_DENIED',403],
 ['SCHEDULE_CONTEXT_POLICY','REFUSED','ROUTINES_ACCESS_DENIED',403],
 ['SCHEDULE_CONTEXT_STALE','STALE','ROUTINES_STALE',409],
 ['SCHEDULE_CONTEXT_REQUEST','INVALID_REQUEST','ROUTINES_INVALID_REQUEST',400],
 ['ROUTINES_UNAVAILABLE','UNAVAILABLE','ROUTINES_UNAVAILABLE',503],
])test(`definite ${cause} retains its closed cause and exact public HTTP status across replay`,async()=>{
 const h=await fixture();try{const a=await h.login(),request=h.body('http-refusal');h.state.refuseCode=cause;
  const first=await a.http(request);assert.equal(first.status,status);const text=await first.text();
  assert.deepEqual(JSON.parse(text),{error:{code,outcome:'NOT_DISPATCHED'}});assert.deepEqual(await receiveRoutinesResponse('prepare',status,text,{request}),JSON.parse(text));
  const row=[...h.pool.rows.values()][0];assert.equal(row.state,'FAILED');assert.deepEqual(row.outcome,{code:stored});
  const ids=h.f.state.ids,claims=h.pool.state.claimed;h.state.refuseCode=null;const replay=await a.http(request);
  assert.equal(replay.status,status);assert.equal(await replay.text(),text);assert.equal(h.f.state.ids,ids);assert.equal(h.pool.state.claimed,claims);assert.equal(h.state.modelCalls,0);
 }finally{h.close();}
});
test('HTTP uncertain failed settlement stays UNKNOWN502 and cannot borrow the definite refusal mapping',async()=>{
 const h=await fixture();try{const a=await h.login();h.state.refuseCode='SCHEDULE_CONTEXT_ACCESS_DENIED';h.pool.state.failFailedSettlement=true;
  const request=h.body('http-uncertain'),response=await a.http(request);assert.equal(response.status,502);const text=await response.text();
  assert.deepEqual(JSON.parse(text),{error:{code:'ROUTINES_UNKNOWN',outcome:'UNKNOWN'}});assert.deepEqual(await receiveRoutinesResponse('prepare',502,text,{request}),JSON.parse(text));assert.equal([...h.pool.rows.values()][0].state,'PENDING');
 }finally{h.close();}
});
