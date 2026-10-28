/** The ordinary SDK-produced workspace file must be DISCOVERABLE and then readable through the real
 * current-authorized document release path.
 *
 * Mocks are installed BEFORE any module import: no ambient network, cloud, provider or model call is reachable from
 * this test, and the guard fails loudly if anything tries. Core authority/session/retention/object bytes are local
 * mocks; the conversation journal, the discovery leaf, the document application and the document-options composition
 * are the real production owners. No DB, no browser, no sandbox, no model loop. No cleanup: every scratch path is
 * retained (m5-cleanup-freeze). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

/** Installed before the first dynamic import below. */
const network={calls:[]};
globalThis.fetch=(...args)=>{network.calls.push(args);throw Object.assign(Error('NETWORK_REFUSED'),{code:'NETWORK_REFUSED'});};

const [{nativeFixture,binding,scopes,id,check},{hash},{createRuntimeDocumentOptionsComposer},{artifactValidators:v},
 {projectNativeResults,isSelectableWorkspacePath},{createDocumentApplication},
 {receiveNativeResultsRequest,receiveNativeResultsResponse}]=await Promise.all([
 import('../../control/conversations/test/native-next-run-fixture.mjs'),
 import('../../control/conversations/boundary.mjs'),
 import('../artifacts/composition.mjs'),
 import('../../../packages/contracts/retrieval-0.2/validate.mjs'),
 import('../artifacts/native-result-discovery.mjs'),
 import('../../control/document-application/index.mjs'),
 import('../../../packages/contracts/document-access-application/native-results.mjs')]);

const at=Date.parse('2026-10-15T12:00:00.000Z'),controlId=id(5000),clientId=id(5);
const CREDENTIAL='local-mocked-session-credential';
const report='# analysis report\nnative Bash produced this file during the run\n';
const table='x,y\n1,2\n';
/** Entry objects carry the raw-byte digest the journal and the release path re-verify, not a canonical-JSON digest. */
const sha=value=>createHash('sha256').update(Buffer.from(value)).digest('hex');

function capturedFiles(){const entry=(path,bytes,n)=>({path,kind:'file',executable:false,
  object:{objectId:id(n),versionId:'captured-workspace-entry',sha256:sha(bytes),bytes:bytes.length,scopes}});
 return {workspace:{contractVersion:'0.1.0',manifestId:id(7100),binding,logicalCwd:'/workspace/conversation',
   entries:[entry('analysis/output/report.md',report,7101),entry('analysis/output/table.csv',table,7103)],
   scopes,createdAt:new Date(at).toISOString()},
  tasks:[entry('1.json','{"task":"json"}',7102)]};}

async function journal(t,{files}={}){
 t.mock.timers.enable({apis:['Date'],now:at});
 const x=await nativeFixture();await x.running(binding);x.seed(binding);
 await x.f.control({controlId,intent:'pause'});await x.f.claim(controlId);
 const fileArgs={binding,scopes,selectedClientId:clientId,controlId,sessionId:x.sessionKey.sessionId};
 if(files){const claim={...fileArgs,requestSha256:hash(files)};await x.f.store.lifecycle.beginFileCapture(claim,check);await x.f.store.lifecycle.recordFiles({...claim,files},check);}
 else{const {captureEmptyFiles}=await import('../../control/conversations/test/lifecycle-fixture.mjs');await captureEmptyFiles(x.f.store,fileArgs);}
 const args={binding,scopes,selectedClientId:clientId,controlId,sessionId:x.sessionKey.sessionId,events:[
  {contractVersion:'0.1.0',eventId:id(5001),createdAt:new Date(at).toISOString(),type:'checkpoint.verified',data:{checkpointId:binding.runId}},
  {contractVersion:'0.1.0',eventId:id(5002),createdAt:new Date(at).toISOString(),type:'run.status',data:{state:'paused',reasonCode:null}}]};
 return {...x,args,capture:(value=args)=>x.f.store.lifecycle.captureSession(value,check),settle:()=>x.settle(binding)};
}

/** The production document-options composition (apps/runtime/artifacts/composition.mjs), unmodified: its composed
 * `nativeResults` port is the only caller of the projection, over the REAL conversation-journal capture owner. */
function composedPort(store,{contextBinding=binding,deadlineMs=at+20000,now=()=>at}={}){
 const composer=createRuntimeDocumentOptionsComposer({storage:{objects:{get:async()=>{throw Error('unused');},put:async()=>null},versions:{}},
  executor:{},pool:{},sessions:{},store,now});
 return composer({selectedClientId:clientId,limits:{maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:1048576},
  artifactOptions:{pool:{},context:{binding:contextBinding,scopes,evidence:[],assets:[],deadlineMs,maxBytes:1048576},
   validators:v,authorize:async()=>{},versions:{},objects:{get:async()=>{throw Error('unused');}},executor:{},now,ids:{}}});
}

test('a captured workspace file is discoverable as a bounded metadata selector through the composed production port',async t=>{
 const files=capturedFiles(),x=await journal(t,{files});
 const composed=composedPort(x.f.store);
 const list=()=>composed.nativeResults.list();
 const selector=bytes=>files.workspace.entries.find(e=>e.object.sha256===sha(bytes));
 // Unsettled or unpublished capture: the existing owner fence holds, nothing is projected.
 await assert.rejects(list(),/UNSETTLED|CHECKPOINT_REFUSED/);
 await x.capture();
 await assert.rejects(list(),/UNSETTLED/);
 await x.settle();
 const found=await list();
 assert.equal(found.manifestId,files.workspace.manifestId);assert.equal(found.capturedAt,files.workspace.createdAt);
 assert.equal(found.truncated,false);
 assert.deepEqual(found.results,[{versionId:id(7101),path:'analysis/output/report.md',bytes:report.length,sha256:sha(report),executable:false},
  {versionId:id(7103),path:'analysis/output/table.csv',bytes:table.length,sha256:sha(table),executable:false}]);
 // Metadata only: no bytes, no task JSON, no host path ever leaves the owner.
 for(const row of found.results){assert.deepEqual(Object.keys(row).sort(),['bytes','executable','path','sha256','versionId']);assert.equal(JSON.stringify(row).includes('base64'),false);}
 assert.equal(JSON.stringify(found).includes('1.json'),false);
 assert.equal(found.results.some(row=>row.versionId===id(7102)),false,'SDK task state is never a discoverable result');
 assert.equal(found.results.some(row=>row.versionId===selector(report).object.objectId),true);
 // Bounded: the production projection truncates rather than growing the answer.
 const bounded=projectNativeResults({files,binding,scopes,owner:binding,maxResults:1});
 assert.equal(bounded.results.length,1);assert.equal(bounded.truncated,true);
 // The projection is bound to the session's own context: a capture read for another conversation is refused by the
 // journal owner's own closed code (its session row is keyed by binding), so no selector is projected for it.
 const foreign=composedPort(x.f.store,{contextBinding:{...binding,conversationId:id(7199)}});
 await assert.rejects(foreign.nativeResults.list(),/STORE_CORRUPT|UNSETTLED|CHECKPOINT_REFUSED/);
 // An expired request deadline refuses before the projection and releases no name.
 const late=composedPort(x.f.store,{deadlineMs:at-1});
 await assert.rejects(late.nativeResults.list(),/ARTIFACT_DEADLINE/);
 assert.equal(isSelectableWorkspacePath('../escape.txt'),false);
 assert.equal(isSelectableWorkspacePath('/etc/passwd'),false);
 assert.equal(isSelectableWorkspacePath('a\\b.txt'),false);
 assert.equal(network.calls.length,0,'no network call is permitted in this test');
});

test('the discovered versionId is readable through the real document application: inspect then download, and nothing else',async t=>{
 const files=capturedFiles(),x=await journal(t,{files});
 await x.capture();await x.settle();
 let clock=at,revoked=false,principal={sessionId:id(900),tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId};
 const now=()=>clock;
 const objects=new Map([...files.workspace.entries,...files.tasks].map(entry=>[entry.object.objectId,
  Buffer.from(entry.path==='analysis/output/report.md'?report:entry.path==='analysis/output/table.csv'?table:'{"task":"json"}')]));
 const sessions={
  async authenticateSession({credential}){if(revoked||credential!==CREDENTIAL)throw Object.assign(Error('SESSION_REFUSED'),{code:'SESSION_REFUSED'});
   return {principal:{...principal},sessionRevision:'rev-1',checkedAtMs:now(),expiresAtMs:now()+20000};},
  async readCurrentState({authentication}){if(revoked)throw Object.assign(Error('SESSION_REFUSED'),{code:'SESSION_REFUSED'});
   return {authenticationSha256:v.hash(authentication),binding,scopes,selectedClientId:clientId,checkedAtMs:now(),expiresAtMs:now()+20000};}};
 const artifactOptions={pool:{},context:{binding,scopes,evidence:[],assets:[],deadlineMs:at+20000,maxBytes:1048576},
  validators:v,authorize:async()=>({expiresAtMs:at+20000}),
  versions:{read:async()=>null,commit:async()=>null},
  objects:{get:async object=>{const bytes=objects.get(object.objectId);if(bytes===undefined)throw Object.assign(Error('ENOENT'),{code:'ENOENT'});return bytes;},put:async()=>null},
  executor:{execute:async()=>{throw Error('no generation in this test');}},now,
  ids:()=>({artifactId:id(1),versionId:id(2),objectId:id(3)}),retention:{assertServable:async()=>{}}};
 const app=createDocumentApplication({sessions,selectedClientId:clientId,artifactOptions,now,
  limits:{maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:1048576},enabled:true,
  nativeFiles:createRuntimeDocumentOptionsComposer({storage:{objects:{get:async()=>{throw Error('unused');},put:async()=>null},versions:{}},executor:{},pool:{},sessions:{},store:x.f.store,now})(
   {selectedClientId:clientId,limits:{maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:1048576},artifactOptions}).nativeFiles});
 const post=(route,body,credential=CREDENTIAL)=>app.handle(new Request(`http://127.0.0.1/api/documents/${route}`,
  {method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${credential}`},body:JSON.stringify(body)}));
 // inspect releases the exact captured entry as the accepted native-file payload.
 const inspected=await post('inspect',{versionId:id(7101)});
 assert.equal(inspected.status,200);
 const payload=await inspected.json();
 assert.equal(payload.kind,'native-file');assert.equal(payload.version.versionId,id(7101));
 assert.equal(payload.version.path,'analysis/output/report.md');assert.equal(payload.version.manifestId,files.workspace.manifestId);
 assert.equal(payload.integrity.sha256,sha(report));assert.equal(payload.integrity.bytes,report.length);
 assert.equal(payload.integrity.currentBytesVerified,true);
 // download releases those exact bytes, re-verified against the object and the served entry.
 const downloaded=await post('download',{versionId:id(7101)});
 assert.equal(downloaded.status,200);
 assert.equal(downloaded.headers.get('content-disposition'),'attachment; filename="report.md"');
 assert.equal(downloaded.headers.get('cache-control'),'no-store');
 assert.equal(downloaded.headers.get('x-content-type-options'),'nosniff');
 const bytes=Buffer.from(await downloaded.arrayBuffer());
 assert.equal(bytes.toString(),report);assert.equal(createHash('sha256').update(bytes).digest('hex'),sha(report));
 // Privacy: SDK task state is not a public file, and an unknown id is not served through the native path.
 for(const versionId of [id(7102),id(7199)]){
  const refused=await post('inspect',{versionId});
  assert.notEqual(refused.status,200);
  assert.equal((await refused.text()).includes('task'),false);
 }
 // Wrong actor and revocation release nothing.
 principal={...principal,actorId:id(7199)};
 const foreignActor=await post('inspect',{versionId:id(7101)});assert.equal(foreignActor.status,403);
 principal={...principal,actorId:binding.actorId};revoked=true;
 const afterRevocation=await post('download',{versionId:id(7101)});assert.equal(afterRevocation.status,403);
 assert.equal((await afterRevocation.text()).includes(report),false);
 revoked=false;
 // Byte tamper: the object no longer matches the served entry, so nothing is released.
 objects.set(id(7101),Buffer.from('tampered after publication'));
 const tampered=await post('download',{versionId:id(7101)});assert.equal(tampered.status,502);
 assert.equal((await tampered.text()).includes(report),false);
 objects.set(id(7101),Buffer.from(report));
 // Deadline: an expired request releases no output either.
 clock=at+30000;
 const expired=await post('inspect',{versionId:id(7101)});assert.equal(expired.status,408);
 assert.equal((await expired.text()).includes('analysis/output/report.md'),false);
 assert.equal(network.calls.length,0,'no network call is permitted in this test');
});

test('the public results route discovers the captured file, the canonical receiver admits it, and inspect/download then release it',async t=>{
 const files=capturedFiles(),x=await journal(t,{files});
 let clock=at,revoked=false,denied=false,revokeOnRelease=false,foreignClient=false,principal={sessionId:id(900),tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId};
 const now=()=>clock;
 const objects=new Map([...files.workspace.entries,...files.tasks].map(entry=>[entry.object.objectId,
  Buffer.from(entry.path==='analysis/output/report.md'?report:entry.path==='analysis/output/table.csv'?table:'{"task":"json"}')]));
 const sessions={
  async authenticateSession({credential}){if(revoked||credential!==CREDENTIAL)throw Object.assign(Error('SESSION_REFUSED'),{code:'SESSION_REFUSED'});
   return {principal:{...principal},sessionRevision:'rev-1',checkedAtMs:now(),expiresAtMs:now()+20000};},
  async readCurrentState({authentication}){if(revoked)throw Object.assign(Error('SESSION_REFUSED'),{code:'SESSION_REFUSED'});
   return {authenticationSha256:v.hash(authentication),binding,scopes,selectedClientId:foreignClient?id(9801):clientId,checkedAtMs:now(),expiresAtMs:now()+20000};}};
 const grants=[];
 const artifactOptions={pool:{},context:{binding,scopes,evidence:[],assets:[],deadlineMs:at+20000,maxBytes:1048576},
  validators:v,authorize:async call=>{grants.push(call);
   if(denied)throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});
   // The canonical Core receipt the artifact service already matches; no invented grant field.
   if(revokeOnRelease&&call.resource.manifestId!==null)revoked=true;
   return {receiptId:'receipt-'+grants.length,decision:'allow',action:call.action,binding:call.binding,
    scopesSha256:v.hash(call.scopes),resourceSha256:v.hash(call.resource),requestSha256:call.requestSha256,expiresAtMs:at+20000};},
  versions:{read:async()=>null,commit:async()=>null},
  objects:{get:async object=>{const bytes=objects.get(object.objectId);if(bytes===undefined)throw Object.assign(Error('ENOENT'),{code:'ENOENT'});return bytes;},put:async()=>null},
  executor:{execute:async()=>{throw Error('no generation in this test');}},now,
  ids:()=>({artifactId:id(1),versionId:id(2),objectId:id(3)}),retention:{assertServable:async()=>{}}};
 const limits={maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:1048576};
 const composed=createRuntimeDocumentOptionsComposer({storage:{objects:{get:async()=>{throw Error('unused');},put:async()=>null},versions:{}},
  executor:{},pool:{},sessions:{},store:x.f.store,now})({selectedClientId:clientId,limits,artifactOptions});
 const app=createDocumentApplication({sessions,selectedClientId:clientId,artifactOptions,now,limits,enabled:true,
  nativeFiles:composed.nativeFiles,nativeResults:composed.nativeResults});
 const post=(route,body,credential=CREDENTIAL)=>app.handle(new Request(`http://127.0.0.1/api/documents/${route}`,
  {method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${credential}`},body:JSON.stringify(body)}));
 await x.capture();
 // Published but unsettled: the existing owner fence holds and no name is leaked.
 const unsettled=await post('results',{});assert.notEqual(unsettled.status,200);
 assert.equal((await unsettled.text()).includes('report.md'),false);
 await x.settle();
 // Only the closed empty request is admitted, and the canonical receiver admits exactly what the route answered.
 const foreignRequest=await post('results',{scope:'conversation'});assert.equal(foreignRequest.status,400);
 const grantsBefore=grants.length;
 const answered=await post('results',{});assert.equal(answered.status,200);
 const callGrants=grants.slice(grantsBefore);
 // The explicit results intent authorizes through the established artifact.inspect action: a pre-collection grant
 // over a closed null snapshot identity, then a release grant bound to the validated snapshot identity. The outer
 // resolver digest stays the canonical {intent:'results',body:{}} and no extra grant field is invented.
 assert.equal(callGrants.length,2,'one collection grant and one release grant');
 assert.deepEqual(callGrants.map(grant=>grant.action),['artifact.inspect','artifact.inspect']);
 assert.equal(callGrants.every(grant=>grant.requestSha256===v.hash({intent:'results',body:{}})),true);
 assert.deepEqual(callGrants[0].binding,binding);assert.deepEqual(callGrants[0].scopes,scopes);
 assert.equal(callGrants[0].resource.manifestId,null);assert.equal(callGrants[0].resource.capturedAt,null);
 assert.equal(callGrants[0].resource.versionId,null);assert.equal(callGrants[0].resource.object,null);
 assert.equal(callGrants[1].resource.manifestId,files.workspace.manifestId);
 assert.equal(typeof callGrants[1].resource.capturedAt,'string');
 assert.equal(callGrants[1].resource.object,null);
 const admitted=receiveNativeResultsResponse(200,Buffer.from(await answered.arrayBuffer()),receiveNativeResultsRequest(Buffer.from('{}')));
 assert.deepEqual(admitted.results.map(row=>row.path),['analysis/output/report.md','analysis/output/table.csv']);
 assert.equal(admitted.manifestId,files.workspace.manifestId);assert.equal(admitted.truncated,false);
 assert.equal(admitted.results.some(row=>row.versionId===id(7102)),false,'SDK task state is never a discoverable result');
 // After reload the discovered selector is what the existing byte authority releases.
 const selector=admitted.results.find(row=>row.path==='analysis/output/report.md').versionId;
 const inspected=await post('inspect',{versionId:selector});assert.equal(inspected.status,200);
 const payload=await inspected.json();assert.equal(payload.kind,'native-file');assert.equal(payload.version.versionId,selector);
 const downloaded=await post('download',{versionId:selector});assert.equal(downloaded.status,200);
 assert.equal(Buffer.from(await downloaded.arrayBuffer()).toString(),report);
 // A malformed producer answer (an extra duplicate row) must be refused at the route boundary: the receiver's reject
 // callback is not allowed to merely return, or the route would release corrupt metadata. The control run proves the
 // same composed port still serves the honest answer on this read.
 const brokenApp=duplicate=>createDocumentApplication({sessions,selectedClientId:clientId,artifactOptions,now,limits,enabled:true,
  nativeFiles:composed.nativeFiles,
  nativeResults:{list:async signal=>{const rows=await composed.nativeResults.list(signal);
   return duplicate&&rows!==null?{...rows,results:[...rows.results,rows.results[0]]}:rows;}}});
 const controlAnswer=await brokenApp(false).handle(new Request('http://127.0.0.1/api/documents/results',{method:'POST',
  headers:{'content-type':'application/json',authorization:`Bearer ${CREDENTIAL}`},body:'{}'}));
 assert.equal(controlAnswer.status,200);
 const malformed=await brokenApp(true).handle(new Request('http://127.0.0.1/api/documents/results',{method:'POST',
  headers:{'content-type':'application/json',authorization:`Bearer ${CREDENTIAL}`},body:'{}'}));
 assert.equal(malformed.status,502,'malformed metadata must be refused by the route boundary');
 assert.equal((await malformed.text()).includes('report.md'),false);
 // Wrong actor and revocation release neither metadata nor bytes.
 principal={...principal,actorId:id(7199)};
 const foreignActor=await post('results',{});assert.equal(foreignActor.status,403);
 assert.equal((await foreignActor.text()).includes('report.md'),false);
 principal={...principal,actorId:binding.actorId};revoked=true;
 const revokedCall=await post('results',{});assert.equal(revokedCall.status,403);
 assert.equal((await revokedCall.text()).includes('report.md'),false);
 revoked=false;
 // A current context that no longer matches this session's selected client releases nothing.
 foreignClient=true;
 // The foreign client is refused by the existing capture owner's own current-session fence (closed code, no names).
 const wrongClient=await post('results',{});assert.notEqual(wrongClient.status,200);
 assert.equal((await wrongClient.text()).includes('report.md'),false);
 foreignClient=false;
 // A Core refusal of the explicit results intent releases no names either.
 denied=true;
 const deniedCall=await post('results',{});assert.notEqual(deniedCall.status,200);
 assert.equal((await deniedCall.text()).includes('report.md'),false);
 denied=false;
 // A context revoked while the release grant is being issued releases nothing: current identity is re-checked after
 // the release grant and before the answer leaves the route.
 revokeOnRelease=true;
 const released=await post('results',{});assert.notEqual(released.status,200);
 assert.equal((await released.text()).includes('report.md'),false);
 revokeOnRelease=false;revoked=false;
 assert.equal(network.calls.length,0,'no network call is permitted in this test');
});
