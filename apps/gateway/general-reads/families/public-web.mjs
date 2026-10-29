/** Discovery and untrusted page consultation retain their distinct native projections.
 * Discovery prefers the approved AWS managed web search MCP target when the deployment names one. */
import {createPublicWebHandlers} from '../../sources/public-web/handler.mjs';
import {createPrimaryWebSearch,primarySearchAdmission,primarySearchTarget} from '../../sources/public-web/primary-search.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {familyOperations} from '../registration.mjs';
export const id='public-web',sourceDirectory='public-web';
/** The endpoint is a deployment fact of the provisioned gateway target, never ambient settings discovery.
 * When it is named, the mounted provider must carry exactly the paid admission the budget owner reserves. */
const primary=configuration=>{
 const target=primarySearchTarget();
 if(target===undefined)return undefined;
 const admission=primarySearchAdmission(),value=createPrimaryWebSearch({...target,...(configuration.now===undefined?{}:{now:configuration.now})});
 if(admission===undefined||value.admission.unitMicroUsd!==admission.unitMicroUsd||value.admission.maxAttempts!==admission.maxAttempts||
    value.admission.provider!==admission.provider)deny('GATEWAY_CONFIGURATION');
 return value;
};
export const createHandlers=configuration=>createPublicWebHandlers(configuration,familyOperations(id),primary(configuration));
