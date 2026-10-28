/** The real product composition must serve the run's captured native workspace file as the user-visible native-file
 * inspection, and must refuse everything else.
 *
 * Spans: the actual SDK options fragment (native Bash admitted only through the asserted sandbox attestation) and the
 * actual document composition port (`createRuntimeDocumentOptionsComposer`'s `nativeFiles`) over the REAL conversation
 * journal (`readArtifactFile`) that the runner's ordinary completion capture feeds.
 *
 * Scripted SQL journals: no database, no SDK process, no native sandbox, no model loop. Source proof only --
 * native host/image qualification remains owed and is NOT claimed here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeFixture,binding,scopes,id,check} from '../../control/conversations/test/native-next-run-fixture.mjs';
import {captureEmptyFiles} from '../../control/conversations/test/lifecycle-fixture.mjs';
import {hash} from '../../control/conversations/boundary.mjs';
import {createRuntimeDocumentOptionsComposer} from '../artifacts/composition.mjs';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createSdkCapabilities} from '../../worker/conversation/capabilities/index.mjs';

const at=Date.parse('2026-10-15T12:00:00.000Z'),controlId=id(5000),clientId=id(5);
const SDK='0.3.295',CLI='2.1.295';

/** The captured workspace entry the run's ordinary completion records (workspace only; task JSON stays private). */
function capturedFiles(){const entry=(path,n)=>({path,kind:'file',executable:false,
  object:{objectId:id(n),versionId:'captured-workspace-entry',sha256:hash(path),bytes:path.length,scopes}});
 return {workspace:{contractVersion:'0.1.0',manifestId:id(7100),binding,logicalCwd:'/workspace/conversation',
   entries:[entry('analysis/output/report.txt',7101)],scopes,createdAt:new Date(at).toISOString()},
  tasks:[entry('1.json',7102)]};}

async function journal(t,{files}={}){
 t.mock.timers.enable({apis:['Date'],now:at});
 const x=await nativeFixture();await x.running(binding);x.seed(binding);
 await x.f.control({controlId,intent:'pause'});await x.f.claim(controlId);
 const fileArgs={binding,scopes,selectedClientId:clientId,controlId,sessionId:x.sessionKey.sessionId};
 if(files){const claim={...fileArgs,requestSha256:hash(files)};await x.f.store.lifecycle.beginFileCapture(claim,check);await x.f.store.lifecycle.recordFiles({...claim,files},check);}
 else await captureEmptyFiles(x.f.store,fileArgs);
 const args={binding,scopes,selectedClientId:clientId,controlId,sessionId:x.sessionKey.sessionId,events:[
  {contractVersion:'0.1.0',eventId:id(5001),createdAt:new Date(at).toISOString(),type:'checkpoint.verified',data:{checkpointId:binding.runId}},
  {contractVersion:'0.1.0',eventId:id(5002),createdAt:new Date(at).toISOString(),type:'run.status',data:{state:'paused',reasonCode:null}}]};
 return {...x,args,capture:(value=args)=>x.f.store.lifecycle.captureSession(value,check)};
}

/** The production composition of the document options (apps/runtime/artifacts/composition.mjs), unmodified. */
function composedNativeFiles(store){
 const now=()=>at+500;
 const composer=createRuntimeDocumentOptionsComposer({storage:{objects:{get:async()=>{throw Error('unused')}},
   versions:{}},executor:{},pool:{},sessions:{},store,now});
 return composer({selectedClientId:clientId,limits:{maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:1048576},
  artifactOptions:{pool:{},context:{binding,scopes,deadlineMs:at+5000},validators:v,
   authorize:async()=>{},versions:{},objects:{get:async()=>{throw Error('unused')}},executor:{},now,ids:{}}}).nativeFiles;
}

test('the composed native-file port serves only the settled captured workspace entry, as the public inspection shape',async t=>{
 const files=capturedFiles(),x=await journal(t,{files}),nativeFiles=composedNativeFiles(x.f.store);
 const read=versionId=>nativeFiles.read(versionId);
 // The journal refuses a recorded-but-unsettled capture (the runner's own refusal path) instead of serving bytes.
 assert.equal(await read(id(7101)),null,'an upload recorded before publication is not a public file');
 await x.capture();          // ordinary completion capture publishes the immutable workspace proof
 await assert.rejects(read(id(7101)),/UNSETTLED/,'a published-but-unsettled capture is refused, never served');
 await x.settle(binding);
 const selected=await read(id(7101));
 assert.deepEqual(selected,{kind:'native-file',binding,scopes,manifestId:files.workspace.manifestId,
  createdAt:files.workspace.createdAt,entry:files.workspace.entries[0]});
 // Native SDK task files, unknown ids and another client's workspace stay private.
 assert.equal(await read(id(7102)),null,'task JSON is never a public file');
 assert.equal(await read(id(7199)),null);
 // The served entry composes into exactly the payload the document application releases to the accepted consumer.
 const metadata={versionId:selected.entry.object.objectId,binding:selected.binding,manifestId:selected.manifestId,
  path:selected.entry.path,object:selected.entry.object,scopes:selected.scopes,createdAt:selected.createdAt};
 const inspection=v.nativeFileInspection({kind:'native-file',version:metadata,
  integrity:{sha256:metadata.object.sha256,bytes:metadata.object.bytes,currentBytesVerified:true}});
 assert.deepEqual(inspection.version,metadata);
 assert.equal(inspection.integrity.sha256,selected.entry.object.sha256);
 assert.equal(inspection.integrity.currentBytesVerified,true);
 // The application releases this payload only while the version id still names the served entry
 // (document-application nativeFile(): selected.entry.object.objectId!==versionId -> DOCUMENT_RESULT_REFUSED).
 assert.notEqual(id(7199),selected.entry.object.objectId);
});

test('the actual SDK options admit native Bash only through the asserted attestation',async t=>{
 const cwd='/workspace/'+binding.conversationId;
 const facts=attestation=>({runOwner:{append:async()=>{}},binding,cwd,now:()=>at+500,newId:()=>id(9),bashSandbox:attestation});
 const admitted=createSdkCapabilities({bash:true},facts({available:true,sdk:SDK,cli:CLI,weakerNestedSandbox:false,outerIsolationBoundary:false}));
 assert.equal(admitted.bashAdmitted,true);assert.equal(admitted.policy.bash,true);
 const unavailable=createSdkCapabilities({bash:true},facts({available:false,sdk:SDK,cli:CLI,weakerNestedSandbox:false,outerIsolationBoundary:false}));
 assert.equal(unavailable.bashAdmitted,false);assert.equal(unavailable.policy.bash,false,'an unavailable sandbox drops Bash from the policy');
 const withoutFact=createSdkCapabilities({bash:true},facts(undefined));
 assert.equal(withoutFact.bashAdmitted,false);assert.equal(withoutFact.policy.bash,false);
 for(const bad of[{available:true,sdk:SDK,cli:'0.0.0',weakerNestedSandbox:false,outerIsolationBoundary:false},
  {available:true,sdk:SDK,cli:CLI,weakerNestedSandbox:true,outerIsolationBoundary:false}])
  assert.throws(()=>createSdkCapabilities({bash:true},facts(bad)),/BASH_SANDBOX|CAPABILITY/);
});
