import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {createClientEvidenceHttpAdapter} from '../http-adapter.mjs';
import {createClientEvidenceReadHandler} from '../handler.mjs';
import {clientEvidenceFixture,credentialReceipt,NOW,asOf,id,operations,endpoints,clientId,documentId,fullBody,sections,documentCursor,sha} from './fixtures.mjs';
const rawProfile={clientId:'Synthetic named client',section:'people'},rawDocument={clientId,documentId};
function setup(operation=operations.profile,request=rawProfile,options={}) {
 const f=clientEvidenceFixture(operation,request,options),wire=[],credentialRequests=[],state={now:NOW};
 const config={endpoints,now:()=>state.now,maxRequestMs:500,maxResponseBytes:65536,
  getCredentials:async request=>{credentialRequests.push(request);return credentialReceipt(request);},
  fetchImpl:async(url,options)=>{wire.push({url,options});return new Response(JSON.stringify(f.page),{headers:{'content-type':'application/json'}});}};
 const create=(changes={})=>createClientEvidenceReadHandler({operation,adapter:createClientEvidenceHttpAdapter({...config,...changes}),now:()=>state.now});
 return {...f,wire,credentialRequests,state,config,create};
}
for(const section of sections)test(`profile exact full ${section} section survives actual response bytes`,async()=>{
 const f=setup(operations.profile,{clientId:'Synthetic named client',section}),output=JSON.parse(await f.create()(f.call));
 assert.deepEqual(output,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:f.call.argumentsSha256,result:f.page});
 assert.deepEqual(JSON.parse(f.wire[0].options.body),{input:f.input,metadata:f.metadata});
 assert.equal(f.wire[0].url,endpoints[f.operation.id]);assert.equal(output.result.generatedAt,asOf);
 assert.deepEqual(f.credentialRequests[0].normalizationContext,f.normalizationContext);
 assert.equal(f.credentialRequests[0].requestSha256,canonicalSha256({input:f.input,metadata:f.metadata}));
 assert.equal(f.wire[0].options.credentials,'omit');assert.equal(f.wire[0].options.redirect,'error');
 assert.equal(output.result.profileSections[section].status,'complete');assert.equal(output.result.profile[section].length,1);
 for(const other of sections.filter(s=>s!==section))assert.equal(output.result.profileSections[other].status,'not_requested');
 assert.equal(f.metadata.engagementCoverage,'recent-only');assert.equal(f.metadata.currentPolicyQualified,false);assert.equal(f.metadata.authoritative,false);
 if(section==='people')assert.equal(output.result.profile.people[0].placementConfidence,'9.999');
 assert.ok(!f.wire[0].options.body.includes('bearerToken'));assert.ok(!f.wire[0].options.body.includes('normalizationContext'));
});
test('broker whole-request digest equals the exact canonical UTF-8 bytes emitted to Fetch',async()=>{
 for(const [operation,request] of [[operations.profile,rawProfile],[operations.documents,rawDocument]]) {
  const f=setup(operation,request);await f.create()(f.call);
  assert.equal(sha(f.wire[0].options.body),f.credentialRequests[0].requestSha256);
 }
});
test('profile overview preserves all requested and unavailable sections without equating a gap to empty',async()=>{
 const f=setup(operations.profile,{clientId}),section=f.page.profileSections.people;
 Object.assign(section,{status:'unavailable',total:null,truncated:null,error:'section_unavailable'});
 const output=JSON.parse(await f.create()(f.call));assert.equal(output.result.profileSections.people.status,'unavailable');
 assert.equal(output.result.profileSections.people.total,null);assert.ok(output.result.coverageNote.includes('Unavailable or unrequested sections are not empty'));
 assert.ok(output.result.coverageNote.includes('Engagement context contains recent items only'));
});
test('profile pagination preserves raw canonical metadata and selected afterId without promoting completeness',async()=>{
 const cursor=Buffer.from(JSON.stringify({v:1,clientId,section:'people',afterId:'00000000'})).toString('base64url');
 const f=setup(operations.profile,{...rawProfile,cursor,limit:1}),row=f.page.profile.people[0];
 Object.assign(f.page.profileSections.people,{status:'partial',total:2,truncated:true,nextCursor:Buffer.from(JSON.stringify({v:1,clientId,section:'people',afterId:row.id})).toString('base64url')});
 const page=JSON.parse(await f.create()(f.call)).result;assert.equal(f.input.afterId,'00000000');assert.equal(page.profileSections.people.status,'partial');
 assert.deepEqual(JSON.parse(f.wire[0].options.body).metadata,f.metadata);assert.equal(f.credentialRequests[0].argumentsSha256,canonicalSha256(f.input));
});
for(const [label,request,options] of [['metadata inventory',{clientId},{}],['stored exact body',rawDocument,{}],
 ['stored transcription',rawDocument,{transcription:true}],['blocked extraction',rawDocument,{blocked:true}]])test(`passive ${label} preserves canonical source data`,async()=>{
 const f=setup(operations.documents,request,options),output=JSON.parse(await f.create()(f.call));assert.deepEqual(output,f.page);
 assert.deepEqual(JSON.parse(f.wire[0].options.body),{input:f.input,metadata:f.metadata});
 assert.deepEqual(f.credentialRequests[0].normalizationContext,f.normalizationContext);assert.equal(f.wire.length,1);
 if(options.blocked){assert.equal(output.data.records.length,0);assert.equal(output.data.coverage.continuationBlocked,true);
  assert.equal(output.data.coverage.missingContent,true);assert.equal(output.data.coverage.complete,false);assert.equal(output.data.coverage.nextCursor,null);}
 else if(request.documentId){assert.equal(output.data.records[0].provenance.trust,'external_untrusted');assert.ok(output.data.records[0].payload.text.includes('funding was withheld'));}
 else {assert.equal(output.data.documents[0].blockedReason,'ATTACHMENT_SCAN_PENDING');assert.equal(output.data.documents[0].usable,false);assert.equal(output.data.records,undefined);}
});
test('document UTF-16 preview, exact late read and hash-bound continuation preserve separate coverage',async()=>{
 const first=setup(operations.documents,{...rawDocument,limit:8});const preview=JSON.parse(await first.create()(first.call));
 assert.equal(preview.data.records[0].payload.text,'😀Stored');assert.equal(preview.data.coverage.characterEnd,8);
 assert.equal(preview.data.coverage.complete,false);assert.ok(preview.data.coverage.nextCursor);
 const resumed=setup(operations.documents,{...rawDocument,cursor:preview.data.coverage.nextCursor});const late=JSON.parse(await resumed.create()(resumed.call));
 assert.equal(late.data.coverage.characterStart,8);assert.ok(late.data.records[0].payload.text.includes('funding was withheld'));
 assert.equal(late.data.coverage.complete,false);assert.equal(late.data.records[0].provenance.sectionHash,sha(fullBody));
 assert.equal(JSON.parse(resumed.wire[0].options.body).input.cursor,preview.data.coverage.nextCursor);
});
test('explicit later section remains a section read without claiming whole document completion',async()=>{
 const f=setup(operations.documents,{...rawDocument,section:2}),page=JSON.parse(await f.create()(f.call));
 assert.equal(page.data.coverage.section,2);assert.equal(page.data.coverage.sectionCount,2);
 assert.equal(page.data.coverage.sectionComplete,true);assert.equal(page.data.coverage.complete,false);
});
test('document query windows and section reads cannot become a complete document read',async()=>{
 const f=setup(operations.documents,{...rawDocument,query:'funding'}),page=JSON.parse(await f.create()(f.call));
 assert.equal(page.data.coverage.matched,true);assert.equal(page.data.coverage.complete,false);
 f.page.data.coverage.complete=true;await assert.rejects(f.create()(f.call));
});
test('all current binding and client resolution substitutions refuse before credentials',async()=>{
 for(const mutate of [c=>c.input.limit=1,c=>c.argumentsSha256='0'.repeat(64),c=>c.request.clientId='Different named client',
  c=>c.normalizationContext.clientResolution.clientId=id('a'),c=>c.normalizationContext.clientResolution.selector='different',
  c=>c.normalizationContext.asOf=new Date(NOW+1).toISOString(),c=>c.authority.claims.binding={...c.authority.binding,writerFence:2},
  c=>c.authority.subject.entityIds=[id('a')],c=>c.authority.claims.audience='meri-broker',c=>c.authority.sourceIds=['other'],
  c=>c.authority.decision.operation='read_client_documents@0.2.0',c=>c.authority.subject.scopes[0].policyRevision='old',
  c=>c.authority.deadlineMs=NOW]) {
  const f=setup(),call=structuredClone(f.call);mutate(call);await assert.rejects(f.create()(call));assert.equal(f.credentialRequests.length,0);assert.equal(f.wire.length,0);
 }
 for(const mutate of [c=>c.normalizationContext.binding.writerFence=2,c=>c.normalizationContext.subject.entityIds=[id('a')],
  c=>c.request.clientId=id('a')]) {const f=setup(operations.documents,rawDocument),call=structuredClone(f.call);
  // Split the trusted context from authority before trying a substitution.
  call.normalizationContext=structuredClone(call.normalizationContext);mutate(call);await assert.rejects(f.create()(call));assert.equal(f.credentialRequests.length,0);}
});
for(const [operation,request] of [[operations.profile,rawProfile],[operations.documents,rawDocument]]) {
 for(const [kind,patch] of [['foreign tenant',scope=>scope.tenantId=id('b')],['foreign policy',scope=>scope.policyRevision='foreign-policy']]) {
  test(`${operation.id} direct source refuses an additional ${kind} capability scope before broker or Fetch`,async()=>{
   const f=setup(operation,request),call=structuredClone(f.call),scope=structuredClone(call.authority.claims.scopes[0]);
   scope.resourceId=id('b');patch(scope);call.authority.claims.scopes.push(scope);
   const adapter=createClientEvidenceHttpAdapter(f.config);
   await assert.rejects(adapter.read({operation,input:call.input,request:call.request,authority:call.authority,
    normalizationContext:call.normalizationContext}),/ACCESS_DENIED/);
   assert.equal(f.credentialRequests.length,0);assert.equal(f.wire.length,0);
   await assert.rejects(f.create()(call),/ACCESS_DENIED/);assert.equal(f.credentialRequests.length,0);assert.equal(f.wire.length,0);
  });
 }
}
test('closed broker receipt pins full authority, normalization context, metadata and both request digests',async()=>{
 for(const mutate of [c=>c.binding.tenantId=id('a'),c=>c.binding.actorId='foreign',c=>c.binding.conversationId=id('a'),c=>c.binding.runId=id('a'),
  c=>c.binding.attemptId=id('a'),c=>c.binding.workerId=id('a'),c=>c.binding.writerFence=2,c=>c.subject.entityIds=[id('a')],
  c=>c.subject.scopes[0].resourceId=id('a'),c=>c.operation=operations.documents,c=>c.normalizationContext.asOf='2026-10-12T00:00:00.000Z',
  c=>c.metadata={other:'changed'},c=>c.argumentsSha256='0'.repeat(64),c=>c.requestSha256='0'.repeat(64),
  c=>c.policyRevision='old',c=>c.sourceIds=['other'],c=>c.expiresAtMs=NOW,c=>c.bearerToken='bad\nheader',c=>c.extra=true]) {
  const f=setup();await assert.rejects(f.create({getCredentials:async r=>{const c=credentialReceipt(r);mutate(c);return c;}})(f.call));assert.equal(f.wire.length,0);
 }
});
test('profile tenant, observation, record, section and Decimal precision substitutions refuse',async()=>{
 for(const mutate of [p=>p.context.client.tenantId=id('a'),p=>p.context.client.id=id('a'),p=>p.generatedAt=new Date(NOW-1).toISOString(),
  p=>p.profile.people[0].clientId=id('a'),p=>p.profile.people[0].tenantId=id('a'),p=>p.profile.people[0].placementConfidence='9.9999',
  p=>p.profileSources.people[0].updatedAt=new Date(NOW-1).toISOString(),p=>p.profileSections.facilities.status='complete',
  p=>delete p.profile.people[0].notes,p=>p.coverageNote='complete current verified source']) {
  const f=setup();mutate(f.page);await assert.rejects(f.create()(f.call));
 }
});
test('documents preserve lineage, record/client/version/hash/range and extraction gaps',async()=>{
 for(const mutate of [p=>p.binding.writerFence=2,p=>p.subject.actorId='foreign',p=>p.data.clientId=id('a'),
  p=>p.data.records[0].provenance.clientId=id('a'),p=>p.data.records[0].provenance.sectionHash='0'.repeat(64),
  p=>p.data.records[0].payload.text='preview',p=>p.data.document.contentHash='0'.repeat(64),
  p=>p.data.coverage.characterStart=2,p=>p.data.records[0].provenance.trust='trusted']) {
  const f=setup(operations.documents,rawDocument);mutate(f.page);await assert.rejects(f.create()(f.call));
 }
 const f=setup(operations.documents,rawDocument,{blocked:true});f.page.data.coverage.complete=true;await assert.rejects(f.create()(f.call));
});
test('changed document or section hash during cursor continuation refuses',async()=>{
 for(const change of [{contentHash:'0'.repeat(64)},{sectionHash:'0'.repeat(64)}]) {
  const f=setup(operations.documents,{...rawDocument,cursor:documentCursor({offset:8,sectionHash:sha(fullBody),...change})});
  await assert.rejects(f.create()(f.call));
 }
});
test('ordinary read methods keep their receiver and detached methods refuse',async()=>{
 const f=setup(),state=new WeakMap(),adapter={async read(){if(!state.has(this))throw Error('RECEIVER_REQUIRED');return state.get(this);}};
 state.set(adapter,f.page);const detached=adapter.read;await assert.rejects(detached(),/RECEIVER_REQUIRED/);
 const execute=createClientEvidenceReadHandler({operation:f.operation,adapter,now:()=>NOW});assert.deepEqual(JSON.parse(await execute(f.call)).result,f.page);
});
test('configuration, input and credentials refuse hostile getters without executing them',async()=>{
 const f=setup();let effects=0;const config={...f.config};Object.defineProperty(config,'endpoints',{enumerable:true,get(){effects++;return endpoints;}});
 assert.throws(()=>createClientEvidenceHttpAdapter(config));const call={...f.call};Object.defineProperty(call,'normalizationContext',{enumerable:true,get(){effects++;return f.normalizationContext;}});
 await assert.rejects(f.create()(call));await assert.rejects(f.create({getCredentials:async r=>{const c=credentialReceipt(r);
  Object.defineProperty(c,'bearerToken',{enumerable:true,get(){effects++;return 'private';}});return c;}})(f.call));assert.equal(effects,0);assert.equal(f.wire.length,0);
});
test('configured endpoints are closed explicit HTTPS URLs and importing/factories allocate nothing',()=>{
 const f=setup();for(const endpoint of ['http://x.invalid/r','https://u:p@x.invalid/r','https://x.invalid/r?x','https://x.invalid/r#x','https://x.invalid'])
  assert.throws(()=>createClientEvidenceHttpAdapter({...f.config,endpoints:{...endpoints,get_client_context:endpoint}}));
 for(const changes of [{endpoints:{}},{endpoints:{...endpoints,other:'https://x.invalid/r'}},{origin:'https://x.invalid'},
  {maxRequestMs:0},{maxResponseBytes:0}])assert.throws(()=>createClientEvidenceHttpAdapter({...f.config,...changes}));
 assert.equal(f.wire.length,0);assert.equal(f.credentialRequests.length,0);
});
test('HTTP error/media/encoding responses and malformed UTF-8/JSON/length never leak private diagnostics',async()=>{
 for(const [body,status,headers] of [['PRIVATE_DIAGNOSTIC',403,{'content-type':'application/json'}],['PRIVATE_DIAGNOSTIC',302,{}],
  ['PRIVATE_DIAGNOSTIC',200,{'content-type':'text/html'}],['{}',200,{'content-type':'application/json','content-encoding':'gzip'}],
  [new Uint8Array([0xc3,0x28]),200,{'content-type':'application/json'}],['{',200,{'content-type':'application/json'}],
  ['{}',200,{'content-type':'application/json','content-length':'100'}]]) {
  const f=setup();await assert.rejects(f.create({fetchImpl:async()=>new Response(body,{status,headers})})(f.call),error=>!error.message.includes('PRIVATE_DIAGNOSTIC'));
 }
 const f=setup();await assert.rejects(f.create({maxResponseBytes:64})(f.call));
});
for(const stage of ['credentials','fetch','body'])test(`parked ${stage} deadline blocks later effects and cancels owned response`,async()=>{
 const f=setup(),park=Promise.withResolvers(),changes={maxRequestMs:20};let cancelled=false;
 if(stage==='credentials')changes.getCredentials=request=>{f.credentialRequests.push(request);return park.promise;};
 if(stage==='fetch')changes.fetchImpl=()=>park.promise;
 if(stage==='body')changes.fetchImpl=async()=>new Response(new ReadableStream({pull(){return park.promise;},cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}});
 await assert.rejects(f.create(changes)(f.call),/DEADLINE/);const before=f.wire.length;
 park.resolve(stage==='credentials'?credentialReceipt(f.credentialRequests[0]):stage==='fetch'?new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}}):undefined);
 await new Promise(r=>setImmediate(r));assert.equal(f.wire.length,before);if(stage!=='credentials')assert.equal(cancelled,true);
});
test('abort on acquired response cancels body and suppresses successful output',async()=>{
 const f=setup(),controller=new AbortController();let cancelled=false;
 await assert.rejects(f.create({fetchImpl:async()=>{controller.abort();return new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}});}})({...f.call,signal:controller.signal}),/CANCELLED/);
 await new Promise(r=>setImmediate(r));assert.equal(cancelled,true);
});
test('production operation descriptors remain disabled and unqualified',()=>{
 for(const operation of Object.values(operations)){const f=clientEvidenceFixture(operation,{clientId});assert.equal(f.contract.descriptor.handler,null);
  assert.equal(f.contract.descriptor.availability,'unimplemented');assert.equal(f.contract.descriptor.qualification,'pending');}
});
