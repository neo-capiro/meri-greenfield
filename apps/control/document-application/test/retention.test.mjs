/** R2 propagation through both document constructor callers: the read path (createArtifactService) and the write/recover path
 * (createPostgresArtifactService) receive the retention gate from the document options; a suppressed conversation gets no version,
 * inspection or bytes and no revision; a malformed gate is a configuration fault. Synthetic local fixture only. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createDocumentApplication} from '../index.mjs';
import {createLocalDocumentFixture} from '../local/fixture.mjs';
const python=process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const spec={operation:'create_word',format:'txt',title:'Retention document',content:{text:'First version\n'}};
async function setup(t,change=x=>x){
 const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:python});t.after(()=>f.close());
 const gate={suppressed:new Set(),calls:[],async assertServable(s){gate.calls.push(s);if(gate.suppressed.has(`${s.tenantId}:${s.kind}:${s.subjectId}`))throw Object.assign(Error('RETENTION_SUPPRESSED'),{code:'RETENTION_SUPPRESSED'});}};
 const options={sessions:f.sessions,selectedClientId:f.selectedClientId,artifactOptions:{...f.artifactOptions,retention:gate},credential:f.credential,now:f.now,limits:f.limits,enabled:true};
 const app=createDocumentApplication(change(options)),session=await f.sessions.issue({identityCredential:f.nativeCredential});
 const post=(route,body)=>app.handle(new Request(`http://127.0.0.1/api/documents/${route}`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${session.credential}`},body:JSON.stringify(body)}));
 return {f,gate,post,conversation:{tenantId:f.artifactOptions.context.binding.tenantId,kind:'conversation',subjectId:f.artifactOptions.context.binding.conversationId}};
}
test('both constructor callers consult the gate: create and inspect run it; a suppressed conversation refuses inspect, download, revise and create without releasing a version',async t=>{
 const a=await setup(t);const created=await a.post('create',{deliveryId:'one',request:spec});assert.equal(created.status,200);const first=await created.json();
 assert.ok(a.gate.calls.some(s=>s.kind==='conversation'&&s.subjectId===a.conversation.subjectId),'the write path consulted the gate');const writes=a.gate.calls.length;
 assert.equal((await a.post('inspect',{versionId:first.version.versionId})).status,200);assert.ok(a.gate.calls.length>writes&&a.gate.calls.some(s=>s.kind==='artifact'&&s.subjectId===first.version.artifactId),'the read path consulted the gate for the resolved artifact');
 a.gate.suppressed.add(`${a.conversation.tenantId}:conversation:${a.conversation.subjectId}`);
 for(const [route,body] of [['inspect',{versionId:first.version.versionId}],['download',{versionId:first.version.versionId}],['revise',{deliveryId:'two',baseVersionId:first.version.versionId,request:{...spec,content:{text:'Second\n'}}}],['create',{deliveryId:'three',request:spec}]]){
  const response=await a.post(route,body);assert.notEqual(response.status,200,route);const text=await response.text();assert.ok(!text.includes(first.version.versionId)&&!text.includes('First version'),route+': nothing of the artifact is released');}
 a.gate.suppressed.clear();assert.equal((await a.post('download',{versionId:first.version.versionId})).status,200);
});
test('a malformed retention gate in the document options is a configuration fault at construction, never a silent bypass',async t=>{
 await assert.rejects(setup(t,o=>({...o,artifactOptions:{...o.artifactOptions,retention:{}}})),/DOCUMENT_CONFIGURATION/);
});
