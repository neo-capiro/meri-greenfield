/** Control-side publication owner for one reviewed browser download.
 *
 * It reuses the EXISTING product document owner: the canonical storage (versions/objects/publication journal) and
 * the Core-authorized `artifactOptions` resolved for this run's native session. Nothing here builds a second store,
 * a second journal or its own authority; the composed options' own `authorize` gates the write and its `context`
 * is the canonical run context (binding/scopes/deadline/maxBytes) that Core observed.
 */
import {createHash} from 'node:crypto';
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {createArtifactService} from '../artifacts/service.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function createBrowserArtifactPublication({resolve,sessions,now,requestMs}){
 if(typeof resolve!=='function'||typeof sessions?.nativeCredentialFor!=='function'||
  typeof now!=='function'||!Number.isSafeInteger(requestMs)||requestMs<1)fail('BROWSER_ARTIFACT_CONFIGURATION');
 return Object.freeze({
  /** The store has already authenticated the run and validated the claimed origin against current policy. This
   * owner re-derives the Core intent body from the canonical binding/scopes and publishes through the document
   * owner's own artifact service, then rechecks current authority before any ACK leaves. */
  async ingest(value,{signal}={}){
   const q=own(value,['binding','scopes','filename','format','mimeType','bytes','origin','policySha256','deadlineMs','idempotencyKey'],['signal']);
   const life=q.signal??signal;nativeSignal(life);
   if(!Buffer.isBuffer(q.bytes)||!q.bytes.length)fail('BROWSER_ARTIFACT_INPUT');
   const binding=data(q.binding),scopes=data(q.scopes),bytes=Buffer.from(q.bytes),contentSha=sha256(bytes);
   if(!Number.isSafeInteger(q.deadlineMs)||q.deadlineMs<=now())fail('BROWSER_ARTIFACT_DEADLINE');
   const deadlineMs=Math.min(q.deadlineMs,now()+requestMs);
   if(deadlineMs<=now())fail('BROWSER_ARTIFACT_DEADLINE');
   const clients=scopes.filter(scope=>scope.kind==='client');
   const selectedClientId=clients.length===1&&!scopes.some(scope=>scope.kind==='private-user')?clients[0].resourceId
    :scopes.length===1&&scopes[0].kind==='private-user'&&scopes[0].resourceId===binding.actorId?null:undefined;
   if(selectedClientId===undefined)fail('BROWSER_ARTIFACT_SCOPE');
   // The Core intent body is built from the CANONICAL facts, never from caller-supplied authority fields.
   const body={binding,scopes,filename:q.filename,format:q.format,mimeType:q.mimeType,origin:q.origin,
    sha256:contentSha,bytes:bytes.length};
   const requestSha256=hash({intent:'browser-import',body});
   let credential;
   try{const issued=sessions.nativeCredentialFor({binding,selectedClientId,...(life===undefined?{}:{signal:life})});
    credential=issued?.credential;if(typeof credential!=='string'||!credential)fail('BROWSER_ARTIFACT_CREDENTIAL');
   }catch{fail('BROWSER_ARTIFACT_CREDENTIAL');}
   let resolved;
   try{resolved=await resolve({credential,intent:'browser-import',body,requestSha256,deadlineMs,signal:life});}
   catch{fail('BROWSER_ARTIFACT_ADMISSION_REFUSED');}
   const options=resolved?.documentOptions?.artifactOptions;
   if(!options||typeof resolved.recheck!=='function')fail('BROWSER_ARTIFACT_ADMISSION_REFUSED');
   const context=options.context;
   // Core's composed context must be exactly this run; a mismatched or caller-copied context refuses.
   // Core's composed context must be exactly this run. Its own deadline caps ours; it is never extended here.
   if(hash(context.binding)!==hash(binding)||hash(context.scopes)!==hash(scopes)||
    !Number.isSafeInteger(context.deadlineMs)||context.deadlineMs<=now())fail('BROWSER_ARTIFACT_CONTEXT');
   const service=createArtifactService({...options});
   // The REAL current-authority recheck contract: phase, intent, the SAME request digest that resolved, a null
   // resource, and a deadline capped by Core's own composed context. Admission precedes the write; release
   // precedes any ACK. A failure in either phase releases nothing.
   const recheckDeadline=Math.min(context.deadlineMs,deadlineMs);
   const fresh=async phase=>{try{
    await resolved.recheck({phase,intent:'browser-import',requestSha256,resource:null,deadlineMs:recheckDeadline,
     ...(life===undefined?{}:{signal:life})});
   }catch{fail(phase==='admission'?'BROWSER_ARTIFACT_ADMISSION_REFUSED':'BROWSER_ARTIFACT_AUTHORITY');}};
   await fresh('admission');
   const ack=await service.ingest({binding:context.binding,scopes:context.scopes,filename:q.filename,
    format:q.format,mimeType:q.mimeType,bytes,sha256:contentSha,idempotencyKey:q.idempotencyKey,
    source:{kind:'browser-download',origin:q.origin,urlHost:new URL(q.origin).hostname,
     acquiredAtMs:now(),policySha256:q.policySha256}},context,{signal:life});
   await fresh('release');
   if(typeof ack?.versionId!=='string'||ack.sha256!==contentSha||ack.bytes!==bytes.length)fail('BROWSER_ARTIFACT_ACK');
   return ack;
  },
 });
}
