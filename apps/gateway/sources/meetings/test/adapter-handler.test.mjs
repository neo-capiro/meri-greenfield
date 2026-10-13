import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {createMeetingHttpAdapter} from '../http-adapter.mjs';
import {createMeetingReadHandler} from '../handler.mjs';
import {meetingFixture,credentialReceipt,NOW,operations,endpoints,clientId,meetingId,noteId,transcriptId,fullBody,sha,id} from './fixtures.mjs';

function setup(operation=operations.read,request={clientId},fixtureOptions={}) {
 const f=meetingFixture(operation,request,fixtureOptions),wire=[],credentialRequests=[],state={now:NOW};
 const config={endpoints,now:()=>state.now,maxRequestMs:500,maxResponseBytes:65536,
  getCredentials:async r=>{credentialRequests.push(r);return credentialReceipt(r);},
  fetchImpl:async(url,options)=>{wire.push({url,options});return new Response(JSON.stringify(f.page),{headers:{'content-type':'application/json'}});}};
 const create=(changes={})=>createMeetingReadHandler({operation,adapter:createMeetingHttpAdapter({...config,...changes}),now:()=>state.now});
 return {...f,wire,credentialRequests,state,config,create};
}
const exact={clientId,meetingId,sourceKind:'note',sourceId:noteId};
for(const [label,operation,request,kind] of [
 ['personal calendar',operations.upcoming,{},'meeting-upcoming-page'],
 ['client calendar',operations.upcoming,{clientId,withinDays:7,limit:1},'meeting-upcoming-page'],
 ['debrief list',operations.debrief,{clientId,from:'2026-10-01T00:00:00Z',to:'2026-11-01T00:00:00Z'},'debrief-source-page'],
 ['exact debrief',operations.debrief,{clientId,debriefId:noteId},'debrief-source-page'],
 ['meeting inventory',operations.read,{clientId},'meeting-inventory-page'],
 ['exact note',operations.read,exact,'meeting-source-body-page'],
 ['exact transcript',operations.read,{...exact,sourceKind:'transcript',sourceId:transcriptId},'meeting-source-body-page'],
])test(`actual Fetch bytes and canonical handler preserve ${label}`,async()=>{
 const f=setup(operation,request),result=JSON.parse(await f.create()(f.call));
 assert.deepEqual(result,f.page);assert.equal(result.kind,kind);
 assert.deepEqual(JSON.parse(f.wire[0].options.body),{input:f.input,metadata:f.metadata});
 assert.equal(f.wire[0].url,endpoints[operation.id]);assert.equal(f.wire[0].options.redirect,'error');assert.equal(f.wire[0].options.credentials,'omit');
 const credential=f.credentialRequests[0];assert.deepEqual(credential.binding,f.authority.binding);assert.deepEqual(credential.subject,f.authority.subject);
 assert.equal(credential.argumentsSha256,canonicalSha256(f.input));assert.equal(credential.requestSha256,canonicalSha256({input:f.input,metadata:f.metadata}));
 assert.ok(!f.wire[0].options.body.includes('bearerToken'));assert.ok(!f.wire[0].options.body.includes('writerFence'));
 assert.equal(result.evidenceReady,false);assert.equal(result.negativeAssertion.kind,'none');assert.equal(result.coverage.enumeration,'unknown');
});
test('inventory contains source identity and hashes but never pretends bodies were read',async()=>{
 const f=setup(),page=JSON.parse(await f.create()(f.call));assert.equal(page.meetings[0].sources[0].contentHash,sha(fullBody));
 assert.equal(page.pageCoverage.sourceBodyCoverageComplete,false);assert.equal(page.pageCoverage.complete,false);
 assert.equal(page.coverage.truncated,true);assert.equal(page.meetings[0].sources[0].body,undefined);
});
test('UTF-16 windows preserve decisive late content and disclose the incomplete earlier window',async()=>{
 const earlier=setup(operations.read,{...exact,characterLimit:8});const preview=JSON.parse(await earlier.create()(earlier.call));
 assert.equal(preview.source.body,'😀Meetin');assert.equal(preview.source.bodyCoverage.characterEnd,8);
 assert.equal(preview.source.provenance.returnedByteLength,Buffer.byteLength('😀Meetin'));assert.equal(preview.source.bodyCoverage.complete,false);
 assert.deepEqual(preview.continuation.requiredReads,['synthetic-meeting-next']);
 const later=setup(operations.read,{...exact,characterOffset:25});const decisive=JSON.parse(await later.create()(later.call));
 assert.ok(decisive.source.body.includes('funding was withheld'));assert.equal(decisive.source.bodyCoverage.characterStart,25);
 assert.equal(decisive.source.bodyCoverage.complete,false);assert.equal(decisive.source.bodyCoverage.truncated,false);
 assert.equal(decisive.evidenceReady,false);assert.equal(decisive.negativeAssertion.kind,'none');
 const whole=setup(operations.read,exact);assert.ok(JSON.parse(await whole.create()(whole.call)).source.body.includes('funding was withheld'));
});
test('opaque cursor stays in canonical metadata and is included in credential digest',async()=>{
 const f=setup(operations.read,{...exact,cursor:'OPAQUE_SYNTHETIC_CURSOR'},{start:25});const page=JSON.parse(await f.create()(f.call));
 assert.equal(JSON.parse(f.wire[0].options.body).metadata.cursor,'OPAQUE_SYNTHETIC_CURSOR');assert.equal(page.scope.cursorApplied,true);
 assert.equal(page.scope.characterOffset,25);assert.equal(page.continuation.cursor,null);assert.equal(page.evidenceReady,false);
 assert.equal(f.credentialRequests[0].requestSha256,canonicalSha256({input:f.input,metadata:{cursor:'OPAQUE_SYNTHETIC_CURSOR'}}));
});
test('calendar/debrief date basis and explicit bounded instants are preserved',async()=>{
 const f=setup(operations.debrief,{clientId,from:'2026-10-01T00:00:00Z',to:'2026-11-01T00:00:00Z'});
 const page=JSON.parse(await f.create()(f.call));assert.equal(page.scope.timeField,'meeting.startsAt');
 assert.equal(page.scope.from,'2026-10-01T00:00:00.000Z');assert.equal(page.scope.to,'2026-11-01T00:00:00.000Z');
 assert.deepEqual(page.window,{basis:'unbounded'});
});
test('configuration is inert, closed and limited to explicit trusted HTTPS endpoints',()=>{
 const f=setup();for(const endpoint of ['http://example.invalid/x','https://u:p@example.invalid/x','https://example.invalid/x?token=x','https://example.invalid/x#x','https://example.invalid']){
  assert.throws(()=>createMeetingHttpAdapter({...f.config,endpoints:{...endpoints,[operations.read.id]:endpoint}}));
 }
 for(const change of [{endpoints:{}},{endpoints:{...endpoints,other:'https://example.invalid/x'}},{origin:'https://example.invalid'},
  {maxResponseBytes:0},{maxRequestMs:0},{getCredentials:null}])assert.throws(()=>createMeetingHttpAdapter({...f.config,...change}));
 assert.throws(()=>createMeetingReadHandler({operation:{id:'mail.read_thread',version:'0.2.0'},adapter:{read(){}},now:()=>NOW}));
 assert.equal(f.wire.length,0);assert.equal(f.credentialRequests.length,0);
});
test('input, subject, scope, operation, capability and full authority binding drift refuse before credentials',async()=>{
 for(const mutate of [c=>c.input.limit=1,c=>c.request.clientId=id('a'),c=>c.argumentsSha256='0'.repeat(64),
  c=>c.authority.subject.entityIds=[id('a')],c=>c.authority.claims.binding={...c.authority.binding,writerFence:2},
  c=>c.authority.subject.scopes[0].policyRevision='old',c=>c.authority.decision.operation='meeting.query_debriefs@0.2.0',
  c=>c.authority.sourceIds=['other-source'],c=>c.authority.claims.actions=['browser.public'],c=>c.authority.claims.audience='meri-broker',
  c=>c.authority.claims.issuedAt=new Date(NOW+1).toISOString(),c=>c.authority.deadlineMs=NOW]) {
  const f=setup(),call=structuredClone(f.call);mutate(call);await assert.rejects(f.create()(call));assert.equal(f.credentialRequests.length,0);assert.equal(f.wire.length,0);
 }
});
test('correlated credentials reject every current binding, subject and protocol substitution',async()=>{
 for(const mutate of [c=>c.binding.tenantId='foreign',c=>c.binding.actorId='foreign',c=>c.binding.conversationId=id('a'),
  c=>c.binding.runId=id('a'),c=>c.binding.attemptId=id('a'),c=>c.binding.workerId=id('a'),c=>c.binding.writerFence=2,
  c=>c.subject.entityIds=[id('a')],c=>c.operation=operations.debrief,c=>c.argumentsSha256='0'.repeat(64),
  c=>c.metadata={cursor:'other'},c=>c.requestSha256='0'.repeat(64),c=>c.policyRevision='old',c=>c.sourceIds=['other'],
  c=>c.expiresAtMs=NOW,c=>c.bearerToken='bad\nheader']) {
  const f=setup();await assert.rejects(f.create({getCredentials:async r=>{const c=credentialReceipt(r);mutate(c);return c;}})(f.call));assert.equal(f.wire.length,0);
 }
});
test('hostile configuration, source-call and credential getters do not run',async()=>{
 let effects=0;const f=setup(),config={...f.config};Object.defineProperty(config,'endpoints',{enumerable:true,get(){effects++;return endpoints;}});
 assert.throws(()=>createMeetingHttpAdapter(config));
 const call={...f.call};Object.defineProperty(call,'input',{enumerable:true,get(){effects++;return f.input;}});await assert.rejects(f.create()(call));
 await assert.rejects(f.create({getCredentials:async r=>{const c=credentialReceipt(r);Object.defineProperty(c,'bearerToken',{enumerable:true,get(){effects++;return 'secret';}});return c;}})(f.call));
 assert.equal(effects,0);assert.equal(f.wire.length,0);
});
test('canonical source binding, body hash, version, byte count and coverage corruption refuse',async()=>{
 for(const mutate of [p=>p.binding.writerFence=2,p=>p.subject.actorId='other',p=>p.operation=operations.debrief,
  p=>p.source.body+='changed',p=>p.source.provenance.returnedBodySha256='0'.repeat(64),p=>p.source.provenance.sourceVersion='other',
  p=>p.source.provenance.returnedByteLength=1,p=>p.source.sourceId=id('a'),p=>p.meeting.clientId=id('a'),
  p=>p.source.provenance.currentClientId=id('a'),p=>p.source.contentHash='0'.repeat(64),p=>p.scope.characterOffset=2,
  p=>p.evidenceReady=true,p=>p.negativeAssertion={kind:'absence'},p=>p.coverage.enumeration='complete',
  p=>p.sources[0].freshness='fresh',p=>p.sources[0].snapshotVersionId='invented',p=>p.sources[0].authority='unsupported',
  p=>{p.sources[0].sourceId='other';p.coverage.sourcesRequested=['other'];p.coverage.sourcesChecked=['other'];}]) {
  const f=setup(operations.read,exact);mutate(f.page);await assert.rejects(f.create()(f.call));
 }
});
test('client calendar cannot substitute a foreign or absent row client',async()=>{
 for(const client of [{id:id('a'),name:'Foreign'},null]) {const f=setup(operations.upcoming,{clientId});
  f.page.meetings[0].client=client;await assert.rejects(f.create()(f.call),/INVALID_RESULT/);}
});
test('debrief body and exact version correlation remain canonical across UTF-16 pages',async()=>{
 const f=setup(operations.debrief,{clientId,debriefId:noteId,characterLimit:8});
 const page=JSON.parse(await f.create()(f.call));assert.equal(page.debriefs[0].body,'😀Meetin');
 assert.deepEqual(page.continuation.requiredReads,['synthetic-debrief-next']);assert.equal(page.scope.timeField,'meeting.startsAt');
 for(const edit of [p=>p.debriefs[0].body='preview',p=>p.debriefs[0].provenance.sourceVersion='other',
  p=>p.debriefs[0].status='draft',p=>p.pageCoverage.complete=true,p=>p.continuation.requiredReads=[]]) {
  const bad=setup(operations.debrief,{clientId,debriefId:noteId,characterLimit:8});edit(bad.page);await assert.rejects(bad.create()(bad.call));}
});
test('required decisive read cannot disappear from an incomplete body result',async()=>{
 const f=setup(operations.read,{...exact,characterLimit:8});f.page.continuation.requiredReads=[];await assert.rejects(f.create()(f.call));
});
test('handler repeats canonical validation for a non-HTTP source port',async()=>{
 const f=setup(operations.read,exact);f.page.source.body='preview';
 const handler=createMeetingReadHandler({operation:operations.read,adapter:{read:async()=>f.page},now:()=>NOW});await assert.rejects(handler(f.call),/INVALID_RESULT/);
});
test('HTTP status, redirects, media and content encoding fail without body diagnostics',async()=>{
 for(const [status,headers] of [[403,{'content-type':'application/json'}],[302,{location:'https://evil.invalid'}],
  [200,{'content-type':'text/html'}],[200,{'content-type':'application/json','content-encoding':'gzip'}]]) {
  const f=setup();await assert.rejects(f.create({fetchImpl:async()=>new Response('PRIVATE_DIAGNOSTIC',{status,headers})})(f.call),error=>!error.message.includes('PRIVATE_DIAGNOSTIC'));
 }
});
test('shared strict byte reader enforces UTF-8, JSON, byte budgets and exact content length',async()=>{
 for(const kind of ['utf8','json','length','overflow']) {
  const f=setup();await assert.rejects(f.create({maxResponseBytes:kind==='overflow'?64:65536,
   fetchImpl:async()=>new Response(kind==='utf8'?new Uint8Array([0xc3,0x28]):kind==='json'?'{':JSON.stringify(f.page),
    {headers:{'content-type':'application/json',...(kind==='length'?{'content-length':'1'}:{})}})})(f.call));
 }
});
for(const stage of ['credentials','fetch','body'])test(`parked ${stage} ends at deadline and late completion cannot release data`,async()=>{
 const f=setup(),park=Promise.withResolvers();let cancelled=false;const changes={maxRequestMs:20};
 if(stage==='credentials')changes.getCredentials=()=>park.promise;
 if(stage==='fetch')changes.fetchImpl=()=>park.promise;
 if(stage==='body')changes.fetchImpl=async()=>new Response(new ReadableStream({pull(){return park.promise;},cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}});
 await assert.rejects(f.create(changes)(f.call),/DEADLINE/);const before=f.wire.length;
 park.resolve(stage==='credentials'?credentialReceipt({operation:f.operation,input:f.input,metadata:f.metadata,argumentsSha256:f.call.argumentsSha256,
  requestSha256:canonicalSha256({input:f.input,metadata:f.metadata}),binding:f.authority.binding,subject:f.authority.subject,
  policyRevision:f.authority.policyRevision,sourceIds:f.authority.sourceIds}):stage==='fetch'?new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}}):undefined);
 await new Promise(r=>setImmediate(r));assert.equal(f.wire.length,before);if(stage!=='credentials')assert.equal(cancelled,true);
});
test('abort during response acquisition cancels acquired body and suppresses release',async()=>{
 const f=setup(),controller=new AbortController();let cancelled=false;
 await assert.rejects(f.create({fetchImpl:async()=>{controller.abort();return new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}});}})({...f.call,signal:controller.signal}),/CANCELLED/);
 await new Promise(r=>setImmediate(r));assert.equal(cancelled,true);
});
test('pre-abort and expired credential never allocate transport',async()=>{
 const f=setup(),controller=new AbortController();controller.abort();await assert.rejects(f.create()({...f.call,signal:controller.signal}),/CANCELLED/);
 await assert.rejects(f.create({getCredentials:async r=>({...credentialReceipt(r),expiresAtMs:NOW})})(f.call),/ACCESS_DENIED/);assert.equal(f.wire.length,0);
});
test('production descriptor stays unavailable and source implementation does not activate it',()=>{
 for(const operation of Object.values(operations)){const f=meetingFixture(operation,operation.id===operations.upcoming.id?{}:{clientId});
  assert.equal(f.contract.descriptor.availability,'unimplemented');assert.equal(f.contract.descriptor.qualification,'pending');assert.equal(f.contract.descriptor.handler,null);}
});
