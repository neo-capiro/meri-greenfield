/** Request-local Office composition of the existing native session, Core artifact
 * options and immutable artifact owners. No credential store or new authority. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {authenticatedCurrentState} from '../../control/action-host/session/owner.mjs';
import {configuration,documentLimits,requestCurrent,method} from '../../control/document-application/current.mjs';
import {createArtifactService} from '../../artifacts/service.mjs';
import {createPostgresArtifactService} from '../../artifacts/postgres-service.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
export function createRuntimeOfficeAccess(value){
 const c=own(value,['optionsOwner','sessions','now','limits']),resolve=method(c.optionsOwner,'resolve'),limits=documentLimits(c.limits);
 const nativeCurrent=authenticatedCurrentState(c.sessions);
 if(typeof nativeCurrent!=='function'||typeof c.now!=='function')fail('OFFICE_CONFIGURATION');
 return Object.freeze({async run(value,work){
  const q=own(value,['credential','intent','versionId','deadlineMs'],['signal','selection']);
  if(!['revise','download','inspect','office-import'].includes(q.intent)||typeof work!=='function')fail('OFFICE_CONFIGURATION');
  const life=createOperationLifetime({now:c.now,signal:q.signal,deadlineMs:Math.min(q.deadlineMs,c.now()+limits.maxRequestMs),errorFactory:code=>Object.assign(Error(code),{code})});
  const owners=new Map();let initial;
  async function native(){
   const result=data(await life.run(signal=>nativeCurrent({credential:q.credential,signal,deadlineMs:life.deadline()})));
   const state=result.current,pin=hash({binding:state.binding,scopes:state.scopes,selectedClientId:state.selectedClientId,
    principal:result.authentication.principal,sessionRevision:result.authentication.sessionRevision});
   if(initial&&pin!==initial.pin)fail('ACCESS_DENIED');initial??={pin,state};life.limitDeadline(Math.min(state.expiresAtMs,result.authentication.expiresAtMs));
   return {...state,sessionSha256:hash({principal:result.authentication.principal,sessionRevision:result.authentication.sessionRevision})};
  }
  async function owner(action,versionId=q.versionId){
   const intent=action==='revise'?'office-edit':action,key=action+':'+versionId;
   if(owners.has(key))return owners.get(key);
   const body=intent==='office-import'?{selection:q.selection}:{versionId},requestSha256=hash({intent,body});
   const raw=await life.run(signal=>resolve({credential:q.credential,intent,body,requestSha256,deadlineMs:life.deadline(),signal}));
   if(raw===null)fail('UNAVAILABLE');const resolved=own(raw,['documentOptions','recheck']);
   if(resolved.documentOptions.sessions!==c.sessions||resolved.documentOptions.now!==c.now)fail('ACCESS_DENIED');
   const config=configuration(resolved.documentOptions),context=config.options.context;
   if(!config.enabled||!config.options.retention)fail('UNAVAILABLE');
   if(hash(context.binding)!==hash(initial.state.binding)||hash(context.scopes)!==hash(initial.state.scopes)||config.selectedClientId!==initial.state.selectedClientId)fail('ACCESS_DENIED');
   life.limitDeadline(context.deadlineMs);
   const current=requestCurrent(config,{credential:q.credential},life,life.deadline()),recheck=method(resolved,'recheck');
   const fresh=async phase=>{
    await life.run(signal=>recheck({phase,intent,requestSha256,resource:null,deadlineMs:life.deadline(),signal}));
    await current.fresh();current.check();
   };
   await fresh('admission');
   // Each actual source read/publication authorization refreshes Core, including
   // the artifact owner's last authorization after an awaited byte operation.
   const authorize=async call=>{await fresh('effect');return current.authorize(call);};
   const result={config,context,fresh,authorize,service:createArtifactService({...config.options,authorize})};owners.set(key,result);return result;
  }
  try{
   await native();const primary=await owner(q.intent);
   const context={...primary.context,deadlineMs:life.deadline()},selectedClientId=initial.state.selectedClientId;
   const fresh=async(phase='release')=>{for(const o of owners.values())await o.fresh(phase);return native();};
   const artifacts=Object.freeze({
    async editorSource(id,ctx,options){const o=await owner(options.write?'revise':'download',id);return o.service.editorSource(id,{...ctx,maxBytes:Math.min(ctx.maxBytes,o.context.maxBytes)},options);},
    async revisionSource(id,ctx,options){const o=await owner('inspect',id);return o.service.revisionSource(id,{...ctx,maxBytes:Math.min(ctx.maxBytes,o.context.maxBytes)},options);},
    async inspect(id,ctx,options){const o=await owner('inspect',id);return o.service.inspect(id,{...ctx,maxBytes:Math.min(ctx.maxBytes,o.context.maxBytes)},options);},
    async history(query,ctx,options){const o=await owner('inspect',query.versionId);return o.service.history(query,{...ctx,maxBytes:Math.min(ctx.maxBytes,o.context.maxBytes)},options);},
   });
   const publisherFor=(publicationContext,retained)=>{
    if(q.intent!=='revise')fail('ACCESS_DENIED');
    const {ids,authorizeOrigin,...options}=primary.config.options;
    const previous=options.admitRetainedEvidence;
    return createPostgresArtifactService({...options,context:publicationContext,authorize:primary.authorize,officeEditWrites:true,
     admitRetainedEvidence:value=>retained.admitRetainedEvidence(value)===undefined&&(previous===undefined||previous(value)===undefined)?undefined:1});
   };
   const originalPublisherFor=(publicationContext,assertOriginal)=>{
    if(q.intent!=='office-import'||typeof assertOriginal!=='function')fail('ACCESS_DENIED');
    const {ids,authorizeOrigin,...options}=primary.config.options;
    return createPostgresArtifactService({...options,context:publicationContext,officeOriginalWrites:true,
     authorize:async call=>{const receipt=await primary.authorize(call);await assertOriginal();return receipt;}});
   };
   const result=await work({context,selectedClientId,artifacts,publisherFor,originalPublisherFor,fresh,life,validators:primary.config.options.validators});
   // Callers with a generation fence perform their final release before return;
   // no new asynchronous work may follow that fence here.
   life.check();return result;
  }finally{life.close();}
 }});
}
