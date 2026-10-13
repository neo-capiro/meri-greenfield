import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {createClientKnowledgeHttpAdapter} from '../http-adapter.mjs';
import {createClientKnowledgeReadHandler} from '../handler.mjs';
import {createClientKnowledgeFixture,endpoints,memoryText,NOW,uuid} from './fixtures.mjs';
const json=page=>new Response(JSON.stringify(page),{headers:{'content-type':'application/json'}});
const readCall=(f,request=f.args,current=f.authority)=>({operation:f.operation,input:f.input(request),request,authority:current,normalizationContext:f.normalizationContext});
const execute=(f,changes={},call=f.call())=>createClientKnowledgeReadHandler({operation:f.operation,
  adapter:createClientKnowledgeHttpAdapter({...f.config,...changes}),now:()=>f.state.now})(call);
const drain=()=>new Promise(resolve=>setImmediate(resolve));

for(const id of ['search_memory','read_monday_client_boards'])test(`${id}: actual loopback Fetch bytes, canonical body hash, scoped broker and handler`,async()=>{
  const f=createClientKnowledgeFixture(id),seen=[];
  const server=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;
    seen.push({method:req.method,headers:req.headers,body});res.writeHead(200,{'content-type':'application/json; charset=utf-8'});
    res.end(JSON.stringify(f.page(JSON.parse(body).input)));});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try {
    const fetchImpl=(url,options)=>{assert.equal(url,endpoints[id]);assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
      return fetch(`http://127.0.0.1:${server.address().port}/knowledge`,options);};
    const out=JSON.parse(await execute(f,{fetchImpl})),wire=seen[0];
    assert.deepEqual(out.result,f.page());assert.deepEqual(out.binding,f.binding);assert.deepEqual(out.subject,f.subject);
    assert.deepEqual(out.operation,f.operation);assert.equal(out.argumentsSha256,canonicalSha256(f.input()));assert.equal(seen.length,1);
    assert.equal(wire.method,'POST');assert.equal(wire.headers.authorization,'Bearer SYNTHETIC_KNOWLEDGE_TOKEN');
    assert.equal(wire.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE_SECRET');assert.equal(wire.headers['x-tenant-id'],undefined);
    const pins=f.credentialCalls[0],body=JSON.parse(wire.body);
    assert.deepEqual(body,{input:f.input(),metadata:f.normalized().metadata});assert.deepEqual(pins.normalizationContext,f.normalizationContext);
    assert.equal(createHash('sha256').update(wire.body,'utf8').digest('hex'),pins.requestSha256);
    assert.equal(pins.argumentsSha256,canonicalSha256(body.input));assert.equal(Object.isFrozen(pins.subject.scopes),true);
    assert.equal(Object.isFrozen(pins.normalizationContext),true);assert.equal(body.binding,undefined);assert.equal(body.normalizationContext,undefined);
    if(id==='search_memory'){assert.equal(f.eligibilityCalls.length,1);assert.equal(f.eligibilityCalls[0].resultSha256,canonicalSha256(out.result));
      assert.deepEqual(f.eligibilityCalls[0].records,[{memoryItemId:out.result.records[0].recordId,recordSha256:canonicalSha256(out.result.records[0])}]);}
    else assert.equal(f.eligibilityCalls.length,0);
  }finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));assert.equal(server.listening,false);}
});

test('memory exact nextRead retrieves late UTF16 material without changing approved record hash/version/scope',async()=>{
  const f=createClientKnowledgeFixture(),first=JSON.parse(await execute(f)).result;
  assert.equal(first.records[0].payload.value.includes('allocation was approved'),false);assert.equal(first.contentTruncated,true);
  const next=first.records[0].payload.content.nextRead,read=JSON.parse(await execute(f,{},f.call(next))).result;
  assert.equal(read.records[0].payload.value.includes('allocation was approved'),true);assert.equal(read.records[0].payload.value.includes('😀'),true);
  assert.equal(read.records[0].payload.content.offset,500);assert.equal(read.records[0].payload.content.endOffset,memoryText.length);
  assert.equal(read.records[0].payload.content.endOffset-read.records[0].payload.content.offset,read.records[0].payload.value.length);
  assert.equal(read.records[0].payload.content.hash,first.records[0].payload.content.hash);
  assert.equal(read.records[0].provenance.sourceVersion,first.records[0].provenance.sourceVersion);
  assert.equal(read.records[0].payload.content.nextRead,null);assert.equal(read.records[0].payload.governance.expiresAt,null);
  assert.equal(read.records[0].payload.governance.reviewDueAt,null);assert.equal(f.eligibilityCalls.length,2);
});

test('memory metadata-only event is preserved with fact limitation and unknown provenance',async()=>{
  const f=createClientKnowledgeFixture(),page=f.page();
  page.records[0].payload.contentStatus='metadata_only';page.records[0].payload.contentLimitation='This approved record contains a learning-event description, not the underlying fact. The original source must be reviewed before proposing corrected content; approval of this event is not verification of an unstored capability, person or facility.';
  page.factContentUnavailableCount=1;page.contentStatus='metadata_only';page.records[0].provenance.sourceRef=null;page.records[0].provenance.sourceExcerpt=null;
  const out=JSON.parse(await execute(f,{fetchImpl:async()=>json(page)})).result;
  assert.deepEqual(out,page);assert.equal(out.factContentUnavailableCount,1);assert.match(out.records[0].payload.contentLimitation,/not verification/);
});

test('memory approved stale or controlling conflict observation remains eligible only by current native receipt',async()=>{
  for(const status of ['stale','conflicted']){const f=createClientKnowledgeFixture(),page=f.page();
    Object.assign(page.records[0].payload.governance,{status,stale:true,conflictStatus:'controlling',controllingItemId:page.records[0].recordId});
    const result=JSON.parse(await execute(f,{fetchImpl:async()=>json(page)})).result;
    assert.equal(result.records[0].payload.governance.status,status);assert.equal(f.eligibilityCalls.length,1);
  }
});

test('memory client scope permits firm rows without treating selected client as universal access',async()=>{
  const f=createClientKnowledgeFixture('search_memory',{client:true}),out=JSON.parse(await execute(f));
  assert.equal(out.subject.kind,'client');assert.equal(out.result.records[0].payload.scope,'firm');assert.equal(out.result.records[0].payload.clientId,null);
  assert.equal(JSON.parse(f.wire[0].options.body).input.clientId,f.clientId);
});

test('memory empty partial/unavailable recall preserves unknown coverage and still requires exact current eligibility receipt',async()=>{
  for(const status of ['healthy','unavailable']){
    const f=createClientKnowledgeFixture(),page=f.page();page.records=[];page.results=[];page.factContentUnavailableCount=0;
    page.contentStatus=status==='healthy'?'empty':'unavailable';page.contentTruncated=false;
    page.summary='No eligible memory was returned. Coverage distinguishes an empty result from unavailable recall.';
    Object.assign(page.coverage,{recordsEvaluated:0,recordsReturned:0,complete:false,paginationComplete:false,
      unavailableSources:status==='unavailable'?['institutional_knowledge']:[]});
    Object.assign(page.coverage.sources[0],{sourceStatus:status,returned:0,recordsEvaluated:0,truncated:true,
      hasMore:status==='healthy',coverageComplete:false,paginationComplete:false,stopReason:'synthetic-unknown-remaining-coverage'});
    Object.assign(page.observability,{coverageComplete:false});
    const out=JSON.parse(await execute(f,{fetchImpl:async()=>json(page)})).result;
    assert.equal(out.coverage.complete,false);assert.equal(out.contentStatus,page.contentStatus);
    assert.equal(f.eligibilityCalls.length,1);assert.deepEqual(f.eligibilityCalls[0].records,[]);
    assert.match(out.governanceCoverage.excluded,/does not establish/);
  }
});

for(const request of [{cursor:'opaque-search-cursor'},{k:'3.7',query:'  café 😀  '}])test(`memory preserves canonical normalized search ${JSON.stringify(request)}`,async()=>{
  const f=createClientKnowledgeFixture(),args={...f.args,...request};await execute(f,{},f.call(args));
  assert.deepEqual(JSON.parse(f.wire[0].options.body),{input:f.input(args),metadata:f.normalized(args).metadata});
  assert.equal(createHash('sha256').update(f.wire[0].options.body).digest('hex'),f.credentialCalls[0].requestSha256);
});

const eligibilityChanges={
  pending:r=>r.records[0].eligibleForRecall=false,unknown:r=>r.records[0].eligibleForRecall=null,
  missing:r=>r.records=[],additional:r=>r.records.push({...r.records[0],memoryItemId:uuid('d')}),duplicate:r=>r.records.push({...r.records[0]}),
  item:r=>r.records[0].memoryItemId=uuid('d'),recordHash:r=>r.records[0].recordSha256='d'.repeat(64),resultHash:r=>r.resultSha256='d'.repeat(64),
  context:r=>r.normalizationContext.userId=uuid('d'),actor:r=>r.binding.actorId=uuid('d'),fence:r=>r.binding.writerFence++,
  client:r=>r.subject.entityIds=[uuid('d')],source:r=>r.sourceIds=['foreign'],policy:r=>r.policyRevision='foreign',
  stale:r=>r.checkedAtMs=NOW-1,future:r=>r.checkedAtMs=NOW+1,expired:r=>r.expiresAtMs=NOW,extended:r=>r.expiresAtMs++,
  extra:r=>r.records[0].approved=true,missingReceipt:r=>null,
};
for(const [name,mutate]of Object.entries(eligibilityChanges))test(`memory ${name} eligibility receipt refuses whole unmodified response`,async()=>{
  const f=createClientKnowledgeFixture();let inspected;
  await assert.rejects(execute(f,{readMemoryEligibility:async pins=>{inspected=pins;const r=f.eligibility(pins);
    const replacement=mutate(r);return name==='missingReceipt'?replacement:r;}}));
  assert.equal(f.calls.includes('fetch'),true);assert.equal(inspected.records.length,1);assert.equal(Object.isFrozen(inspected.records[0]),true);
});

test('memory healthy source and active DTO cannot promote pending proposal or expired/native-ineligible material',async()=>{
  for(const reason of ['pending-proposal','expired-ttl','wrong-private-owner','missing-review','missing-source-provenance']){
    const f=createClientKnowledgeFixture(),page=f.page();
    if(reason==='expired-ttl')page.records[0].payload.governance.expiresAt=new Date(NOW-1000).toISOString();
    if(reason==='missing-review')Object.assign(page.records[0].payload.governance,{approvedAt:null,approvedByUserId:null});
    if(reason==='missing-source-provenance')Object.assign(page.records[0].provenance,{sourceId:null,sourceRef:null,sourceVersion:null});
    if(reason==='pending-proposal')page.records[0].payload.governance.authority='working_draft';
    await assert.rejects(execute(f,{fetchImpl:async()=>json(page),readMemoryEligibility:async pins=>{const r=f.eligibility(pins);r.records[0].eligibleForRecall=false;return r;}}));
  }
});

test('memory pending lifecycle label is refused by canonical DTO before eligibility port',async()=>{
  const f=createClientKnowledgeFixture(),page=f.page();page.records[0].payload.governance.status='pending_review';
  await assert.rejects(execute(f,{fetchImpl:async()=>json(page)}),/INVALID_RESULT/);assert.equal(f.eligibilityCalls.length,0);
});

for(const name of ['tenant','actor','client','board','version','duplicate','missing'])test(`Monday trusted managed mapping ${name} refuses before Fetch`,async()=>{
  const f=createClientKnowledgeFixture('read_monday_client_boards');
  await assert.rejects(execute(f,{getCredentials:async pins=>{const c=f.credentials(pins),m=c.managedBoardMapping;
    if(name==='tenant')m.tenantId=uuid('d');if(name==='actor')m.userId=uuid('d');if(name==='client')m.clientId=uuid('d');
    if(name==='board')m.boardIds=['model-invented'];if(name==='version')m.mappingVersionId='';if(name==='duplicate')m.boardIds=['101','101'];
    if(name==='missing')delete c.managedBoardMapping;return c;}}));
  assert.equal(f.calls.includes('fetch'),false);
});

for(const name of ['board','client','actor'])test(`Monday source row ${name} cannot escape current managed mapping`,async()=>{
  const f=createClientKnowledgeFixture('read_monday_client_boards'),page=f.page();
  if(name==='board'){page.records[0].payload.origin.boardId='999';page.records[0].provenance.boardId='999';page.records[0].recordId='999:202';}
  if(name==='client')page.records[0].payload.clientId=uuid('d');if(name==='actor')page.records[0].payload.sourceActorUserId=uuid('d');
  await assert.rejects(execute(f,{fetchImpl:async()=>json(page)}),/INVALID_RESULT/);
});

test('Monday model boardContext stays a selector; exact broker mapping alone admits each item/subitem',async()=>{
  const f=createClientKnowledgeFixture('read_monday_client_boards'),args={...f.args,boardContext:'999'},page=f.page(f.input(args));
  Object.assign(page.records[0].payload.origin,{itemType:'subitem',parentItemId:'303'});page.records[0].provenance.parentItemId='303';
  let observedBody;
  const out=JSON.parse(await execute(f,{fetchImpl:async(url,options)=>{observedBody=options.body;return json(page);}},f.call(args))).result;
  assert.equal(JSON.parse(observedBody).input.boardContext,'999');
  assert.equal(out.records[0].payload.origin.boardId,'101');assert.equal(out.records[0].payload.origin.parentItemId,'303');
});

test('Monday explicit page/cursor and opaque inert provider columns survive without refresh/write',async()=>{
  const f=createClientKnowledgeFixture('read_monday_client_boards'),args={...f.args,cursor:'OPAQUE_PROVIDER_CURSOR',pageSize:1};
  const out=JSON.parse(await execute(f,{},f.call(args))).result;
  assert.equal(JSON.parse(f.wire[0].options.body).input.cursor,'OPAQUE_PROVIDER_CURSOR');
  assert.equal(f.credentialCalls[0].metadata.pagination,'explicit-page');assert.deepEqual(out.records[0].payload.columns,[{value:{inert:true}}]);
  assert.equal(f.calls.includes('eligibility'),false);
});

const credentialChanges={context:c=>c.normalizationContext={tenantId:uuid('d'),userId:uuid('d')},metadata:c=>c.metadata={sourceConnected:true},
  actor:c=>c.binding.actorId=uuid('d'),attempt:c=>c.binding.attemptId=uuid('d'),fence:c=>c.binding.writerFence++,subject:c=>c.subject.authorizationDecisionId=uuid('d'),
  operation:c=>c.operation.id='read_monday_client_boards',digest:c=>c.argumentsSha256='d'.repeat(64),bodyHash:c=>c.requestSha256='d'.repeat(64),
  source:c=>c.sourceIds=['foreign'],policy:c=>c.policyRevision='foreign',token:c=>c.bearerToken='bad\nheader'};
for(const [name,mutate]of Object.entries(credentialChanges))test(`knowledge credential ${name} substitution refuses before Fetch`,async()=>{
  const f=createClientKnowledgeFixture();await assert.rejects(execute(f,{getCredentials:async pins=>{const c=f.credentials(pins);mutate(c);return c;}}),/ACCESS_DENIED/);
  assert.equal(f.calls.includes('fetch'),false);
});

test('knowledge full canonical authority rejects audience/actions/decision mismatch before broker',async()=>{
  for(const change of [a=>a.claims.audience='meri-broker',a=>a.claims.actions=['command.execute'],a=>a.decision.decision='denied',
    a=>a.decision.operation='other@0.2.0',a=>a.decision.decisionId=uuid('d'),a=>delete a.decision.scopes,a=>a.subject.scopes=[]]){
    const f=createClientKnowledgeFixture(),authority=structuredClone(f.authority);change(authority);
    await assert.rejects(execute(f,{},f.call(f.args,authority)));assert.deepEqual(f.calls,[]);
  }
});

test('knowledge normalization context and normalized selection cannot be supplied by model/request',async()=>{
  for(const seam of ['context','requestContext','metadata','selection']){const f=createClientKnowledgeFixture(),call=f.call();
    if(seam==='context')call.normalizationContext={...f.normalizationContext,userId:uuid('d')};
    if(seam==='requestContext')call.request={...f.args,normalizationContext:f.normalizationContext};
    if(seam==='metadata')call.metadata={currentPolicyQualified:true};if(seam==='selection')call.input={...call.input,k:2};
    await assert.rejects(execute(f,{},call));assert.deepEqual(f.calls,[]);
  }
});

test('knowledge handler preserves WeakMap-backed ordinary read receiver and original captured method',async()=>{
  for(const id of ['search_memory','read_monday_client_boards']){const f=createClientKnowledgeFixture(id),state=new WeakMap();
    const adapter={async read(call){assert.equal(state.get(this),f.page);return state.get(this)(call.input);}};state.set(adapter,f.page);
    const handler=createClientKnowledgeReadHandler({operation:f.operation,adapter,now:()=>f.state.now});
    adapter.read=()=>{throw Error('replacement');};assert.deepEqual(JSON.parse(await handler(f.call())).result,f.page());
  }
});

for(const kind of ['status','media','encoding','length','overflow','utf8','json','object'])test(`knowledge ${kind} response refuses boundedly without source diagnostics`,async()=>{
  const f=createClientKnowledgeFixture(),changes={};if(kind==='overflow')changes.maxResponseBytes=64;
  changes.fetchImpl=async()=>kind==='object'?{body:'PRIVATE'}:new Response(kind==='utf8'?new Uint8Array([0xc3,0x28]):kind==='json'?'{PRIVATE':JSON.stringify(f.page()),
    {status:kind==='status'?403:200,headers:{'content-type':kind==='media'?'text/html':'application/json',...(kind==='encoding'?{'content-encoding':'gzip'}:{}),
      ...(kind==='length'?{'content-length':'1'}:{})}});
  await assert.rejects(execute(f,changes),error=>!error.message.includes('PRIVATE'));assert.equal(f.eligibilityCalls.length,0);
});

for(const stage of ['credentials','fetch','body','eligibility'])for(const cancel of [false,true])test(`knowledge ${cancel?'cancel':'deadline'} bounds parked ${stage} and cleans late response`,async()=>{
  const f=createClientKnowledgeFixture(),held=Promise.withResolvers(),entered=Promise.withResolvers(),controller=new AbortController();let effectSignal,bodyCancelled=false;
  const changes={maxRequestMs:25};
  if(stage==='credentials')changes.getCredentials=pins=>{effectSignal=pins.signal;entered.resolve();return held.promise;};
  if(stage==='fetch')changes.fetchImpl=(url,options)=>{effectSignal=options.signal;entered.resolve();return held.promise;};
  if(stage==='body')changes.fetchImpl=async(url,options)=>{effectSignal=options.signal;return new Response(new ReadableStream({pull(){entered.resolve();return held.promise;},cancel(){bodyCancelled=true;}}),{headers:{'content-type':'application/json'}});};
  if(stage==='eligibility')changes.readMemoryEligibility=pins=>{effectSignal=pins.signal;entered.resolve();return held.promise;};
  const pending=execute(f,changes,{...f.call(),signal:controller.signal});
  try {await entered.promise;if(cancel)controller.abort();await assert.rejects(pending,new RegExp(cancel?'CANCELLED':'DEADLINE'));
    assert.equal(effectSignal.aborted,true);const after=f.calls.length;
    const late=new Response(new ReadableStream({cancel(){bodyCancelled=true;}}),{headers:{'content-type':'application/json'}});held.resolve(stage==='fetch'?late:undefined);
    await drain();await drain();assert.equal(f.calls.length,after);if(stage==='fetch'||stage==='body')assert.equal(bodyCancelled,true);
  }finally {controller.abort();held.resolve();await pending.catch(()=>{});}
});

test('knowledge inert admission never reads proxy/accessor authority/receipts/signals',async()=>{
  for(const stage of ['call','authority','credential','signal','eligibility']){const f=createClientKnowledgeFixture();let hits=0;let call=f.call(),changes={};
    const proxy=new Proxy({},{get(t,k){if(k==='then')return undefined;hits++;throw Error('private');},ownKeys(){hits++;throw Error('private');},getPrototypeOf(){hits++;throw Error('private');}});
    if(stage==='call')call=proxy;if(stage==='authority')call.authority=proxy;if(stage==='credential')changes.getCredentials=async()=>proxy;
    if(stage==='eligibility')changes.readMemoryEligibility=async()=>proxy;if(stage==='signal')call.signal={get aborted(){hits++;throw Error('private');}};
    await assert.rejects(execute(f,changes,call));assert.equal(hits,0);
  }
});

test('knowledge configured endpoints refuse missing/extra/nonHTTPS credentials/query/fragment before I/O',()=>{
  const f=createClientKnowledgeFixture();for(const value of [{},{...endpoints,extra:'https://source.invalid'},{...endpoints,search_memory:'http://source.invalid'},
    {...endpoints,search_memory:'https://x:y@source.invalid'},{...endpoints,search_memory:'https://source.invalid?actor=1'},{...endpoints,search_memory:'https://source.invalid#x'}])
    assert.throws(()=>createClientKnowledgeHttpAdapter({...f.config,endpoints:value}));assert.deepEqual(f.calls,[]);
});
