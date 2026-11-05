/** Deliverable and client-file scenarios over the canonical artifact service with the plain-text executor. */
import {syntheticPrincipal} from '../../offline-targets/conversation-application.mjs';
import {createScriptedArtifactService} from '../../offline-targets/artifact-service.mjs';
import {artifactValidators as validators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {observedAnswer,observedRefusal,fileRecord} from './envelope.mjs';
const SOURCE='artifact-service';
const principal=(tenantId,tag)=>syntheticPrincipal({tenantId,actorId:`actor-${tag}`,tag});
let _seq=0;
/** Build the options required by service.create/revise: invocationId must match /^sdk:[a-f0-9]{64}$/ and
 *  requestSha256 must equal the one computed inside generate(). versionId=undefined lets ids() allocate it. */
function invocationFor(request,context,baseVersionId=null){
 const requestSha256=validators.nativeRequestSha256(request,context,baseVersionId);
 const invocationId='sdk:'+canonicalSha256({requestSha256,sequence:++_seq});
 return {invocation:{invocationId,versionId:undefined,requestSha256}};
}
export async function artifactTextCreate(view){const {tenantId,tag,title,text}=view.scenario,p=principal(tenantId,tag),f=createScriptedArtifactService();
 const req=f.textRequest(title,text),ctx=f.context(p);
 const created=await f.service.create(req,ctx,invocationFor(req,ctx)),downloaded=await f.service.download(created.version.versionId,f.context(p));
 return observedAnswer(view,{kind:'file',source:SOURCE,observed:{version:created.version,execution:created.execution},files:[fileRecord(downloaded.version,downloaded.bytes)]});}
export async function artifactTextRevise(view){const {tenantId,tag,title,text,revisedText}=view.scenario,p=principal(tenantId,tag),f=createScriptedArtifactService();
 const req=f.textRequest(title,text),ctx=f.context(p);
 const created=await f.service.create(req,ctx,invocationFor(req,ctx));
 const revReq=f.textRequest(title,revisedText),revCtx=f.context(p);
 const revised=await f.service.revise(created.version.versionId,revReq,revCtx,invocationFor(revReq,revCtx,created.version.versionId));
 const original=await f.service.download(created.version.versionId,f.context(p)),latest=await f.service.download(revised.version.versionId,f.context(p));
 const observed={revisionLinksParent:revised.version.parentVersionId===created.version.versionId,originalPreserved:original.version.object.sha256===created.version.object.sha256&&original.bytes.toString('utf8')===text,distinctVersions:revised.version.versionId!==created.version.versionId};
 return observedAnswer(view,{kind:'file',source:SOURCE,observed,files:[fileRecord(original.version,original.bytes),fileRecord(latest.version,latest.bytes)]});}
export async function artifactForeignDownload(view){const s=view.scenario,owner=principal(s.ownerTenantId,s.ownerTag),foreign=principal(s.foreignTenantId,s.foreignTag),f=createScriptedArtifactService();
 const req=f.textRequest('Owner note',s.text),ctx=f.context(owner);
 const created=await f.service.create(req,ctx,invocationFor(req,ctx));
 try{const leaked=await f.service.download(created.version.versionId,f.context(foreign));return observedAnswer(view,{kind:'file',source:SOURCE,observed:{version:leaked.version},files:[fileRecord(leaked.version,leaked.bytes)]});}
 catch(error){if(typeof error?.code!=='string'||!error.code.startsWith('ARTIFACT_'))throw error;return observedRefusal(view,error.code,{code:error.code});}}
