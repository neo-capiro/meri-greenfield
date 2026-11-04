/** Real source, session, document and publication owners over isolated scripted SQL/CAS.
 * These author tests do not qualify a database, provider or Office renderer. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {receiveCanvasRequest,receiveCanvasResponse} from '../../../../packages/contracts/dist/document-canvas.mjs';
import {nativeDocumentFixture,sha} from '../../../artifacts/test/native-document-fixture.mjs';
import {createRuntimeArtifactApplication} from '../application.mjs';
import {createDocumentCanvasApplication} from '../canvas-application.mjs';
import {captureRuntimePorts,createRuntimeProductApplications} from '../../product-applications.mjs';
import {createControlRouteApplications} from '../../control-route-boundary.mjs';
const encode=value=>new TextEncoder().encode(JSON.stringify(value));
async function fixture({retained=false,assets=false,retainAssets=true,general=false}={}){
 const f=nativeDocumentFixture({scopes:[{tenantId:'synthetic-tenant',kind:'client',resourceId:'33333333-3333-4333-8333-000000000090',policyRevision:'r1'}]});
 if(general)f.context.scopes=[{tenantId:f.context.binding.tenantId,kind:'private-user',resourceId:f.context.binding.actorId,policyRevision:'r1'}];
 if(retained)f.context.evidence=[{sourceId:'program_elements',recordId:'record-synthetic',sourceVersionId:'version-synthetic',observedAt:new Date(f.options.now()).toISOString(),sourceUpdatedAt:null,citationId:randomUUID(),scopes:structuredClone(f.context.scopes),contentSha256:'a'.repeat(64),binding:structuredClone(f.context.binding)}];
 if(assets){
  const bytes=Buffer.from('synthetic retained image bytes'),object={objectId:randomUUID(),versionId:'SYNTHETIC_RETAINED',sha256:sha(bytes),bytes:bytes.length,scopes:structuredClone(f.context.scopes)};
  f.context.assets=[{id:'retained-image',object}];f.state.objects.set(hash(object),bytes);
  f.options.retainedAssetMapWrites=retainAssets;
  f.call.request={operation:'create_word',format:'docx',title:'Synthetic',content:{blocks:[{kind:'paragraph',runs:[{text:'Original'}]},{kind:'image',assetId:'retained-image',widthInches:1,heightInches:1}]}};
  f.options.executor={async execute(input){f.state.executions.push(input);const bytes=Buffer.from(JSON.stringify(input.request.content.blocks));return {bytes,inspection:{sha256:sha(bytes),bytes:bytes.length,format:'docx',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{paragraphs:1,tables:0,pictures:input.assets.length}}};}};
 }
 const first=await f.run(),binding=f.context.binding,now=f.options.now,credential='action_session_'+'a'.repeat(43),expiry=now()+30000;
 const selectedClientId=general?null:f.context.scopes[0].resourceId,state={denied:false,resolved:[],phases:[],release:null,principal:{},current:null};
 const sessions={async authenticateSession(){if(state.denied)throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});return {principal:{sessionId:'synthetic-session',tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId,...state.principal},sessionRevision:'synthetic-current',checkedAtMs:now(),expiresAtMs:expiry};},async readCurrentState({authentication}){const current={authenticationSha256:hash(authentication),binding,scopes:f.context.scopes,selectedClientId,checkedAtMs:now(),expiresAtMs:expiry};return state.current?state.current(current):current;}};
 const limits={maxRequestMs:5000,maxRequestBytes:2097152,maxResponseBytes:16777216};
 const optionsOwner={async resolve(call){state.resolved.push(call);return {documentOptions:{sessions,selectedClientId,artifactOptions:{...f.options,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()})},now,limits,enabled:true},async recheck({phase}){state.phases.push(phase);if(phase==='release')await state.release?.();if(state.denied)throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}};}};
 const config={sessions,optionsOwner,now,limits},application=createRuntimeArtifactApplication(config),app=createDocumentCanvasApplication({...config,application});
 const selection={artifactId:first.version.artifactId,versionId:first.version.versionId,objectSha256:first.version.object.sha256};
 const call=async(route,body,changes={})=>{const response=await app.handle(new Request('https://synthetic.invalid/api/documents/'+route,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify(body),...changes}));return {status:response.status,body:await response.json()};};
 const read=selected=>call('canvas-read',{selection:selected??selection});
 const replacement=assets?{...f.call.request,content:{blocks:[{kind:'paragraph',runs:[{text:'Replacement'}]},f.call.request.content.blocks[1]]}}:{...f.call.request,content:{text:'Replacement\n'}};
 const saveBody={selection,deliveryId:'canvas-save-1',request:replacement};
 return {f,first,state,config,app,application,selection,call,read,saveBody};
}
test('canvas read releases only bounded canonical source after current admission and release',async()=>{
 const h=await fixture({assets:true}),result=await h.read();assert.equal(result.status,200,JSON.stringify(result.body));
 assert.deepEqual(Object.keys(result.body).sort(),['headVersionId','inspection','request','version']);assert.deepEqual(result.body.request,h.f.call.request);
 assert.equal(result.body.inspection.currentBytesVerified,true);assert.equal(result.body.headVersionId,h.selection.versionId);
 assert.deepEqual(h.state.phases,['admission','release']);assert.equal(h.f.state.executions.length,1);
 const q=receiveCanvasRequest('canvas-read',encode({selection:h.selection}));assert.deepEqual(await receiveCanvasResponse('canvas-read',result.status,encode(result.body),q),result.body);
});
test('save uses canonical revise, preserves evidence and exact retained assets, and keeps original immutable',async()=>{
 const h=await fixture({retained:true,assets:true}),original=await h.read();
 const saved=await h.call('canvas-save',h.saveBody);assert.equal(saved.status,200,JSON.stringify(saved.body));
 assert.equal(saved.body.version.parentVersionId,h.selection.versionId);assert.equal(saved.body.version.artifactId,h.selection.artifactId);
 assert.deepEqual(saved.body.version.evidence,h.first.version.evidence);assert.deepEqual(h.f.state.executions[1].assets,h.f.state.executions[0].assets);
 assert.deepEqual(h.state.resolved.map(item=>item.intent),['inspect','inspect','revise']);
 const q=receiveCanvasRequest('canvas-save',encode(h.saveBody));await receiveCanvasResponse('canvas-save',saved.status,encode(saved.body),q);
 const next=await h.read({artifactId:saved.body.version.artifactId,versionId:saved.body.version.versionId,objectSha256:saved.body.version.object.sha256});assert.deepEqual(next.body.request,h.saveBody.request);
 const previous=await h.read();assert.deepEqual(previous.body.request,original.body.request);assert.equal(previous.body.headVersionId,saved.body.version.versionId);
});
test('General chat reads and saves canonical documents under the actor private-user scope',async()=>{
 const h=await fixture({general:true,retained:true}),read=await h.read();assert.equal(read.status,200,JSON.stringify(read.body));
 const expected=[{tenantId:h.f.context.binding.tenantId,kind:'private-user',resourceId:h.f.context.binding.actorId,policyRevision:'r1'}];
 assert.deepEqual(read.body.version.scopes,expected);
 const save=await h.call('canvas-save',h.saveBody);assert.equal(save.status,200,JSON.stringify(save.body));
 assert.deepEqual(save.body.version.scopes,expected);assert.deepEqual(save.body.version.evidence,h.first.version.evidence);
 assert.equal(save.body.version.artifactId,h.selection.artifactId);assert.equal(save.body.version.parentVersionId,h.selection.versionId);
 const next=await h.read({artifactId:save.body.version.artifactId,versionId:save.body.version.versionId,objectSha256:save.body.version.object.sha256});
 assert.equal(next.status,200);assert.deepEqual(next.body.request,h.saveBody.request);assert.equal(h.f.state.executions.length,2);
});
for(const change of ['tenant','client'])test(`late ${change} change fails through current source authorization without releasing text or saving`,async()=>{
 for(const route of ['canvas-read','canvas-save']){
  const h=await fixture({general:change==='tenant'});
  h.state.release=()=>{
   assert(h.f.state.gets>0,'The private source bytes were read before the release-time identity change');
   if(change==='tenant')h.state.principal={tenantId:'other-synthetic-tenant'};
   else h.state.current=current=>({...current,selectedClientId:'33333333-3333-4333-8333-000000000091',scopes:current.scopes.map(scope=>({...scope,resourceId:'33333333-3333-4333-8333-000000000091'}))});
  };
  const result=await h.call(route,route==='canvas-read'?{selection:h.selection}:h.saveBody);
  assert.equal(result.status,403,JSON.stringify(result.body));assert.deepEqual(result.body,{error:{code:'ACCESS_DENIED',outcome:route==='canvas-read'?'READ_UNAVAILABLE':'NOT_DISPATCHED'}});
  assert.deepEqual(h.state.resolved.map(item=>item.intent),['inspect']);assert.equal(h.f.state.executions.length,1);
 }
});
test('wrong exact selection and release-time revocation release no source or write',async()=>{
 const wrong=await fixture(),result=await wrong.read({...wrong.selection,objectSha256:'f'.repeat(64)});assert.equal(result.status,403);assert.equal(result.body.error.outcome,'READ_UNAVAILABLE');assert.equal(wrong.f.state.executions.length,1);
 const denied=await fixture();denied.state.release=()=>{denied.state.denied=true;};const noSource=await denied.read();assert.equal(noSource.status,403);assert.equal(noSource.body.error.outcome,'READ_UNAVAILABLE');assert.equal(Object.hasOwn(noSource.body,'request'),false);
 const save=await fixture();save.state.release=()=>{save.state.denied=true;};const noSave=await save.call('canvas-save',save.saveBody);assert.equal(noSave.status,403);assert.equal(noSave.body.error.outcome,'NOT_DISPATCHED');assert.equal(save.f.state.executions.length,1);assert.deepEqual(save.state.resolved.map(item=>item.intent),['inspect']);
});
test('superseded selected parent refuses before dispatch and never rebases a replacement',async()=>{
 const h=await fixture();await h.f.run({...h.f.call,deliveryId:'other',baseVersionId:h.selection.versionId});
 const result=await h.call('canvas-save',h.saveBody);assert.equal(result.status,409);assert.deepEqual(result.body,{error:{code:'CONFLICT',outcome:'NOT_DISPATCHED'}});assert.equal(h.f.state.executions.length,2);assert.deepEqual(h.state.resolved.map(item=>item.intent),['inspect']);
});
test('missing durable asset mapping and browser-supplied authority cannot write',async()=>{
 const h=await fixture({assets:true,retainAssets:false}),result=await h.call('canvas-save',h.saveBody);assert.equal(result.status,503);assert.equal(h.f.state.executions.length,1);
 const extra=await h.call('canvas-save',{...h.saveBody,retained:{evidence:[],assets:[]}});assert.equal(extra.status,400);assert.equal(h.state.resolved.length,1);
 const unsupported=await h.call('canvas-save',{...h.saveBody,request:{...h.saveBody.request,format:'pptx'}});assert.equal(unsupported.status,400);assert.equal(h.f.state.executions.length,1);
});
test('canonical post-commit release denial keeps RESULT_NOT_RELEASED with no receipt',async()=>{
 const h=await fixture();let releases=0;h.state.release=()=>{if(++releases===2)h.state.denied=true;};
 const result=await h.call('canvas-save',h.saveBody);assert.equal(result.status,403);assert.equal(result.body.error.outcome,'RESULT_NOT_RELEASED');assert.equal(h.f.state.executions.length,2);assert.equal(Object.hasOwn(result.body,'version'),false);
 const q=receiveCanvasRequest('canvas-save',encode(h.saveBody));await receiveCanvasResponse('canvas-save',result.status,encode(result.body),q);
});
test('authentication, method, body bounds and absent source owner fail closed',async()=>{
 const h=await fixture();assert.equal((await h.call('canvas-read',{selection:h.selection},{headers:{'content-type':'application/json'}})).status,401);
 assert.equal((await h.app.handle(new Request('https://synthetic.invalid/api/documents/canvas-read'))).status,405);
 const oversized=await h.call('canvas-read',{selection:h.selection,padding:'x'.repeat(8192)});assert.notEqual(oversized.status,200);assert.equal(h.state.resolved.length,0);
 const absent=createDocumentCanvasApplication({...h.config,optionsOwner:undefined,application:h.application});
 const result=await absent.handle(new Request('https://synthetic.invalid/api/documents/canvas-read',{method:'POST',headers:{authorization:'Bearer test','content-type':'application/json'},body:JSON.stringify({selection:h.selection})}));assert.equal(result.status,503);
});
test('public product mount routes canvas reads and writes to the canonical document owners',async()=>{
 const h=await fixture(),{sessions,now,limits,optionsOwner}=h.config;
 const app=createRuntimeProductApplications({configuration:{sourceEnabled:false,limits:{requestMs:limits.maxRequestMs,requestBytes:limits.maxRequestBytes},native:{maxResponseBytes:limits.maxResponseBytes}},sessions,now,ports:captureRuntimePorts({artifactOptionsOwner:optionsOwner})});
 const routes=createControlRouteApplications({assembly:app,candidate:{handle(){assert.fail('Canvas reached private candidate');}}});
 const call=async(route,body)=>routes.public.handle(new Request('https://synthetic.invalid/api/documents/'+route,{method:'POST',headers:{authorization:'Bearer action_session_'+'a'.repeat(43),'content-type':'application/json'},body:JSON.stringify(body)}));
 const read=await call('canvas-read',{selection:h.selection});assert.equal(read.status,200);assert.deepEqual((await read.json()).request,h.f.call.request);
 const save=await call('canvas-save',h.saveBody);assert.equal(save.status,200);assert.equal((await save.json()).version.parentVersionId,h.selection.versionId);assert.equal(h.f.state.executions.length,2);
});
