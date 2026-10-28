/**
 * Wave5 MO01/ST16 — the native selected-procedure CALLER chain.
 *
 * Only the Core HTTP boundary is faked. The worker task port, the private resolver and the attended Core client are
 * the real modules, so this proves the chain the SDK activity actually runs: persisted selection -> control resolver
 * -> Core admission -> immutable guidance + subset-only narrowing. No model, provider, network or database is used.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {binding,scopes,versions,id} from '../../test/store-fixture.mjs';
import {createProcedureCoreClient,PROCEDURE_RUNTIME_ROUTE} from '../core-client.mjs';
import {createProcedureResolver} from '../resolver.mjs';
import {createProcedureRuntime,PROCEDURE_RESOLVE_MAX_MS} from '../../../../worker/conversation/procedures/runtime.mjs';
import {createTaskProcedurePort} from '../../../../worker/conversation/procedures/task-port.mjs';
import {BUILTIN_PROCEDURE_IDS,PROCEDURE_CONTEXT_MARKER,narrowProcedureTools,assertProcedureSelector} from '../../../../worker/conversation/procedures/guidance.mjs';

const NOW=1_800_000_000_000,CLIENT_ID=id(5),SECRET='svc-secret-value';
const selector=id=>{const version=1;return {source:'builtin',id,version,manifestDigest:canonicalSha256({id,version})};};
const stored=id=>selector(id);
const admissionFor=(selection,over={})=>({
 version:1,tenantId:binding.tenantId,manifestDigest:selection.manifestDigest,
 identity:{source:'builtin',id:selection.id,canonicalId:selection.id,version:selection.version},
 instruction:'Open with the decision the record needs.',purpose:'Prepare a hearing brief.',scopes:['general'],
 evidencePrerequisites:['client documents'],scope:'client',clientId:CLIENT_ID,
 policy:{effectMode:'read_only',allowedCapabilities:['read'],allowedTools:['get_client_context','read_client_documents'],requiredTools:['get_client_context'],prohibitedEffects:['send_email']},
 contract:{outputFields:['summary'],completionChecks:['every claim cited'],coverageStates:['covered'],caseIds:[]},
 resolvedAt:NOW,validUntil:NOW+60_000,...over});

/** Real chain; only fetchImpl is synthetic. `revokeAfterAnswer` drops the native session while Core answers. */
function chainFor({answered,status=200,revokeAfterAnswer=false}={}){
 let token='tok-1';const calls=[];
 const client=createProcedureCoreClient({origin:'https://core.test',now:()=>NOW,getServiceSecret:async()=>SECRET,
  nativeCredentialFor:{nativeCredentialFor:()=>({credential:token,expiresAtMs:NOW+60_000})},
  fetchImpl:async(url,init)=>{calls.push({url,init});if(revokeAfterAnswer)token='tok-2';return new Response(typeof answered==='string'?answered:JSON.stringify(answered),{status});}});
 const resolver=createProcedureResolver({core:client,now:()=>NOW});
 const runtime=createProcedureRuntime({now:()=>NOW,resolve:({binding:b,versions:v,selection,scopes:s,signal})=>resolver.resolve({binding:b,selection,scopes:s,versions:v,signal})});
 return {client,resolver,runtime,calls,token:()=>token};
}
/** Exactly how apps/worker/conversation/activity.mjs calls the port for one run. */
const prepareFor=(runtime,procedure,extra={})=>runtime.prepare({binding,versions,request:{requestId:id(61),prompt:'brief this',window:null,...(procedure===undefined?{}:{procedure})},scopes,signal:new AbortController().signal,...extra});
const codeOf=async fn=>{try{await fn();return null;}catch(error){return error?.code;}};

test('all six canonical builtins resolve through the caller chain into appended guidance',async()=>{
 assert.deepEqual([...BUILTIN_PROCEDURE_IDS],['briefing','draft','bill_analysis','hearing_prep','coalition_letter','amendment_tracker']);
 for(const builtin of BUILTIN_PROCEDURE_IDS){
  const selection=stored(builtin),chain=chainFor({answered:admissionFor(selection)});
  const prepared=await prepareFor(chain.runtime,stored(builtin));
  assert.equal(chain.calls.length,1,builtin);
  assert.equal(chain.calls[0].url,'https://core.test'+PROCEDURE_RUNTIME_ROUTE,builtin);
  // The browser-supplied selector is forwarded as a selection only: no tool, instruction or authority rides with it.
  const body=JSON.parse(chain.calls[0].init.body);
  assert.deepEqual(Object.keys(body).sort(),['clientId','conversationId','scope','selector'],builtin);
  assert.deepEqual(body.selector,{source:'builtin',id:builtin,version:1,manifestDigest:selection.manifestDigest});
  assert.equal(body.conversationId,binding.conversationId);
  assert.equal(body.clientId,CLIENT_ID);assert.equal(body.scope,'client');
  assert.equal(chain.calls[0].init.headers['x-internal-service-secret'],SECRET);
  assert.equal(chain.calls[0].init.headers.authorization,'Bearer tok-1');
  assert.ok(prepared.systemPromptAppend.startsWith(PROCEDURE_CONTEXT_MARKER),builtin);
  const payload=JSON.parse(prepared.systemPromptAppend.slice(PROCEDURE_CONTEXT_MARKER.length));
  assert.equal(payload.procedure.identity.id,builtin);
  assert.equal(payload.procedure.instruction,'Open with the decision the record needs.');
  assert.equal(payload.procedure.manifestDigest,selection.manifestDigest);
  assert.deepEqual([...prepared.allowedTools],['get_client_context','read_client_documents']);
  assert.ok(Object.isFrozen(prepared));assert.ok(Object.isFrozen(prepared.identity));
 }
});

test('guidance narrows the SDK tool list by subset only and never adds or strips a tool',async()=>{
 const granted=['get_client_context'];
 // A mounted Capiro read tool the procedure did not grant is removed; SDK builtins and other mounts are untouched.
 assert.deepEqual(narrowProcedureTools(['Read','Agent','mcp__reads__get_client_context','mcp__reads__query_debriefs'],granted),
  ['Read','Agent','mcp__reads__get_client_context']);
 // Nothing to narrow, or nothing left: the input is returned unchanged rather than widened or emptied.
 for(const value of [undefined,[],['Read','Agent'],['mcp__reads__query_debriefs']])assert.deepEqual(narrowProcedureTools(value,granted),value);
 assert.deepEqual(narrowProcedureTools(['mcp__reads__get_client_context'],['get_client_context','read_client_documents']),['mcp__reads__get_client_context']);
});

test('a run without a persisted selection is unchanged and calls nothing',async()=>{
 const chain=chainFor({answered:admissionFor(stored('briefing'))});
 assert.equal(await prepareFor(chain.runtime,undefined),null);
 assert.equal(await prepareFor(chain.runtime,null),null);
 assert.equal(chain.calls.length,0);
});

test('a stale or replayed selection is refused instead of guidance',async()=>{
 // Digest no longer matches the stored selection (the row changed under the browser).
 assert.equal(await codeOf(()=>prepareFor(chainFor({answered:admissionFor(stored('briefing'),{manifestDigest:'c'.repeat(64)})}).runtime,stored('briefing'))),'PROCEDURE_ADMISSION_REFUSED');
 // Version drift: an older admitted version must not satisfy a newer selection.
 assert.equal(await codeOf(()=>prepareFor(chainFor({answered:admissionFor(stored('draft'),{identity:{source:'builtin',id:'draft',canonicalId:'draft',version:2}})}).runtime,{...stored('draft'),version:3,manifestDigest:canonicalSha256({id:'draft',version:3})})),'PROCEDURE_ADMISSION_REFUSED');
 // A different procedure entirely.
 assert.equal(await codeOf(()=>prepareFor(chainFor({answered:admissionFor(stored('briefing'))}).runtime,stored('draft'))),'PROCEDURE_ADMISSION_REFUSED');
 assert.equal(await codeOf(()=>prepareFor(chainFor({answered:admissionFor(stored('briefing'),{validUntil:NOW})}).runtime,stored('briefing'))),'PROCEDURE_ADMISSION_REFUSED');
});

test('altered scope, client and tool set are refused',async()=>{
 // The run is client-scoped (store-fixture scopes carry one client scope): a general, other-client or
 // otherwise re-scoped admission cannot describe this run.
 for(const over of [{scope:'general',clientId:null},{clientId:id(9)},{scope:'general',clientId:id(9)}]){
  const selection=stored('bill_analysis');
  assert.equal(await codeOf(()=>prepareFor(chainFor({answered:admissionFor(selection,over)}).runtime,selection)),'PROCEDURE_ADMISSION_REFUSED',JSON.stringify(over));
 }
 // A procedure may never grant an effect or a tool outside the canonical read-capability set.
 assert.equal(await codeOf(()=>prepareFor(chainFor({answered:admissionFor(stored('briefing'),{policy:{effectMode:'write',allowedCapabilities:['read'],allowedTools:['get_client_context'],requiredTools:[],prohibitedEffects:[]}})}).runtime,stored('briefing'))),'PROCEDURE_ADMISSION_REFUSED');
 assert.equal(await codeOf(()=>prepareFor(chainFor({answered:admissionFor(stored('briefing'),{policy:{effectMode:'read_only',allowedCapabilities:['read'],allowedTools:['shell_exec'],requiredTools:[],prohibitedEffects:[]}})}).runtime,stored('briefing'))),'PROCEDURE_ADMISSION_REFUSED');
 assert.equal(await codeOf(()=>prepareFor(chainFor({answered:admissionFor(stored('briefing'),{policy:{effectMode:'read_only',allowedCapabilities:['read'],allowedTools:['get_client_context'],requiredTools:['send_email'],prohibitedEffects:[]}})}).runtime,stored('briefing'))),'PROCEDURE_ADMISSION_REFUSED');
});

test('a disabled or revoked authority refuses before any guidance is released',async()=>{
 const selection=stored('hearing_prep');
 // Core refuses the operation (403): no admission, no retry loop.
 assert.equal(await codeOf(()=>prepareFor(chainFor({answered:'{}',status:403}).runtime,selection)),'PROCEDURE_CORE_REFUSED');
 assert.equal(await codeOf(()=>prepareFor(chainFor({answered:'{}',status:500}).runtime,selection)),'PROCEDURE_CORE_UNAVAILABLE');
 // The native session dies while Core answers: the admission is dropped.
 assert.equal(await codeOf(()=>prepareFor(chainFor({answered:admissionFor(selection),revokeAfterAnswer:true}).runtime,selection)),'PROCEDURE_CORE_SESSION_UNAVAILABLE');
 // Malformed answer and a non-https origin are refused at the boundary.
 assert.equal(await codeOf(()=>prepareFor(chainFor({answered:'<html>'}).runtime,stored('coalition_letter'))),'PROCEDURE_CORE_INVALID_RESULT');
 assert.throws(()=>createProcedureCoreClient({origin:'http://core.test',now:()=>NOW,getServiceSecret:async()=>SECRET,nativeCredentialFor:{nativeCredentialFor:()=>({credential:'tok-1',expiresAtMs:NOW+1})}}),error=>error.code==='PROCEDURE_CORE_CONFIGURATION');
 assert.throws(()=>createProcedureResolver({core:{},now:()=>NOW}),error=>error.code==='PROCEDURE_RESOLVER_CONFIGURATION');
});

test('a selector may only carry a selection: unknown keys, unknown ids and bad digests are refused',()=>{
 assert.throws(()=>assertProcedureSelector({source:'builtin',id:'briefing',version:1,manifestDigest:'a'.repeat(64),instruction:'do it'}),error=>error.code==='PROCEDURE_SELECTION_REFUSED');
 assert.equal(assertProcedureSelector({source:'builtin',id:'briefing',version:1,manifestDigest:'a'.repeat(64)}).id,'briefing');
 for(const bad of [
  {source:'builtin',id:'briefing',version:1,manifestDigest:'a'.repeat(64),tools:['shell_exec']},
  {source:'builtin',id:'not_a_procedure',version:1,manifestDigest:'a'.repeat(64)},
  {source:'builtin',id:'briefing',version:0,manifestDigest:'a'.repeat(64)},
  {source:'builtin',id:'briefing',version:1,manifestDigest:'short'},
  {source:'firm',recordId:'not-a-uuid',version:1,manifestDigest:'a'.repeat(64)},
  {source:'other',id:'briefing',version:1,manifestDigest:'a'.repeat(64)},
 ])assert.throws(()=>assertProcedureSelector(bad),error=>error.code==='PROCEDURE_SELECTION_REFUSED',JSON.stringify(bad));
});

test('the task port resolves the stored selection through the existing native transport operation',async()=>{
 const seen=[];const selection=stored('coalition_letter');
 const port=createTaskProcedurePort({now:()=>NOW,native:{async call(operation,input){seen.push({operation,input});return admissionFor(selection);}}});
 assert.equal(await port.prepare({binding,versions,request:{requestId:id(61),prompt:'x',procedure:selection},scopes,signal:new AbortController().signal}).then(value=>value.identity.id),'coalition_letter');
 assert.equal(seen.length,1);assert.equal(seen[0].operation,'runner/procedure-resolve');
 // Closed request: the run's binding and nothing else. The selection, versions, scope and current execution
 // identity are loaded by control through its own service owner, never carried in this body.
 assert.deepEqual(Object.keys(seen[0].input).sort(),['binding']);
 assert.equal(seen[0].input.binding.conversationId,binding.conversationId);
 // No selection: the transport is never called, so an unselected run cannot reach Core through this port.
 const untouched=createTaskProcedurePort({now:()=>NOW,native:{async call(){throw Error('MUST_NOT_CALL');}}});
 assert.equal(await untouched.prepare({binding,versions,request:{requestId:id(61),prompt:'x'},scopes,signal:new AbortController().signal}),null);
});

test('the port the conversation activity consumes is normalised for exactly one run',async()=>{
 // The activity builds the port from the runner and calls it once per run with the run's own binding, versions,
 // scopes and stored request; a malformed port is refused by the activity itself (PROCEDURE_ACTIVITY_CONFIGURATION).
 const port=createTaskProcedurePort({now:()=>NOW,native:{async call(){return admissionFor(stored('briefing'));}}});
 assert.equal(typeof port.prepare,'function');
 assert.equal(port.prepare.length,1);
 assert.equal(typeof createProcedureRuntime({resolve:async()=>{}}).prepare,'function');
 assert.equal(PROCEDURE_RESOLVE_MAX_MS,3000);
});
