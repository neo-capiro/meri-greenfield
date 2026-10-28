/**
 * Wave5 MO01/ST16 — the REAL procedure-resolve production join.
 *
 * Every boundary is the real module: the closed request admission (packages/contracts/runtime-0.2/validate.mjs), the
 * worker run-owner HTTP application, the current-execution authentication, the retention serving lock, the control
 * conversations service procedureResolve(), the injected procedure admission port and the attended Core client. Only
 * the Core HTTP boundary (fetchImpl) and the scripted session/store are synthetic: no model, provider, network or
 * database is used. This is the join the previous scripted caller tests bypassed.
 *
 * The workspace package link and the run-owner runtime configuration are resolved through the same hooks the
 * neighbouring worker tests use; nothing is installed, and no dependency cache is touched.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const HERE=new URL('.',import.meta.url);
registerHooks({resolve(specifier,context,next){
 if(specifier==='@capiro/meri-contracts/node')return {url:new URL('../../../../../packages/contracts/validate.mjs',HERE).href,shortCircuit:true};
 if(specifier==='./config.mjs'&&context.parentURL?.endsWith('/apps/runtime/worker-http.mjs'))return {url:new URL('../../test/load-only-runtime-config-stub.mjs',HERE).href,shortCircuit:true};
 return next(specifier,context);}});
const [{applicationFixture,binding,scopes,versions,id},{canonicalSha256},contracts,{createExecutionBinding},{createCoreProcedureAdmission},{PROCEDURE_RUNTIME_ROUTE},{PROCEDURE_RESOLVE_OPERATION},{createWorkerRunApplication}]=await Promise.all([
 import('../../test/application-fixture.mjs'),import('../../../../../packages/contracts/validate.mjs'),
 import('../../../../../packages/contracts/runtime-0.2/validate.mjs'),import('../../execution-boundary.mjs'),
 import('../../../../runtime/native-authority/procedure-admission.mjs'),import('../core-client.mjs'),
 import('../../../../worker/conversation/procedures/task-port.mjs'),import('../../../../runtime/worker-http.mjs')]);

const NOW=Date.now(),CLIENT_ID=id(5),SECRET='svc-secret-value';
const builtin=name=>({source:'builtin',id:name,version:1,manifestDigest:canonicalSha256({id:name,version:1})});
const firm={source:'firm',recordId:id(77),version:4,manifestDigest:canonicalSha256({firm:id(77),version:4})};
const admissionFor=(selection,over={})=>({version:1,tenantId:binding.tenantId,manifestDigest:selection.manifestDigest,
 identity:selection.source==='firm'?{source:'firm',id:selection.recordId,canonicalId:id(78),version:selection.version}:{source:'builtin',id:selection.id,canonicalId:selection.id,version:selection.version},
 instruction:'Open with the decision the record needs.',purpose:'Prepare a hearing brief.',scopes:['general'],evidencePrerequisites:['client documents'],
 scope:'client',clientId:CLIENT_ID,
 policy:{effectMode:'read_only',allowedCapabilities:['read'],allowedTools:['get_client_context'],requiredTools:[],prohibitedEffects:['send_email']},
 contract:{outputFields:['summary'],completionChecks:['every claim cited'],coverageStates:['covered'],caseIds:[]},
 resolvedAt:NOW,validUntil:NOW+60_000,...over});
const codeOf=async fn=>{try{await fn();return null;}catch(error){return error?.code;}};

/** Real service + real port; only the Core HTTP boundary and the session/store are scripted. */
async function realChain({selection,answered,status=200,revokeAfterAnswer=false}={}){
 let token='tok-1';const calls=[];
 const procedureAdmission=createCoreProcedureAdmission({origin:'https://core.test',now:()=>NOW,getServiceSecret:async()=>SECRET,
  nativeCredentials:{nativeCredentialFor:()=>({credential:token,expiresAtMs:NOW+60_000})},
  fetchImpl:async(url,init)=>{calls.push({url,init});if(revokeAfterAnswer)token='tok-2';return new Response(typeof answered==='string'?answered:JSON.stringify(answered),{status});}});
 const f=await applicationFixture({initialInput:true,serviceOptions:{procedureAdmission}});
 const input={...f.input,...(selection===undefined?{}:{procedure:selection})};
 await f.service.allocateInput({credential:f.credential,input});
 await f.service.submit({credential:f.credential,input});
 return {f,calls,input,resolve:()=>f.service.procedureResolve({credential:f.credential,binding})};
}

test('a persisted procedure selection is resolved through the real service and port',async()=>{
 for(const selection of [builtin('briefing'),firm]){
  const chain=await realChain({selection,answered:admissionFor(selection)});
  try{
   const saved=await chain.f.service.loadForExecution({credential:chain.f.credential,binding});
   assert.deepEqual(saved.request.procedure,selection,'the selection the server persisted is the one resolved');
   const admission=await chain.resolve();
   assert.equal(chain.calls.length,1);
   assert.equal(chain.calls[0].url,'https://core.test'+PROCEDURE_RUNTIME_ROUTE);
   // The request body carries the conversation, the client and the closed selector union only: the caller supplies
   // no scope, budget, tool or instruction of its own.
   const body=JSON.parse(chain.calls[0].init.body);
   assert.deepEqual(Object.keys(body).sort(),['clientId','conversationId','scope','selector']);
   assert.deepEqual(body.selector,selection);
   assert.equal(body.conversationId,binding.conversationId);
   assert.equal(body.clientId,CLIENT_ID);assert.equal(body.scope,'client');
   assert.equal(chain.calls[0].init.headers['x-internal-service-secret'],SECRET);
   assert.equal(chain.calls[0].init.headers.authorization,'Bearer tok-1');
   assert.equal(chain.calls[0].init.method,'POST');assert.equal(chain.calls[0].init.redirect,'error');
   assert.equal(admission.instruction,'Open with the decision the record needs.');
   assert.equal(admission.manifestDigest,selection.manifestDigest);
   assert.deepEqual(admission.policy.allowedTools,['get_client_context']);
  }finally{chain.f.close();}
 }
});

test('an unselected run never reaches Core and a wrong run authority never releases an admission',async()=>{
 // No persisted procedure: refused before any Core call.
 const unselected=await realChain({answered:admissionFor(builtin('briefing'))});
 try{
  assert.equal(await codeOf(()=>unselected.resolve()),'PROCEDURE_SELECTION_ABSENT');
  assert.equal(unselected.calls.length,0,'the port is not called for an unselected run');
 }finally{unselected.f.close();}
 // A different run's binding cannot borrow this run's session.
 const chain=await realChain({selection:builtin('draft'),answered:admissionFor(builtin('draft'))});
 try{
  const other={...binding,runId:id(4242)};
  assert.equal(await codeOf(()=>chain.f.service.procedureResolve({credential:chain.f.credential,binding:other})),'STALE_WRITER');
  assert.equal(chain.calls.length,0,'no Core call without the run owning the session');
 }finally{chain.f.close();}
});

test('a drifted, refused or revoked answer dies instead of becoming guidance',async()=>{
 const selection=builtin('hearing_prep');
 // Core answers for a different digest than the persisted selection.
 const drift=await realChain({selection,answered:admissionFor(selection,{manifestDigest:'c'.repeat(64)})});
 try{assert.equal(await codeOf(()=>drift.resolve()),'PROCEDURE_ADMISSION_REFUSED');}finally{drift.f.close();}
 // Another client's admission cannot describe this run.
 const otherClient=await realChain({selection,answered:admissionFor(selection,{clientId:id(9)})});
 try{assert.equal(await codeOf(()=>otherClient.resolve()),'PROCEDURE_ADMISSION_REFUSED');}finally{otherClient.f.close();}
 // Core refuses the operation, is unavailable, or loses the session while answering.
 const refused=await realChain({selection,answered:'{}',status:403});
 try{assert.equal(await codeOf(()=>refused.resolve()),'PROCEDURE_CORE_REFUSED');}finally{refused.f.close();}
 const down=await realChain({selection,answered:'{}',status:500});
 try{assert.equal(await codeOf(()=>down.resolve()),'PROCEDURE_CORE_UNAVAILABLE');}finally{down.f.close();}
 const revoked=await realChain({selection,answered:admissionFor(selection),revokeAfterAnswer:true});
 try{assert.equal(await codeOf(()=>revoked.resolve()),'PROCEDURE_CORE_SESSION_UNAVAILABLE');}finally{revoked.f.close();}
 // Malformed Core answer.
 const malformed=await realChain({selection,answered:'<html>'});
 try{assert.equal(await codeOf(()=>malformed.resolve()),'PROCEDURE_CORE_INVALID_RESULT');}finally{malformed.f.close();}
});

test('the closed run-owner operation admits a binding and nothing else',()=>{
 assert.equal(PROCEDURE_RESOLVE_OPERATION,'runner/procedure-resolve');
 assert.equal(contracts.runOwnerOperations['procedure-resolve'],'procedureResolve');
 // A new optional read must not invalidate historical prepared-candidate configurations.
 assert.ok(!contracts.requiredRunOwnerOperations.includes('procedure-resolve'));
 assert.ok(!contracts.requiredRunOwnerOperations.includes('upload-source'));
 assert.ok(contracts.requiredRunOwnerOperations.includes('load'));
 assert.deepEqual(Object.keys(contracts.assertRunOwnerRequest('procedure-resolve',{binding})).sort(),['binding']);
 for(const bad of [{binding,input:{selection:builtin('briefing')}},{binding,selector:builtin('briefing')},
   {binding,versions},{binding,scopes:[{kind:'client'}]},{selector:builtin('briefing')}])
  assert.throws(()=>contracts.assertRunOwnerRequest('procedure-resolve',bad),JSON.stringify(bad));
 assert.throws(()=>contracts.assertRunOwnerRequest('procedure-write',{binding}));
});

test('the worker run-owner route serves the admission under the retention serving lock',async()=>{
 const {versions:ignored,...identity}=createExecutionBinding({binding,versions,plan:{synthetic:'procedure-resolve'},expiresAtMs:NOW+30000,runtimeSessionId:'synthetic-'+('b'.repeat(64))});
 const subject={tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId};
 let locked=false,releases=0,checks=0,served=0;
 const app=createWorkerRunApplication({execution:{async authenticate(){checks++;return {execution:identity,scopes,selectedClientId:CLIENT_ID,policyRevision:scopes[0].policyRevision};}},
  configuration:{retention:{enabled:true},limits:{requestMs:3000,requestBytes:2048}},
  createService(){return {procedureResolve({credential:runCredential,binding:runBinding}){served++;assert.equal(runCredential,'synthetic-execution');
   // The service answer is serialized inside the retention serving lock; a suppressed conversation withholds it.
   return {toJSON(){assert.equal(locked,true);return {admission:{for:runBinding.runId}};}};}};},
  retention:{async withRelease(subjects,release,{signal,deadlineMs}){assert.deepEqual(subjects,[subject]);assert.ok(deadlineMs>Date.now());releases++;locked=true;try{return await release(signal,async selected=>{assert.deepEqual(selected,subject);});}finally{locked=false;}}},
 });
 const post=body=>app.handle(new Request('https://control.invalid/internal/conversations/procedure-resolve',{method:'POST',headers:{authorization:'Bearer synthetic-execution','content-type':'application/json'},body:JSON.stringify(body)}));
 const response=await post({binding});
 assert.equal(response.status,200,await response.clone().text());assert.equal(releases,1);assert.equal(served,1);assert.equal(checks,2);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.deepEqual(JSON.parse(await response.text()),{admission:{for:binding.runId}});
 // The route refuses anything that is not the closed binding request, before any service is created.
 const extra=await post({binding,input:{selection:builtin('briefing')}});
 assert.equal(extra.status,403);assert.equal(served,1);assert.equal(releases,1);
 const foreign=await post({binding:{...binding,runId:id(4242)}});
 assert.equal(foreign.status,403);assert.equal(served,1);
 // An unknown operation on the same shape is still 404.
 const unknown=await app.handle(new Request('https://control.invalid/internal/conversations/procedure-write',{method:'POST',headers:{authorization:'Bearer synthetic-execution','content-type':'application/json'},body:JSON.stringify({binding})}));
 assert.equal(unknown.status,404);
});
