/** Mounted native document application, deterministic compiler and canonical artifact owners;
 * SQL/object storage and native identity are isolated synthetic ports, not live qualification. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {nativeDocumentFixture,sha} from '../../../artifacts/test/native-document-fixture.mjs';
import {id} from '../../../artifacts/storage/test/sql-fixture.mjs';
import {sourceFor,opFor} from '../../../artifacts/federal-drafting/test/fixtures.mjs';
import {scopedSource} from '../../../artifacts/federal-drafting/test/scoped-fixture.mjs';
import {textSha256} from '../../../artifacts/federal-drafting/engine.mjs';
import {createLocalDocumentPorts} from '../local/ports.mjs';
import {createRuntimeArtifactApplication} from '../../../runtime/artifacts/application.mjs';
import {createRuntimeDocumentOptionsComposer} from '../../../runtime/artifacts/composition.mjs';
import {createControlRouteApplications} from '../../../runtime/control-route-boundary.mjs';
import {createArtifactService} from '../../../artifacts/service.mjs';
import official from '../../../../packages/contracts/test/fixtures/federal-draft-source.wire.json' with {type:'json'};
import rawOfficial from '../../../../packages/contracts/test/fixtures/federal-raw-source.wire.json' with {type:'json'};

export const bytes=value=>new TextEncoder().encode(JSON.stringify(value));
export async function ok(response){const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));return body;}
export const publication=(selection,revisionSha256,output,extra={})=>({selection,revisionSha256,output,deliveryId:randomUUID(),baseVersionId:null,baseRevisionSha256:null,...extra});
export const importedSelection=(result,over={})=>({versionId:result.publication.version.versionId,expectedArtifactSha256:result.publication.version.object.sha256,
 operations:[opFor(result.source,{scopeId:'document',expectedText:'$20',text:'$25',...over})]});

/** `text` replaces the official fixture's extracted text (and its hash pin); `docx` adds a synthetic Word renderer port. */
export async function fixture(t,{native=false,nested=false,text=null,docx=false,raw=false,federalValidator,realClock=false}={}){
 const binding={tenantId:id(100),actorId:id(101),conversationId:id(102),runId:id(103),attemptId:id(104),workerId:id(105),writerFence:1};
 const clientId=id(106),scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:'policy1'}];
 const f=nativeDocumentFixture({binding,scopes}),source=nested?scopedSource():sourceFor();
 if(realClock){f.state.clock=Date.now();f.options.now=Date.now;f.context.deadlineMs=f.state.clock+300000;}
 const retained=await f.run({...f.call,request:{...f.call.request,title:'Synthetic federal source',content:{text:JSON.stringify(source)}}});
 const {deadlineMs}=f.context,now=f.options.now;
 const state={closed:false,revoked:false,artifactChecks:0},ports=createLocalDocumentPorts({binding,scopes,clientId,deadlineMs,now,state,...(realClock?{sessionTtlMs:300000}:{})});
 const nativeState={calls:0,available:true,mutate:null},expectedSelection=structuredClone(raw?rawOfficial.request:official.request);
 delete expectedSelection.representation;
 if(text!==null){expectedSelection.textHash=textSha256(text);if(raw)expectedSelection.versionHash=expectedSelection.textHash;}
 const federalSource={async read({selection,signal,representation}){
  assert.equal(signal.aborted,false);assert.deepEqual(selection,expectedSelection);nativeState.calls++;
  assert.equal(representation,raw?'retained-raw-utf8/1':undefined);
  const result=nativeState.available?structuredClone(raw?rawOfficial.response:official.response):{tool:'read_federal_draft_source',authoritativeOwner:'federal_evidence_current',currentStatus:'unavailable',selection,reason:'exact_current_source_unavailable',...(raw?{representation}:{})};
  if(text!==null&&nativeState.available){result.source.text=text;result.source.textHash=expectedSelection.textHash;
   if(raw){result.source.versionHash=expectedSelection.versionHash;Object.assign(result.raw,{text,sha256:expectedSelection.textHash,byteLength:Buffer.byteLength(text)});Object.assign(result.raw.capture,{sha256:expectedSelection.textHash,byteLength:Buffer.byteLength(text)});}}
  nativeState.mutate?.(result);return result;
 }};
 const executor=docx?{async execute(call){
  if(call.request.format!=='docx')return f.options.executor.execute(call);
  f.state.executions.push(call);const rendered=Buffer.from(JSON.stringify(call.request.content));
  return {bytes:rendered,inspection:{sha256:sha(rendered),bytes:rendered.length,format:'docx',nativeOpened:false,rendered:false,recalculated:false,members:['word/document.xml'],details:{paragraphs:call.request.content.blocks.length,tables:0,pictures:0}}};
 }}:f.options.executor;
 t.after(()=>ports.sessions.close());
 const limits={maxRequestMs:realClock?60000:5000,maxRequestBytes:1048576,maxResponseBytes:2097152};
 const compose=createRuntimeDocumentOptionsComposer({storage:{objects:f.options.objects,versions:f.options.versions},executor,
  pool:f.options.pool,store:{lifecycle:{readArtifactFile:async()=>null}},sessions:ports.sessions,now});
 let denyRelease=false;
 const optionsOwner={async resolve(){return {documentOptions:{...compose({artifactOptions:{...f.options,executor,authorize:ports.authorize,
  ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})},selectedClientId:clientId,limits,enabled:true,...(native?{federalSource}:{})}),...(federalValidator?{federalValidator}:{})},
  async recheck(check){if(denyRelease&&check.phase==='release')throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}};}};
 const runtime=createRuntimeArtifactApplication({sessions:ports.sessions,optionsOwner,now,limits});
 const listeners=createControlRouteApplications({assembly:runtime,candidate:{async handle(){return null;}}});
 const session=await ports.sessions.issue({identityCredential:ports.nativeCredential});
 const post=(intent,body)=>listeners.public.handle(new Request('https://meri.synthetic.invalid/api/documents/'+intent,{method:'POST',
  headers:{authorization:'Bearer '+session.credential,'content-type':'application/json'},body:JSON.stringify(body)}));
 const selection={versionId:retained.version.versionId,expectedArtifactSha256:retained.version.object.sha256,operations:[opFor(source,{scopeId:nested?'a':'section-1'})]};
 return {f,state,nativeState,source,selection,post,deny:()=>{denyRelease=true;},allow:()=>{denyRelease=false;},
  importRequest:()=>({selection:structuredClone(expectedSelection),deliveryId:randomUUID(),...(raw?{representation:'retained-raw-utf8/1'}:{})}),
  suppress:()=>f.sql.suppressed.add(binding.tenantId+':artifact:'+retained.version.artifactId),
  reads:createArtifactService({...f.options,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})})};
}
