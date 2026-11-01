import test from 'node:test';
import assert from 'node:assert/strict';
import {createUploadCustody,hash} from '../custody.mjs';
import {createUploadInspection} from '../extraction.mjs';
import {uploadHash} from '../policy.mjs';
import {createUploadApplication,UPLOAD_INSPECTION_DISPATCH,UPLOAD_INSPECTION_UNSETTLED_EVENT} from '../application.mjs';
import {createMemoryRetentionJournal} from '../../retention/memory-journal.mjs';
import {createRetentionReadGate} from '../../retention/suppression.mjs';
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`,copy=structuredClone;
function fixture(){
 const state={at:Date.now(),denied:false,suppressed:false,puts:0,object:null,lostAck:false,absent:false,rows:new Map(),gets:0};
 const bytes=Buffer.from('literal uploaded document'),declaration={filename:'document.txt',mimeType:'text/plain',bytes:bytes.length,sha256:uploadHash(bytes)};
 const binding={tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),attemptId:id(5),workerId:id(6),writerFence:1};
 const scopes=[{tenantId:id(1),kind:'private-user',resourceId:id(2),policyRevision:'policy1'}],now=()=>state.at;
 const current=async()=>{if(state.denied)throw Error('CURRENT_DENIED');return {binding:copy(binding),scopes:copy(scopes),selectedClientId:null,checkedAtMs:now(),expiresAtMs:now()+300000};};
 const store={
  async prepare(r){const old=[...state.rows.values()].find(v=>v.requestId===r.requestId);if(old)return copy(old);state.rows.set(r.uploadId,copy(r));return copy(r);},
  async readByRequest(owner,key){return copy([...state.rows.values()].find(r=>r.requestId===key)??null);},
  async read(owner,key){await state.onRead?.(key);return copy(state.rows.get(key)??null);},
  async transition(a,b,check){await state.onTransition?.(a,b);check();if(hash(state.rows.get(a.uploadId))!==hash(a))throw Error('UPLOAD_CHANGED');state.rows.set(a.uploadId,copy(b));return copy(b);},
 };
 const objects={
  async put(r){state.puts++;await state.onPut?.();state.stored=Buffer.from(r.bytes);state.object={objectId:r.objectId,versionId:'NATIVE_ORIGINAL_VERSION',sha256:uploadHash(r.bytes),bytes:r.bytes.length,scopes:r.scopes};if(state.lostAck)throw Error('ACK_LOST');return copy(state.object);},
  async observePut(){return state.absent?null:copy(state.object);},
  async get(){state.gets++;state.onGet?.();return Buffer.from(state.stored??bytes);},
 };
 const receipt=(file=declaration)=>({sourceSha256:file.sha256,sourceBytes:file.bytes,checkedAtMs:now()}),tool={name:'synthetic',version:'1',binarySha256:'a'.repeat(64)};
 const inspection=createUploadInspection({now,scanner:{async scan({file}){await state.onScan?.();return {...receipt(file),status:'clean',tool,definitionsSha256:'b'.repeat(64),reason:null};}},extractor:{async extract(){return state.extractionUnavailable?{...receipt(),status:'unavailable',tool:null,segments:[],limitations:['EXTRACTOR_UNAVAILABLE']}:{...receipt(),status:'available',tool,segments:state.segments??[],limitations:[]};}}});
 const journal=createMemoryRetentionJournal(),retention=createRetentionReadGate({journal:{...journal,get:async()=>state.suppressed?{state:'SUPPRESSED'}:null},serving:{isEnabled:()=>true}});
 const suppress=()=>journal.withTransition(`${binding.tenantId}:conversation:${binding.conversationId}`,async()=>{state.suppressed=true;});
 const removeOriginal=async({object})=>{if(state.hold)throw Error('LEGAL_HOLD');state.onDelete?.();return {deleted:true,objectId:object.objectId,versionId:object.versionId};};
 let sequence=20;const config={store,objects,inspection,current,retention,removeOriginal,now,ids:()=>id(sequence++)},options={deadlineMs:state.at+180000};
 const create=changes=>createUploadCustody({...config,...changes});
 const initiate=owner=>owner.initiate({requestId:id(10),declaration},options);
 return {state,bytes,declaration,binding,scopes,config,options,create,initiate,suppress};
}
test('original upload is immutable, scan-gated, reloadable and idempotent across owner reconstruction',async()=>{
 const f=fixture(),owner=f.create(),prepared=await f.initiate(owner);
 assert.equal(prepared.state,'prepared');assert.equal((await f.initiate(f.create())).uploadId,prepared.uploadId);
 const stored=await owner.put(prepared.uploadId,f.bytes,f.options);assert.equal(stored.object.versionId,'NATIVE_ORIGINAL_VERSION');
 await assert.rejects(owner.read(prepared.uploadId,f.options),{code:'UPLOAD_NOT_CLEAN'});assert.equal(f.state.gets,0);
 await owner.inspect(prepared.uploadId,f.options);assert.deepEqual((await f.create().read(prepared.uploadId,f.options)).bytes,f.bytes);
 await f.create().put(prepared.uploadId,f.bytes,f.options);assert.equal(f.state.puts,1);
});

test('private input source re-resolves exact original hash and actual current clean extraction',async()=>{
 const f=fixture(),owner=f.create(),r=await f.initiate(owner),selector={uploadId:r.uploadId,sha256:f.declaration.sha256};
 f.state.segments=[{ordinal:0,text:f.bytes.toString(),method:'native',confidence:null,location:{page:null,slide:null,sheet:null,rowStart:null,rowEnd:null}}];
 await owner.put(r.uploadId,f.bytes,f.options);await assert.rejects(owner.readForInput(selector,f.options),/NOT_CLEAN/);
 await owner.inspect(r.uploadId,f.options);const source=await f.create().readForInput(selector,f.options);assert.deepEqual(source.bytes,f.bytes);
 assert.equal(source.record.inspection.extraction.segments[0].trust,'external_untrusted');
 await assert.rejects(owner.readForInput({...selector,sha256:'0'.repeat(64)},f.options),/ORIGINAL_MISMATCH/);
 await assert.rejects(owner.readForInput({...selector,scanStatus:'clean'},f.options));
 let scans=0;f.state.onScan=()=>{scans++;};
 // A settled observation is reconciled, not re-run: a lost inspect reply never costs a second native scan.
 assert.deepEqual(await owner.inspect(r.uploadId,f.options),await f.create().status(r.uploadId,f.options));assert.equal(scans,0);
 // An outage verdict (no extractor) is not settled, so a later inspect may replace it once the tool is back.
 f.state.extractionUnavailable=true;const second=await owner.initiate({requestId:id(11),declaration:f.declaration},f.options),other={uploadId:second.uploadId,sha256:f.declaration.sha256};
 await owner.put(second.uploadId,f.bytes,f.options);await owner.inspect(second.uploadId,f.options);await assert.rejects(owner.readForInput(other,f.options),/EXTRACTION_UNAVAILABLE/);
 f.state.extractionUnavailable=false;await owner.inspect(second.uploadId,f.options);assert.equal(scans,2);assert.equal((await owner.readForInput(other,f.options)).record.inspection.extraction.status,'available');
 assert.deepEqual((await owner.read(r.uploadId,f.options)).bytes,f.bytes);
 f.state.denied=true;await assert.rejects(owner.readForInput(selector,f.options),/CURRENT_DENIED/);
});
test('lost ACK is reconciled through read-only native identity, never a second put',async()=>{
 const f=fixture(),owner=f.create(),r=await f.initiate(owner);f.state.lostAck=true;
 await assert.rejects(owner.put(r.uploadId,f.bytes,f.options),{code:'UPLOAD_PUT_UNKNOWN'});
 assert.equal(f.state.rows.get(r.uploadId).state,'writing');await owner.put(r.uploadId,f.bytes,f.options);assert.equal(f.state.puts,1);
 const recovered=await f.create().status(r.uploadId,f.options);assert.equal(recovered.state,'stored');assert.equal(recovered.object.versionId,'NATIVE_ORIGINAL_VERSION');assert.equal(f.state.puts,1);
});
test('absent observation stays unknown and does not grant replay',async()=>{
 const f=fixture(),owner=f.create(),r=await f.initiate(owner);f.state.lostAck=true;await assert.rejects(owner.put(r.uploadId,f.bytes,f.options));f.state.absent=true;
 assert.equal((await owner.status(r.uploadId,f.options)).state,'writing');await owner.put(r.uploadId,f.bytes,f.options);assert.equal(f.state.puts,1);
});

test('a never-attempted upload can be cancelled atomically, but UNKNOWN cannot be erased or retried',async()=>{
 const f=fixture(),owner=f.create(),r=await f.initiate(owner);
 const removed=await owner.remove(r.uploadId,f.options);assert.equal(removed.state,'removed');assert.equal(removed.object,null);
 assert.equal((await owner.put(r.uploadId,f.bytes,f.options)).state,'removed');assert.equal(f.state.puts,0);
 const g=fixture(),other=g.create(),pending=await g.initiate(other);g.state.lostAck=true;g.state.absent=true;
 await assert.rejects(other.put(pending.uploadId,g.bytes,g.options));await assert.rejects(other.remove(pending.uploadId,g.options),/REMOVAL_UNCERTAIN/);
 assert.equal(g.state.rows.get(pending.uploadId).state,'writing');assert.equal(g.state.puts,1);
});
test('suppression waits for a durable write claim, while an in-flight native attempt retains exact custody',async()=>{
 const f=fixture(),owner=f.create(),r=await f.initiate(owner),claimed=Promise.withResolvers(),resume=Promise.withResolvers(),putEntered=Promise.withResolvers(),putResume=Promise.withResolvers();
 f.state.onTransition=async(a,b)=>{if(b.state==='writing'){claimed.resolve();await resume.promise;}};
 f.state.onPut=async()=>{putEntered.resolve();await putResume.promise;};
 const writing=owner.put(r.uploadId,f.bytes,f.options),refused=assert.rejects(writing,/RETENTION_SUPPRESSED/);await claimed.promise;
 const suppressed=f.suppress();await new Promise(setImmediate);assert.equal(f.state.suppressed,false);
 resume.resolve();await suppressed;await putEntered.promise;
 assert.equal(f.state.rows.get(r.uploadId).state,'writing');assert.equal(f.state.puts,1);
 putResume.resolve();await refused;
 assert.equal(f.state.rows.get(r.uploadId).state,'stored');assert.equal(f.state.rows.get(r.uploadId).object.versionId,'NATIVE_ORIGINAL_VERSION');
 await assert.rejects(owner.put(r.uploadId,f.bytes,f.options),/RETENTION_SUPPRESSED/);assert.equal(f.state.puts,1);
});
test('current actor/client mismatch and retention suppression deny metadata/bytes before release',async()=>{
 const f=fixture(),owner=f.create(),r=await f.initiate(owner);await owner.put(r.uploadId,f.bytes,f.options);await owner.inspect(r.uploadId,f.options);
 f.state.suppressed=true;await assert.rejects(owner.status(r.uploadId,f.options),/RETENTION/);f.state.suppressed=false;
 const wrong=f.create({current:async()=>({...await f.config.current(),binding:{...f.binding,actorId:id(8)},scopes:[{...f.scopes[0],resourceId:id(8)}]})});
 await assert.rejects(wrong.status(r.uploadId,f.options),{code:'UPLOAD_ACCESS_DENIED'});
 f.state.onGet=()=>{f.state.denied=true;};await assert.rejects(owner.read(r.uploadId,f.options),/CURRENT_DENIED/);
});
test('revoked access during scanning cannot publish extraction',async()=>{
 const f=fixture(),owner=f.create(),r=await f.initiate(owner);await owner.put(r.uploadId,f.bytes,f.options);f.state.onScan=()=>{f.state.denied=true;};
 await assert.rejects(owner.inspect(r.uploadId,f.options),/CURRENT_DENIED/);assert.equal(f.state.rows.get(r.uploadId).inspection,null);
});
test('removal suppresses serving first; holds and UNKNOWN deletion preserve exact original identity',async()=>{
 const f=fixture(),owner=f.create(),r=await f.initiate(owner);await owner.put(r.uploadId,f.bytes,f.options);await owner.inspect(r.uploadId,f.options);f.state.hold=true;
 await assert.rejects(owner.remove(r.uploadId,f.options),/LEGAL_HOLD/);assert.equal(f.state.rows.get(r.uploadId).state,'removing');assert.equal(f.state.rows.get(r.uploadId).object.versionId,'NATIVE_ORIGINAL_VERSION');
 await assert.rejects(owner.read(r.uploadId,f.options),{code:'UPLOAD_NOT_CLEAN'});f.state.hold=false;
 const removed=await f.create().remove(r.uploadId,f.options);assert.equal(removed.state,'removed');assert.equal(removed.inspection,null);assert.equal(removed.object.versionId,'NATIVE_ORIGINAL_VERSION');
});
test('changed bytes and reused request identity with different declaration are rejected before effect',async()=>{
 const f=fixture(),owner=f.create(),r=await f.initiate(owner);
 await assert.rejects(owner.put(r.uploadId,Buffer.from('different bytes'),f.options),{code:'UPLOAD_ORIGINAL_MISMATCH'});assert.equal(f.state.puts,0);
 await assert.rejects(owner.initiate({requestId:id(10),declaration:{...f.declaration,filename:'renamed.txt'}},f.options),{code:'UPLOAD_REQUEST_CONFLICT'});
});
function applicationFixture(overrides={}){
 const f=fixture(),authentication=()=>({principal:{sessionId:'synthetic-session',tenantId:f.binding.tenantId,actorId:f.binding.actorId,conversationId:f.binding.conversationId,runId:f.binding.runId},sessionRevision:'1',checkedAtMs:f.state.at,expiresAtMs:f.state.at+300000});
 f.state.authCredentials=[];
 const sessions={async authenticateSession({credential}){f.state.authCredentials.push(credential);if(f.state.denied)throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});return authentication();},
  async readCurrentState({authentication:auth}){return {...await f.config.current(),authenticationSha256:hash(auth)};}};
 f.state.events=[];
 const app=createUploadApplication({...f.config,sessions,log:event=>f.state.events.push(event),...overrides});
 const request=(intent,body,headers={})=>new Request('https://control.synthetic.invalid/api/uploads/'+intent,{method:'POST',headers:{authorization:'Bearer synthetic.session','content-type':'application/json',...headers},body:JSON.stringify(body)});
 const put=uploadId=>new Request('https://control.synthetic.invalid/api/uploads/original/'+uploadId,{method:'PUT',headers:{authorization:'Bearer synthetic.session','content-type':'application/octet-stream','content-length':String(f.bytes.length)},body:f.bytes});
 const status=async uploadId=>{const response=await app.handle(request('status',{uploadId}));assert.equal(response.status,200,await response.clone().text());return response.json();};
 /** The server-side dispatch is started and not awaited, so a check observes it the way the composer does: through
  * status reads. Bounded, and it settles within a few turns because every port here is scripted. */
 const settled=async(uploadId,ready=receipt=>receipt.scanStatus!=='pending')=>{for(let i=0;i<500;i++){const receipt=await status(uploadId);if(ready(receipt))return receipt;await new Promise(resolve=>setImmediate(resolve));}assert.fail('the dispatched inspection never settled');};
 const turns=async(n=25)=>{for(let i=0;i<n;i++)await new Promise(resolve=>setImmediate(resolve));};
 return {...f,app,request,put,status,settled,turns};
}
test('upload HTTP accepts canonical bearer characters unchanged and still delegates actual access to sessions',async()=>{
 for(const credential of ['plain-opaque','base64url.token-_','opaque~token','opaque+token/x','opaque==','x'.repeat(8192)+'==']){
  const f=applicationFixture(),response=await f.app.handle(f.request('initiate',{requestId:id(10),...f.declaration},{authorization:'Bearer '+credential}));
  assert.equal(response.status,200);assert.ok(f.state.authCredentials.length>0);assert.ok(f.state.authCredentials.every(value=>value===credential));
 }
 for(const authorization of ['Bearer opaque token','Bearer opaque,token','Bearer opaque:token','Bearer opaque=middle','Bearer opaque===','Bearer '+ 'x'.repeat(8193),'Basic opaque']){
  const f=applicationFixture(),response=await f.app.handle(f.request('initiate',{requestId:id(10),...f.declaration},{authorization}));
  assert.equal(response.status,403);assert.deepEqual(f.state.authCredentials,[]);assert.equal(f.state.rows.size,0);
 }
 const f=applicationFixture();f.state.denied=true;
 assert.equal((await f.app.handle(f.request('initiate',{requestId:id(10),...f.declaration},{authorization:'Bearer valid+/=='}))).status,403);
 assert.deepEqual(f.state.authCredentials,['valid+/==']);assert.equal(f.state.rows.size,0);
});
test('real CONTROL HTTP mount admits only canonical current sessions and bounded inert bodies',async()=>{
 const f=applicationFixture(),denied=await f.app.handle(f.request('initiate',{requestId:id(10),...f.declaration},{authorization:''}));assert.equal(denied.status,403);assert.equal(f.state.rows.size,0);
 const begun=await f.app.handle(f.request('initiate',{requestId:id(10),...f.declaration}));assert.equal(begun.status,200);const receipt=await begun.json();assert.equal(receipt.storageStatus,'awaiting_upload');assert.equal(receipt.originalBytesAvailable,false);assert.equal(Object.hasOwn(receipt,'scopes'),false);
 // The scanner is down for the server-side dispatch, so the stored original stays uninspected until the explicit
 // route re-inspects it once the tool is back: a refusal is reported once and never retried.
 f.state.onScan=()=>{throw Object.assign(Error('SCANNER_DOWN'),{code:'UPLOAD_UNAVAILABLE'});};
 assert.equal((await f.app.handle(f.put(receipt.uploadId))).status,200);
 await f.settled(receipt.uploadId,()=>f.state.events.length>0);
 assert.deepEqual(f.state.events,[{event:UPLOAD_INSPECTION_UNSETTLED_EVENT,code:'UPLOAD_UNAVAILABLE',attempts:1}]);
 assert.equal((await f.app.handle(f.request('read',{uploadId:receipt.uploadId}))).status,409);
 f.state.onScan=null;
 const scanned=await f.app.handle(f.request('inspect',{uploadId:receipt.uploadId}));assert.equal(scanned.status,200);assert.equal((await scanned.json()).scanStatus,'clean');
 const downloaded=await f.app.handle(f.request('read',{uploadId:receipt.uploadId}));assert.equal(downloaded.status,200);assert.equal(downloaded.headers.get('cache-control'),'no-store');assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),f.bytes);
 f.state.denied=true;assert.equal((await f.app.handle(f.request('status',{uploadId:receipt.uploadId}))).status,403);
});
test('HTTP accessors cannot replace native route or credentials, and no URL/scan flag is admitted',async()=>{
 const f=applicationFixture(),request=f.request('initiate',{requestId:id(10),...f.declaration,scanStatus:'clean',url:'https://arbitrary.invalid'});let invoked=0;
 Object.defineProperty(request,'url',{get(){invoked++;throw Error('HOSTILE_GETTER');}});
 assert.equal((await f.app.handle(request)).status,400);assert.equal(invoked,0);assert.equal(f.state.rows.size,0);assert.equal(f.state.puts,0);
});

test('real CONTROL receipts and exact original bytes cross the generated upload receiver',async()=>{
 const {receiveUploadRequest:admit,receiveUploadResponse:receive,receiveUploadOriginal,receiveUploadDownload}=await import('../../../../packages/contracts/dist/uploads-application.mjs');
 const f=applicationFixture(),json=v=>new TextEncoder().encode(JSON.stringify(v));
 const call=async(route,body)=>{const q=admit(route,json(body)),response=await f.app.handle(f.request(route,q));return receive(route,response.status,new Uint8Array(await response.arrayBuffer()),q);};
 const begun=await call('initiate',{requestId:id(10),...f.declaration}),uploadId=begun.uploadId;
 const completion=admit('complete',json({uploadId})),bytes=await receiveUploadOriginal(f.bytes,completion,begun);
 const response=await f.app.handle(new Request('https://control.synthetic.invalid/api/uploads/original/'+uploadId,{method:'PUT',headers:{authorization:'Bearer synthetic.session','content-type':'application/octet-stream','content-length':String(bytes.length)},body:bytes}));
 const stored=receive('complete',response.status,new Uint8Array(await response.arrayBuffer()),completion);assert.equal(stored.storageStatus,'stored');assert.equal(stored.scanStatus,'pending');
 const scanned=await call('inspect',{uploadId}),read=admit('read',json({uploadId}));
 const downloaded=await receiveUploadDownload(await f.app.handle(f.request('read',read)),read,scanned);assert.deepEqual(Buffer.from(downloaded.bytes),f.bytes);
 const removed=await call('remove',{uploadId});assert.equal(removed.storageStatus,'removed');assert.equal(removed.scanStatus,'unavailable');assert.equal(removed.original.versionId,stored.original.versionId);
});

const {nativeUploadCustody}=await import('../../../runtime/uploads/native-host-contract.mjs');

// The real local inspection port, wrapped so the private custody context can be observed and a mutation can be
// injected INSIDE the operation. A refusal recorded by the closure is rethrown so the flow fails closed.
function hookedInspection(f,hook=null){
 const captured={},inner=f.config.inspection,bound=inner.inspect.bind(inner);
 const inspection={...inner,inspect:async(declaration,bytes,options)=>{
  const context=options.custodyContext;
  assert.ok(context,'the private custody context is passed alongside signal/deadline');
  assert.equal(Object.isFrozen(context),true);
  assert.equal(typeof context.assertCurrent,'function');
  captured.context=context;captured.record=context.record;captured.current=context.current;
  captured.declaration=declaration;captured.bytes=bytes;
  if(hook!==null)await hook(context);
  try{captured.live=await context.assertCurrent();}catch(error){
   captured.denied=error;
   throw error; // Fail closed: nothing is published when the captured authority no longer holds.
  }
  return bound(declaration,bytes,{signal:options.signal,deadlineMs:options.deadlineMs});}};
 return {captured,inspection};
}

test('inspection receives a real custody snapshot that rechecks live authority and the same record',async()=>{
 const f=fixture(),{captured,inspection}=hookedInspection(f),owner=f.create({inspection});
 const prepared=await f.initiate(owner),stored=await owner.put(prepared.uploadId,f.bytes,f.options);
 assert.equal(stored.state,'stored');
 const published=await owner.inspect(prepared.uploadId,f.options);
 assert.equal(published.inspection.scan.status,'clean','the real local inspection still publishes its result');
 assert.equal(captured.live.binding.conversationId,f.binding.conversationId);
 assert.deepEqual(captured.bytes,f.bytes,'the port receives the original bytes unchanged');
 const saved=f.state.rows.get(prepared.uploadId);
 assert.equal(captured.record.uploadId,saved.uploadId);
 assert.equal(captured.record.state,'stored');
 // The ACTUAL saved record and current scope feed the shared native projection.
 // `saved` is the row AFTER publication; the projection must describe the row AS INSPECTED.
 const atInspection=captured.record;
 const projection=nativeUploadCustody(atInspection,captured.current);
 assert.equal(projection.uploadId,atInspection.uploadId);
 assert.equal(projection.recordSha256,hash(atInspection));
 assert.equal(projection.objectId,atInspection.object.objectId);
 assert.equal(projection.bytes,atInspection.object.bytes);
 assert.equal(projection.sha256,atInspection.object.sha256);
 assert.equal(projection.owner.actorId,f.binding.actorId);
 assert.equal(projection.scopes[0].tenantId,f.binding.tenantId);
 assert.equal(projection.revision,atInspection.revision);
 assert.equal(saved.uploadId,atInspection.uploadId);
 // After the operation ends the retained closure is dead.
 await assert.rejects(()=>captured.context.assertCurrent());
});

test('the custody closure refuses a changed record, run binding, revocation or retention loss',async()=>{
 const run=async(label,{ownerHooks=null,hook})=>{
  const f=fixture(),{captured,inspection}=hookedInspection(f,hook(f));
  const owner=ownerHooks===null?f.create({inspection}):ownerHooks(f,inspection);
  const prepared=await f.initiate(owner),stored=await owner.put(prepared.uploadId,f.bytes,f.options);
  assert.equal(stored.state,'stored',label);f.state.lastUploadId=prepared.uploadId;
  await assert.rejects(()=>owner.inspect(prepared.uploadId,f.options),undefined,label);
  assert.ok(captured.denied,`${label}: the captured authority must refuse`);
  assert.equal(f.state.rows.get(prepared.uploadId).inspection,null,`${label}: nothing is published on denial`);
 };
 await run('changed saved record revision',{hook:f=>async()=>{
  const row=f.state.rows.get(f.state.lastUploadId);
  f.state.rows.set(row.uploadId,{...row,revision:row.revision+1});}});
 await run('changed run/attempt/worker binding',{
  ownerHooks:(f,inspection)=>{let override=null;
   f.__override=value=>{override=value;};
   return f.create({inspection,current:async()=>({...await f.config.current(),
    ...(override===null?{}:{binding:{...f.binding,...override}})})});},
  hook:f=>async()=>{f.__override({runId:id(77),attemptId:id(78),workerFence:f.binding.writerFence+1});}});
 await run('revoked current authority',{hook:f=>async()=>{f.state.denied=true;}});
 await run('retention suppression',{hook:f=>async()=>{f.state.suppressed=true;}});
});


test('request status restores lost initiate and write replies without allocating or replaying',async()=>{
 const f=fixture(),r=await f.initiate(f.create());
 assert.equal((await f.create().statusByRequest(r.requestId,f.options)).uploadId,r.uploadId);
 assert.equal(f.state.rows.size,1);assert.equal(f.state.puts,0);
 f.state.lostAck=true;await assert.rejects(f.create().put(r.uploadId,f.bytes,f.options));f.state.absent=true;
 assert.equal((await f.create().statusByRequest(r.requestId,f.options)).state,'writing');
 f.state.absent=false;assert.equal((await f.create().statusByRequest(r.requestId,f.options)).state,'stored');assert.equal(f.state.puts,1);
 await assert.rejects(f.create().statusByRequest(id(99),f.options),{code:'UPLOAD_NOT_FOUND'});
 const wrong=f.create({current:async()=>({...await f.config.current(),binding:{...f.binding,actorId:id(8)},scopes:[{...f.scopes[0],resourceId:id(8)}]})});
 await assert.rejects(wrong.statusByRequest(r.requestId,f.options),{code:'UPLOAD_ACCESS_DENIED'});
 f.state.suppressed=true;await assert.rejects(f.create().statusByRequest(r.requestId,f.options),/RETENTION/);
 f.state.suppressed=false;f.state.denied=true;await assert.rejects(f.create().statusByRequest(r.requestId,f.options),/CURRENT_DENIED/);
});
test('status HTTP request selector is closed, authenticated and never an initiate',async()=>{
 const f=applicationFixture();await f.initiate(f.create());
 const result=await f.app.handle(f.request('status',{requestId:id(10)}));assert.equal(result.status,200);assert.equal((await result.json()).requestId,id(10));
 const missing=await f.app.handle(f.request('status',{requestId:id(99)}));assert.equal(missing.status,404);assert.equal((await missing.json()).error.outcome,'READ_UNAVAILABLE');
 for(const body of [{requestId:id(10),uploadId:id(20)},{requestId:id(10),actorId:id(2)}])assert.notEqual((await f.app.handle(f.request('status',body))).status,200);
 for(const route of ['remove','inspect','read'])assert.notEqual((await f.app.handle(f.request(route,{requestId:id(10)}))).status,200);
 assert.equal(f.state.rows.size,1);assert.equal(f.state.puts,0);f.state.denied=true;
 assert.equal((await f.app.handle(f.request('status',{requestId:id(10)}))).status,403);
});

test('a refusal after storage is reported as stored-then-refused over HTTP, with the retained reason, never as no effect',async()=>{
 const f=applicationFixture(),original=Buffer.from([255,254,0]),declaration={filename:'binary.txt',mimeType:'text/plain',bytes:original.length,sha256:uploadHash(original)};
 let scans=0;f.state.onScan=()=>{scans++;};
 const begun=await (await f.app.handle(f.request('initiate',{requestId:id(12),...declaration}))).json();
 const put=new Request('https://control.synthetic.invalid/api/uploads/original/'+begun.uploadId,{method:'PUT',headers:{authorization:'Bearer synthetic.session','content-type':'application/octet-stream','content-length':String(original.length)},body:original});
 assert.equal((await f.app.handle(put)).status,200);
 const inspected=await f.app.handle(f.request('inspect',{uploadId:begun.uploadId}));assert.equal(inspected.status,200);
 const receipt=await inspected.json();
 // The generated browser receiver admits the stored-then-refused receipt as a valid 200 state, not a wire mismatch.
 const {receiveUploadRequest:admit,receiveUploadResponse:receive}=await import('../../../../packages/contracts/dist/uploads-application.mjs');
 const admitted=admit('inspect',new TextEncoder().encode(JSON.stringify({uploadId:begun.uploadId})));
 assert.deepEqual(receive('inspect',200,new TextEncoder().encode(JSON.stringify(receipt)),admitted),receipt);
 assert.equal(receipt.storageStatus,'stored');assert.equal(receipt.scanStatus,'clean');assert.equal(receipt.extraction.status,'blocked');assert.deepEqual(receipt.extraction.limitations,['UPLOAD_ENCODING']);
 assert.equal(receipt.original.versionId,'NATIVE_ORIGINAL_VERSION');assert.equal(scans,1);
 // Reload by request identity and a repeated inspect both return the retained refusal without a second native run.
 const reloaded=await (await f.app.handle(f.request('status',{requestId:id(12)}))).json();assert.deepEqual(reloaded,receipt);
 assert.deepEqual(await (await f.app.handle(f.request('inspect',{uploadId:begun.uploadId}))).json(),receipt);assert.equal(scans,1);
 // The refused original is not a conversation source, but its own exact bytes remain the user's to download or remove.
 await assert.rejects(f.create().readForInput({uploadId:begun.uploadId,sha256:declaration.sha256},f.options),/EXTRACTION_UNAVAILABLE/);
 const downloaded=await f.app.handle(f.request('read',{uploadId:begun.uploadId}));assert.equal(downloaded.status,200);assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),original);
 const removed=await (await f.app.handle(f.request('remove',{uploadId:begun.uploadId}))).json();assert.equal(removed.storageStatus,'removed');
});

test('a stored original is inspected server-side exactly once, and status reads see the verdict land without a second call',async()=>{
 const f=applicationFixture({dispatch:{backoffMs:0}});let scans=0;f.state.onScan=()=>{scans++;};
 f.state.segments=[{ordinal:0,text:f.bytes.toString(),method:'native',confidence:null,location:{page:null,slide:null,sheet:null,rowStart:null,rowEnd:null}}];
 const begun=await (await f.app.handle(f.request('initiate',{requestId:id(10),...f.declaration}))).json();
 const stored=await (await f.app.handle(f.put(begun.uploadId))).json();
 assert.equal(stored.storageStatus,'stored');assert.equal(stored.scanStatus,'pending');assert.equal(stored.extraction.status,'pending');
 const landed=await f.settled(begun.uploadId);
 assert.equal(landed.scanStatus,'clean');assert.equal(landed.extraction.status,'available');assert.equal(landed.originalBytesAvailable,true);
 assert.equal(scans,1,'exactly one native scan for the stored bytes');assert.deepEqual(f.state.events,[]);
 // A put retry of the same original is reconciled, never re-sent and never re-dispatched; the explicit route reports
 // the settled observation without running the bytes again.
 assert.equal((await f.app.handle(f.put(begun.uploadId))).status,200);await f.turns();
 assert.equal(f.state.puts,1);assert.equal(scans,1);
 const again=await (await f.app.handle(f.request('inspect',{uploadId:begun.uploadId}))).json();
 assert.equal(again.scanStatus,'clean');assert.equal(scans,1);
 assert.equal((await f.app.handle(f.request('read',{uploadId:begun.uploadId}))).status,200);
 assert.deepEqual(UPLOAD_INSPECTION_DISPATCH,{attempts:3,backoffMs:2000});
});

test('an unknown remote outcome is retried with the bounded budget and then settles; refusals, revocation and exhaustion are reported once',async()=>{
 const unknown=code=>Object.assign(Error(code),{code});
 const transient=applicationFixture({dispatch:{backoffMs:0}});
 let failures=2,scans=0;transient.state.onScan=()=>{scans++;};
 const inner=transient.config.inspection;
 const flaky={async inspect(...args){if(failures-->0)throw unknown('UPLOAD_INSPECTION_OUTCOME_UNKNOWN');return inner.inspect(...args);}};
 const f=applicationFixture({dispatch:{backoffMs:0},inspection:flaky});f.state.onScan=transient.state.onScan;
 const begun=await (await f.app.handle(f.request('initiate',{requestId:id(10),...f.declaration}))).json();
 assert.equal((await f.app.handle(f.put(begun.uploadId))).status,200);
 const landed=await f.settled(begun.uploadId);
 assert.equal(landed.scanStatus,'clean');assert.equal(failures,-1,'two unknown outcomes, then the third attempt settled');
 assert.equal(scans,1);assert.deepEqual(f.state.events,[]);
 // Exhaustion: every attempt unknown. The dispatch gives up after the declared attempts, reports once, and the
 // original stays honestly pending for the explicit route.
 const g=applicationFixture({dispatch:{attempts:2,backoffMs:0},inspection:{async inspect(){throw unknown('UPLOAD_INSPECTION_OUTCOME_UNKNOWN');}}});
 const second=await (await g.app.handle(g.request('initiate',{requestId:id(11),...g.declaration}))).json();
 assert.equal((await g.app.handle(g.put(second.uploadId))).status,200);
 await g.settled(second.uploadId,()=>g.state.events.length>0);
 assert.deepEqual(g.state.events,[{event:UPLOAD_INSPECTION_UNSETTLED_EVENT,code:'UPLOAD_INSPECTION_OUTCOME_UNKNOWN',attempts:2}]);
 assert.equal((await g.status(second.uploadId)).scanStatus,'pending');
 // A revoked session is never retried: the dispatch carries exactly a request's authority and stops when it is gone.
 const h=applicationFixture({dispatch:{backoffMs:0}});
 const third=await (await h.app.handle(h.request('initiate',{requestId:id(12),...h.declaration}))).json();
 h.state.onScan=()=>{h.state.denied=true;};
 assert.equal((await h.app.handle(h.put(third.uploadId))).status,200);
 for(let i=0;i<500&&h.state.events.length===0;i++)await h.turns(1);
 assert.equal(h.state.events.length,1);assert.equal(h.state.events[0].attempts,1);assert.equal(h.state.rows.get(third.uploadId).inspection,null);
 for(const dispatch of [{attempts:0},{attempts:11},{backoffMs:-1},{backoffMs:1.5},{other:1}])assert.throws(()=>createUploadApplication({...f.config,sessions:{authenticateSession(){},readCurrentState(){}},dispatch}),{code:'UPLOAD_CONFIGURATION'});
});

test('an explicit inspect and a put retry join the inspection in flight instead of running the bytes twice',async()=>{
 const f=applicationFixture({dispatch:{backoffMs:0}});let release,scans=0;
 const gate=new Promise(resolve=>{release=resolve;});f.state.onScan=async()=>{scans++;await gate;};
 const begun=await (await f.app.handle(f.request('initiate',{requestId:id(10),...f.declaration}))).json();
 assert.equal((await f.app.handle(f.put(begun.uploadId))).status,200);
 await f.turns();assert.equal(scans,1,'the dispatched scan is in flight');
 const joined=f.app.handle(f.request('inspect',{uploadId:begun.uploadId}));
 assert.equal((await f.app.handle(f.put(begun.uploadId))).status,200);
 await f.turns();assert.equal(scans,1,'neither the explicit route nor the retry starts a second scan');
 assert.equal((await f.status(begun.uploadId)).scanStatus,'pending','a status read during the scan is honest, not blocked');
 release();
 const explicit=await (await joined).json();
 assert.equal(explicit.scanStatus,'clean','the explicit caller reports the joined outcome under its own authority');
 assert.equal(scans,1);assert.equal(f.state.puts,1);
 assert.equal((await f.settled(begun.uploadId)).scanStatus,'clean');
});

test('a status read that raced a concurrent publication reports the current record; effects still refuse UPLOAD_CHANGED',async()=>{
 const f=fixture(),owner=f.create(),r=await f.initiate(owner);await owner.put(r.uploadId,f.bytes,f.options);
 let reads=0;const advance=()=>{const row=f.state.rows.get(r.uploadId);f.state.rows.set(r.uploadId,{...row,revision:row.revision+1,updatedAtMs:row.updatedAtMs+1});};
 // The second read of the status operation is its guard re-read: the row advanced in between, exactly as the
 // server-side inspection landing between the two does.
 f.state.onRead=()=>{if(++reads===2)advance();};
 const current=await owner.status(r.uploadId,f.options);
 assert.equal(current.revision,f.state.rows.get(r.uploadId).revision,'status reports the record as it is now');
 reads=0;f.state.onRead=()=>{if(++reads===2)advance();};
 await assert.rejects(owner.remove(r.uploadId,f.options),{code:'UPLOAD_CHANGED'},'an effect keeps the strict check');
});
