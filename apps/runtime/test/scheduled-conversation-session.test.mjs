/** Actual admission, history, native identity, action session and lifecycle Stop; SQL/Core/Temporal are protocol fixtures. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduledAdmissionFixture} from '../native-authority/test/scheduled-admission-fixture.mjs';
import {createConversationIdentity} from '../conversation-identity.mjs';
import {createCoreMembershipGate} from '../../control/product-access/core-membership.mjs';
import {createCoreConversationCurrentness} from '../native-authority/conversation-currentness.mjs';
import {createActionSessionOwner} from '../../control/action-host/session/owner.mjs';
import {createInitialRunBindingJournal} from '../../control/conversations/initial-run-binding-journal.mjs';
import {createNextRunOwner} from '../../control/conversations/next-run.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {createConversationService} from '../../control/conversations/service.mjs';
import {createConversationLifecycleService} from '../../control/conversations/lifecycle/service.mjs';
import {createConversationHistoryService} from '../../control/conversations/history/service.mjs';
import {createConversationHistoryApplication} from '../../control/conversations/history/http.mjs';
import {createScheduledConversationCurrentness} from '../../control/schedules/scheduled-conversation-currentness.mjs';
import {MODEL_CATALOG} from '../../../packages/contracts/test/model-selection-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {id} from '../../control/conversations/test/store-fixture.mjs';

async function fixture(t,{general=false}={}){
 const h=await scheduledAdmissionFixture({agentcore:true,general});await h.adapter.admit(h.request);
 const state={revoked:false,actor:h.template.principal.actorId,clients:general?[]:[h.template.selectedClientId],calls:[],cancelled:[],reconciled:[],originHook:null},limits={maxRequestMs:3000,maxFactBytes:131072};
 const originalScheduleConnect=h.scheduleSql.pool.connect;
 h.scheduleSql.pool.connect=async()=>{const c=await originalScheduleConnect();return {...c,async query(sql,args=[]){
  if(sql.includes("effect->'binding'->>'conversationId'")){await state.originHook?.();return {rows:structuredClone([...h.scheduleSql.state.occurrences.values()].filter(r=>r.tenant_id===args[0]&&r.effect.binding.conversationId===args[1]))};}
  return c.query(sql,args);
 }};};
 const pool={async connect(){const c=await h.pool.connect();return {...c,async query(sql,args=[]){
  if(sql.startsWith('SELECT * FROM meri_conversations.conversations WHERE tenant_id=$1 AND owner_actor_id=$2'))return {rows:[...h.conversations.state.conversations.values()].filter(r=>r.tenant_id===args[0]&&r.owner_actor_id===args[1]&&r.projection.scopes.every(s=>s.kind!=='client'||args[2].includes(s.resourceId)))};
  if(sql.startsWith('SELECT e.*')){const rows=[];for(const r of h.conversations.state.runs.values())if(r.tenant_id===args[0]&&r.conversation_id===args[1])for(const e of h.conversations.state.events.get([r.tenant_id,r.conversation_id,r.run_id].join(':'))??[])rows.push({...e,tenant_id:r.tenant_id,conversation_id:r.conversation_id,run_id:r.run_id,global:r.sequence_base+e.sequence});return {rows:rows.sort((a,b)=>a.global-b.global).filter(e=>e.global>args[2]).slice(0,args[3])};}
  return c.query(sql,args);
 }};}};
 const store=createPostgresConversationStore({pool,now:h.now,modelCatalog:MODEL_CATALOG,assertConversationActive(){assert.fail('Scheduled reopening must never reserve or submit an ordinary turn');}});
 const fetchImpl=async(url,options)=>{
  const path=new URL(url).pathname;state.calls.push(path);assert.equal(options.headers.authorization,'Bearer native');
  if(state.revoked)return Response.json({error:'denied'},{status:403});
  const times={checkedAtMs:h.now(),expiresAtMs:h.now()+120000},principal={...h.template.principal,actorId:state.actor};
  if(path.endsWith('/identity'))return Response.json({principal,identityRevision:'a'.repeat(64),...times});
  if(path.endsWith('/membership'))return Response.json({...principal,status:'active',role:'standard_user',permissions:[],clientIds:state.clients,membershipRevision:'b'.repeat(64),...times});
  return Response.json({error:'No ordinary Core conversation exists'},{status:403});
 };
 const native=createConversationIdentity({store,identity:{origin:'https://core.synthetic.invalid',fetchImpl},qualification:{policyRevision:h.template.policyRevision},now:h.now,limits,
  nextRunOwner:createNextRunOwner({store,versions:h.template.versions,now:h.now}),initialBindings:createInitialRunBindingJournal({pool}),configurationSha256:h.template.configurationSha256,versions:h.template.versions,
  proposeInitialExpiry:()=>h.now()+60000,factWindowMs:60000,scheduleOwner:h.scheduleOwner});
 const gate=createCoreMembershipGate({origin:'https://core.synthetic.invalid',fetchImpl,identityContext:native,now:h.now,limits});
 const sessions=createActionSessionOwner({mode:'process-local',now:h.now,verifyIdentity:native.verifyIdentity,resolveContext:native.resolveContext,withAuthority:native.withAuthority,membership:{admit:gate.admit,recheck:gate.recheck},limits:{...limits,maxSessions:20,maxTtlMs:60000},refusals:()=>{}});t.after(()=>sessions.close());
 const dispatcher={async start(){assert.fail('No new dispatch on reopening');},async signal(){},async cancel({binding}){state.cancelled.push(binding);}},basic=createConversationService({sessions,store,dispatcher,versions:h.template.versions,modelCatalog:MODEL_CATALOG,now:h.now});
 const service=createConversationLifecycleService({service:basic,sessions,store,dispatcher,retention:null,now:h.now,async reconcileOriginal({binding}){state.reconciled.push(binding);}});
 const currentness=createScheduledConversationCurrentness({scheduleOwner:h.scheduleOwner,gate,core:{assertCurrent(){assert.fail('Positive custody must not call ordinary Core current');}},now:h.now});
 const history=createConversationHistoryApplication({service:createConversationHistoryService({store,gate,nextRunOwner:{admitTurn(){assert.fail('Ordinary authority must refuse before checking settlement or reserving a new turn');}}}),gate,currentness,
  turnCurrentness:createCoreConversationCurrentness({origin:'https://core.synthetic.invalid',fetchImpl,now:h.now,limits}),now:h.now,limits:{maxRequestMs:3000,maxRequestBytes:131072,maxResponseBytes:2097152}});
 const list=()=>history.handle(new Request('https://meri.invalid/api/conversations/list',{method:'POST',headers:{authorization:'Bearer native','content-type':'application/json'},body:'{}'}));
 const issue=(hints={})=>sessions.issue({identityCredential:'native',hints:{conversationId:h.identity.binding.conversationId,clientId:h.template.selectedClientId,...hints}});
 let sequence=900;const status=state=>store.append(h.identity.binding,{eventId:id(sequence++),createdAt:new Date(h.now()).toISOString(),type:'run.status',data:{state,reasonCode:null}},()=>{});
 const nextTurn=()=>history.handle(new Request('https://meri.invalid/api/conversations/next-turn',{method:'POST',headers:{authorization:'Bearer native','content-type':'application/json'},body:JSON.stringify({conversationId:h.identity.binding.conversationId,sourceRunId:h.identity.binding.runId})}));
 return {...h,originalStore:h.store,store,native,gate,sessions,service,basic,state,list,issue,status,nextTurn};
}

for(const general of [false,true]){
 test(`${general?'General':'client'} scheduled discovery opens the exact admitted run and existing Stop fences it`,async t=>{
  const h=await fixture(t,{general});await h.status('starting');await h.status('running');
  const page=await h.list();assert.equal(page.status,200);const rows=(await page.json()).conversations;assert.equal(rows.length,1);assert.equal(rows[0].conversationId,h.identity.binding.conversationId);
  const session=await h.issue({conversationId:rows[0].conversationId});assert.equal(session.context.runId,h.identity.binding.runId);
  const stopped=await h.service.cancel({credential:session.credential});assert.deepEqual(stopped,{state:'cancelled'});
  await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(h.state.cancelled,[h.identity.binding]);assert.deepEqual(h.state.reconciled,[h.identity.binding]);
  assert.equal((await h.store.read(h.identity.binding,{},()=>{})).run.state,'cancelled');assert.equal(h.conversations.state.runs.size,1);assert.equal(h.conversations.state.nextRuns.size,0);
  assert.ok(h.state.calls.every(p=>p.endsWith('/identity')||p.endsWith('/membership')));
 });
 test(`${general?'General':'client'} fresh completed opening without runId retains the admitted run and creates no next turn`,async t=>{
  const h=await fixture(t,{general});await h.status('starting');await h.status('running');await h.status('completed');
  const session=await h.issue();assert.equal(session.context.runId,h.identity.binding.runId);
  await h.sessions.authenticateSession({credential:session.credential});assert.equal(h.conversations.state.runs.size,1);assert.equal(h.conversations.state.nextRuns.size,0);
  await assert.rejects(h.basic.submit({credential:session.credential,input:{requestId:id(998),prompt:'An unapproved new ordinary prompt'}}));
  const turn=await h.nextTurn();assert.notEqual(turn.status,200);assert.equal((await turn.json()).error.outcome,'NOT_DISPATCHED');assert.ok(h.state.calls.some(p=>p.endsWith('/current')));
  assert.equal(h.conversations.state.runs.size,1);assert.equal(h.conversations.state.nextRuns.size,0);
  await assert.rejects(h.issue({runId:id(999)}));assert.equal(h.conversations.state.nextRuns.size,0);
 });
 test(`${general?'General':'client'} current membership and owner denials cannot open or stop a scheduled run`,async t=>{
  const h=await fixture(t,{general});await h.status('starting');await h.status('running');const session=await h.issue();
  h.state.revoked=true;await assert.rejects(h.service.cancel({credential:session.credential}));await assert.rejects(h.issue());
  h.state.revoked=false;h.state.actor='foreign';await assert.rejects(h.issue());
  h.state.actor=h.template.principal.actorId;if(!general){h.state.clients=[];await assert.rejects(h.issue());}
  assert.equal((await h.store.read(h.identity.binding,{},()=>{})).run.state,'running');assert.equal(h.state.cancelled.length,0);assert.equal(h.conversations.state.nextRuns.size,0);
 });
}

test('an existing pending ordinary reservation cannot replace the scheduled admitted run',async t=>{
 const h=await fixture(t);await h.status('failed');
 const ordinary=createNextRunOwner({store:h.originalStore,versions:h.template.versions,now:h.now});
 const pending=await ordinary.selectRun({principal:h.template.principal,conversationId:h.identity.binding.conversationId});assert.equal(pending.reserved,true);
 for(const hints of [{},{runId:h.identity.binding.runId},{runId:pending.binding.runId}])await assert.rejects(h.issue(hints));
 assert.equal(h.conversations.state.runs.size,1);assert.equal(h.conversations.state.nextRuns.size,1);assert.equal(h.state.cancelled.length,0);
});

test('missing, corrupt and changing occurrence custody never becomes a new conversation or fallback permission',async t=>{
 for(const mode of ['absent','corrupt','drift']){
  const h=await fixture(t);const row=[...h.scheduleSql.state.occurrences.values()][0];
  if(mode==='absent')h.scheduleSql.state.occurrences.clear();
  if(mode==='corrupt')row.effect_sha256='0'.repeat(64);
  if(mode==='drift'){let reads=0;h.state.originHook=()=>{if(++reads===3)row.state='REFUSED';};}
  await assert.rejects(h.issue());assert.equal(h.conversations.state.runs.size,1);assert.equal(h.conversations.state.nextRuns.size,0);
  assert.equal(h.state.calls.some(p=>p.endsWith('/current')),mode==='absent');
 }
});
