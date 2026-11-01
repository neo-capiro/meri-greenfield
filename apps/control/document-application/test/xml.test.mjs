/** Real route/session/delivery/publication owners, scripted SQL/storage and XML executor; no OS/native claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createDocumentApplication} from '../index.mjs';
import {createLocalDocumentPorts} from '../local/ports.mjs';
import {nativeDocumentFixture,sha} from '../../../artifacts/test/native-document-fixture.mjs';
import {structureCheck} from '../../../artifacts/structure/file-structure.mjs';
import {NOW,id} from '../../../artifacts/storage/test/sql-fixture.mjs';

const text='\ufeff<?xml version="1.0" encoding="UTF-8"?>\r\n<bill xmlns="urn:fixture">α &amp; β</bill>\r\n';
const request={operation:'create_word',format:'xml',title:'Legislation',content:{text}};
async function fixture(t){
 const binding={tenantId:id(100),actorId:id(101),conversationId:id(102),runId:id(103),attemptId:id(104),workerId:id(105),writerFence:1};
 const clientId=id(106),scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:'policy1'}];
 const f=nativeDocumentFixture({binding,scopes}),state={closed:false,revoked:false,artifactChecks:0},now=()=>NOW;
 const ports=createLocalDocumentPorts({binding,scopes,clientId,deadlineMs:NOW+25000,now,state});t.after(()=>ports.sessions.close());
 const executor={async execute(call){
  f.state.executions.push(call);const bytes=Buffer.from(call.request.content.text);
  assert.deepEqual(structureCheck(bytes,'xml'),{valid:true});
  return {bytes,inspection:{sha256:sha(bytes),bytes:bytes.length,format:'xml',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{encoding:'UTF-8',whitespace:'unchanged',wellFormed:true}}};
 }};
 const options={sessions:ports.sessions,selectedClientId:clientId,artifactOptions:{...f.options,executor,authorize:ports.authorize,now,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})},now,limits:{maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:1048576},enabled:true};
 const session=await ports.sessions.issue({identityCredential:ports.nativeCredential});
 // Reconstruct the HTTP owner for every call: reopen uses retained data, not an in-memory route result.
 const post=(route,body)=>createDocumentApplication(options).handle(new Request('https://meri.synthetic.invalid/api/documents/'+route,{method:'POST',headers:{authorization:'Bearer '+session.credential,'content-type':'application/json'},body:JSON.stringify(body)}));
 return {f,state,post};
}
async function good(response){assert.equal(response.status,200,await response.clone().text());return response.json();}

test('XML creates, revises, reopens, inspects, downloads and pages exact immutable history',async t=>{
 const x=await fixture(t),first=await good(await x.post('create',{deliveryId:'xml-one',request}));
 const revised={...request,content:{text:text.replace('α','γ')}},second=await good(await x.post('revise',{deliveryId:'xml-two',baseVersionId:first.version.versionId,request:revised}));
 assert.equal(second.version.parentVersionId,first.version.versionId);assert.equal(second.version.artifactId,first.version.artifactId);
 for(const [result,expected] of [[first,text],[second,revised.content.text]]){
  assert.equal(result.version.filename,'Legislation.xml');assert.equal(result.version.mimeType,'application/xml; charset=utf-8');
  const inspection=await good(await x.post('inspect',{versionId:result.version.versionId}));assert.equal(inspection.inspection.currentBytesVerified,true);assert.equal(inspection.inspection.details.wellFormed,true);
  const response=await x.post('download',{versionId:result.version.versionId});assert.equal(response.status,200);
  assert.equal(response.headers.get('content-type'),'application/xml; charset=utf-8');assert.equal(response.headers.get('content-disposition'),'attachment; filename="Legislation.xml"');assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  const bytes=Buffer.from(await response.arrayBuffer());assert.deepEqual(bytes,Buffer.from(expected));assert.equal(sha(bytes),result.version.object.sha256);
 }
 const history=await good(await x.post('history',{versionId:first.version.versionId,limit:10,cursor:null}));assert.deepEqual(history.versions,[second.version,first.version]);
 const replay=await good(await x.post('create',{deliveryId:'xml-one',request}));assert.deepEqual(replay.version,first.version);assert.equal(x.f.state.executions.length,2);assert.equal(x.f.state.puts,2);
});

test('XML lost publication acknowledgement recovers the original delivery without regeneration',async t=>{
 const x=await fixture(t);x.f.publication.state.lostAck=true;
 const uncertain=await x.post('create',{deliveryId:'xml-unknown',request});assert.equal(uncertain.status,502);assert.equal((await uncertain.json()).error.outcome,'UNKNOWN');
 const recovered=await good(await x.post('create',{deliveryId:'xml-unknown',request}));
 assert.equal(recovered.version.object.sha256,sha(Buffer.from(text)));assert.equal(x.f.state.executions.length,1);assert.equal(x.f.state.puts,1);assert.equal(x.f.publication.state.writes,1);
 assert.equal([...x.f.state.rows.values()][0].state,'UNKNOWN');
});

for(const mode of ['revoked','suppressed'])test(`XML reads and delivery recovery withhold bytes when ${mode}`,async t=>{
 const x=await fixture(t),created=await good(await x.post('create',{deliveryId:'xml-access',request}));
 if(mode==='revoked')x.state.revoked=true;
 else x.f.sql.suppressed.add(`${x.f.context.binding.tenantId}:conversation:${x.f.context.binding.conversationId}`);
 for(const [route,body] of [['download',{versionId:created.version.versionId}],['inspect',{versionId:created.version.versionId}],['history',{versionId:created.version.versionId,limit:10,cursor:null}],['create',{deliveryId:'xml-access',request}]])assert.notEqual((await x.post(route,body)).status,200);
 assert.equal(x.f.state.executions.length,1);assert.equal(x.f.state.puts,1);
});
test('malformed or unsafe XML refuses before any delivery, generation or object effect',async t=>{
 const x=await fixture(t);
 for(const invalid of ['', ' ', '<a>', '<a/><b/>', '<a>&undefined;</a>', '<!DOCTYPE a SYSTEM "https://example.invalid/no-fetch"><a/>']){
  const response=await x.post('create',{deliveryId:'xml-invalid',request:{...request,content:{text:invalid}}});
  assert.notEqual(response.status,200);assert.equal((await response.json()).error.outcome,'NOT_DISPATCHED');
 }
 assert.equal(x.f.state.rows.size,0);assert.equal(x.f.state.executions.length,0);assert.equal(x.f.state.puts,0);assert.equal(x.f.publication.state.writes,0);
});
