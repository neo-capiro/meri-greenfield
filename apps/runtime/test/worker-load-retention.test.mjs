/** Synthetic worker HTTP composition with the canonical retention startup, ledger,
 * journal, suppression owner and read gate. No network, database or model calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {createActionSessionOwner} from '../../control/action-host/session/owner.mjs';
import {createConversationService} from '../../control/conversations/service.mjs';
import {createConversationLifecycleService} from '../../control/conversations/lifecycle/service.mjs';
import {composeStartup,subjectOf} from '../../control/retention/test/fixture.mjs';
import {subjectKey} from '../../control/retention/boundary.mjs';
import {binding as originalBinding,scopes as originalScopes,versions,id} from '../../control/conversations/test/store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';

// Same opt-in import-only configuration stub used by the existing load fixture.
// The HTTP boundary uses only fault(); configuration/secret access stays forbidden.
if(process.env.MERI_DIAGNOSTIC_IMPORT_STUBS==='1')registerHooks({resolve(specifier,context,next){
 if(specifier==='./config.mjs'&&context.parentURL?.endsWith('/apps/runtime/worker-http.mjs'))return {url:new URL('../../control/conversations/test/load-only-runtime-config-stub.mjs',import.meta.url).href,shortCircuit:true};
 return next(specifier,context);
}});
const {createWorkerRunApplication}=await import('../worker-http.mjs');
const deferred=()=>Promise.withResolvers();

async function fixture(t,{requestMs=2000}={}){
 const f=composeStartup(),subject=subjectOf();await f.startup.start();
 const binding={...originalBinding,tenantId:subject.tenantId,actorId:subject.ownerActorId,conversationId:subject.subjectId};
 const scopes=originalScopes.map(scope=>({...scope,tenantId:binding.tenantId}));
 const counts={task:0,retention:0,release:0,scoped:0,serialized:0,reads:0,journal:0,writes:0};
 const state={taskHook:null,taskExpiresAtMs:null,scopedHook:null,serializeHook:null,releaseOptions:null,releaseSubjects:null};
 const attempted=deferred(),scoped=deferred();
 const retention={
  async assertServable(value){counts.retention++;return f.startup.gate.assertServable(value);},
  withRelease(subjects,release,options){counts.release++;state.releaseSubjects=subjects;state.releaseOptions=options;attempted.resolve();
   return f.startup.gate.withRelease(subjects,(signal,assertLocked)=>release(signal,async value=>{
    counts.scoped++;scoped.resolve();await state.scopedHook?.();return assertLocked(value);
   }),options);
  },
 };
 const principal={tenantId:binding.tenantId,actorId:binding.actorId,role:'standard_user',permissions:[],clientIds:[id(5)],membershipRevision:'member'};
 const sessions=createActionSessionOwner({mode:'process-local',now:Date.now,limits:{maxSessions:4,maxRequestMs:requestMs,maxTtlMs:60000,maxFactBytes:65536},
  verifyIdentity(){const at=Date.now();return {principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'identity',checkedAtMs:at,expiresAtMs:at+60000};},
  resolveContext({identity}){const at=Date.now();return {identitySha256:hash(identity),binding,scopes,selectedClientId:id(5),contextRevision:'context',checkedAtMs:at,expiresAtMs:at+60000};},
  membership:{admit:()=>({principal,expiresAtMs:Date.now()+60000}),recheck:()=>principal},
 });
 t.after(()=>sessions.close());
 const saved={run:{binding,scopes,state:'queued',versions,createdAt:new Date().toISOString(),policyRevision:scopes[0].policyRevision},request:{requestId:id(6),prompt:'Synthetic retained prompt',skill:null,window:null,windowRequest:null},lastSequence:1};
 const unused=()=>assert.fail('unexpected effect');
 const store={accept:unused,append(){counts.writes++;return unused();},async read(){counts.reads++;return structuredClone(saved);},
  lifecycle:{begin:unused,change:unused,get:unused,controls:unused,claim:unused,checkpoint:unused,readCheckpoint:unused,async execution(){counts.journal++;return {fixtureMarker:'journal-read'};},continuation:unused,cancel:unused,readStopFence:unused}};
 const dispatcher={start:unused,cancel:unused,signal:unused};
 const basic=createConversationService({sessions,store,dispatcher,versions,retention,maxRequestMs:requestMs});
 const lifecycle=createConversationLifecycleService({service:basic,store,dispatcher,sessions,maxRequestMs:requestMs,reconcileOriginal:unused,checkpoints:{read:unused}});
 const service={async loadForExecution(input){const result=await lifecycle.loadForExecution(input);
  // A trusted fixture hook observes the actual Response.json materialization point.
  return {...result,toJSON(){counts.serialized++;state.serializeHook?.();return result;}};
 }};
 const native={async call(operation,input){assert.equal(operation,'worker/authorize');counts.task++;await state.taskHook?.(counts.task);
  const at=Date.now();return {binding,operation:input.operation,inputSha256:input.inputSha256,identityCredential:'synthetic-native',scopes,selectedClientId:id(5),policyRevision:scopes[0].policyRevision,authorizationDecisionId:'synthetic-decision',checkedAtMs:at,expiresAtMs:state.taskExpiresAtMs??at+60000};
 }};
 const configuration={retention:{enabled:true},limits:{requestMs,requestBytes:131072}};
 const options={service,sessions,native,configuration,retention};
 const app=createWorkerRunApplication(options);
 const request=signal=>new Request('https://control.synthetic.invalid/internal/conversations/load',{method:'POST',headers:{authorization:'Bearer synthetic-task','content-type':'application/json'},body:JSON.stringify({binding}),signal});
 const suppress=()=>f.startup.suppression.suppress({principal:f.principal,subject,reason:'Synthetic retention test'});
 return {...f,subject,binding,counts,state,sessions,options,app,request,suppress,attempted:attempted.promise,scoped:scoped.promise};
}

test('suppression committed during final task verification withholds the saved load response',{timeout:5000},async t=>{
 const f=await fixture(t);f.state.taskHook=async count=>{if(count===3)await f.suppress();};
 const response=await f.app.handle(f.request()),body=await response.text();
 const projection=(await f.journal.get(subjectKey(f.subject))).state;
 t.diagnostic(JSON.stringify({status:response.status,promptPresent:body.includes('Synthetic retained prompt'),projection,counts:f.counts}));
 assert.equal(projection,'SUPPRESSED');
 assert.equal(response.status,403);
 assert.doesNotMatch(body,/Synthetic retained prompt/);
 assert.equal(f.counts.serialized,0);assert.equal(f.counts.task,3);
 assert.equal(f.counts.retention,4);assert.equal(f.counts.scoped,1);assert.equal(f.counts.writes,0);
 assert.equal(f.sessions.status().sessions,0);
});

test('earlier canonical suppression still refuses before loading saved data',{timeout:5000},async t=>{
 const f=await fixture(t);await f.suppress();const response=await f.app.handle(f.request());
 assert.equal(response.status,403);assert.equal(f.counts.reads,0);assert.equal(f.counts.serialized,0);assert.equal(f.counts.release,0);
 assert.equal(f.sessions.status().sessions,0);
});

test('successful load serializes under its authenticated subject release fence',{timeout:5000},async t=>{
 const f=await fixture(t);let acknowledged=false,suppression;
 f.state.scopedHook=async()=>{
  suppression=f.suppress().then(()=>{acknowledged=true;});
  await nextTurn();assert.equal(acknowledged,false);assert.equal(f.sink.size(),0);
 };
 f.state.serializeHook=()=>assert.equal(acknowledged,false,'serialization precedes the waiting suppression acknowledgement');
 const response=await f.app.handle(f.request());assert.equal(response.status,200);
 assert.equal((await response.json()).request.prompt,'Synthetic retained prompt');await suppression;
 assert.equal(acknowledged,true);assert.equal(f.counts.task,3);assert.equal(f.counts.retention,4);
 assert.equal(f.counts.release,1);assert.equal(f.counts.scoped,1);assert.equal(f.counts.serialized,1);
 assert.equal(f.counts.reads,2);assert.equal(f.counts.journal,1);assert.equal(f.counts.writes,0);
 assert.deepEqual(f.state.releaseSubjects,[{tenantId:f.binding.tenantId,kind:'conversation',subjectId:f.binding.conversationId}]);
 assert.ok(f.state.releaseOptions.signal instanceof AbortSignal);assert.ok(Number.isSafeInteger(f.state.releaseOptions.deadlineMs));
 assert.equal(f.sessions.status().sessions,0);
});

for(const phase of ['acquisition','scoped read'])for(const reason of ['cancel','deadline'])test(`${reason} during release ${phase} frees locks and prevents late serialization`,{timeout:5000},async t=>{
 const f=await fixture(t,{requestMs:reason==='deadline'?200:2000}),abort=new AbortController(),held=deferred(),entered=deferred();
 t.after(()=>held.resolve());let holder;
 if(phase==='acquisition'){
  holder=f.journal.withTransition(subjectKey(f.subject),async()=>{entered.resolve();await held.promise;});await entered.promise;
 }else f.state.scopedHook=async()=>{entered.resolve();await held.promise;};
 const pending=f.app.handle(f.request(abort.signal));await (phase==='acquisition'?f.attempted:entered.promise);
 if(reason==='cancel')abort.abort();
 const response=await pending;assert.equal(response.status,408);assert.equal(f.counts.serialized,0);
 assert.doesNotMatch(await response.text(),/Synthetic retained prompt/);assert.equal(f.sessions.status().sessions,0);
 if(phase==='acquisition'){held.resolve();await holder;}
 await f.suppress(); // Must acquire the same canonical subject lock after failed release.
 held.resolve();await nextTurn();assert.equal(f.counts.serialized,0);
 if(phase==='acquisition')assert.equal(f.counts.scoped,0,'a cancelled waiter never enters the release callback');
 assert.equal((await f.journal.get(subjectKey(f.subject))).state,'SUPPRESSED');
});

test('serialization failure frees the canonical subject lock and revokes the temporary session',{timeout:5000},async t=>{
 const f=await fixture(t);f.state.serializeHook=()=>{throw Error('synthetic serialization failure');};
 const response=await f.app.handle(f.request());assert.equal(response.status,403);
 assert.doesNotMatch(await response.text(),/Synthetic retained prompt/);assert.equal(f.sessions.status().sessions,0);
 await f.suppress();assert.equal((await f.journal.get(subjectKey(f.subject))).state,'SUPPRESSED');
});

test('the final verified authority expiry bounds release acquisition',{timeout:5000},async t=>{
 const f=await fixture(t),held=deferred(),entered=deferred();t.after(()=>held.resolve());
 const holder=f.journal.withTransition(subjectKey(f.subject),async()=>{entered.resolve();await held.promise;});await entered.promise;
 f.state.taskHook=count=>{if(count===3)f.state.taskExpiresAtMs=Date.now()+75;};
 const response=await f.app.handle(f.request());assert.equal(response.status,408);
 assert.equal(f.state.releaseOptions.deadlineMs,f.state.taskExpiresAtMs);
 assert.equal(f.counts.scoped,0);assert.equal(f.counts.serialized,0);assert.equal(f.sessions.status().sessions,0);
 held.resolve();await holder;await f.suppress();assert.equal((await f.journal.get(subjectKey(f.subject))).state,'SUPPRESSED');
});

test('declared retention requires a release gate and supplied malformed ports fail closed',async t=>{
 const f=await fixture(t);
 for(const retention of [undefined,null,{}, {withRelease:null}, {withRelease:false}])assert.throws(()=>createWorkerRunApplication({...f.options,retention}),/RETENTION|CONFIGURATION/);
 const undeclared={limits:f.options.configuration.limits};
 assert.doesNotThrow(()=>createWorkerRunApplication({...f.options,configuration:undeclared,retention:undefined}));
 for(const retention of [null,{}, {withRelease:null}])assert.throws(()=>createWorkerRunApplication({...f.options,configuration:undeclared,retention}),/RETENTION|CONFIGURATION/);
});

test('a gate without its scoped assertion cannot serialize load data',async t=>{
 const f=await fixture(t),retention={withRelease:(_subjects,release,{signal})=>release(signal)};
 const app=createWorkerRunApplication({...f.options,retention}),response=await app.handle(f.request());
 assert.equal(response.status,403);assert.equal(f.counts.serialized,0);assert.equal(f.sessions.status().sessions,0);
});
