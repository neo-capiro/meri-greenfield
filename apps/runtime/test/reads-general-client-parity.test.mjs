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
async function setup(family,id,{general=true,request}={}){
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
