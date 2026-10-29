/** Source composition only: no listener or configuration activation. The caller
 * supplies the existing document options/session owners and self-hosted CODE. */
import {createRuntimeOfficeAccess} from './office-access.mjs';
import {types} from 'node:util';
import {borrowedRunSession} from '../../control/action-host/session/owner.mjs';
import {createAttendedOffice,attendedRequest,attendedIntent} from '../../artifacts/edit-sessions/attended.mjs';
import {createWopiFileApplication} from '../../artifacts/edit-sessions/wopi-files.mjs';
import {wopiRequest,wopiResponse,cancelWopiBody,refusalStatus} from '../../artifacts/edit-sessions/wopi-http.mjs';
export function createRuntimeOfficeApplication({optionsOwner,sessions,now,limits,drafts,codec,launch,generation}){
 const access=createRuntimeOfficeAccess({optionsOwner,sessions,now,limits}),borrow=borrowedRunSession(sessions);
 const attended=createAttendedOffice({drafts,launch,generation,now});
 if(typeof borrow!=='function'||typeof codec?.verify!=='function')throw Error('OFFICE_CONFIGURATION');
 return Object.freeze({
  async execute(route,value,{credential,deadlineMs,signal}){
   const input=attendedRequest(route,value);
   return access.run({credential,deadlineMs,signal,intent:attendedIntent(route,input),versionId:input.versionId},current=>attended.execute(route,input,current));
  },
  async handleWopi(request){
   try{
    const info=wopiRequest(request);let claims;
    try{claims=codec.verify(info.token,{fileId:info.fileId});}catch{return wopiResponse(401);}
    // Borrow only an existing native receipt. Full authentication and the signed
    // binding/client/scope comparison happen again inside the file application.
    const selected=borrow({binding:claims.runBinding,selectedClientId:claims.selectedClientId,signal:info.signal});
    return await access.run({credential:selected.credential,deadlineMs:Math.min(claims.expiresAtMs,selected.expiresAtMs),signal:info.signal,
     intent:claims.userCanWrite?'revise':'download',versionId:claims.versionId},async current=>{
      const files=createWopiFileApplication({codec,drafts,artifacts:current.artifacts,generation,now,
       resolveContext:async()=>{const state=await current.fresh();return {context:current.context,selectedClientId:state.selectedClientId,expiresAtMs:state.expiresAtMs,sessionSha256:state.sessionSha256};}});
      return files.handle(request);
     });
   }catch(error){
    const code=error&&typeof error==='object'&&!types.isProxy(error)?Object.getOwnPropertyDescriptor(error,'code')?.value:null;
    return wopiResponse(refusalStatus(error)??(['ACCESS_DENIED','SESSION_REFUSED','ARTIFACT_AUTHORITY','RETENTION_SUPPRESSED'].includes(code)?404:500));
   }
   finally{cancelWopiBody(request);}
  },
 });
}
