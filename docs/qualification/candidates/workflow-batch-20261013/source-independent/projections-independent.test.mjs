/** Independent source controls through the actual canonical authority/gateway. */
import test from 'node:test';import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {createServer} from 'node:http';import {once} from 'node:events';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;assert.ok(root,'Exact source root required');
const load=path=>import(pathToFileURL(root+'/'+path));
const {createCurrentToolAuthority}=await load('apps/gateway/authorization/current-tool-authority.mjs');
const {createToolDispatch}=await load('apps/gateway/dispatch/tool-dispatch.mjs');
const {createClientEvidenceHttpAdapter:ceHttp}=await load('apps/gateway/sources/client-evidence/http-adapter.mjs');
const {createClientEvidenceReadHandler:ceHandler}=await load('apps/gateway/sources/client-evidence/handler.mjs');
const {clientEvidenceFixture,credentialReceipt,operations,endpoints,NOW:CE_NOW,clientId,documentId}=await load('apps/gateway/sources/client-evidence/test/fixtures.mjs');
const {createIdentityContactsHttpAdapter:icHttp}=await load('apps/gateway/sources/identity-contacts/http-adapter.mjs');
const {createIdentityContactsReadHandler:icHandler}=await load('apps/gateway/sources/identity-contacts/handler.mjs');
const {createIdentityContactsFixture}=await load('apps/gateway/sources/identity-contacts/test/fixtures.mjs');
const {canonicalSha256:hash}=await load('packages/contracts/validate.mjs');
const clone=x=>structuredClone(x),sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
const ids=['get_client_context','read_client_documents','resolve_entity','find_contacts'];
function fixture(id){
 const evidence=id==='get_client_context'||id==='read_client_documents';
 const source=evidence?clientEvidenceFixture(id==='get_client_context'?operations.profile:operations.documents,
  id==='get_client_context'?{clientId,section:'people'}:{clientId,documentId}):createIdentityContactsFixture(id,{linked:id==='find_contacts'});
 const auth=clone(source.authority),state={now:evidence?CE_NOW:source.state.now,revoked:false},counts={credentials:0,fetch:0,reserve:0,settle:0,uncertain:0,policy:0},wire=[];
 auth.claims.binding=clone(auth.binding);auth.claims.scopes=clone(auth.subject.scopes);auth.decision.scopes=clone(auth.subject.scopes);
 const request=evidence?clone(source.request):clone(source.args),operation=source.operation,contract=source.contract;
 const context=source.normalizationContext;
 const normalized=contract.normalizeInput(request,context);
 const call=()=>({input:normalized.input,request,authority:auth,argumentsSha256:normalized.argumentsSha256,normalizationContext:context});
 const page=(input,pins,metadata)=>{
  const result=evidence?clone(source.page):source.page(input,auth,metadata);
  if(id!=='get_client_context'){result.binding=clone(pins.binding);result.subject=clone(pins.subject);}
  state.changePage?.(result,pins);return result;
 };
 const config={endpoints:evidence?endpoints:source.config.endpoints,now:()=>state.now,maxRequestMs:500,maxResponseBytes:1048576,
  async getCredentials(pins){counts.credentials++;state.pins=pins;const receipt=evidence?credentialReceipt(pins):source.credentials(pins);state.changeReceipt?.(receipt);return receipt;},
  async fetchImpl(url,options){counts.fetch++;wire.push({url,options});const body=JSON.parse(options.body);
   const result=page(body.input,state.pins,body.metadata);state.afterRead?.();return new Response(JSON.stringify(result),{headers:{'content-type':'application/json'}});}};
 const handler=changes=>(evidence?ceHandler:icHandler)({operation,adapter:(evidence?ceHttp:icHttp)({...config,...changes}),now:()=>state.now});
 const ports={async verifyCapability(){if(state.revoked)throw Error('SYNTHETIC_REVOKED');return JSON.stringify(auth.claims);},
  async currentRun(){return JSON.stringify({binding:auth.binding,policyRevision:auth.policyRevision,deadlineMs:auth.deadlineMs,checkedAtMs:state.now});},
  async authorizeBusiness(){counts.policy++;return JSON.stringify({decision:{...auth.decision,evaluatedAt:new Date(state.now).toISOString()},subject:auth.subject,grants:contract.descriptor.requiredGrants});},
  async authorizeSources(){return JSON.stringify({sourceIds:auth.sourceIds,enabled:true,policyRevision:auth.policyRevision,checkedAtMs:state.now});}};
 const gateway=(changes={},configuration={})=>createToolDispatch({catalog:{entry:()=>({contract,descriptor:contract.descriptor,execute:handler(changes)}),discoverable:()=>[]},
  authority:createCurrentToolAuthority({ports,now:()=>state.now,maxFactBytes:1048576}),
  budget:{async reserve({reservationId}){counts.reserve++;state.afterReserve?.();return JSON.stringify({reservationId,decision:'reserved'});},async settle({reservationId}){counts.settle++;state.afterSettle?.();return JSON.stringify({reservationId,decision:'settled'});},async markUncertain(){counts.uncertain++;}},
  limits:{maxRequestBytes:65536,maxResponseBytes:1048576,maxRequestMs:500,maxCleanupMs:30},now:()=>state.now,newId:()=>auth.binding.workerId,sourceEnabled:true,defaultCongress:119,...configuration});
 const run=(g=gateway(),args=request)=>g.execute(JSON.stringify({operation,arguments:args}),'SYNTHETIC_OPAQUE');
 return {id,evidence,source,auth,state,counts,wire,request,operation,contract,call,handler,gateway,run,page,config};
}
for(const operation of ['get_client_context','read_client_documents'])for(const [name,patch]of[
 ['foreign tenant',scope=>scope.tenantId='synthetic-foreign-tenant'],['foreign policy',scope=>scope.policyRevision='synthetic-foreign-policy'],
])test(operation+': direct source refuses additional '+name+' capability scope before broker',async()=>{
 const f=fixture(operation),scope=clone(f.auth.claims.scopes[0]);scope.resourceId=f.auth.binding.workerId;patch(scope);f.auth.claims.scopes.push(scope);
 let error;try{await f.handler()(f.call());}catch(e){error=e.message;}
 console.log(JSON.stringify({operation,case:name,error,credentialCalls:f.counts.credentials,fetchCalls:f.counts.fetch}));
 assert.equal(error,'ACCESS_DENIED');assert.equal(f.counts.credentials,0);assert.equal(f.counts.fetch,0);
});
for(const operation of ids)test(operation+': canonical dispatcher refuses foreign capability scope before reservation/broker',async()=>{
 const f=fixture(operation);f.auth.claims.scopes.push({...clone(f.auth.claims.scopes[0]),tenantId:'foreign',resourceId:'another'});
 await assert.rejects(f.run(),/ACCESS_DENIED/);assert.equal(f.counts.reserve,0);assert.equal(f.counts.credentials,0);
});
for(const operation of ids)test(operation+': actual loopback Fetch reaches canonical handler and governed gateway with exact raw request SHA',async()=>{
 const f=fixture(operation),observed=[];
 const server=createServer(async(req,res)=>{try{
  let raw='';for await(const chunk of req)raw+=chunk;observed.push({raw,headers:req.headers,method:req.method});
  const body=JSON.parse(raw);res.writeHead(200,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(f.page(body.input,f.state.pins,body.metadata)));
 }catch(error){res.writeHead(500,{'content-type':'application/json'});res.end('{}');}});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const address=server.address();
 try{
  const gateway=f.gateway({fetchImpl:(url,options)=>{f.counts.fetch++;return fetch('http://127.0.0.1:'+address.port+'/canonical',options);}});
  const released=JSON.parse(await f.run(gateway));assert.deepEqual(released.binding,f.auth.binding);assert.equal(observed.length,1);
  assert.equal(observed[0].method,'POST');assert.equal(sha(observed[0].raw),f.state.pins.requestSha256);
  assert.equal(hash(JSON.parse(observed[0].raw)),f.state.pins.requestSha256);assert.deepEqual(Object.keys(JSON.parse(observed[0].raw)).sort(),['input','metadata']);
  assert.equal(observed[0].raw.includes('SYNTHETIC_BEARER'),false);assert.equal(observed[0].raw.includes('claims'),false);
  assert.equal(f.counts.reserve,1);assert.equal(f.counts.settle,1);assert.equal(f.counts.uncertain,0);
 }finally{server.closeAllConnections();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));assert.equal(server.listening,false);}
});
for(const operation of ids)test(operation+': changed writer fence after budget reservation blocks source effects',async()=>{
 const f=fixture(operation);f.state.afterReserve=()=>{f.auth.binding.writerFence++;f.auth.claims.binding.writerFence++;};
 await assert.rejects(f.run(),/ACCESS_DENIED/);assert.equal(f.counts.reserve,1);assert.equal(f.counts.credentials,0);assert.equal(f.counts.fetch,0);assert.equal(f.counts.uncertain,1);
});
for(const operation of ['get_client_context','read_client_documents'])test(operation+': current decision refresh preserves selected scope and exact original observation',async()=>{
 const f=fixture(operation);f.state.afterReserve=()=>{f.auth.subject.authorizationDecisionId=f.auth.binding.workerId;f.auth.decision.decisionId=f.auth.binding.workerId;f.state.now+=1;};
 const released=JSON.parse(await f.run());assert.equal(released.subject.authorizationDecisionId,f.auth.binding.workerId);
 if(operation==='get_client_context'){assert.equal(f.state.pins.normalizationContext.asOf,new Date(CE_NOW).toISOString());assert.equal(released.result.generatedAt,new Date(CE_NOW).toISOString());}
 else assert.deepEqual(f.state.pins.normalizationContext.subject,f.auth.subject);
 assert.equal(f.counts.settle,1);
});
test('profile client selector resolves from current subject; observation substitution refuses canonical release',async()=>{
 const f=fixture('get_client_context');f.state.changePage=page=>page.generatedAt=new Date(CE_NOW-1).toISOString();
 await assert.rejects(f.run(),/INVALID_RESULT/);assert.equal(f.counts.settle,0);assert.equal(f.counts.uncertain,1);
});
test('document blocked extraction remains missing readable content, with no new extractor or evidence claim',async()=>{
 const f=fixture('read_client_documents'),blocked=clientEvidenceFixture(operations.documents,f.request,{blocked:true});f.source.page=blocked.page;
 const released=JSON.parse(await f.run());assert.equal(released.data.records.length,0);assert.equal(released.data.coverage.complete,false);assert.equal(released.data.coverage.continuationBlocked,true);assert.equal(released.data.coverage.missingContent,true);assert.equal(Object.hasOwn(released,'verified'),false);assert.equal(f.counts.fetch,1);
});
test('entity candidate cannot acquire a verified identity label through actual gateway',async()=>{
 const f=fixture('resolve_entity');f.state.changePage=page=>page.result.verified=true;
 await assert.rejects(f.run(),/INVALID_RESULT/);assert.equal(f.counts.settle,0);assert.equal(f.counts.uncertain,1);
});
test('contacts cannot substitute returned selected client at actual release boundary',async()=>{
 const f=fixture('find_contacts');f.state.changePage=page=>page.result.clientId=f.auth.binding.workerId;
 await assert.rejects(f.run(),/INVALID_RESULT/);assert.equal(f.counts.settle,0);assert.equal(f.counts.uncertain,1);
});
test('caller Congress/normalization authority cannot bypass trusted configuration, and missing pin stops before reservation',async()=>{
 const f=fixture('resolve_entity');await assert.rejects(f.run(f.gateway(),{...f.request,defaultCongress:120}),/INVALID_ARGUMENTS/);
 await assert.rejects(f.run(f.gateway({}, {defaultCongress:undefined})),/UNAVAILABLE/);assert.equal(f.counts.reserve,0);assert.equal(f.counts.credentials,0);
});
test('broker immutable context/body receipt substitution refuses before source Fetch',async()=>{
 const f=fixture('get_client_context');f.state.changeReceipt=receipt=>receipt.normalizationContext.asOf=new Date(CE_NOW-1000).toISOString();
 await assert.rejects(f.run(),/INVALID_RESULT/);assert.equal(f.counts.fetch,0);assert.equal(f.counts.settle,0);assert.equal(f.counts.uncertain,1);
});
test('stalled actual Response reader has finite cancellation and governed uncertain accounting',async()=>{
 const f=fixture('resolve_entity');let cancelled=0;
 const gateway=f.gateway({maxRequestMs:20,fetchImpl:async()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));},cancel(){cancelled++;}}),{headers:{'content-type':'application/json'}})});
 await assert.rejects(f.run(gateway),/DEADLINE/);assert.equal(cancelled,1);assert.equal(f.counts.settle,0);assert.equal(f.counts.uncertain,1);
});
