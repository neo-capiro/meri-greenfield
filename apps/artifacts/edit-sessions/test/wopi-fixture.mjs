/** Actual artifact, native-session, token and Core-client owners; Core's HTTP
 * responses are scripted. Core has its separate ordinary-role PostgreSQL suite. */
import {nativeDocumentFixture,sha} from '../../test/native-document-fixture.mjs';
import {id} from '../../storage/test/sql-fixture.mjs';
import {ooxml} from '../../structure/test/fixtures.mjs';
import {inspectOfficeEdit} from '../inspect-office.mjs';
import {createArtifactService} from '../../service.mjs';
import {createActionSessionOwner} from '../../../control/action-host/session/owner.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createCoreOfficeDraftClient} from '../core-drafts.mjs';
import {createWopiAccessTokenCodec} from '../wopi-access-token.mjs';
import {createWopiFileApplication} from '../wopi-files.mjs';
const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
export async function wopiFixture(t,{format='docx',write=true,withEvidence=false}={}){
 const f=nativeDocumentFixture({scopes:[{tenantId:'synthetic-tenant',kind:'client',resourceId:id(5),policyRevision:'synthetic-policy'}]}),baseBytes=ooxml(format),selectedClientId=f.context.scopes[0].resourceId;
 if(withEvidence)f.context.evidence.push({sourceId:'synthetic-source',recordId:'synthetic-record',sourceVersionId:'synthetic-version',
  observedAt:new Date(f.state.clock).toISOString(),sourceUpdatedAt:null,citationId:id(980),scopes:structuredClone(f.context.scopes),contentSha256:'a'.repeat(64),binding:structuredClone(f.context.binding)});
 const requests={docx:{blocks:[{kind:'paragraph',runs:[{text:'Original'}]}]},xlsx:{sheets:[{name:'Data',rows:[[{value:2}]]}]},pptx:{slides:[{title:'Original',bullets:['Fixture']}]}};
 f.options.executor={async execute(){f.state.executions.push('base');const inspection=inspectOfficeEdit(baseBytes,format);if(format==='xlsx')inspection.details.formulaCache='removed/unverified; recalculation required';return {bytes:baseBytes,inspection};}};
 const first=await f.run({...f.call,request:{operation:({docx:'create_word',xlsx:'create_excel',pptx:'create_powerpoint'})[format],format,title:'Synthetic',content:requests[format]}});
 const now=()=>f.state.clock,context=f.context,binding=context.binding,scopes=context.scopes;
 const sessions=createActionSessionOwner({mode:'process-local',now,limits:{maxSessions:4,maxRequestMs:1000,maxTtlMs:60000,maxFactBytes:65536},
  verifyIdentity:async()=>({principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'identity',checkedAtMs:now(),expiresAtMs:now()+60000}),
  resolveContext:async({identity})=>({identitySha256:canonicalSha256(identity),binding,scopes,selectedClientId,contextRevision:'revision',checkedAtMs:now(),expiresAtMs:now()+60000})});
 const session=await sessions.issue({identityCredential:'synthetic-native-bearer'});t.after(()=>sessions.close());
 const state=Object.assign(f.state,{calls:[],lock:'',epoch:1,generation:0,hook:null,contextHook:null,generationHook:null,readonly:false,failSave:false,loseBegin:false,loseSettle:false});
 const draft={draftId:id(700),conversationId:binding.conversationId,artifactId:first.version.artifactId,baseVersionId:first.version.versionId,baseSha256:sha(baseBytes),format,filename:first.version.filename,
  sequence:0,sha256:null,byteLength:0,state:'draft',publishIntent:null,publishedVersionId:null,savedAt:new Date(now()).toISOString(),expiresAt:new Date(now()+7*86400000).toISOString(),bytesBase64:null};
 const codec=createWopiAccessTokenCodec({key:Buffer.alloc(32,42),now});
 const claims={editSessionId:draft.draftId,fileId:'synthetic-file',versionId:first.version.versionId,conversationId:binding.conversationId,editorId:id(701),editorEpoch:1,
  actorId:binding.actorId,tenantId:binding.tenantId,userCanWrite:write,expiresAtMs:now()+10000,suppressionGeneration:0};
 const drafts=createCoreOfficeDraftClient({origin:'https://core.example.test',now,nativeCredentials:{nativeCredentialFor:i=>sessions.nativeCredentialFor(i)},getServiceSecret:async()=>'synthetic-service-secret',reservedCredentials:async()=>new Set(),
  fetchImpl:async(url,options)=>{
   const request=JSON.parse(options.body),route=url.split('/office-drafts/')[1];state.calls.push({route,request,headers:options.headers});
   await state.hook?.(route,request);
   if(['editor/read','lock','save'].includes(route)&&(request.editorEpoch!==state.epoch||request.editorId!==claims.editorId))return new Response(null,{status:409});
   if(route==='editor/read'||route==='read')return json({...draft});
   const receipt=()=>{const {bytesBase64,...metadata}=draft;return {...metadata};};
   if(route==='publish/begin'){
    if(request.sequence!==draft.sequence||request.sha256!==draft.sha256||!draft.bytesBase64)return new Response(null,{status:409});
    if(['publish-pending','publish-unknown','published'].includes(draft.state))return json({receipt:receipt(),dispatch:false});
    if(!['draft','publish-refused'].includes(draft.state))return new Response(null,{status:409});
    draft.state='publish-pending';draft.publishIntent=`office:${draft.draftId}:${draft.sequence}`;
    if(state.loseBegin)throw Error('synthetic lost begin ACK');return json({receipt:receipt(),dispatch:true});
   }
   if(route==='publish/settle'){
    const next=({published:'published',refused:'publish-refused',conflict:'conflict',unknown:'publish-unknown'})[request.outcome];
    if(request.sequence!==draft.sequence||request.sha256!==draft.sha256||request.intent!==draft.publishIntent||
     !['publish-pending','publish-unknown'].includes(draft.state)&&!(draft.state===next&&draft.publishedVersionId===request.versionId))return new Response(null,{status:409});
    draft.state=next;draft.publishedVersionId=request.versionId;if(state.loseSettle)throw Error('synthetic lost settle ACK');return json(receipt());
   }
   if(route==='lock'){
    const current=state.lock;if(request.operation==='get')return json({status:200,lock:current});
    if(request.operation==='lock'?current&&current!==request.lock:!current||current!==(request.operation==='relock'?request.oldLock:request.lock))return json({status:409,lock:current});
    state.lock=request.operation==='unlock'?'':request.lock;return json({status:200});
   }
   if(route==='save'){
    if(!state.lock||state.lock!==request.lock)return json({status:409,lock:state.lock});
    if(draft.state!=='draft'||request.expectedSequence!==draft.sequence&&request.sha256!==draft.sha256)return new Response(null,{status:409});
    if(draft.sha256!==request.sha256)Object.assign(draft,{sequence:draft.sequence+1,sha256:request.sha256,byteLength:Buffer.from(request.bytesBase64,'base64').length,bytesBase64:request.bytesBase64});
    if(state.failSave)throw Error('synthetic lost Save ACK');
    const {bytesBase64,...receipt}=draft;return json({status:200,receipt});
   }
   throw Error('Unexpected route');
  }});
 const originalAuthorize=f.options.authorize;
 const artifacts=createArtifactService({...f.options,ids:()=>({artifactId:id(900),versionId:id(901),objectId:id(902)}),authorize:async x=>{if(state.readonly&&x.action==='artifact.revise')throw Object.assign(Error('ARTIFACT_AUTHORITY'),{code:'ARTIFACT_AUTHORITY'});return originalAuthorize(x);}});
 const options={codec,drafts,artifacts,now,resolveContext:async()=>{await state.contextHook?.();const native=sessions.nativeCredentialFor({binding,selectedClientId});return {context,selectedClientId,expiresAtMs:native.expiresAtMs};},
  generation:async subjects=>{await state.generationHook?.();for(const s of subjects)await f.options.retention.assertServable(s);return state.generation;}};
 const host=createWopiFileApplication(options),token=codec.issue(claims);
 const request=(operation='checkFileInfo',{body,lock,oldLock,headers={},token:access=token,signal}={})=>{
  const contents=['getFile','save'].includes(operation),method=['checkFileInfo','getFile'].includes(operation)?'GET':'POST';
  return new Request(`https://wopi.example.test/api/meri/office/wopi/files/${claims.fileId}${contents?'/contents':''}?access_token=${access}`,{method,
   headers:{...(method==='POST'?{'x-wopi-override':({save:'PUT',lock:'LOCK',relock:'LOCK',refresh:'REFRESH_LOCK',unlock:'UNLOCK',get:'GET_LOCK',relative:'PUT_RELATIVE'})[operation]}:{}),
    ...(lock===undefined?{}:{'x-wopi-lock':lock}),...(oldLock===undefined?{}:{'x-wopi-oldlock':oldLock}),...headers},...(body===undefined?{}:{body,duplex:'half'}),...(signal?{signal}:{})});
 };
 return {...f,first,baseBytes,state,draft,codec,claims,sessions,session,host,artifactOptions:f.options,options,request,send:(op,args)=>host.handle(request(op,args)),sha};
}
