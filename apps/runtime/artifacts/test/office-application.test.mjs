/** Actual native-session, runtime composition, artifact, token and Core-client
 * owners. Synthetic options authority, Core HTTP and SQL/object ports. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {wopiFixture} from '../../../artifacts/edit-sessions/test/wopi-fixture.mjs';
import {createCollaboraCodeLaunch} from '../../../artifacts/edit-sessions/collabora-code.mjs';
import {createRuntimeOfficeApplication} from '../office-application.mjs';
import {id} from '../../../artifacts/storage/test/sql-fixture.mjs';
import {ooxml} from '../../../artifacts/structure/test/fixtures.mjs';
import {preservationBytes} from '../../../artifacts/edit-sessions/test/preservation-fixture.mjs';
import {OFFICE_SCHEMA,receiveOfficeRequest,receiveOfficeResponse,receiveOfficeDownload} from '../../../../packages/contracts/dist/office-application.mjs';
import {receiveDocumentRequest,receiveDocumentResponse} from '../../../../packages/contracts/dist/document-access-application.mjs';
const encode=value=>new TextEncoder().encode(JSON.stringify(value));
async function fixture(t,{format='docx',discoveryFormat=format,baseBytes}={}){
 const f=await wopiFixture(t,{format,...(baseBytes?{baseBytes}:{})}),now=f.options.now;
 const state=Object.assign(f.state,{observations:[],phaseHook:null,modeDenied:null});
 const limits={maxRequestMs:5000,maxRequestBytes:2097152,maxResponseBytes:16777216};
 const optionsOwner={async resolve(call){
  const required={revise:'artifact.revise',inspect:'artifact.inspect',download:'artifact.download'}[call.intent];
  const authorize=async x=>{if(x.action!==required||state.modeDenied===call.intent)throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});return f.artifactOptions.authorize(x);};
  return {documentOptions:{sessions:f.sessions,selectedClientId:f.claims.selectedClientId,artifactOptions:{...f.artifactOptions,now,authorize,ids:()=>({artifactId:id(960),versionId:id(961),objectId:id(962)})},now,limits,enabled:true},
   async recheck({phase}){state.observations.push({intent:call.intent,phase});await state.phaseHook?.(call.intent,phase);if(state.modeDenied===call.intent)throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}};
 }};
 const discoveryBytes=Buffer.from(`<wopi-discovery><net-zone name="external-https"><app>${['edit','view'].map(mode=>`<action ext="${discoveryFormat}" name="${mode}" urlsrc="https://office.example.test/browser/synthetic/cool.html?"/>`).join('')}</app></net-zone></wopi-discovery>`);
 const launch=createCollaboraCodeLaunch({editorOrigin:'https://office.example.test',wopiOrigin:'https://wopi.example.test',discoveryBytes,codec:f.codec,now});
 const config={optionsOwner,sessions:f.sessions,now,limits,drafts:f.options.drafts,codec:f.codec,launch,generation:f.options.generation,browserOrigin:'https://app.example.test'};
 const app=createRuntimeOfficeApplication(config),key={draftId:f.draft.draftId,versionId:f.first.version.versionId};
 const auth=()=>({credential:f.session.credential,deadlineMs:now()+5000});
 const execute=(route,extra={},chosen=auth())=>app.execute(route,{...key,...extra},chosen);
 const start=(extra={})=>execute('launch',{operation:'acquire',editorId:f.claims.editorId,expectedEpoch:0,mode:'edit',...extra});
 const wopi=(form,operation='checkFileInfo',extra={})=>{
  const original=f.request(operation,{...extra,token:form.fields.access_token}),url=new URL(original.url);
  url.pathname=url.pathname.replace('synthetic-file',f.draft.draftId);
  return app.handleWopi(new Request(url,original));
 };
 return {...f,state,app,execute,start,wopi,auth,key,config};
}
for(const format of ['docx','xlsx','pptx'])test(`${format}: attended open, launch, WOPI Save, recover and separate Publish`,async t=>{
 const f=await fixture(t,{format}),opened=await f.execute('open');
 assert.equal(opened.draft.sequence,0);assert.equal(opened.launch,null);assert.equal(Object.hasOwn(opened.draft,'bytesBase64'),false);
 const started=await f.start(),claims=f.codec.verify(started.launch.fields.access_token,{fileId:f.draft.draftId});
 assert.deepEqual(claims.runBinding,f.context.binding);assert.equal(claims.selectedClientId,f.claims.selectedClientId);
 assert.equal(claims.expiresAtMs,f.session.expiresAtMs);assert.ok(claims.expiresAtMs<Date.parse(started.editor.expiresAt));
 assert.equal((await f.wopi(started.launch,'lock',{lock:'CODE'})).status,200);
 assert.equal((await f.wopi(started.launch,'save',{lock:'CODE',body:ooxml(format)})).status,200);
 assert.equal(f.state.puts,1);assert.equal(f.sql.state.versions.size,1);
 const recovered=await f.execute('read');assert.equal(recovered.draft.sequence,1);assert.equal(recovered.launch,null);assert.equal(Object.hasOwn(recovered.draft,'bytesBase64'),false);
 const published=await f.execute('publish',{sequence:recovered.draft.sequence,sha256:recovered.draft.sha256});
 assert.equal(published.draft.state,'published');assert.equal(published.publication.version.parentVersionId,f.first.version.versionId);
 assert.equal(f.state.puts,2);assert.equal(f.state.executions.length,1);
});

for(const format of ['docx','xlsx','pptx'])test(`${format}: preserve saved package through reopen, release and immutable revision`,async t=>{
 const baseBytes=preservationBytes(format),saved=preservationBytes(format,'after'),f=await fixture(t,{format,baseBytes});
 await f.execute('open');const started=await f.start();
 assert.equal((await f.wopi(started.launch,'lock',{lock:'preserve'})).status,200);
 const save=await f.wopi(started.launch,'save',{lock:'preserve',body:saved});assert.equal(save.status,200);
 const confirmed=await f.execute('read');
 assert.equal(confirmed.draft.sequence,1);assert.equal(confirmed.draft.sha256,f.sha(saved));assert.equal(confirmed.draft.byteLength,saved.length);
 assert.equal(f.state.puts,1);assert.equal(f.sql.state.versions.size,1);
 const released=await f.execute('release',{editorId:started.editor.editorId,expectedEpoch:started.editor.epoch});
 assert.equal(released.editor.editorId,null);assert.equal((await f.wopi(started.launch,'getFile')).status,404);
 const reopened=await f.start({expectedEpoch:released.editor.epoch});
 assert.deepEqual(Buffer.from(await (await f.wopi(reopened.launch,'getFile')).arrayBuffer()),saved);
 await f.execute('release',{editorId:reopened.editor.editorId,expectedEpoch:reopened.editor.epoch});
 const input={sequence:confirmed.draft.sequence,sha256:confirmed.draft.sha256},published=await f.execute('publish',input);
 assert.equal(published.publication.version.parentVersionId,f.first.version.versionId);
 assert.equal(published.publication.version.object.sha256,f.sha(saved));assert.equal(published.publication.version.object.bytes,saved.length);
 const source=await f.options.artifacts.editorSource(published.publication.version.versionId,f.context,{write:true});
 assert.deepEqual(source.bytes,saved);
 assert.deepEqual((await f.options.artifacts.editorSource(f.first.version.versionId,f.context,{write:false})).bytes,baseBytes);
 const replay=await f.execute('publish',input);assert.equal(replay.publication.version.versionId,published.publication.version.versionId);
 assert.equal(f.state.puts,2);assert.equal(f.sql.state.versions.size,2);assert.equal(f.state.executions.length,1);
 assert.equal(published.publication.inspection.nativeOpened,false);assert.equal(published.publication.inspection.recalculated,false);
});
test('renew clips the token to current native expiry and release invalidates WOPI while preserving private bytes',async t=>{
 const f=await fixture(t),started=await f.start();
 await f.wopi(started.launch,'lock',{lock:'CODE'});await f.wopi(started.launch,'save',{lock:'CODE',body:ooxml('docx')});
 f.state.clock+=1000;
 const renewed=await f.execute('renew',{editorId:started.editor.editorId,expectedEpoch:started.editor.epoch,mode:'edit'});
 assert.equal(renewed.launch.expiresAtMs,f.session.expiresAtMs);assert.equal(renewed.editor.epoch,started.editor.epoch);
 const released=await f.execute('release',{editorId:started.editor.editorId,expectedEpoch:started.editor.epoch});
 assert.equal(released.editor.editorId,null);assert.equal(released.draft.sequence,1);assert.equal(f.state.lock,'');
 assert.equal((await f.wopi(renewed.launch)).status,404);assert.equal((await f.execute('read')).draft.sha256,renewed.draft.sha256);
});
test('only explicit takeover replaces an active editor and old tokens no longer read or save',async t=>{
 const f=await fixture(t),started=await f.start();
 await assert.rejects(f.start({editorId:id(702),expectedEpoch:1}),{code:'OFFICE_DRAFT_CONFLICT'});
 const next=await f.start({operation:'takeover',editorId:id(702),expectedEpoch:1});assert.equal(next.editor.epoch,2);
 assert.equal((await f.wopi(started.launch)).status,404);assert.equal((await f.wopi(next.launch)).status,200);
});
test('missing discovery action and wrong selected source refuse before acquiring an editor',async t=>{
 const f=await fixture(t,{discoveryFormat:'xlsx'});
 await assert.rejects(f.start(),{code:'EDITOR_CODE_ACTION_UNAVAILABLE'});
 assert.ok(!f.state.calls.some(c=>c.route==='editor'));
 const other=await fixture(t);other.draft.baseSha256='a'.repeat(64);
 await assert.rejects(other.start(),{code:'EDITOR_SOURCE_MISMATCH'});assert.ok(!other.state.calls.some(c=>c.route==='editor'));
});
test('view uses download permission and its token cannot lock or Save',async t=>{
 const f=await fixture(t);f.state.modeDenied='revise';const opened=await f.start({mode:'view'});
 assert.equal((await f.wopi(opened.launch)).status,200);assert.equal((await f.wopi(opened.launch,'lock',{lock:'CODE'})).status,401);
 assert.ok(f.state.observations.every(o=>o.intent==='download'));
});
test('native expiry, revocation and exact run/scope/client binding refuse borrowed-token use',async t=>{
 for(const change of ['expiry','revoke','run','scope']){
  const f=await fixture(t),started=await f.start();
  if(change==='expiry')f.state.clock=f.session.expiresAtMs;
  if(change==='revoke')f.sessions.close();
  if(change==='run')f.context.binding.writerFence++;
  if(change==='scope')f.context.scopes[0].policyRevision='changed';
  assert.ok([401,404].includes((await f.wopi(started.launch)).status),change);
 }
});
test('a replacement native session cannot revive an old token; explicit renewal binds the replacement',async t=>{
 const f=await fixture(t),started=await f.start();
 f.sessions.revoke(f.session.credential);
 const replacement=await f.sessions.issue({identityCredential:'synthetic-replacement-native'});
 assert.equal((await f.wopi(started.launch)).status,404);
 const renewed=await f.execute('renew',{editorId:started.editor.editorId,expectedEpoch:started.editor.epoch,mode:'edit'},
  {credential:replacement.credential,deadlineMs:f.options.now()+5000});
 assert.equal((await f.wopi(renewed.launch)).status,200);
 assert.equal((await f.wopi(started.launch)).status,404);
});
test('an acquired editor whose acknowledgement is lost is recovered by the same explicit editor identity',async t=>{
 const f=await fixture(t);f.state.editorId=null;
 let lost=true;const drafts={async call(route,body,selection){const result=await f.options.drafts.call(route,body,selection);
  if(lost&&route==='editor'&&body.operation==='acquire'){lost=false;throw Object.assign(Error('lost editor ACK'),{outcome:'UNKNOWN'});}return result;}};
 const app=createRuntimeOfficeApplication({...f.config,drafts}),input={...f.key,operation:'acquire',editorId:id(703),expectedEpoch:1,mode:'edit'};
 await assert.rejects(app.execute('launch',input,f.auth()),e=>e.outcome==='UNKNOWN');assert.equal(f.state.epoch,2);
 const recovered=await f.execute('read');assert.equal(recovered.editor.editorId,id(703));assert.equal(recovered.editor.epoch,2);
 const replay=await app.execute('launch',input,f.auth());assert.equal(replay.editor.epoch,2);assert.equal(f.state.epoch,2);
});
test('release-time access loss and retention generation change never return a launch form',async t=>{
 const f=await fixture(t);f.state.phaseHook=(intent,phase)=>{if(phase==='release')f.state.modeDenied=intent;};
 await assert.rejects(f.start(),{code:'ACCESS_DENIED'});assert.equal(f.state.puts,1);
 const g=await fixture(t);let reads=0;g.state.generationHook=()=>{if(++reads===3)g.state.generation++;};
 await assert.rejects(g.start(),{code:'EDITOR_RESULT_NOT_RELEASED'});
});
test('current Core artifact authority is checked again after a delayed byte read',async t=>{
 const f=await fixture(t),started=await f.start(),get=f.artifactOptions.objects.get;
 f.artifactOptions.objects.get=async(...args)=>{const bytes=await get(...args);f.state.modeDenied='revise';return bytes;};
 assert.equal((await f.wopi(started.launch,'getFile')).status,500);assert.equal(f.state.puts,1);
});
test('discard is explicit, clears saved private bytes, and remains blocked during uncertain Publish',async t=>{
 const f=await fixture(t),started=await f.start();await f.wopi(started.launch,'lock',{lock:'CODE'});await f.wopi(started.launch,'save',{lock:'CODE',body:ooxml('docx')});
 f.draft.state='publish-unknown';f.draft.publishIntent=`office:${f.draft.draftId}:1`;
 await assert.rejects(f.execute('discard'),{code:'OFFICE_DRAFT_CONFLICT'});assert.ok(f.draft.bytesBase64);
 f.draft.state='publish-refused';assert.deepEqual(await f.execute('discard'),{discarded:true});assert.equal(f.draft.bytesBase64,null);
});
async function control(f,route,extra={}){
 const value={schema:OFFICE_SCHEMA,...(route==='inspect'?{versionId:f.key.versionId}:f.key),...extra};
 const selected=receiveOfficeRequest(route,encode(value));
 const response=await f.app.handleControl(new Request(`https://control.example.test/api/meri/office/${route}`,{method:'POST',
  headers:{authorization:`Bearer ${f.session.credential}`,'content-type':'application/json'},body:JSON.stringify(value)}));
 const body=new Uint8Array(await response.arrayBuffer()),received=await receiveOfficeResponse(route,response.status,body,selected);
 return {response,body,received,selected};
}
for(const format of ['docx','xlsx','pptx'])test(`${format}: versioned HTTP producer/receiver handles private Save and distinct Publish`,async t=>{
 const f=await fixture(t,{format});assert.equal((await control(f,'open')).response.status,200);
 const opened=await control(f,'launch',{operation:'acquire',editorId:f.claims.editorId,expectedEpoch:0,mode:'edit'});
 assert.equal(opened.response.status,200);assert.equal(opened.response.headers.get('cache-control'),'no-store');assert.equal(opened.response.headers.get('referrer-policy'),'no-referrer');
 assert.equal((await (await f.wopi(opened.received.launch)).json()).PostMessageOrigin,'https://app.example.test');
 await f.wopi(opened.received.launch,'lock',{lock:'CODE'});await f.wopi(opened.received.launch,'save',{lock:'CODE',body:ooxml(format)});
 const snapshot=(await control(f,'read')).received;assert.equal(snapshot.launch,null);assert.equal(f.state.puts,1);
 const published=await control(f,'publish',{sequence:snapshot.draft.sequence,sha256:snapshot.draft.sha256});
 assert.equal(published.response.status,200);assert.equal(published.received.draft.state,'published');
 assert.deepEqual(Object.keys(published.received.publication).sort(),['inspection','version']);assert.equal(published.received.publication.inspection.currentBytesVerified,true);
 const inspected=await control(f,'inspect',{versionId:published.received.draft.publishedVersionId});assert.equal(inspected.response.status,200);
 assert.equal(inspected.received.document.version.object.sha256,snapshot.draft.sha256);
 if(format==='xlsx'){
  assert.equal(inspected.received.document.inspection.details.formulaCache,'editor-provided/unverified; recalculation required');
  const legacy=receiveDocumentRequest('inspect',encode({versionId:inspected.received.document.version.versionId}));
  await assert.rejects(receiveDocumentResponse('inspect',200,encode(inspected.received.document),legacy));
 }
 const version=inspected.received.document.version;
 const download=new Response(Buffer.from(f.draft.bytesBase64,'base64'),{headers:{'content-type':version.mimeType,'content-length':String(version.object.bytes),
  'content-disposition':`attachment; filename="${version.filename}"`,'cache-control':'no-store','x-content-type-options':'nosniff'}});
 const admitted=await receiveOfficeDownload(download,version);assert.deepEqual(Buffer.from(admitted.bytes),Buffer.from(f.draft.bytesBase64,'base64'));
});
test('receiver rejects leaked private bytes/tokens, substituted selectors, unbranded requests and incorrect lease epochs',async t=>{
 const f=await fixture(t),read=await control(f,'read'),launch=await control(f,'launch',{operation:'acquire',editorId:f.claims.editorId,expectedEpoch:0,mode:'edit'});
 for(const change of [r=>{r.draft.bytesBase64='private';},r=>{r.launch=launch.received.launch;},r=>{r.draft.draftId=id(999);},r=>{r.draft.baseVersionId=id(998);}]){
  const r=structuredClone(read.received);change(r);await assert.rejects(receiveOfficeResponse('read',200,encode(r),read.selected));
 }
 await assert.rejects(receiveOfficeResponse('read',200,read.body,{...read.selected}));
 const wrong=structuredClone(launch.received);wrong.editor.epoch++;await assert.rejects(receiveOfficeResponse('launch',200,encode(wrong),launch.selected));
 for(const change of [r=>{r.launch.actionUrl='https://attacker.example.test/browser/x/cool.html';},r=>{r.launch.fields.access_token_ttl='0';},r=>{r.launch.expiresAtMs=Date.parse(r.editor.expiresAt)+1;}]){
  const r=structuredClone(launch.received);change(r);await assert.rejects(receiveOfficeResponse('launch',200,encode(r),launch.selected));
 }
});
test('versioned inspect refuses mismatched publication hash, invented cache/fidelity claims and unrelated formats',async t=>{
 const f=await fixture(t,{format:'xlsx'}),result=await control(f,'inspect');
 for(const change of [r=>{r.document.inspection.sha256='a'.repeat(64);},r=>{r.document.inspection.recalculated=true;},
  r=>{r.document.inspection.details.formulaCache='verified';},r=>{r.document.version.object.scopes[0].policyRevision='other';}]){
  const r=structuredClone(result.received);change(r);await assert.rejects(receiveOfficeResponse('inspect',200,encode(r),result.selected));
 }
 const native=structuredClone(result.received);native.document.inspection.details.formulaCache='editor-provided/unverified; recalculation required';
 native.document.inspection.details.revisionMethod='openpyxl typed-cell replacement';await assert.rejects(receiveOfficeResponse('inspect',200,encode(native),result.selected));
});
test('HTTP entry refuses malformed/oversized bodies and unselected methods before the workflow runs',async t=>{
 const f=await fixture(t);let touched=false;const headers={authorization:`Bearer ${f.session.credential}`,'content-type':'application/json'};
 const hostile={get url(){touched=true;return 'https://bad.test';}};assert.equal((await f.app.handleControl(hostile)).status,400);assert.equal(touched,false);
 const cases=[['GET','read',undefined,headers,405],['POST','save','{}',headers,404],['POST','read','{}',headers,400],['POST','read','{',headers,400],
  ['POST','read',JSON.stringify({schema:OFFICE_SCHEMA,...f.key,actorId:'forged'}),headers,400],['POST','read','{}',{'content-type':'application/json'},401],
  ['POST','read','{}',{...headers,'content-encoding':'gzip'},415],['POST','read','{}',{...headers,'content-length':'9000'},413]];
 for(const [method,route,body,h,status]of cases){const response=await f.app.handleControl(new Request(`https://control.example.test/api/meri/office/${route}`,{method,headers:h,...(body?{body}:{})}));
  assert.equal(response.status,status);assert.equal((await response.json()).error.outcome,'NOT_DISPATCHED');}
 assert.equal(f.state.calls.length,0);assert.equal(f.state.puts,1);
});
test('HTTP failure after a Core write preserves uncertainty and never retries the write',async t=>{
 const f=await fixture(t);f.state.phaseHook=(intent,phase)=>{if(phase==='release')f.state.modeDenied=intent;};
 const result=await control(f,'launch',{operation:'acquire',editorId:f.claims.editorId,expectedEpoch:0,mode:'edit'});
 assert.equal(result.response.status,403);assert.deepEqual(result.received.error,{code:'ACCESS_DENIED',outcome:'UNKNOWN'});
 assert.equal(f.state.calls.filter(c=>c.route==='editor'&&c.request.operation==='acquire').length,1);
 assert.ok(!JSON.stringify(result.received).includes('access_token'));
});
test('request byte/JSON admission is closed, bounded and inert for proxies or accessor byte values',()=>{
 let touched=false;const fake=new Proxy(new Uint8Array(),{get(){touched=true;throw Error('trap');}});
 assert.throws(()=>receiveOfficeRequest('read',fake));assert.equal(touched,false);
 for(const bytes of [new Uint8Array(8193),Uint8Array.of(255),new TextEncoder().encode('{"schema":"meri.office-application/1","__proto__":{}}')])assert.throws(()=>receiveOfficeRequest('read',bytes));
 assert.throws(()=>receiveOfficeRequest('save',encode({})));
});
test('oversized and cancelled HTTP streams retire without a Core draft operation',async t=>{
 const f=await fixture(t),headers={authorization:`Bearer ${f.session.credential}`,'content-type':'application/json'};let cancelled=0;
 const body=new ReadableStream({pull(c){c.enqueue(new Uint8Array(9000));},cancel(){cancelled++;}});
 const oversized=await f.app.handleControl(new Request('https://control.example.test/api/meri/office/read',{method:'POST',headers,body,duplex:'half'}));
 assert.equal(oversized.status,400);assert.equal(cancelled,1);
 const controller=new AbortController();controller.abort();
 const aborted=await f.app.handleControl(new Request('https://control.example.test/api/meri/office/read',{method:'POST',headers,body:JSON.stringify({schema:OFFICE_SCHEMA,...f.key}),signal:controller.signal}));
 assert.equal(aborted.status,499);assert.equal((await aborted.json()).error.outcome,'NOT_DISPATCHED');assert.equal(f.state.calls.length,0);
});
test('trusted CODE postmessage origin requires an exact HTTPS origin',async t=>{
 const f=await fixture(t);
 for(const browserOrigin of [undefined,'*','http://app.example.test','https://app.example.test/path','https://user:password@app.example.test'])
  assert.throws(()=>createRuntimeOfficeApplication({...f.config,browserOrigin}));
});
test('pptx launch cannot return a write token after the final read contains an unbound chart workbook',async t=>{
 const {zip}=await import('../../../artifacts/structure/test/fixtures.mjs');
 const {chart}=await import('../../../artifacts/edit-sessions/test/embedded-chart-fixture.mjs');
 const entries=chart();entries['ppt/charts/chart1.xml']=entries['ppt/charts/chart1.xml'].replace('rId1','missing');
 const f=await fixture(t,{format:'pptx'}),bytes=zip(entries);let changed=false;
 f.state.hook=r=>{if(r==='editor/read'){changed=true;Object.assign(f.draft,{sequence:1,sha256:f.sha(bytes),byteLength:bytes.length,bytesBase64:bytes.toString('base64'),state:'draft'});}};
 await assert.rejects(f.start(),{code:'EDITOR_STRUCTURE_REFUSED'});assert.equal(changed,true);assert.equal(f.draft.sha256,f.sha(bytes));assert.equal(f.state.puts,1);
});

test('historical workbook-loss draft is recoverable metadata but cannot receive an edit token',async t=>{
 const f=await fixture(t,{format:'pptx',baseBytes:preservationBytes('pptx')}),bytes=ooxml('pptx');
 Object.assign(f.draft,{sequence:1,sha256:f.sha(bytes),byteLength:bytes.length,bytesBase64:bytes.toString('base64')});
 assert.equal((await f.execute('read')).draft.sha256,f.sha(bytes));
 await assert.rejects(f.start(),{code:'EDITOR_STRUCTURE_REFUSED'});
 assert.equal(f.state.calls.some(c=>c.route==='editor'&&c.request.operation==='acquire'),false);assert.equal(f.state.puts,1);
});
test('pptx renew cannot return a write token after the final read contains an unbound chart workbook',async t=>{
 const {zip}=await import('../../../artifacts/structure/test/fixtures.mjs');
 const {chart}=await import('../../../artifacts/edit-sessions/test/embedded-chart-fixture.mjs');
 const entries=chart();entries['ppt/charts/chart1.xml']=entries['ppt/charts/chart1.xml'].replace('rId1','missing');
 const f=await fixture(t,{format:'pptx'}),bytes=zip(entries);let changed=false;
 f.state.hook=r=>{if(r==='editor/read'){changed=true;Object.assign(f.draft,{sequence:1,sha256:f.sha(bytes),byteLength:bytes.length,bytesBase64:bytes.toString('base64'),state:'draft'});}};
 await assert.rejects(f.execute('renew',{editorId:f.claims.editorId,expectedEpoch:1,mode:'edit'}),{code:'EDITOR_STRUCTURE_REFUSED'});
 assert.equal(changed,true);assert.equal(f.draft.sha256,f.sha(bytes));assert.equal(f.state.puts,1);
});
