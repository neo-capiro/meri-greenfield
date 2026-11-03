/** Synthetic worker HTTP composition with the canonical retention startup, ledger,
 * journal, suppression owner and read gate. No network, database or model calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {createExecutionSessions} from '../execution-sessions.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {createConversationService} from '../../control/conversations/service.mjs';
import {createConversationLifecycleService,taskControlPage} from '../../control/conversations/lifecycle/service.mjs';
import {composeStartup,subjectOf} from '../../control/retention/test/fixture.mjs';
import {subjectKey} from '../../control/retention/boundary.mjs';
import {binding as originalBinding,scopes as originalScopes,versions,id} from '../../control/conversations/test/store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {MODEL_CATALOG} from '../../../packages/contracts/test/model-selection-fixture.mjs';
import {createTurnTelemetry} from '../telemetry/turn-context.mjs';

// Same opt-in import-only configuration stub used by the existing load fixture.
// The HTTP boundary uses only fault(); configuration/secret access stays forbidden.
if(process.env.MERI_DIAGNOSTIC_IMPORT_STUBS==='1')registerHooks({resolve(specifier,context,next){
 if(specifier==='./config.mjs'&&context.parentURL?.endsWith('/apps/runtime/worker-http.mjs'))return {url:new URL('../../control/conversations/test/load-only-runtime-config-stub.mjs',import.meta.url).href,shortCircuit:true};
 return next(specifier,context);
}});
const {createWorkerRunApplication}=await import('../worker-http.mjs');
const deferred=()=>Promise.withResolvers();

async function fixture(t,{requestMs=2000,executionMs=60000,retention:retentionOverride}={}){
 const f=composeStartup(),subject=subjectOf();await f.startup.start();
 const binding={...originalBinding,tenantId:subject.tenantId,actorId:subject.ownerActorId,conversationId:subject.subjectId};
 const scopes=originalScopes.map(scope=>({...scope,tenantId:binding.tenantId}));
 const counts={task:0,retention:0,release:0,scoped:0,serialized:0,reads:0,journal:0,writes:0,controls:0};
 const state={taskHook:null,taskExpiresAtMs:null,scopedHook:null,serializeHook:null,releaseOptions:null,releaseSubjects:null};
 const attempted=deferred(),scoped=deferred();
 const retention=retentionOverride??{
  async assertServable(value){counts.retention++;return f.startup.gate.assertServable(value);},
  withRelease(subjects,release,options){counts.release++;state.releaseSubjects=subjects;state.releaseOptions=options;attempted.resolve();
   return f.startup.gate.withRelease(subjects,(signal,assertLocked)=>release(signal,async value=>{
    counts.scoped++;scoped.resolve();await state.scopedHook?.();return assertLocked(value);
   }),options);
  },
 };
 const adapters=[];
 const saved={run:{binding,scopes,state:'queued',versions,createdAt:new Date().toISOString(),policyRevision:scopes[0].policyRevision},request:{requestId:id(6),prompt:'Synthetic retained prompt',skill:null,window:null,windowRequest:null,modelSelection:MODEL_CATALOG.defaultSelection},lastSequence:1};
 const unused=()=>assert.fail('unexpected effect');
 const store={readModelPolicy:async()=>({maxTurns:20,maxBudgetMicroUsd:2000000}),accept:unused,append(){counts.writes++;return unused();},async read(){counts.reads++;return structuredClone(saved);},
  lifecycle:{begin:unused,change:unused,get:unused,async controls(){counts.controls++;return [{controlSequence:1,commandSha256:'a'.repeat(64),command:{prompt:'Synthetic steer text'},state:'PENDING'}];},claim:unused,captureSession:unused,readSessionCapture:unused,async execution(){counts.journal++;return {fixtureMarker:'journal-read'};},continuation:unused,cancel:unused,readStopFence:unused,dispatchChild:unused,settleChild:unused}};
 const dispatcher={start:unused,cancel:unused,signal:unused};
 const {versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:'retention'},expiresAtMs:Date.now()+executionMs,runtimeSessionId:'conversation-'+hash(binding)});
 const execution={async authenticate(input){assert.equal(input.credential,'synthetic-task');assert.deepEqual(input.binding,binding);counts.task++;await state.taskHook?.(counts.task);
  return {execution:identity,versions,state:'queued',scopes,selectedClientId:id(5),policyRevision:scopes[0].policyRevision};
 }};
 const createService=({credential,binding})=>{const sessions=createExecutionSessions({execution,credential,binding});adapters.push(sessions);
  const basic=createConversationService({sessions,store,dispatcher,versions,retention,modelCatalog:MODEL_CATALOG,maxRequestMs:requestMs});
  const lifecycle=createConversationLifecycleService({service:basic,store,dispatcher,sessions,retention,maxRequestMs:requestMs,reconcileOriginal:unused,checkpoints:{read:unused}});
  return {async loadForExecution(input){const result=await lifecycle.loadForExecution(input);state.returned=true;
   return {...result,toJSON(){counts.serialized++;state.serializeHook?.();return result;}};
  },async [taskControlPage](input){const result=await lifecycle[taskControlPage](input);state.returned=true;return result;}};
 };
 const configuration={retention:{enabled:true},limits:{requestMs,requestBytes:131072}};
 const lines=[],turnTelemetry=createTurnTelemetry({service:'control',write:line=>lines.push(line)});
 const options={execution,createService,configuration,retention,turnTelemetry};
 const app=createWorkerRunApplication(options);
 const request=(signal,route='load')=>new Request('https://control.synthetic.invalid/internal/conversations/'+route,{method:'POST',headers:{authorization:'Bearer synthetic-task','content-type':'application/json'},body:JSON.stringify({binding}),signal});
 const suppress=()=>f.startup.suppression.suppress({principal:f.principal,subject,reason:'Synthetic retention test'});
 const refusals=()=>lines.map(line=>JSON.parse(line)).filter(line=>line.event==='meri.worker.refusal');
 return {...f,subject,binding,counts,state,adapters,expiresAtMs:identity.expiresAtMs,options,app,request,suppress,refusals,attempted:attempted.promise,scoped:scoped.promise};
}

test('suppression committed during final execution verification withholds the saved load response',{timeout:5000},async t=>{
 const f=await fixture(t);f.state.taskHook=async count=>{if(f.state.returned)await f.suppress();};
 const response=await f.app.handle(f.request()),body=await response.text();
 const projection=(await f.journal.get(subjectKey(f.subject))).state;
 t.diagnostic(JSON.stringify({status:response.status,promptPresent:body.includes('Synthetic retained prompt'),projection,counts:f.counts}));
 assert.equal(projection,'SUPPRESSED');
 assert.equal(response.status,403);
 assert.doesNotMatch(body,/Synthetic retained prompt/);
 assert.equal(f.counts.serialized,0);assert.equal(f.counts.task,6);
 assert.equal(f.counts.retention,4);assert.equal(f.counts.scoped,1);assert.equal(f.counts.writes,0);
 assert.ok(f.adapters.every(s=>!('issue' in s)&&!('revoke' in s)));
});

test('earlier canonical suppression still refuses before loading saved data',{timeout:5000},async t=>{
 const f=await fixture(t);await f.suppress();const response=await f.app.handle(f.request());
 assert.equal(response.status,403);assert.equal(f.counts.reads,0);assert.equal(f.counts.serialized,0);assert.equal(f.counts.release,0);
 assert.ok(f.adapters.every(s=>!('issue' in s)&&!('revoke' in s)));
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
 assert.equal(acknowledged,true);assert.equal(f.counts.task,6);assert.equal(f.counts.retention,4);
 assert.equal(f.counts.release,1);assert.equal(f.counts.scoped,1);assert.equal(f.counts.serialized,1);
 assert.equal(f.counts.reads,2);assert.equal(f.counts.journal,1);assert.equal(f.counts.writes,0);
 assert.deepEqual(f.state.releaseSubjects,[{tenantId:f.binding.tenantId,kind:'conversation',subjectId:f.binding.conversationId}]);
 assert.ok(f.state.releaseOptions.signal instanceof AbortSignal);assert.ok(Number.isSafeInteger(f.state.releaseOptions.deadlineMs));
 assert.ok(f.adapters.every(s=>!('issue' in s)&&!('revoke' in s)));
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
 assert.doesNotMatch(await response.text(),/Synthetic retained prompt/);assert.ok(f.adapters.every(s=>!('issue' in s)&&!('revoke' in s)));
 if(phase==='acquisition'){held.resolve();await holder;}
 await f.suppress(); // Must acquire the same canonical subject lock after failed release.
 held.resolve();await nextTurn();assert.equal(f.counts.serialized,0);
 if(phase==='acquisition')assert.equal(f.counts.scoped,0,'a cancelled waiter never enters the release callback');
 assert.equal((await f.journal.get(subjectKey(f.subject))).state,'SUPPRESSED');
});

test('serialization failure frees the canonical subject lock and has no temporary user session',{timeout:5000},async t=>{
 const f=await fixture(t);f.state.serializeHook=()=>{throw Error('synthetic serialization failure');};
 const response=await f.app.handle(f.request());assert.equal(response.status,403);
 assert.doesNotMatch(await response.text(),/Synthetic retained prompt/);assert.ok(f.adapters.every(s=>!('issue' in s)&&!('revoke' in s)));
 await f.suppress();assert.equal((await f.journal.get(subjectKey(f.subject))).state,'SUPPRESSED');
});

test('the final verified authority expiry bounds release acquisition',{timeout:5000},async t=>{
 const f=await fixture(t,{requestMs:2000,executionMs:150}),held=deferred(),entered=deferred();t.after(()=>held.resolve());
 const holder=f.journal.withTransition(subjectKey(f.subject),async()=>{entered.resolve();await held.promise;});await entered.promise;
 f.state.taskHook=()=>{};
 const response=await f.app.handle(f.request());assert.equal(response.status,408);
 assert.equal(f.state.releaseOptions.deadlineMs,f.expiresAtMs);
 assert.equal(f.counts.scoped,0);assert.equal(f.counts.serialized,0);assert.ok(f.adapters.every(s=>!('issue' in s)&&!('revoke' in s)));
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
 assert.equal(response.status,403);assert.equal(f.counts.serialized,0);assert.ok(f.adapters.every(s=>!('issue' in s)&&!('revoke' in s)));
});

test('a runner control page is released under the same subject fence and withheld when suppression commits during its final verify',{timeout:5000},async t=>{
 const f=await fixture(t),page=await f.app.handle(f.request(undefined,'next-controls'));
 assert.equal(page.status,200);assert.deepEqual((await page.json()).controls.map(c=>c.command.prompt),['Synthetic steer text']);
 assert.deepEqual({task:f.counts.task,controls:f.counts.controls,release:f.counts.release,scoped:f.counts.scoped,reads:f.counts.reads},{task:2,controls:1,release:1,scoped:1,reads:0});
 assert.ok(f.adapters.every(s=>!('issue' in s)&&!('revoke' in s)));
 const g=await fixture(t);g.state.taskHook=async count=>{if(g.state.returned)await g.suppress();};
 const withheld=await g.app.handle(g.request(undefined,'next-controls')),body=await withheld.text();
 assert.equal(withheld.status,403);assert.doesNotMatch(body,/Synthetic steer text/);assert.equal(g.counts.controls,1);
});

// A private worker refusal is one uniform 403 answer for several distinct owners. The
// diagnostic names the operation, the phase and the refusing owner's closed code; it
// never changes the answer, its status or any authority/retention decision.
test('a request-phase refusal names the load operation and the request phase',{timeout:5000},async t=>{
 const f=await fixture(t);
 const refused=await f.app.handle(new Request('https://control.synthetic.invalid/internal/conversations/load',{method:'POST',headers:{authorization:'Bearer synthetic-task','content-type':'text/plain'},body:JSON.stringify({binding:f.binding})}));
 assert.equal(refused.status,403);assert.deepEqual(await refused.json(),{error:{code:'WORKER_REQUEST_REFUSED'}});
 const [refusal]=f.refusals();
 assert.deepEqual({operation:refusal.operation,stage:refusal.stage,code:refusal.code},{operation:'load',stage:'request',code:'WORKER_REQUEST_REFUSED'});
 assert.equal(Object.hasOwn(refusal,'runId'),false,'no binding was parsed, so the line carries no run identity');
 assert.equal(f.counts.task,0);
});

test('a retention refusal inside the conversation load names the service phase and its closed code',{timeout:5000},async t=>{
 const f=await fixture(t);await f.suppress();
 const refused=await f.app.handle(f.request());
 assert.equal(refused.status,403);assert.deepEqual(await refused.json(),{error:{code:'WORKER_REQUEST_REFUSED'}});
 const [refusal]=f.refusals();t.diagnostic(JSON.stringify(refusal));
 assert.equal(refusal.operation,'load');assert.equal(refusal.stage,'service');assert.equal(refusal.code,'RETENTION_SUPPRESSED');
 assert.equal(refusal.runId,f.binding.runId);assert.equal(refusal.attemptId,f.binding.attemptId);assert.equal(refusal.service,'control');
 assert.equal(f.counts.reads,0);assert.equal(f.counts.serialized,0);assert.equal(f.counts.release,0);
});

test('a retention read that did not answer at the release fence stays a 403 and is named as such',{timeout:5000},async t=>{
 const cause=Object.assign(new Error('55P03'),{code:'55P03'});
 const readUnavailable=()=>Object.assign(new Error('RETENTION_READ_UNAVAILABLE'),{code:'RETENTION_READ_UNAVAILABLE',cause});
 const f=await fixture(t,{retention:{async assertServable(){},withRelease(subjects,release,{signal}){return release(signal,async()=>{throw readUnavailable();});}}});
 f.state.returned=true;
 const refused=await f.app.handle(f.request()),body=await refused.text();
 assert.equal(refused.status,403);assert.deepEqual(JSON.parse(body),{error:{code:'WORKER_REQUEST_REFUSED'}});
 const [refusal]=f.refusals();t.diagnostic(JSON.stringify({status:refused.status,refusal}));
 assert.equal(refusal.operation,'load');assert.equal(refusal.stage,'release');assert.equal(refusal.code,'RETENTION_READ_UNAVAILABLE');
 assert.equal(refusal.runId,f.binding.runId);
 assert.equal(f.counts.serialized,0,'the withheld body is never serialized');
});
