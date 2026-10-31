import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {wopiFixture} from './wopi-fixture.mjs';
import {ooxml} from '../../structure/test/fixtures.mjs';
import {createWopiFileApplication} from '../wopi-files.mjs';
import {createArtifactService} from '../../service.mjs';
import {zip} from '../../structure/test/fixtures.mjs';
import {createHash} from 'node:crypto';
import {chart} from './embedded-chart-fixture.mjs';
const edited=()=>ooxml('docx',{mainXml:'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Private edit</w:t></w:r></w:p></w:body></w:document>'});
const bytes=async response=>Buffer.from(await response.arrayBuffer());
test('native CODE forwarded expiry must match the signed token and cannot extend its lifetime',async t=>{
 const f=await wopiFixture(t),source=f.request().url;
 const request=extra=>new Request(source+extra);
 assert.equal((await f.host.handle(request('&access_token_ttl='+f.claims.expiresAtMs))).status,200);
 assert.equal((await f.host.handle(request('&access_token_ttl=0'))).status,200);
 for(const extra of ['&access_token_ttl=-1','&access_token_ttl=NaN','&access_token_ttl=9007199254740992',
  '&access_token_ttl='+String(f.claims.expiresAtMs+1),'&access_token_ttl='+f.claims.expiresAtMs+'&access_token_ttl='+f.claims.expiresAtMs,
  '&unrecognized=1']){
  assert.equal((await f.host.handle(request(extra))).status,401);
 }
 f.state.clock=f.claims.expiresAtMs;
 assert.equal((await f.host.handle(request('&access_token_ttl='+f.claims.expiresAtMs))).status,401);
 assert.equal((await f.host.handle(request('&access_token_ttl=0'))).status,401);
});
test('CODE reconnect permission is a closed hint and never upgrades a read-only token',async t=>{
 const f=await wopiFixture(t,{write:false});f.state.readonly=true;
 for(const permission of ['edit','readonly']){
  const response=await f.host.handle(new Request(f.request().url+'&permission='+permission));
  assert.equal(response.status,200);assert.equal((await response.json()).UserCanWrite,false);
  const lock=f.request('lock',{lock:'one'});
  assert.equal((await f.host.handle(new Request(lock.url+'&permission='+permission,lock))).status,401);
 }
 for(const value of ['','write','admin','edit&permission=readonly','edit&authority=allow'])
  assert.equal((await f.host.handle(new Request(f.request().url+'&permission='+value))).status,401);
 f.sessions.revoke(f.session.credential);
 assert.notEqual((await f.host.handle(new Request(f.request().url+'&permission=edit'))).status,200);
 assert.equal(f.state.lock,'');assert.equal(f.draft.sequence,0);
});
for(const format of ['docx','xlsx','pptx'])test(`${format}: CheckFileInfo and GetFile use exact immutable source and current native session`,async t=>{
 const f=await wopiFixture(t,{format}),response=await f.send(),info=await response.json();assert.equal(response.status,200);
 assert.equal(info.BaseFileName,f.first.version.filename);assert.equal(info.Size,f.baseBytes.length);assert.equal(info.UserCanWrite,true);assert.equal(info.UserCanNotWriteRelative,true);
 assert.match(info.UserId,/^[a-f0-9]{64}$/u);assert.equal(info.OwnerId,info.UserId);assert.equal(info.SupportsLocks,true);
 const file=await f.send('getFile');assert.equal(file.status,200);assert.deepEqual(await bytes(file),f.baseBytes);assert.equal(file.headers.get('x-wopi-itemversion'),info.Version);
 assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(file.headers.get('referrer-policy'),'no-referrer');
 assert.ok(f.state.calls.every(x=>x.headers.authorization==='Bearer synthetic-native-bearer'&&x.headers['x-internal-service-secret']==='synthetic-service-secret'));
 assert.equal(f.state.puts,1);assert.equal(f.state.executions.length,1);
});
test('extended opaque lock lifecycle, exact private Save and lost-ACK replay never publish',async t=>{
 const f=await wopiFixture(t),lock='{"owner": "CODE", "pad": "'+'x'.repeat(996)+'"}';assert.equal(lock.length,1024);
 assert.equal((await f.send('lock',{lock})).status,200);
 assert.equal((await f.send('get')).headers.get('x-wopi-lock'),lock);
 assert.equal((await f.send('refresh',{lock})).status,200);
 const mismatch=await f.send('lock',{lock:'other'});assert.equal(mismatch.status,409);assert.equal(mismatch.headers.get('x-wopi-lock'),lock);
 assert.equal((await f.send('relock',{lock:'new lock',oldLock:lock})).status,200);
 f.state.failSave=true;assert.equal((await f.send('save',{lock:'new lock',body:edited()})).status,500);assert.equal(f.draft.sequence,1);
 f.state.failSave=false;const saved=await f.send('save',{lock:'new lock',body:edited()});assert.equal(saved.status,200);assert.equal(f.draft.sequence,1);
 assert.equal(saved.headers.get('x-wopi-lock'),null);assert.equal(saved.headers.get('x-wopi-itemversion'),(await (await f.send()).json()).Version);
 assert.deepEqual(await bytes(await f.send('getFile')),edited());assert.equal(f.state.puts,1);assert.equal(f.state.executions.length,1);
 assert.equal(f.sql.state.versions.size,1);assert.ok(!f.state.calls.some(c=>c.route.includes('publish')));
 assert.equal((await f.send('unlock',{lock:'new lock'})).status,200);assert.equal((await f.send('get')).headers.get('x-wopi-lock'),'');
 const unlocked=await f.send('save',{body:edited()});assert.equal(unlocked.status,409);assert.equal(unlocked.headers.get('x-wopi-lock'),'');assert.equal(f.draft.sequence,1);
});
test('a read-only token downloads through current download authority and cannot lock, save or create another file',async t=>{
 const f=await wopiFixture(t,{write:false});f.state.readonly=true;
 assert.equal((await f.send()).status,200);assert.equal((await (await f.send()).json()).UserCanWrite,false);
 assert.deepEqual(await bytes(await f.send('getFile')),f.baseBytes);
 for(const op of ['lock','save','get','relative'])assert.equal((await f.send(op,{...(op==='lock'||op==='save'?{lock:'one'}:{}),...(op==='save'?{body:edited()}:{})})).status,401);
 assert.ok(f.state.calls.every(x=>x.route==='editor/read'));
});
test('a writable token cannot bypass current artifact.revise permission',async t=>{
 const f=await wopiFixture(t);f.state.readonly=true;assert.equal((await f.send()).status,404);
 assert.equal((await f.send('save',{lock:'one',body:edited()})).status,404);assert.equal(f.draft.sequence,0);
});
for(const change of ['token','file','expired','actor','conversation','base','epoch','generation','suppression','session'])test(`current ${change} loss releases no document or lock`,async t=>{
 const f=await wopiFixture(t);let request=f.request('getFile');
 if(change==='token')request=new Request(request.url.replace(/access_token=.*/u,'access_token=invalid'));
 if(change==='file')request=new Request(request.url.replace('synthetic-file','another-file'));
 if(change==='expired')f.state.clock=f.claims.expiresAtMs;
 if(['actor','conversation'].includes(change)){const field=change==='actor'?'actorId':'conversationId',value=change==='actor'?'other':'00000000-0000-4000-8000-000000000999';const claims={...f.claims,[field]:value,runBinding:{...f.claims.runBinding,[field]:value}};request=f.request('getFile',{token:f.codec.issue(claims)});}
 if(change==='base')f.draft.baseSha256='b'.repeat(64);
 if(change==='epoch')f.state.epoch++;
 if(change==='generation')f.state.generation++;
 if(change==='suppression')f.sql.suppressed.add(`${f.context.binding.tenantId}:artifact:${f.first.version.artifactId}`);
 if(change==='session')f.sessions.revoke(f.session.credential);
 const response=await f.host.handle(request);assert.notEqual(response.status,200);assert.equal((await bytes(response)).length,0);assert.equal(response.headers.get('x-wopi-lock'),null);
});
for(const stage of ['context','body','after-save','final-retention'])test(`access loss at ${stage} withholds late bytes and never repeats an effect`,async t=>{
 const f=await wopiFixture(t);await f.send('lock',{lock:'one'});
 if(stage==='context')f.state.contextHook=()=>{f.sessions.revoke(f.session.credential);};
 if(stage==='after-save')f.state.hook=route=>{if(route==='editor/read'&&f.draft.sequence>0)f.state.epoch++;};
 if(stage==='final-retention'){let reads=0;f.state.generationHook=()=>{if(++reads===3)f.state.generation++;};}
 const body=stage==='body'?new ReadableStream({pull(c){c.enqueue(edited());f.sessions.revoke(f.session.credential);c.close();}},{highWaterMark:0}):edited();
 const response=await f.send('save',{lock:'one',body});assert.notEqual(response.status,200);assert.equal((await bytes(response)).length,0);
 assert.ok(f.state.calls.filter(x=>x.route==='save').length<=1);
 if(stage==='context'||stage==='body')assert.equal(f.draft.sequence,0);
 if(stage==='after-save'||stage==='final-retention')assert.equal(f.draft.sequence,1);
});
test('a slow empty lock body cannot carry earlier revise authority into the later effect',async t=>{
 const f=await wopiFixture(t),body=new ReadableStream({pull(c){f.state.readonly=true;c.close();}},{highWaterMark:0});
 assert.equal((await f.send('lock',{lock:'one',body})).status,404);assert.equal(f.state.lock,'');
 assert.ok(f.state.calls.length>0);assert.ok(f.state.calls.every(c=>c.route==='editor/read'));
});
test('suppression or takeover during the last current check withholds an otherwise valid file',async t=>{
 for(const cause of ['suppression','takeover']){const f=await wopiFixture(t);let reads=0;
  f.state.hook=route=>{if(route==='editor/read'&&++reads===2){if(cause==='takeover')f.state.epoch++;else f.sql.suppressed.add(`${f.context.binding.tenantId}:artifact:${f.first.version.artifactId}`);}};
  const response=await f.send('getFile');assert.equal(response.status,404);assert.equal((await bytes(response)).length,0);
 }
});
test('GetFile enforces MaxExpectedSize and returns neither partial bytes nor a direct download URL',async t=>{
 const f=await wopiFixture(t),small=await f.send('getFile',{headers:{'x-wopi-maxexpectedsize':String(f.baseBytes.length-1)}});assert.equal(small.status,412);assert.equal((await bytes(small)).length,0);
 assert.equal((await f.send('getFile',{headers:{'x-wopi-maxexpectedsize':String(f.baseBytes.length)}})).status,200);
 const info=await (await f.send()).json();assert.equal(info.FileUrl,undefined);assert.equal(info.DownloadUrl,undefined);
});
test('malformed, empty, oversized and truncated Save bodies never reach Core Save',async t=>{
 const f=await wopiFixture(t);await f.send('lock',{lock:'one'});
 for(const [body,headers,status]of [[Buffer.from('bad'),{},400],[Buffer.alloc(0),{},400],[edited(),{'content-length':String(edited().length+1)},400],
  [edited(),{'content-length':'20971521'},413],[edited(),{'content-encoding':'gzip'},415]]){
  const response=await f.send('save',{lock:'one',body,headers});assert.equal(response.status,status);
 }
 assert.ok(!f.state.calls.some(c=>c.route==='save'));assert.equal(f.draft.sequence,0);
});
test('unbounded, cancelled and refused input streams are retired without a Save',async t=>{
 const f=await wopiFixture(t);let cancelled=0;
 const body=new ReadableStream({pull(c){c.enqueue(new Uint8Array(1024*1024));},cancel(){cancelled++;}});
 assert.equal((await f.send('save',{lock:'one',body})).status,413);assert.equal(cancelled,1);
 const controller=new AbortController(),hanging=new ReadableStream({pull(){controller.abort();},cancel(){cancelled++;}},{highWaterMark:0});
 assert.notEqual((await f.send('save',{lock:'one',body:hanging,signal:controller.signal})).status,200);assert.equal(cancelled,2);
 const refused=new ReadableStream({cancel(){cancelled++;}});assert.equal((await f.send('save',{token:'invalid',body:refused})).status,401);assert.equal(cancelled,3);
 assert.ok(!f.state.calls.some(c=>c.route==='save'));
});
test('closed method/path/query/header syntax and inert native Request access',async t=>{
 const f=await wopiFixture(t);let touched=false;const requests=[{get url(){touched=true;return f.request().url;}},new Proxy(f.request(),{get(){touched=true;throw Error();}}),
  new Request(f.request().url+'&access_token=another'),new Request(f.request().url+'&authority=allow'),new Request(f.request().url,{method:'DELETE'}),
  new Request(f.request().url,{method:'POST',headers:{'x-wopi-override':'RENAME_FILE'}}),new Request(f.request().url,{method:'POST',headers:{'x-wopi-override':'toString'}}),
  f.request('lock',{lock:'one',headers:{'x-wopi-oldlock':''}}),f.request('lock',{lock:'a'.repeat(1025)}),f.request('getFile',{headers:{'x-wopi-maxexpectedsize':'-1'}})];
 for(const request of requests)assert.notEqual((await f.host.handle(request)).status,200);
 assert.equal(touched,false);assert.equal(f.state.calls.length,0);
});
test('unsupported write-relative and publication barrier never create a file or report Save success',async t=>{
 const f=await wopiFixture(t);assert.equal((await f.send('relative')).status,401);await f.send('lock',{lock:'one'});
 f.draft.sequence=1;f.draft.sha256=f.sha(edited());f.draft.byteLength=edited().length;f.draft.bytesBase64=edited().toString('base64');f.draft.state='publish-pending';f.draft.publishIntent=`office:${f.draft.draftId}:1`;
 assert.equal((await (await f.send()).json()).UserCanWrite,false);
 const response=await f.send('save',{lock:'one',body:edited()});assert.equal(response.status,409);assert.equal(response.headers.get('x-wopi-lock'),'one');assert.equal(f.draft.sequence,1);
});
test('private editor source requires retention and explicit read/write intent; public source shape remains unchanged',async t=>{
 const f=await wopiFixture(t),ids=()=>({artifactId:f.first.version.artifactId,versionId:f.first.version.versionId,objectId:f.first.version.object.objectId});
 const service=createArtifactService({...f.artifactOptions,ids}),unguarded=createArtifactService({...f.artifactOptions,ids,retention:undefined});
 assert.throws(()=>service.editorSource(f.first.version.versionId,f.context));
 await assert.rejects(unguarded.editorSource(f.first.version.versionId,f.context,{write:true}),{code:'ARTIFACT_CONFIGURATION'});
 const source=await service.editorSource(f.first.version.versionId,f.context,{write:true});assert.deepEqual(Object.keys(source).sort(),['bytes','version']);
 assert.deepEqual(await bytes(await f.send('getFile')),source.bytes);
});
test('actual local HTTP GET/LOCK/PUT/GET traverses the adapter, canonical artifact owner and Core transport',async t=>{
 const f=await wopiFixture(t),host=createWopiFileApplication(f.options);
 const server=createServer(async(req,res)=>{try{const body=['GET','HEAD'].includes(req.method)?undefined:Readable.toWeb(req);
  const response=await host.handle(new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,...(body?{body,duplex:'half'}:{})}));
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 const send=async(op,options)=>{const request=f.request(op,options),url=new URL(request.url);url.protocol='http:';url.host='127.0.0.1:'+server.address().port;
  return fetch(url,{method:request.method,headers:request.headers,...(request.body?{body:request.body,duplex:'half'}:{})});};
 assert.equal((await send('lock',{lock:'local CODE'})).status,200);assert.deepEqual(await bytes(await send('getFile')),f.baseBytes);
 assert.equal((await send('save',{lock:'local CODE',body:edited()})).status,200);assert.deepEqual(await bytes(await send('getFile')),edited());assert.equal(f.sql.state.versions.size,1);
});

test('validated workbook base and retained draft remain writable with exact private bytes',async t=>{
 const f=await wopiFixture(t,{format:'pptx',baseBytes:zip(chart())}),entries=chart();
 entries['ppt/charts/chart1.xml']=entries['ppt/charts/chart1.xml'].replace('val="0"','val="1"');
 const saved=zip(entries),info=await (await f.send()).json();
 assert.equal(info.UserCanWrite,true);assert.equal(info.SupportsUpdate,true);assert.equal(info.ReadOnly,false);
 assert.equal((await f.send('lock',{lock:'chart-lock'})).status,200);
 const response=await f.send('save',{lock:'chart-lock',body:saved});assert.equal(response.status,200);
 assert.equal(f.draft.sequence,1);assert.equal(f.draft.sha256,f.sha(saved));
 assert.equal(response.headers.get('x-wopi-itemversion'),`${f.draft.draftId}:1:${f.sha(saved)}`);
 assert.deepEqual(await bytes(await f.send('getFile')),saved);
 assert.equal((await (await f.send()).json()).UserCanWrite,true);
 assert.equal(f.state.puts,1);assert.equal(f.sql.state.versions.size,1);
});

test('malformed chart-workbook Save refuses before Core and preserves the last good draft',async t=>{
 const f=await wopiFixture(t,{format:'pptx',baseBytes:zip(chart())});
 await f.send('lock',{lock:'chart-lock'});await f.send('save',{lock:'chart-lock',body:f.baseBytes});
 const entries=chart();entries['ppt/charts/chart1.xml']=entries['ppt/charts/chart1.xml'].replace('rId1','missing');
 const before={sequence:f.draft.sequence,sha256:f.draft.sha256,calls:f.state.calls.length};
 assert.equal((await f.send('save',{lock:'chart-lock',body:zip(entries)})).status,400);
 assert.equal(f.state.calls.slice(before.calls).some(call=>call.route==='save'),false);
 assert.equal(f.draft.sequence,before.sequence);assert.equal(f.draft.sha256,before.sha256);
 assert.deepEqual(await bytes(await f.send('getFile')),f.baseBytes);
});

test('structurally valid engine output that drops a workbook never reaches Core Save',async t=>{
 const f=await wopiFixture(t,{format:'pptx',baseBytes:zip(chart())});await f.send('lock',{lock:'one'});
 await f.send('save',{lock:'one',body:f.baseBytes});const before=f.state.calls.length;
 assert.equal((await f.send('save',{lock:'one',body:ooxml('pptx')})).status,400);
 assert.equal(f.state.calls.slice(before).some(c=>c.route==='save'),false);assert.equal(f.draft.sequence,1);
 assert.equal(f.draft.sha256,f.sha(f.baseBytes));assert.deepEqual(await bytes(await f.send('getFile')),f.baseBytes);
});

test('valid chart and workbook part renumbering is accepted without splicing original bytes',async t=>{
 const f=await wopiFixture(t,{format:'pptx',baseBytes:zip(chart())}),e=chart();
 e['ppt/charts/chart9.xml']=e['ppt/charts/chart1.xml'];delete e['ppt/charts/chart1.xml'];
 e['ppt/charts/_rels/chart9.xml.rels']=e['ppt/charts/_rels/chart1.xml.rels'].replace('data.xlsx','renamed.xlsx');delete e['ppt/charts/_rels/chart1.xml.rels'];
 e['ppt/embeddings/renamed.xlsx']=e['ppt/embeddings/data.xlsx'];delete e['ppt/embeddings/data.xlsx'];
 e['[Content_Types].xml']=e['[Content_Types].xml'].replace('chart1.xml','chart9.xml');const saved=zip(e);
 await f.send('lock',{lock:'one'});assert.equal((await f.send('save',{lock:'one',body:saved})).status,200);
 assert.deepEqual(await bytes(await f.send('getFile')),saved);assert.equal(f.draft.sha256,f.sha(saved));
});

for(const loss of ['epoch','lock','access','session','retention'])test(`chart-workbook save still enforces ${loss}`,async t=>{
 const f=await wopiFixture(t,{format:'pptx',baseBytes:zip(chart())});await f.send('lock',{lock:'one'});
 if(loss==='epoch')f.state.epoch++;
 if(loss==='lock')f.state.lock='other';
 if(loss==='access')f.state.readonly=true;
 if(loss==='session')f.sessions.revoke(f.session.credential);
 if(loss==='retention')f.sql.suppressed.add(`${f.context.binding.tenantId}:artifact:${f.first.version.artifactId}`);
 assert.notEqual((await f.send('save',{lock:'one',body:f.baseBytes})).status,200);
 assert.equal(f.draft.sequence,0);assert.equal(f.draft.bytesBase64,null);assert.equal(f.state.puts,1);
});

test('closed WOPI codec cannot issue or verify after key ownership is released',async()=>{
 const {createWopiAccessTokenCodec}=await import('../wopi-access-token.mjs');
 const codec=createWopiAccessTokenCodec({key:Buffer.alloc(32,7),now:()=>1000});
 codec.close();
 assert.throws(()=>codec.issue({}),{code:'WOPI_TOKEN_CONFIGURATION'});
 assert.throws(()=>codec.verify('a.b',{fileId:'f'}),{code:'WOPI_TOKEN_CONFIGURATION'});
});
