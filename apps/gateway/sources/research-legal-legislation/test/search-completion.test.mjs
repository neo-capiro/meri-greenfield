/** Complete search projection with synthetic native HTTP; no ResearchService/folder/client wall is executed here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {assertLegalSearchRequest,assertLegalSliceRequest,assertUnscopedLegalRequest,captureResearchClientReference,captureResearchClientSelection,legalSliceContext} from '../request-context.mjs';
import {storedCase,authorityNote} from './fixture.mjs';
const id='search_legislative_research',operation={id,version:'0.2.0'},clientId='a1234567-b123-4c12-8d12-e123456789ab',foreign='d1234567-b123-4c12-8d12-e123456789ab';
const selected=(reference='Client Name')=>({clientResolution:{reference,clientId},citationResolution:null});
function namedCase(request={sessionKey:'2026',clientId:' Client Name ',folderId:'native-folder',query:'energy'}){
 return storedCase(id,{request,context:selected(captureResearchClientReference(request))});
}
function perCall(f,capture=()=>{}){return f.handler({getCredentials:undefined,credentialsForCall:(operation,call)=>{capture({operation,call});return f.transport.getCredentials;}});}

test('closed search-only preflight admits raw names/folders without manufacturing a resolution',()=>{
 const raw={sessionKey:'2026',clientId:' Client Name ',folderId:'native-folder',query:'energy'},copy=assertLegalSearchRequest(operation,raw);
 assert.deepEqual(copy,raw);assert.notEqual(copy,raw);assert.ok(Object.isFrozen(copy));
 assert.throws(()=>legalSliceContext(operation,raw),{message:'UNAVAILABLE'});
 assert.deepEqual(legalSliceContext(operation,raw,selected().clientResolution),selected());
 assert.throws(()=>assertLegalSearchRequest({id:'get_legal_reference',version:'0.2.0'},{}),{message:'GATEWAY_CONFIGURATION'});
 for(const request of [{...raw,clientId:1},{...raw,folderId:{}},{...raw,citation:'Article I'},{...raw,tenantId:'other'}])
  assert.throws(()=>assertLegalSearchRequest(operation,request),{message:'INVALID_ARGUMENTS'});
});

test('reference capture preserves exact native trim/UTF16-clip80/trim grammar and inert hostile-object refusal',()=>{
 for(const raw of [null,'','   ',` ${clientId.toUpperCase()} `,'Long Client '.repeat(12),'x'.repeat(79)+' 🌱 end']){
  const request={clientId:raw},expected=raw?.trim().slice(0,80).trim()||null;assert.equal(captureResearchClientReference(request),expected);
 }
 let effects=0;const getter={get clientId(){effects++;return 'Client Name';}},proxy=new Proxy({clientId:'Client Name'},{ownKeys(){effects++;return ['clientId'];}});
 for(const raw of [getter,proxy])assert.throws(()=>captureResearchClientReference(raw),{message:'INVALID_ARGUMENTS'});
 const resolution={get reference(){effects++;return 'Client Name';},clientId};
 assert.throws(()=>captureResearchClientSelection({clientId:'Client Name'},resolution),{message:'ACCESS_DENIED'});assert.equal(effects,0);
});

test('named selection requires an exact closed trusted reference/lowercase UUID; UUID/null remain compatible',()=>{
 assert.deepEqual(captureResearchClientSelection({clientId:` ${clientId.toUpperCase()} `}),{reference:clientId.toUpperCase(),clientId});
 for(const clientId of [undefined,null,'',' '])assert.equal(captureResearchClientSelection({clientId:clientId??null}),null);
 for(const resolution of [null,{reference:'Other',clientId},{reference:'Client Name',clientId:'not-uuid'},
  {reference:'Client Name',clientId:clientId.toUpperCase()},{reference:'Client Name',clientId,authorized:true},{reference:'Client Name'}])
  assert.throws(()=>captureResearchClientSelection({clientId:' Client Name '},resolution),{message:'ACCESS_DENIED'});
 assert.throws(()=>captureResearchClientSelection({clientId:'Client Name'}),{message:'UNAVAILABLE'});
 const value=captureResearchClientSelection({clientId:' Client Name '},selected().clientResolution);assert.deepEqual(value,selected().clientResolution);assert.ok(Object.isFrozen(value));
});

test('personal null-client folders delegate exactly without inferred client selection or scope rewriting',async()=>{
 for(const extra of [{},{clientId:null},{clientId:''},{clientId:' '}])for(const folderId of ['native-folder',' ']){
  const request={sessionKey:'2026',folderId,...extra},f=storedCase(id,{request}),out=JSON.parse(await f.handler()(f.call()));
  assert.equal(f.authority.subject.kind,'personal');assert.deepEqual(f.normalizationContext,{clientResolution:null,citationResolution:null});
  assert.equal(out.result.result.scope.clientId,null);assert.equal(out.result.result.scope.folderId,folderId);assert.deepEqual(f.wire[0].body,request);
  assert.throws(()=>assertUnscopedLegalRequest(operation,request),{message:'UNAVAILABLE'});
 }
});

test('matching current client UUID and folder retain all raw selectors and ordinary source coverage',async()=>{
 const request={sessionKey:'2026',clientId:` ${clientId.toUpperCase()} `,folderId:'native-folder',query:'energy',billIds:['bill-b','bill-a','bill-b'],kind:'text',versionStage:'enrolled'},f=storedCase(id,{request});
 f.state.page={...f.page,result:{...f.page.result,items:[{...f.page.result.items[0],billId:'bill-a'}]}};
 const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(f.wire[0].body,request);assert.equal(out.result.result.scope.clientId,clientId);
 assert.equal(out.result.result.scope.folderId,'native-folder');assert.equal(out.result.authority,authorityNote);assert.equal(out.result.result.coverage.retainedVersionsOnly,true);
 assert.equal(out.result.result.coverage.complete,false);assert.deepEqual(f.credentialCalls[0].normalizationContext,f.normalizationContext);
});

test('named search needs per-call credentials and replaces only clientId while retaining original proof and complete carrier',async()=>{
 const request={sessionKey:'2026',clientId:' Client Name ',folderId:'native-folder',query:'energy',title:'Synthetic',cursor:'opaque-native-cursor'},f=namedCase(request),call=f.call();
 await assert.rejects(f.handler()(call),{message:'UNAVAILABLE'});assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 let captured;const out=JSON.parse(await perCall(f,value=>captured=value)(call)),[proof]=f.credentialCalls;
 assert.equal(captured.call,call);assert.deepEqual(captured.operation,operation);assert.deepEqual(f.wire[0].body,{...request,clientId});
 assert.equal(f.wire[0].url,'https://native-core.example.invalid/api/clio/tools/search_legislative_research');assert.equal(f.wire.length,1);
 assert.equal(proof.requestSha256,hash(request));assert.notEqual(proof.requestSha256,hash(f.wire[0].body));assert.equal(proof.argumentsSha256,call.argumentsSha256);
 assert.deepEqual(proof.normalizationContext,f.normalizationContext);assert.deepEqual(out,{binding:f.binding,subject:f.authority.subject,operation,argumentsSha256:call.argumentsSha256,result:f.page});
 assert.equal(f.arguments.clientId,' Client Name ');
});

test('named client clipping stays exact before UUID forwarding without clipping another raw argument',async()=>{
 const request={sessionKey:'2026',clientId:' Client '.repeat(16),folderId:'native-folder',query:' energy '},f=namedCase(request);
 assert.equal(f.normalizationContext.clientResolution.reference,request.clientId.trim().slice(0,80).trim());
 await perCall(f)(f.call());assert.deepEqual(f.wire[0].body,{...request,clientId});assert.equal(f.wire[0].body.query,' energy ');
});

test('hidden/foreign selected client or current resource mismatch cannot reach native HTTP or source credentials',async()=>{
 for(const mode of ['foreign-client','wrong-resource','personal','missing-grant']){
  const f=namedCase(),call=structuredClone(f.call()),a=call.authority;
  if(mode==='foreign-client')a.subject.entityIds=[foreign];
  if(mode==='wrong-resource'){a.subject.scopes[0].resourceId=foreign;a.claims.scopes[0].resourceId=foreign;a.decision.scopes[0].resourceId=foreign;}
  if(mode==='personal')Object.assign(a.subject,{kind:'personal',entityType:'user',entityIds:[a.binding.actorId]});
  if(mode==='missing-grant')a.sourceIds=[];
  await assert.rejects(perCall(f)(call),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);assert.equal(f.credentialCalls.length,0);
 }
 const f=namedCase();f.state.credentialMutator=proof=>proof.requestSha256='0'.repeat(64);
 await assert.rejects(perCall(f)(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
});

test('reference/context/input/hash substitution and fake trust fields fail without native request',async()=>{
 const f=namedCase(),call=f.call();
 for(const changes of [{request:{...f.arguments,clientId:'Another Name'}},{normalizationContext:{...f.normalizationContext,authorized:true}},
  {normalizationContext:{...f.normalizationContext,citationResolution:{citation:'X',referenceId:'Y',code:'statute'}}},
  {input:{...call.input,scope:{...call.input.scope,folderId:'other'}}},{argumentsSha256:'0'.repeat(64)},
  {request:{...f.arguments,noFetch:true}}])await assert.rejects(perCall(f)({...call,...changes}));
 assert.equal(f.wire.length,0);assert.equal(f.credentialCalls.length,0);
});

test('native folder/client/feature/member/resolver/cursor failures remain failures rather than a successful empty DTO',async()=>{
 for(const message of ['RESEARCH_FOLDER_CLIENT_MISMATCH','RESEARCH_CLIENT_UNAVAILABLE','FOLDER_NOT_FOUND','FEATURE_DISABLED','CURRENT_MEMBER_REQUIRED','CLIENT_AMBIGUOUS','SEARCH_CHANGED_RESTART']){
  const f=namedCase();f.state.responseFactory=()=>Response.json({message},{status:404});
  await assert.rejects(perCall(f)(f.call()),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);assert.equal(f.credentialCalls.length,1);
 }
});

test('folder/client/query result substitutions withhold the entire native result without repairing scope or content',async()=>{
 for(const mutate of [p=>p.result.scope.clientId=foreign,p=>p.result.scope.folderId='other',p=>p.result.interpretedQuery.raw='other',
  p=>p.result.complete=true,p=>p.authority='Current law verified',p=>p.result.items[0].privateClientNote='PRIVATE']){
  const f=namedCase();f.state.resultMutator=mutate;await assert.rejects(perCall(f)(f.call()),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);
 }
});

test('legal reference keeps every name/folder/parser gate even when a caller supplies a search resolution',()=>{
 const ref={id:'get_legal_reference',version:'0.2.0'};
 for(const request of [{view:'rules',clientId:'Client Name'},{view:'rules',folderId:'native-folder'},
  {citation:'Article I'},{referenceId:'explicit',citation:'1.10',edition:'2026'}]){
  assert.throws(()=>assertLegalSliceRequest(ref,request,selected().clientResolution),{message:'UNAVAILABLE'});
  assert.throws(()=>legalSliceContext(ref,request,selected().clientResolution),{message:'UNAVAILABLE'});
 }
});

test('named search cancellation/deadline/response bounds and invalid canonical search semantics retain existing refusals',async()=>{
 const f=namedCase();await assert.rejects(perCall(f)({...f.call(),signal:AbortSignal.abort()}),{message:'CANCELLED'});assert.equal(f.credentialCalls.length,0);
 const g=namedCase(),controller=new AbortController();g.state.afterSource=()=>controller.abort();await assert.rejects(perCall(g)({...g.call(),signal:controller.signal}),{message:'CANCELLED'});
 const h=namedCase();h.state.afterSource=()=>h.state.now=h.authority.deadlineMs;await assert.rejects(perCall(h)(h.call()),{message:'DEADLINE'});
 const small=namedCase();await assert.rejects(small.handler({getCredentials:undefined,credentialsForCall:()=>small.transport.getCredentials,maxResponseBytes:8})(small.call()),{message:'RESOURCE_LIMIT'});
 for(const request of [{clientId:'Client Name'},{sessionKey:'2026',clientId:'Client Name',query:' '},{sessionKey:'2026',clientId:'Client Name',folderId:'x'.repeat(101)}]){
  const j=namedCase();await assert.rejects(perCall(j)({...j.call(),request}),{message:'INVALID_ARGUMENTS'});assert.equal(j.wire.length,0);
 }
});
