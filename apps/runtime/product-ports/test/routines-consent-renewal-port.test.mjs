/** MR-04 renewal port (wire E forwarding): the composed runtime routines feature — createRoutinesFamily -> the real runtime
 * feature -> the REAL Core client — forwards the run's own live session and a cold management session's own bearer in the
 * client's canonical closed shape. Only the external Core transport and the schedule-owned management-preparation SQL domain
 * are scripted; no network, database, provider, model, AWS or browser call. */
import test from 'node:test';import assert from 'node:assert/strict';
import {routinesFamily} from '../routines.mjs';
import {ROUTINE_PATHS} from '../../../control/schedules/application-http.mjs';
import {applicationFixture,routineRequest,binding as ownerBinding,clientId as ownerClientId} from '../../../control/schedules/test/application-fixture.mjs';
import {canonicalSha256 as sha256} from '../../../../packages/contracts/validate.mjs';
import {createActionSessionOwner,routineManagementSessions} from '../../../control/action-host/session/owner.mjs';
import {createNativeIdentityContext} from '../../native-authority/identity-context.mjs';
import {createCoreMembershipGate} from '../../../control/product-access/core-membership.mjs';
import {createRoutinesCoreClient,ROUTINES_CORE_ROUTES} from '../../native-authority/routines-core-client.mjs';
import {coreRoutes,coreSigner,CORE_ORIGIN} from '../../native-authority/test/routines-core-fixture.mjs';
const base={limits:{startupMs:1000,shutdownMs:1000,requestMs:5000,requestBytes:131072},native:{maxResponseBytes:131072}};
const post=(path,body={},credential='synthetic')=>new Request('https://synthetic.invalid'+path,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body)});
const SERVICE_SECRET='synthetic-routines-service-secret';
const RUNTIME_VERSIONS={imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'};
/** Only the schedule-owned management-preparation SQL domain is faked; every other statement reaches the existing fixtures. */
function managementJournal(basePool){
 const rows=new Map(),slot=v=>v.slice(0,4).join('|');
 const journal=(text,values=[])=>{
  if(['BEGIN','COMMIT','ROLLBACK'].includes(text)||text.startsWith('SET LOCAL'))return {rows:[],rowCount:0};
  if(text.startsWith('INSERT INTO meri_schedules.management_preparations(')){const k=slot(values);if(rows.has(k))return {rows:[],rowCount:0};
   rows.set(k,{tenant_id:values[0],actor_id:values[1],scope_sha256:values[2],request_id:values[3],claim_id:values[4],record:values[5],record_sha256:values[6],state:'PENDING',proposal_id:null,outcome:null});return {rows:[],rowCount:1};}
  if(text.startsWith('SELECT tenant_id,actor_id,scope_sha256,request_id,claim_id,record,record_sha256,state,proposal_id,outcome FROM meri_schedules.management_preparations')){
   if(text.includes('proposal_id=$4'))return {rows:[],rowCount:0};
   const found=rows.get(slot(values));return found?{rows:[structuredClone(found)],rowCount:1}:{rows:[],rowCount:0};}
  if(text.startsWith('UPDATE meri_schedules.management_preparations SET state=$5')){const found=rows.get(slot(values));found.state=values[4];found.proposal_id=values[5]??null;found.outcome=values[6]??null;return {rows:[structuredClone(found)],rowCount:1};}
  throw Error('unexpected management journal SQL: '+text);
 };
 return {rows,pool:{async connect(){const client=await basePool.connect();let borrowed=false;return {async query(text,values=[]){
  if(text.includes('meri_schedules.management_preparations')){borrowed=true;return journal(text,values);}
  if(borrowed&&(text==='COMMIT'||text==='ROLLBACK'))return {rows:[],rowCount:0};
  return client.query(text,values);},release(error){client.release(error);}};}}};
}
test('the composed renewal port reaches Core for the run and the cold management session and leaves an invalid 200 unresolved',async()=>{
 const f=await applicationFixture();try{
  const {commandContext,allocationJson,template,workflow,limits}=f.contextConfiguration,principal={tenantId:ownerBinding.tenantId,actorId:ownerBinding.actorId};
  const stamp=()=>({checkedAtMs:f.now(),expiresAtMs:f.now()+60000}),runReceipt=()=>JSON.stringify({binding:ownerBinding,policyRevision:'p1',checkedAtMs:f.now(),deadlineMs:f.now()+60000});
  const identityFetch=async(url,init)=>Response.json(url.endsWith('/membership')?{...principal,status:'active',role:'standard_user',permissions:[],clientIds:[ownerClientId],membershipRevision:'m1',...stamp()}
   :url.endsWith('/identity')?{principal,identityRevision:'i1',...stamp()}
   :{principal,identityRevision:'i1',identitySha256:JSON.parse(init.body).identitySha256,conversationId:ownerBinding.conversationId,selectedClientId:ownerClientId,contextRevision:'c1',...stamp()});
  const identity=createNativeIdentityContext({origin:CORE_ORIGIN,fetchImpl:identityFetch,now:f.now,limits:{maxRequestMs:5000,maxFactBytes:65536},enabled:true,
   admitInitialConversation:async()=>runReceipt(),currentOwner:{async currentRun(){return runReceipt();}}});
  const gate=createCoreMembershipGate({origin:CORE_ORIGIN,identityContext:identity,fetchImpl:identityFetch,now:f.now,limits:{maxRequestMs:5000,maxFactBytes:65536}});
  const core={requests:[],serviceSecret:SERVICE_SECRET,bearer:'synthetic-native',principal,signer:coreSigner(),coreNow:f.now,
   membership:()=>({tenantId:principal.tenantId,actorId:principal.actorId,clientIds:[ownerClientId],expiresAtMs:f.now()+60000}),rewrite:null};
  const policyWire=coreRoutes(core),sent={renewals:[],current:[]},answer={value:null};
  const externalFetch=async(url,init)=>{
   if(url===CORE_ORIGIN+ROUTINES_CORE_ROUTES.consentRenewal){sent.renewals.push({authorization:init.headers.authorization,body:JSON.parse(init.body)});return Response.json(answer.value);}
   if(url===CORE_ORIGIN+ROUTINES_CORE_ROUTES.managementCurrent){const body=JSON.parse(init.body),selected=body.clientId;
    const current={kind:'routine-management',principal,scopes:[{kind:selected===null?'private-user':'client',tenantId:principal.tenantId,resourceId:selected??principal.actorId,policyRevision:body.policyRevision}],selectedClientId:selected,membershipRevision:'a'.repeat(64)};
    sent.current.push(body);return Response.json({...current,contextRevision:sha256(current),checkedAtMs:f.now(),expiresAtMs:f.now()+30000});}
   if(url===CORE_ORIGIN+ROUTINES_CORE_ROUTES.managementPolicy){const body=JSON.parse(init.body);
    return Response.json({authorized:true,selectionSha256:body.selectionSha256,current:body.selection.current,destinationResolution:null,limits:null,checkedAtMs:f.now(),expiresAtMs:f.now()+30000});}
   return policyWire(url,init);
  };
  // The management session owner is installed over the REAL Core current wire, exactly as production wires it, so the composed
  // feature's own management context and management relay resolve the live bearer from these sessions alone.
  const management={owner:null};
  const wire=createRoutinesCoreClient({origin:CORE_ORIGIN,now:f.now,maxRequestMs:5000,getServiceSecret:async()=>SERVICE_SECRET,
   managementCredentials:{nativeCredentialFor:value=>management.owner.nativeCredentialFor(value)},fetchImpl:externalFetch});
  const sessions=createActionSessionOwner({mode:'process-local',verifyIdentity:identity.verifyIdentity,resolveContext:identity.resolveContext,membership:{admit:gate.admit,recheck:gate.recheck},now:f.now,
   refusals:()=>{},limits:{maxSessions:4,maxRequestMs:5000,maxTtlMs:60000,maxFactBytes:65536},management:{readCurrent:wire.managementCurrent,versions:RUNTIME_VERSIONS,policyRevision:'p1'}});
  management.owner=routineManagementSessions(sessions);
  const session=await sessions.issue({identityCredential:'synthetic-native',hints:{conversationId:ownerBinding.conversationId,clientId:ownerClientId},deadlineMs:f.now()+5000});
  // The cold management session names the schedule's own client, so its current authority anchors the client scope the
  // intent holds; a General (private-user) current is not a member of that set and the journal refuses pre-INSERT.
  const cold=await management.owner.issue({identityCredential:'synthetic-native',clientId:ownerClientId});
  const journal=managementJournal(f.pool),client={...f.client,workflow:{...f.client.workflow,start(){throw Error('unexpected workflow start');}},connection:{withDeadline:(deadline,fn)=>fn(),withAbortSignal:(signal,fn)=>fn()}};
  const family=routinesFamily({context:{commandContext,allocationJson,template,workflow,limits},newId:f.newId,retirement:{async retire(){return {physicalStopProven:true};}}},{fetchImpl:externalFetch,readSecret:async()=>Buffer.from(SERVICE_SECRET)});
  const {ports}=family({configuration:{...base,agentcore:{policyRevision:'p1'},temporal:{taskQueue:'meri-conversations'},routines:{enabled:true,core:{origin:CORE_ORIGIN,serviceSecretFile:'/run/meri/routines-service-secret',cancellationProof:core.signer.pin}}},pool:journal.pool,client,now:f.now});
  const app=ports.routinesApplicationFactory.create({sessions,retention:{async assertServable(){}}});
  const request={...routineRequest(),destinationReference:'meri-inbox'};
  const prepared=await (await app.handle(post(ROUTINE_PATHS.prepare,{requestId:'renewal-port-prepare',operation:'schedule_task',request},session.credential))).json();
  assert.equal(prepared.status,'approval_required');
  const approved=await (await app.handle(post(ROUTINE_PATHS.approve,{operation:'schedule_task',request,proposalId:prepared.proposal.proposalId,intentSha256:prepared.proposal.intentSha256,decision:'approved'},session.credential))).json();
  assert.equal(approved.status,'acknowledged');
  const scheduleId=approved.receipt.projection.scheduleId;
  const renewal=generation=>{answer.value={schemaVersion:1,state:'active',generation,policyRevision:'p1',issuedAtMs:f.now()-1000,expiresAtMs:f.now()+3600000,observedAtMs:f.now(),idempotent:false};};
  const review=await (await app.handle(post(ROUTINE_PATHS.consentReview,{scheduleId},session.credential))).json();
  assert.equal(review.status,'review_required');
  // 1. the run's own session: the trusted forwarding reaches the canonical closed client shape and Core's wire E.
  renewal(review.generation);
  const renewed=await app.handle(post(ROUTINE_PATHS.consentApprove,{scheduleId,reviewSha256:review.reviewSha256,requestId:'renewal-port-run',decision:'approved'},session.credential));
  assert.equal(renewed.status,200,JSON.stringify(await renewed.clone().json()));
  assert.equal((await renewed.json()).status,'renewed');
  assert.equal(sent.renewals.length,1,'the run branch reached Core exactly once');
  assert.equal(sent.renewals[0].authorization,'Bearer synthetic-native',"the run owner's own live bearer");
  assert.equal(sent.renewals[0].body.schemaVersion,1);assert.equal(sent.renewals[0].body.selection.operation,'schedule_task');
  assert.equal([...journal.rows.values()].find(r=>r.request_id==='renewal-port-run').state,'PREPARED');
  // 2. a cold management session: that session's own live bearer, resolved by the same session owner.
  const reviewManagement=await (await app.handle(post(ROUTINE_PATHS.consentReview,{scheduleId},cold.credential))).json();
  assert.equal(reviewManagement.status,'review_required');
  renewal(reviewManagement.generation);
  const renewedManagement=await app.handle(post(ROUTINE_PATHS.consentApprove,{scheduleId,reviewSha256:reviewManagement.reviewSha256,requestId:'renewal-port-management',decision:'approved'},cold.credential));
  assert.equal(renewedManagement.status,200,JSON.stringify(await renewedManagement.clone().json()));
  assert.equal(sent.renewals.length,2,'the management branch reached Core exactly once');
  assert.equal(sent.renewals[1].authorization,'Bearer synthetic-native',"the management session's own live bearer");
  assert.ok(sent.current.length>=1,'the management session re-read its current authority from Core');
  // 3. a post-200 invalid reply: the durable slot stays PENDING (UNKNOWN), one attempt only, and an identical retry at a later
  // clock re-presents the FIRST stored decision byte for byte.
  const reviewInvalid=await (await app.handle(post(ROUTINE_PATHS.consentReview,{scheduleId},session.credential))).json();
  answer.value={...answer.value,state:'active',observedAtMs:f.now(),expiresAtMs:f.now()-1000};
  const before=sent.renewals.length;
  const unresolved=await app.handle(post(ROUTINE_PATHS.consentApprove,{scheduleId,reviewSha256:reviewInvalid.reviewSha256,requestId:'renewal-port-invalid',decision:'approved'},session.credential));
  assert.notEqual(unresolved.status,200);
  assert.equal(sent.renewals.length,before+1,'one attempt only: no automatic retry');
  assert.equal([...journal.rows.values()].find(r=>r.request_id==='renewal-port-invalid').state,'PENDING','an undecided Core answer never settles FAILED');
  const firstAttempt=sent.renewals[before].body.selection.scheduleBinding;
  f.state.now+=1000;
  await app.handle(post(ROUTINE_PATHS.consentApprove,{scheduleId,reviewSha256:reviewInvalid.reviewSha256,requestId:'renewal-port-invalid',decision:'approved'},session.credential));
  assert.equal(sent.renewals.length,before+2);
  // The durable row's OWN decision bytes are re-presented; the per-dispatch deadline is the only value the clock moves.
  const retry=sent.renewals[before+1].body.selection.scheduleBinding;
  assert.notEqual(retry.deadlineMs,firstAttempt.deadlineMs,'the retry ran at a later clock');
  assert.deepEqual(retry.intent,firstAttempt.intent,'the stored intent bytes are re-presented');
  assert.deepEqual(retry.approval,firstAttempt.approval,'the first stored approval is re-presented byte for byte, never re-minted');
  assert.deepEqual(retry.callerIdentity,firstAttempt.callerIdentity);
  // 4. a retired session is refused before Core and leaves no claim at all.
  sessions.close();
  const denied=await app.handle(post(ROUTINE_PATHS.consentApprove,{scheduleId,reviewSha256:reviewInvalid.reviewSha256,requestId:'renewal-port-retired',decision:'approved'},session.credential));
  assert.notEqual(denied.status,200);
  assert.equal(sent.renewals.length,before+2,'a retired session dispatches nothing');
  assert.equal([...journal.rows.values()].some(r=>r.request_id==='renewal-port-retired'),false,'no slot was claimed');
 }finally{await f.close();}
});
