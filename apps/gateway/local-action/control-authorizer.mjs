/** Synthetic identity wrapper over the canonical lookup authorization composition. */
import {createCurrentToolAuthority} from '../authorization/current-tool-authority.mjs';
import {createTaskLookupAuthorizer,lookupAuthorizationFailure} from '../authorization/task-lookup-authorizer.mjs';
import {ownFields} from '../sources/source-admission.mjs';
import {deny} from '../dispatch/operation-result.mjs';
import {assertLocalActionIdentity} from './identity.mjs';
export function createLocalLookupAuthorizer(configuration){
 const {identity,credential,assertStoredBinding,now,maxFactBytes=65536}=ownFields(configuration,['identity','credential','assertStoredBinding','now'],['maxFactBytes']);
 assertLocalActionIdentity(identity);if(typeof credential!=='string'||typeof assertStoredBinding!=='function'||typeof now!=='function')deny('GATEWAY_CONFIGURATION');
 const authority=createCurrentToolAuthority({ports:identity.authorityPorts,now,maxFactBytes});
 return async call=>{
  try {
  const state=identity.status();
  return createTaskLookupAuthorizer({authority,credential,commandContext:{binding:state.binding,clientResolution:{reference:state.clientId,clientId:state.clientId}},scopes:state.scopes,assertStoredBinding,now})(call);
  } catch(error){throw lookupAuthorizationFailure(error);}
 };
}
