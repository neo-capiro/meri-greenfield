// @ts-check
/**
 * Control-side procedure admission port (Wave5 MO01/ST16).
 *
 * Owns the Core service secret and the attended native credential, exactly like
 * apps/runtime/native-authority/conversation-source.mjs: the route is fixed, the secret is read per call, and the
 * credential borrowed for the exact binding/selected client must still be the same one after Core answers. The
 * resolver derives the conversation and the selected client from the run's own binding/client scope (never from the
 * selector) and refuses any answer that does not belong to precisely this selection, client and tenant.
 *
 * The worker's run-owner route /internal/conversations/procedure-resolve reaches this port through
 * apps/control/conversations/service.mjs procedureResolve(), which loads the persisted selection itself: no caller
 * can supply a selector, scope, budget or version as request authority.
 */
import {createProcedureCoreClient} from '../../control/conversations/procedures/core-client.mjs';
import {createProcedureResolver} from '../../control/conversations/procedures/resolver.mjs';
const fault=code=>Object.assign(Error('PROCEDURE_ADMISSION_'+code),{code:'PROCEDURE_ADMISSION_'+code});
export function createCoreProcedureAdmission(configuration){
 const {origin,getServiceSecret,nativeCredentials,now=Date.now,maxRequestMs,fetchImpl}=configuration??{};
 if(typeof origin!=='string'||typeof getServiceSecret!=='function'||typeof now!=='function')throw fault('CONFIGURATION');
 if(nativeCredentials===undefined||typeof nativeCredentials?.nativeCredentialFor!=='function')throw fault('CONFIGURATION');
 // An own function-valued property, so the Core client's descriptor check sees exactly one callable port.
 const credentialPort=Object.freeze({nativeCredentialFor:value=>nativeCredentials.nativeCredentialFor(value)});
 const core=createProcedureCoreClient({origin,getServiceSecret,now,nativeCredentialFor:credentialPort,
  ...(fetchImpl===undefined?{}:{fetchImpl}),...(maxRequestMs===undefined?{}:{maxRequestMs})});
 const resolver=createProcedureResolver({core,now});
 return Object.freeze({resolve:value=>resolver.resolve(value)});
}
