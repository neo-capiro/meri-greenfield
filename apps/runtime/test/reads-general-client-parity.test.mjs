/** Actual composer, current execution and HTTP adapters; source DTOs remain synthetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,uuid} from './reads-native-fixture.mjs';
import {connect} from '../../worker/conversation/reads/test/native-mcp-fixture.mjs';
import {nativeFamilyCase} from '../../gateway/general-reads/test/native-family-cases.mjs';
import {clientEvidenceFixture,operations as evidence,NOW as evidenceNow,clientId,documentCursor} from '../../gateway/sources/client-evidence/test/fixtures.mjs';
import {meetingFixture,operations as meeting,NOW as meetingNow,meetingId,noteId} from '../../gateway/sources/meetings/test/fixtures.mjs';

const cases=[['client-knowledge-profile','get_client_context'],['client-documents','read_client_documents'],
 ['meeting-source','meeting.read_client_meetings'],['client-knowledge-search','search_client_knowledge'],['tracked-bills','search_tracked_bills']];
async function setup(family,id,{general=true,request,sourceResponse}={}){
 let scene;
 if(family==='client-knowledge-profile'||family==='client-documents'){
  scene=clientEvidenceFixture(family==='client-documents'?evidence.documents:evidence.profile,request??{clientId});scene.now=()=>evidenceNow;
 }else if(family==='meeting-source'){
  scene=meetingFixture(meeting.read,request??{clientId});scene.now=()=>meetingNow;
 }else scene=nativeFamilyCase(family,id,{...(request?{request}:{})});
 if(!scene.transport){
  scene.arguments=scene.request;scene.binding=scene.authority.binding;scene.state={};
  scene.transport={async fetchImpl(_url,options){
   const correlation=JSON.parse(Buffer.from(options.headers['x-meri-read-correlation'],'base64url'));
   assert.deepEqual(correlation.subject,scene.authority.subject);
   assert.deepEqual(JSON.parse(options.body).input,scene.input);
   const page=structuredClone(scene.page);scene.state.resultMutator?.(page);scene.state.afterSource?.();
   return Response.json(page);
  }};
 }
 if(general){
  const a=scene.authority,s=a.subject;
  Object.assign(s,{kind:'personal',entityType:'user',entityIds:[a.binding.actorId],
   scopes:[{tenantId:a.binding.tenantId,kind:'private-user',resourceId:a.binding.actorId,policyRevision:s.policyRevision}]});
  if(scene.page?.subject)scene.page.subject=s;
 }
 if(sourceResponse)scene.transport.fetchImpl=sourceResponse;
 return fixture(family,id,{scene});
}
for(const [family,id] of cases){
 test(`${id}: actual SDK exposes and executes the General read with registry guidance`,async t=>{
  const f=await setup(family,id),m=await connect(t,f);assert(m);
  const tools=await m.client.listTools();assert(tools.tools.some(tool=>tool.name===m.name));
  assert.match(m.client.getInstructions(),/Resolve a named client with lookup_client_registry first/);
  const out=await m.call();assert.equal(out.isError,undefined,JSON.stringify(out));assert.equal(m.runtime.receipts().length,1);
 });
 test(`${id}: selected-client positive remains available`,async()=>{
  const f=await setup(family,id,{general:false}),r=await f.execute();assert.equal(r.status,200,await r.clone().text());
 });
 test(`${id}: General keeps personal lineage through the actual composer`,async()=>{
  const f=await setup(family,id),r=await f.execute();assert.equal(r.status,200,await r.clone().text());
  assert.equal(f.calls.filter(p=>p===`/api/clio/tools/${id}`).length,1);
  const out=JSON.parse((await r.json()).resultJson);
  if(out.subject){assert.equal(out.subject.kind,'personal');assert.deepEqual(out.subject.entityIds,[f.binding.actorId]);assert.equal(out.subject.scopes[0].kind,'private-user');}
 });
 test(`${id}: General source refusal and current execution revocation withhold results`,async()=>{
  for(const after of [false,true]){
   const f=await setup(family,id);if(after)f.scene.state.afterSource=f.revoke;else f.deny();
   const r=await f.execute();assert.equal(r.status,403,await r.clone().text());assert.equal(f.calls.filter(p=>p===`/api/clio/tools/${id}`).length,1);
  }
 });
 test(`${id}: selected-client mismatch is refused before source dispatch`,async()=>{
  const f=await setup(family,id,{general:false}),r=await f.execute({...f.scene.arguments,clientId:uuid('f')});
  assert.notEqual(r.status,200);assert(!f.calls.includes(`/api/clio/tools/${id}`));
 });
 test(`${id}: General names are resolved by registry first`,async()=>{
  const f=await setup(family,id),r=await f.execute({...f.scene.arguments,clientId:'Unresolved client name'});
  assert.notEqual(r.status,200);assert(!f.calls.includes(`/api/clio/tools/${id}`));
 });
}
for(const [family,id] of cases.slice(3))test(`${id}: hidden General target is refused before source read`,async()=>{
 const f=await setup(family,id);f.setClients([]);const r=await f.execute();assert.equal(r.status,403,await r.clone().text());assert(!f.calls.includes(`/api/clio/tools/${id}`));
});
test('General document continuation retains client/content/range binding',async()=>{
 const f=await setup('client-documents','read_client_documents',{request:{clientId,documentId:'synthetic-doc',limit:20}});
 const r=await f.execute();assert.equal(r.status,200,await r.clone().text());
 const page=JSON.parse((await r.json()).resultJson);assert(page.data.coverage.nextCursor);
 const bad=await f.execute({...f.scene.arguments,cursor:documentCursor({clientId:uuid('f')})});
 assert.notEqual(bad.status,200);assert.equal(f.calls.filter(p=>p.endsWith('/read_client_documents')).length,1);
});
test('General meeting body remains exact and substituted body is withheld',async()=>{
 const request={clientId,meetingId,sourceKind:'note',sourceId:noteId,characterLimit:20};
 const f=await setup('meeting-source','meeting.read_client_meetings',{request});
 const r=await f.execute();assert.equal(r.status,200,await r.clone().text());
 const page=JSON.parse((await r.json()).resultJson);assert.equal(page.subject.kind,'personal');assert.equal(page.source.body.length,20);
 f.scene.state.resultMutator=page=>{page.source.body='substituted';};
 const bad=await f.execute();assert.notEqual(bad.status,200);
});

for(const general of [true,false])for(const message of [
 'Meeting page changed; restart the read',
 'Meeting continuation is too large; narrow the time window and restart',
])test(`meeting continuation refusal reaches MCP with safe recovery: ${general?'General':'client'} / ${message}`,async t=>{
 let cancelled=0;
 const request={clientId,cursor:'synthetic-existing-cursor'};
 const f=await setup('meeting-source','meeting.read_client_meetings',{general,request,
  sourceResponse:async(_url,options)=>{
   assert.equal(JSON.parse(options.body).metadata.cursor,request.cursor);
   return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(
    JSON.stringify({statusCode:400,message,privateDetail:'WITHHELD_SOURCE_DETAIL'})));},cancel(){cancelled++;}}),
    {status:400,headers:{'content-type':'application/json'}});
  }});
 const m=await connect(t,f),out=await m.call();
 assert.equal(out.isError,true);
 const text=out.content.map(item=>item.text??'').join('\n');
 assert.match(text,/INVALID_ARGUMENTS:/);
 assert.match(text,/restart without the cursor/);
 assert.match(text,/narrow the from\/to time range and restart/);
 assert.match(text,/No evidence, absence or completeness is established/);
 assert.doesNotMatch(text,/WITHHELD_SOURCE_DETAIL|synthetic-existing-cursor|Meeting page changed|Meeting continuation is too large/);
 assert.equal(f.calls.filter(path=>path==='/api/clio/tools/meeting.read_client_meetings').length,1);
 assert.equal(cancelled,1);
 assert.equal(m.runtime.receipts().length,0);
});

test('meeting recovery classification preserves noncursor, body and permission failures',async()=>{
 for(const [request,status,code] of [
  [{clientId},400,'INVALID_RESULT'],
  [{clientId,meetingId,sourceKind:'note',sourceId:noteId,cursor:'synthetic-body-cursor'},400,'INVALID_RESULT'],
  [{clientId,cursor:'synthetic-list-cursor'},403,'ACCESS_DENIED'],
  [{clientId,cursor:'synthetic-list-cursor'},500,'SOURCE_UNAVAILABLE'],
 ]){
  const f=await setup('meeting-source','meeting.read_client_meetings',{request,
   sourceResponse:async()=>Response.json({message:'WITHHELD_SOURCE_DETAIL'},{status})});
  const response=await f.execute(),failure=await response.json();
  assert.notEqual(response.status,200);assert.deepEqual(failure,{error:{code}});
  assert.equal(f.calls.filter(path=>path==='/api/clio/tools/meeting.read_client_meetings').length,1);
 }
 const other=await setup('client-documents','read_client_documents',{request:{clientId,cursor:'documents:synthetic-document-cursor'},
  sourceResponse:async()=>Response.json({message:'WITHHELD_SOURCE_DETAIL'},{status:400})});
 assert.deepEqual(await (await other.execute()).json(),{error:{code:'INVALID_RESULT'}});
});

test('original invalid meeting arguments still refuse before source dispatch',async t=>{
 const f=await setup('meeting-source','meeting.read_client_meetings'),m=await connect(t,f);
 const out=await m.call({clientId,limit:0});
 assert.equal(out.isError,true);
 assert.match(out.content[0].text,/Input validation error: Invalid arguments for tool meeting_read_client_meetings/);
 assert.doesNotMatch(out.content[0].text,/restart without the cursor/);
 assert.equal(f.calls.filter(path=>path==='/api/clio/tools/meeting.read_client_meetings').length,0);
});
