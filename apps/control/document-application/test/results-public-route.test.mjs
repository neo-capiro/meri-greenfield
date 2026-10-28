/** The advertised native-result discovery route through the REAL runtime artifact mount.
 *
 * Drives POST /api/documents/results through apps/runtime/artifacts/application.mjs (createRuntimeArtifactApplication)
 * + the public control boundary + the real composed document options (createRuntimeDocumentOptionsComposer) over the
 * REAL conversation-journal settled-capture owner, and admits the answer with the canonical receiver. A future
 * allowlist/route/port drift for results therefore fails here instead of going unnoticed.
 *
 * Mocks are installed BEFORE any module import: no ambient network, cloud, provider, model, DB, sandbox or renderer
 * target is reachable, and the guard fails loudly if anything tries. Session/current-authority and storage are the
 * existing local document fixture owner; the journal, the composition port, the mount and the receiver are production.
 * No cleanup: every scratch path is retained (m5-cleanup-freeze). */
import test from 'node:test';
import assert from 'node:assert/strict';

/** Installed before the first dynamic import below. */
const network={calls:[]};
globalThis.fetch=(...args)=>{network.calls.push(args);throw Object.assign(Error('NETWORK_REFUSED'),{code:'NETWORK_REFUSED'});};

const [{nativeFixture,binding,scopes,id,check},{hash},{createHash},{createLocalDocumentPorts},{createRuntimeArtifactApplication},
 {createRuntimeDocumentOptionsComposer},{createControlRouteApplications},access,{artifactValidators:v}]=await Promise.all([
 import('../../conversations/test/native-next-run-fixture.mjs'),import('../../conversations/boundary.mjs'),
 import('node:crypto'),import('../local/ports.mjs'),import('../../../runtime/artifacts/application.mjs'),
 import('../../../runtime/artifacts/composition.mjs'),import('../../../runtime/control-route-boundary.mjs'),
 import('../../../../packages/contracts/dist/document-access-application.mjs'),
 import('../../../../packages/contracts/retrieval-0.2/validate.mjs')]);

const at=Date.parse('2026-10-15T12:00:00.000Z'),controlId=id(5000),clientId=id(5);
const limits={maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:1048576};
const report='# analysis report\nnative Bash produced this file during the run\n';
const table='x,y\n1,2\n';
/** Entry objects carry the raw-byte digest the journal and the release path re-verify. */
const sha=value=>createHash('sha256').update(Buffer.from(value)).digest('hex');

/** The captured workspace entries the run's ordinary completion records (workspace only; task JSON stays private). */
function capturedFiles(){const entry=(path,bytes,n)=>({path,kind:'file',executable:false,
  object:{objectId:id(n),versionId:'captured-workspace-entry',sha256:sha(bytes),bytes:bytes.length,scopes}});
 return {workspace:{contractVersion:'0.1.0',manifestId:id(7100),binding,logicalCwd:'/workspace/conversation',
   entries:[entry('analysis/output/report.md',report,7101),entry('analysis/output/table.csv',table,7103)],
   scopes,createdAt:new Date(at).toISOString()},
  tasks:[entry('1.json','{"task":"json"}',7102)]};}

/** The real journal, its own capture fences, and the docs the public route is expected to answer with. */
async function journal(t,{files}={}){
 t.mock.timers.enable({apis:['Date'],now:at});
 const x=await nativeFixture();await x.running(binding);x.seed(binding);
 await x.f.control({controlId,intent:'pause'});await x.f.claim(controlId);
 const fileArgs={binding,scopes,selectedClientId:clientId,controlId,sessionId:x.sessionKey.sessionId};
 const claim={...fileArgs,requestSha256:hash(files)};await x.f.store.lifecycle.beginFileCapture(claim,check);await x.f.store.lifecycle.recordFiles({...claim,files},check);
 const args={binding,scopes,selectedClientId:clientId,controlId,sessionId:x.sessionKey.sessionId,events:[
  {contractVersion:'0.1.0',eventId:id(5001),createdAt:new Date(at).toISOString(),type:'checkpoint.verified',data:{checkpointId:binding.runId}},
  {contractVersion:'0.1.0',eventId:id(5002),createdAt:new Date(at).toISOString(),type:'run.status',data:{state:'paused',reasonCode:null}}]};
 return {...x,args,capture:(value=args)=>x.f.store.lifecycle.captureSession(value,check),settle:()=>x.settle(binding)};
}

/** The REAL mount: createRuntimeArtifactApplication + the public control boundary + the real composed options.
 * `store` is the real journal (or a store without the settled-capture read, for the refusal row). */
async function mount(t,{store,versions}){
 const now=()=>at,deadlineMs=at+20000,state={closed:false,revoked:false,artifactChecks:0};
 const ports=createLocalDocumentPorts({binding,scopes,clientId,deadlineMs,now,state});t.after(()=>ports.sessions.close());
 const objects={get:async()=>null,put:async()=>null};
 const executor={execute:async()=>{throw Error('no generation in this test');}};
 const entity=()=>({objectId:null,versionId:null,artifactId:null});
 const compose=createRuntimeDocumentOptionsComposer({storage:{objects,versions},executor,pool:{},store,sessions:ports.sessions,now});
 const owner={async resolve(){return {documentOptions:compose({
   artifactOptions:{pool:{},context:{binding,scopes,evidence:[],assets:[],deadlineMs,maxBytes:1048576},validators:v,
     authorize:ports.authorize,versions,objects,executor,now,ids:entity,authorizeOrigin:async()=>{throw Error('unused');}},
   selectedClientId:clientId,limits,enabled:true}),async recheck(){}};}};
 const runtime=createRuntimeArtifactApplication({sessions:ports.sessions,optionsOwner:owner,now,limits});
 const listeners=createControlRouteApplications({assembly:runtime,candidate:{async handle(){return null;}}});
 const session=await ports.sessions.issue({identityCredential:ports.nativeCredential});
 const post=(route,body={})=>listeners.public.handle(new Request('https://meri.synthetic.invalid/api/documents/'+route,
  {method:'POST',headers:{authorization:'Bearer '+session.credential,'content-type':'application/json'},body:JSON.stringify(body)}));
 return {post,ports,state};
}

const emptyVersions={read:async()=>null,commit:async()=>null,list:async()=>({records:[]})};

test('the settled captured workspace entry is discoverable through the real mount and admitted by the canonical receiver',async t=>{
 const files=capturedFiles(),x=await journal(t,{files});
 await x.capture();
 const m=await mount(t,{store:x.f.store,versions:emptyVersions});
 // Published but unsettled: the existing owner fence holds through the mount and no name leaks.
 const unsettled=await m.post('results');
 assert.equal(unsettled.status,502);
 assert.equal((await unsettled.text()).includes('report.md'),false);
 await x.settle();
 const answered=await m.post('results');
 const text=await answered.text();
 assert.equal(answered.status,200,text);
 const admitted=access.receiveNativeResultsResponse(200,Buffer.from(text),access.receiveNativeResultsRequest(Buffer.from('{}')));
 assert.equal(admitted.manifestId,files.workspace.manifestId);
 assert.equal(admitted.capturedAt,files.workspace.createdAt);
 assert.equal(admitted.truncated,false);
 assert.deepEqual(admitted.results.map(row=>row.path),['analysis/output/report.md','analysis/output/table.csv']);
 // The selector is the captured entry's own immutable objectId, with its exact digest and length.
 const entry=files.workspace.entries[0];
 assert.equal(admitted.results[0].versionId,entry.object.objectId);
 assert.equal(admitted.results[0].sha256,entry.object.sha256);
 assert.equal(admitted.results[0].bytes,report.length);
 assert.equal(admitted.results[0].executable,false);
 // SDK task/internal entries are never discoverable, and no byte content is released.
 assert.equal(admitted.results.some(row=>row.versionId===id(7102)),false,'SDK task state is never a discoverable result');
 assert.equal(text.includes('1.json'),false);
 assert.equal(text.includes('native Bash produced'),false);
 // The request is a closed empty object on the real mount: a caller-supplied body is refused, and no name leaks.
 const foreignBody=await m.post('results',{scope:'conversation'});
 assert.equal(foreignBody.status,400);
 assert.equal((await foreignBody.text()).includes('report.md'),false);
 // Additivity, same mount: a valid existing document request still reaches its own owner unchanged.
 const listing=await m.post('list',{scope:'owner',limit:5,cursor:null});
 const listingBody=await listing.text();
 assert.equal(listing.status,200,listingBody);
 assert.deepEqual(JSON.parse(listingBody),{scope:'owner',versions:[],nextCursor:null});
 assert.equal(network.calls.length,0,'no network call is permitted in this test');
});

test('a store without the settled-capture read refuses only results; the existing document route keeps working',async t=>{
 const store={lifecycle:{readArtifactFile:async()=>null}};   // the additive facet is absent, every other route is not
 const m=await mount(t,{store,versions:emptyVersions});
 const refused=await m.post('results');
 assert.equal(refused.status,502);
 assert.deepEqual(JSON.parse(await refused.text()),{error:{code:'DOCUMENT_REFUSED',outcome:'NOT_DISPATCHED'}});
 // The refusal is results-only: a valid existing request on the same mount still answers its own owner with data.
 const listing=await m.post('list',{scope:'owner',limit:5,cursor:null});
 assert.equal(listing.status,200,await listing.clone().text());
 assert.deepEqual(JSON.parse(await listing.text()),{scope:'owner',versions:[],nextCursor:null});
 assert.equal(network.calls.length,0,'no network call is permitted in this test');
});
