/** Independent synthetic composition through real canonical contracts and authority. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const root = process.env.MEMORY_GATEWAY_REVIEW_ROOT
  ? pathToFileURL(`${process.env.MEMORY_GATEWAY_REVIEW_ROOT}/`) : new URL('../../../', import.meta.url);
const load = path => import(new URL(path, root));
const {canonicalSha256} = await load('packages/contracts/validate.mjs');
const contracts = await load('packages/contracts/retrieval-0.2/validate.mjs');
const {CATALOG_OPERATION_BINDINGS} = await load('packages/contracts/retrieval-0.2/catalog-validation.mjs');
const {createToolDispatch} = await load('apps/gateway/dispatch/tool-dispatch.mjs');
const {createCurrentToolAuthority} = await load('apps/gateway/authorization/current-tool-authority.mjs');
const {createSourceDisabledGateway} = await load('apps/gateway/index.mjs');
const {createRuntimeCatalog} = await load('apps/gateway/catalog/runtime-catalog.mjs');
const NOW = Date.parse('2026-10-12T04:00:00Z');
const id = digit => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
const operation = {id:'memory.list_own_proposals',version:'0.2.0'};
const limits = {maxRequestBytes:65536,maxResponseBytes:65536,maxRequestMs:2000,maxCleanupMs:30};
const clone = value => JSON.parse(JSON.stringify(value));
const stable = subject => {const {authorizationDecisionId:ignored,...value}=subject;return value;};
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
const drain = () => new Promise(resolve => setImmediate(resolve));
const request = args => JSON.stringify({operation,arguments:args});

function fixture({client=null, nextCursor=null}={}) {
  const events=[], stored=new Map();
  const state={now:NOW,policyCalls:0,nextCursor,client,revoked:false};
  const binding={tenantId:id('1'),actorId:id('2'),conversationId:id('3'),runId:id('4'),
    attemptId:id('5'),workerId:id('6'),writerFence:1};
  const scope={tenantId:binding.tenantId,kind:client?'client':'private-user',resourceId:client??binding.actorId,policyRevision:'review-policy'};
  const subject={kind:client?'client':'personal',entityType:client?'client':'user',entityIds:[client??binding.actorId],
    tenantId:binding.tenantId,actorId:binding.actorId,authorizationDecisionId:id('a'),
    policyRevision:scope.policyRevision,scopes:[scope],rosterVersionId:null};
  const claims={capabilityId:id('7'),issuer:'independent-synthetic',audience:'meri-gateway',binding,
    actions:['tool.read'],scopes:[scope],issuedAt:new Date(NOW-1000).toISOString(),
    expiresAt:new Date(NOW+10000).toISOString(),policyRevision:scope.policyRevision,
    budgets:{maxTurns:5,maxRuntimeSeconds:10,maxCostMicrousd:1,maxOutputBytes:65536}};
  const contract=contracts.resolveOperationContract(operation), descriptor=contract.descriptor;
  const authorityPorts={
    async verifyCapability(){events.push('capability');if(state.revoked)throw Error('synthetic private denial');return JSON.stringify(claims);},
    async currentRun(){events.push('run');return JSON.stringify({binding,policyRevision:scope.policyRevision,deadlineMs:state.deadline??NOW+10000,checkedAtMs:state.now});},
    async authorizeBusiness({input}){events.push('policy');state.policyCalls++;state.inputs??=[];state.inputs.push(clone(input));
      state.beforePolicy?.(state.policyCalls,input);
      return JSON.stringify({decision:{decisionId:subject.authorizationDecisionId,actor:{tenantId:binding.tenantId,actorId:binding.actorId},
        operation:`${operation.id}@${operation.version}`,scopes:subject.scopes,policyRevision:scope.policyRevision,
        evaluatedAt:new Date(state.now).toISOString(),decision:'allowed',reasonCode:'SYNTHETIC_ONLY'},
        subject,grants:descriptor.requiredGrants});},
    async authorizeSources(){events.push('sources');return JSON.stringify({sourceIds:[...new Set(descriptor.sourceRequirements.map(x=>x.sourceId))],enabled:true,policyRevision:scope.policyRevision,checkedAtMs:state.now});}
  };
  const budget={
    async reserve({reservationId}){events.push('reserve');return JSON.stringify({reservationId,decision:'reserved'});},
    async settle({reservationId}){events.push('settle');return JSON.stringify({reservationId,decision:'settled'});},
    async markUncertain(){events.push('uncertain');}
  };
  const contextPorts={
    async loadPrevious({key,signal}){events.push('load');state.loadKey=key;state.loadSignal=signal;
      const response={record:stored.get(canonicalSha256(key))??null,checkedAtMs:state.now};
      return JSON.stringify(state.changeLoad?state.changeLoad(clone(response)):response);},
    async retain({record,signal}){events.push('retain');state.retained=clone(record);state.retainSignal=signal;
      stored.set(canonicalSha256(record.key),clone(record));
      const response={decision:'retained',keySha256:canonicalSha256(record.key),previousSha256:record.previousSha256,checkedAtMs:state.now};
      return JSON.stringify(state.changeRetain?state.changeRetain(response):response);}
  };
  const entry={descriptor,contract,async execute(call){events.push('handler');state.call=call;
    const continued=call.input.cursor!==null;
    const page={tool:'list_memory_proposals',enabled:true,authority:'own_pending_proposals',claimsAreApprovedFacts:false,
      scope:{tenantId:binding.tenantId,userId:binding.actorId,clientId:call.input.clientId},
      candidates:[{id:continued?id('8'):id('9'),status:'pending',approvedFact:false,scope:client?'client':'personal',
        clientId:client,sourceKind:'explicit_user',createdAt:continued?'2026-10-10T00:00:00Z':'2026-10-11T00:00:00Z',
        restricted:false,title:'Independent synthetic proposal',proposedText:'Unapproved synthetic content',contentTruncated:false}],
      nextCursor:state.nextCursor,
      coverage:{firstPage:!continued,complete:!continued&&state.nextCursor===null,
        reason:!continued&&state.nextCursor===null?'own_pending_proposals_complete':'unread_pages_restricted_or_truncated_content'}};
    const result={binding:call.authority.binding,subject:call.authority.subject,operation,
      argumentsSha256:call.argumentsSha256,result:page};
    return state.rawOutput??JSON.stringify(state.changeOutput?state.changeOutput(result):result);
  }};
  const authority=createCurrentToolAuthority({ports:authorityPorts,now:()=>state.now,maxFactBytes:65536});
  const create=changes=>createToolDispatch({catalog:{entry:()=>entry,discoverable:()=>[entry]},authority,budget,
    limits,now:()=>state.now,newId:()=>id('b'),sourceEnabled:true,memoryContextPorts:contextPorts,...changes});
  return {state,events,stored,binding,subject,claims,scope,contract,entry,authorityPorts,budget,contextPorts,create};
}

async function seeded() {
  const f=fixture({nextCursor:'cursor-one'});
  await f.create().execute(request({}),'synthetic');
  assert.equal(f.events.filter(x=>x==='retain').length,1);
  f.events.length=0;f.state.nextCursor=null;f.state.policyCalls=0;
  return f;
}
async function denied(f,args={},changes={}) {
  await assert.rejects(f.create(changes).execute(request(args),'synthetic'),/^GatewayDenied: (INVALID_ARGUMENTS|ACCESS_DENIED|INVALID_RESULT|DEADLINE|CANCELLED|BUDGET_UNCERTAIN|GATEWAY_CONFIGURATION)$/);
}

test('independent: canonical mail and memory profiles are selected; actual15 stay unavailable',async()=>{
  const selected=CATALOG_OPERATION_BINDINGS.filter(row=>row.dispatchProfile!==undefined);
  assert.deepEqual(selected.map(row=>[row.id,row.dispatchProfile]),[['mail.list_messages','mail-candidates/1'],['mail.search_messages','mail-candidates/1'],[operation.id,'memory-proposals/1']]);
  const catalog=JSON.parse(readFileSync(new URL('packages/contracts/retrieval-0.2/catalog.json',root)));
  assert.equal(catalog.operations.length,37);assert.equal(catalog.originals.length,139);
  const f=fixture();const gateway=createSourceDisabledGateway({authorityPorts:f.authorityPorts,budget:f.budget,limits,now:()=>NOW,newId:()=>id('b')});
  const view=createRuntimeCatalog({catalogJson:JSON.stringify(catalog),contracts});
  for(const row of catalog.operations){assert.equal(row.availability,'unimplemented');assert.equal(row.qualification,'pending');
    assert.equal(row.handler,null);assert.equal(view.entry(row.operation),null);
    await assert.rejects(gateway.execute(JSON.stringify({operation:row.operation,arguments:{}}),'synthetic'),/UNAVAILABLE/);}
  assert.equal(gateway.sourceEnabled,false);assert.deepEqual(await gateway.discover(),[]);assert.deepEqual(f.events,[]);
});

test('independent: first page uses fresh server-selected client and canonical normalized input',async()=>{
  const f=fixture({client:id('c')});
  const output=JSON.parse(await f.create().execute(request({clientId:null,limit:null}),'synthetic'));
  assert.deepEqual(f.state.inputs[0],{clientId:null,limit:null});
  assert.deepEqual(f.state.inputs[1],{clientId:id('c'),cursor:null,limit:5});
  assert.deepEqual(f.state.call.input,f.state.inputs[1]);
  assert.equal(output.result.scope.clientId,id('c'));assert.equal(output.argumentsSha256,canonicalSha256(f.state.call.input));
  assert.equal(f.events.includes('load'),false);assert.equal(f.events.includes('retain'),false);
});

test('independent: canonical continuation consumes retained raw request/page and advances',async()=>{
  const f=await seeded(), record=f.state.retained;
  assert.deepEqual(record.previous.request,{});assert.equal(record.previous.page.nextCursor,'cursor-one');
  assert.equal(record.previousSha256,canonicalSha256(record.previous));
  assert.deepEqual(record.key,{binding:f.binding,operation,policyRevision:f.scope.policyRevision,subject:stable(f.subject),cursor:'cursor-one'});
  const output=JSON.parse(await f.create().execute(request({cursor:'cursor-one'}),'synthetic'));
  assert.equal(output.result.coverage.firstPage,false);assert.equal(output.result.candidates[0].id,id('8'));
  assert.equal(f.events.filter(x=>x==='load').length,1);assert.equal(f.events.filter(x=>x==='handler').length,1);
});

test('independent: all invalid model shape/context inputs fail before trusted ports',async()=>{
  for(const args of [{subject:{}},{previous:{}},{context:{}},{authorizationDecisionId:id('a')},{policyRevision:'x'},
    {binding:{}},{tenantId:id('1')},{cursor:''},{limit:11},{limit:1.5},{clientId:'not-a-client'},[],null]){
    const f=fixture();await denied(f,args);assert.deepEqual(f.events,[],JSON.stringify(args));}
  let effects=0;const raw=new Proxy({},{get(){effects++;throw Error('get');},ownKeys(){effects++;throw Error('keys');}});
  const f=fixture();await assert.rejects(f.create().execute(raw,'synthetic'),/INVALID_ARGUMENTS/);assert.equal(effects,0);assert.deepEqual(f.events,[]);
});

test('independent: client selector cannot override server subject before effects',async()=>{
  const f=fixture({client:id('c')});await denied(f,{clientId:id('d')});
  assert.equal(f.events.includes('handler'),false);assert.equal(f.events.includes('reserve'),false);
});

test('independent: decision IDs rotate while stable authority remains required',async()=>{
  const f=fixture();f.state.beforePolicy=ordinal=>{f.subject.authorizationDecisionId=id(String(ordinal));};
  await f.create().execute(request({}),'synthetic');assert.equal(f.events.filter(x=>x==='handler').length,1);
});

for(const ordinal of [2,3,4,5])test(`independent: stable subject drift at authority stage ${ordinal} never releases`,async()=>{
  const f=fixture({client:id('c')});
  f.state.beforePolicy=n=>{if(n===ordinal){f.subject.entityIds=[id('d')];}};
  await denied(f);if(ordinal<=3)assert.equal(f.events.includes('handler'),false);
});

test('independent: absent retained context or context ports cannot invent continuation',async()=>{
  for(const changes of [{},{memoryContextPorts:undefined}]){const f=fixture();await denied(f,{cursor:'unknown'},changes);
    assert.equal(f.events.includes('handler'),false);assert.equal(f.events.includes('reserve'),false);}
});

const corruptRecords={
  tenant:r=>{r.record.key.binding.tenantId=id('f');}, actor:r=>{r.record.key.binding.actorId=id('f');},
  conversation:r=>{r.record.key.binding.conversationId=id('f');},run:r=>{r.record.key.binding.runId=id('f');},
  attempt:r=>{r.record.key.binding.attemptId=id('f');},worker:r=>{r.record.key.binding.workerId=id('f');},
  fence:r=>{r.record.key.binding.writerFence++;},policy:r=>{r.record.key.policyRevision='other';},
  operation:r=>{r.record.key.operation.id='query_tasks';},version:r=>{r.record.key.operation.version='0.1.0';},
  subject:r=>{r.record.key.subject.entityIds=[id('f')];},cursor:r=>{r.record.key.cursor='different';},
  digest:r=>{r.record.previousSha256='f'.repeat(64);},
  staleRead:r=>{r.checkedAtMs=NOW-1;},futureRead:r=>{r.checkedAtMs=NOW+1;},
  futureRecord:r=>{r.record.recordedAtMs=NOW+1;},expired:r=>{r.record.expiresAtMs=NOW;},
  beyondAuthority:r=>{r.record.expiresAtMs=NOW+10001;},extra:r=>{r.record.extra=true;},
  limit:r=>{r.record.previous.request.limit=10;r.record.previousSha256=canonicalSha256(r.record.previous);},
  poisonedCursor:r=>{r.record.previous.page.nextCursor='different';r.record.previousSha256=canonicalSha256(r.record.previous);},
  invalidPage:r=>{r.record.previous.page.candidates[0].approvedFact=true;r.record.previousSha256=canonicalSha256(r.record.previous);}
};
for(const [name,change] of Object.entries(corruptRecords))test(`independent: retained context rejects ${name}`,async()=>{
  const f=await seeded();f.state.changeLoad=value=>{change(value);return value;};await denied(f,{cursor:'cursor-one'});
  assert.equal(f.events.includes('handler'),false);assert.equal(f.events.includes('reserve'),false);
});

const corruptOutput={
  operation:o=>{o.operation={id:'query_tasks',version:'0.2.0'};},arguments:o=>{o.argumentsSha256='f'.repeat(64);},
  binding:o=>{o.binding={...o.binding,writerFence:2};},subject:o=>{o.subject={...o.subject,authorizationDecisionId:id('f')};},
  extra:o=>{o.extra=true;},missing:o=>{delete o.operation;},approved:o=>{o.result.candidates[0].approvedFact=true;},
  actor:o=>{o.result.scope.userId=id('f');},restricted:o=>{o.result.candidates[0].restricted=true;},
  coverage:o=>{o.result.coverage.complete=false;}
};
for(const [name,change] of Object.entries(corruptOutput))test(`independent: envelope and raw DTO reject ${name}`,async()=>{
  const f=fixture();f.state.changeOutput=value=>{change(value);return value;};await denied(f);
  assert.equal(f.events.includes('settle'),false);assert.equal(f.events.includes('retain'),false);assert.equal(f.events.includes('uncertain'),true);
});

for(const field of ['decision','keySha256','previousSha256','checkedAtMs'])test(`independent: retain receipt rejects ${field}`,async()=>{
  const f=fixture({nextCursor:'cursor-one'});f.state.changeRetain=value=>({...value,[field]:field==='checkedAtMs'?NOW-1:'wrong'});
  await denied(f);assert.equal(f.events.includes('retain'),true);assert.equal(f.events.includes('settle'),false);assert.equal(f.events.includes('uncertain'),true);
});

for(const target of ['load','retain'])test(`independent: ${target} rejects hostile non-JSON receipt without property effects`,async()=>{
  const f=target==='load'?await seeded():fixture({nextCursor:'cursor-one'});let effects=0;
  // An async port necessarily performs Promise thenable assimilation before
  // its value reaches the raw-JSON boundary; keep that language lookup inert.
  const hostile=new Proxy({},{get(_value,key){if(key==='then')return undefined;effects++;throw Error('get');},ownKeys(){effects++;throw Error('keys');}});
  f.contextPorts[target==='load'?'loadPrevious':'retain']=async()=>hostile;
  await denied(f,target==='load'?{cursor:'cursor-one'}:{});assert.equal(effects,0);
  assert.equal(f.events.includes('settle'),false);if(target==='load')assert.equal(f.events.includes('handler'),false);
});

test('independent: retained ports receive immutable context detached from model objects',async()=>{
  const f=fixture({nextCursor:'cursor-one'}),retain=f.contextPorts.retain;
  f.contextPorts.retain=async call=>{
    for(const value of [call.record,call.record.key,call.record.key.binding,call.record.key.subject,
      call.record.previous,call.record.previous.request,call.record.previous.page])assert.ok(Object.isFrozen(value));
    return retain(call);
  };
  await f.create().execute(request({}),'synthetic');f.state.nextCursor=null;
  const loadPrevious=f.contextPorts.loadPrevious;f.contextPorts.loadPrevious=async call=>{
    for(const value of [call.key,call.key.binding,call.key.subject,call.key.operation])assert.ok(Object.isFrozen(value));
    return loadPrevious(call);
  };
  await f.create().execute(request({cursor:'cursor-one'}),'synthetic');
});

test('independent: release revocation prevents retain, final revocation prevents release',async()=>{
  for(const stage of ['handler','settle']){
    const f=fixture({nextCursor:'cursor-one'});
    const target=stage==='handler'?f.entry:f.budget,method=stage==='handler'?'execute':'settle';
    const original=target[method];target[method]=async(...args)=>{const result=await original(...args);f.state.revoked=true;return result;};
    await denied(f);assert.equal(f.events.includes('retain'),stage==='settle');
  }
});

for(const target of ['load','retain','settle'])test(`independent: fresh shortened authority bounds parked ${target} and late completion`,async()=>{
  const f=target==='load'?await seeded():fixture({nextCursor:'cursor-one'});
  f.state.deadline=NOW+20;
  const port=target==='settle'?f.budget:f.contextPorts,method=target==='load'?'loadPrevious':target;
  const original=port[method];let release,parkedSignal,completed=false,released=false,failure;
  port[method]=async call=>{f.events.push(`park:${target}`);parkedSignal=call.signal;return new Promise(resolve=>{release=async()=>resolve(await original(call));});};
  const controller=new AbortController();
  const pending=f.create().execute(request(target==='load'?{cursor:'cursor-one'}:{}),'synthetic',controller.signal)
    .then(()=>{released=true;},error=>{failure=error.message;}).finally(()=>{completed=true;});
  let observed,beforeLate;
  try{await pause(100);observed={completed,failure,aborted:parkedSignal?.aborted,parked:!!release};beforeLate=[...f.events];}
  finally{controller.abort();await pending;await release?.();await drain();await drain();}
  assert.deepEqual(observed,{completed:true,failure:'DEADLINE',aborted:true,parked:true});assert.equal(released,false);
  const after=f.events.slice(beforeLate.length).filter(x=>x!==target);assert.deepEqual(after,[],'late context/settle completion must not start later effects');
});
