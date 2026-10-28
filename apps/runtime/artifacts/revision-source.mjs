/** Private selected-source read, using the document owner's current session/byte/retention checks.
 * No public route, model/tool loop, execution allocation or object write is introduced. */
import {types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertDocumentRevisionSelection} from '../../../packages/contracts/document-revision.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {createArtifactService} from '../../artifacts/service.mjs';
import {configuration as documentConfiguration,documentLimits,requestCurrent,method} from '../../control/document-application/current.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
export function createRuntimeDocumentRevisionSource(configuration){
 const c=own(configuration,['optionsOwner','sessions','now','limits'],['retention']),resolve=method(c.optionsOwner,'resolve'),limits=documentLimits(c.limits);
 if(typeof c.now!=='function'||types.isProxy(c.now))fail('ARTIFACT_RUNTIME_CONFIGURATION');
 return Object.freeze({async read(value){
  const q=own(value,['credential','selection','deadlineMs'],['signal']),selection=assertDocumentRevisionSelection(q.selection);
  const body={versionId:selection.versionId},intent='inspect',requestSha256=hash({intent,body});
  const at=c.now(),deadlineMs=Math.min(q.deadlineMs,at+limits.maxRequestMs);
  const life=createOperationLifetime({deadlineMs,now:c.now,signal:q.signal,errorFactory:code=>Object.assign(Error(code),{code})});
  try{
   const raw=await life.run(signal=>resolve({credential:q.credential,intent,body,requestSha256,deadlineMs,signal}));if(raw===null)fail('UNAVAILABLE');
   const resolved=own(raw,['documentOptions','recheck']),recheck=method(raw,'recheck');
   if(resolved.documentOptions.sessions!==c.sessions||resolved.documentOptions.now!==c.now)fail('ACCESS_DENIED');
   const config=documentConfiguration({...resolved.documentOptions,artifactOptions:{...resolved.documentOptions.artifactOptions,...(c.retention?{retention:c.retention}:{})}});
   if(!config.enabled)fail('UNAVAILABLE');life.limitDeadline(config.options.context.deadlineMs);
   const current=requestCurrent(config,{credential:q.credential},life,deadlineMs);
   const fresh=async phase=>{await life.run(signal=>recheck({phase,intent,requestSha256,resource:null,deadlineMs,signal}));await current.fresh();current.check();};
   await fresh('admission');
   const service=createArtifactService({...config.options,authorize:current.authorize}),context=config.options.context;
   const source=await life.run(signal=>service.revisionSource(selection.versionId,context,{signal}));
   if(source.version.artifactId!==selection.artifactId||source.version.object.sha256!==selection.objectSha256)fail('ACCESS_DENIED');
   const history=await life.run(signal=>service.history({versionId:selection.versionId,limit:1,cursor:null},context,{signal}));
   if(history.artifactId!==selection.artifactId)fail('ACCESS_DENIED');
   const result=data({...source,headVersionId:history.headVersionId});
   if(Buffer.byteLength(JSON.stringify(result))>Math.min(config.limits.maxResponseBytes,limits.maxResponseBytes))fail('UNAVAILABLE');
   await fresh('release');return result;
  }finally{life.close();}
 }});
}
