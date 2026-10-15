/** Deliverable and client-file scenarios over the canonical artifact service with the plain-text executor. */
import {syntheticPrincipal} from '../../offline-targets/conversation-application.mjs';
import {createScriptedArtifactService} from '../../offline-targets/artifact-service.mjs';
import {observedAnswer,observedRefusal,fileRecord} from './envelope.mjs';
const SOURCE='artifact-service';
const principal=(tenantId,tag)=>syntheticPrincipal({tenantId,actorId:`actor-${tag}`,tag});
export async function artifactTextCreate(view){const {tenantId,tag,title,text}=view.scenario,p=principal(tenantId,tag),f=createScriptedArtifactService();
 const created=await f.service.create(f.textRequest(title,text),f.context(p)),downloaded=await f.service.download(created.version.versionId,f.context(p));
 return observedAnswer(view,{kind:'file',source:SOURCE,observed:{version:created.version,execution:created.execution},files:[fileRecord(downloaded.version,downloaded.bytes)]});}
export async function artifactTextRevise(view){const {tenantId,tag,title,text,revisedText}=view.scenario,p=principal(tenantId,tag),f=createScriptedArtifactService();
 const created=await f.service.create(f.textRequest(title,text),f.context(p)),revised=await f.service.revise(created.version.versionId,f.textRequest(title,revisedText),f.context(p));
 const original=await f.service.download(created.version.versionId,f.context(p)),latest=await f.service.download(revised.version.versionId,f.context(p));
 const observed={revisionLinksParent:revised.version.parentVersionId===created.version.versionId,originalPreserved:original.version.object.sha256===created.version.object.sha256&&original.bytes.toString('utf8')===text,distinctVersions:revised.version.versionId!==created.version.versionId};
 return observedAnswer(view,{kind:'file',source:SOURCE,observed,files:[fileRecord(original.version,original.bytes),fileRecord(latest.version,latest.bytes)]});}
export async function artifactForeignDownload(view){const s=view.scenario,owner=principal(s.ownerTenantId,s.ownerTag),foreign=principal(s.foreignTenantId,s.foreignTag),f=createScriptedArtifactService();
 const created=await f.service.create(f.textRequest('Owner note',s.text),f.context(owner));
 try{const leaked=await f.service.download(created.version.versionId,f.context(foreign));return observedAnswer(view,{kind:'file',source:SOURCE,observed:{version:leaked.version},files:[fileRecord(leaked.version,leaked.bytes)]});}
 catch(error){if(typeof error?.code!=='string'||!error.code.startsWith('ARTIFACT_'))throw error;return observedRefusal(view,error.code,{code:error.code});}}
