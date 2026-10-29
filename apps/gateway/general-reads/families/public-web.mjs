/** Discovery and untrusted page consultation retain their distinct native projections.
 * Discovery prefers the approved AWS managed web search MCP target when the deployment names one. */
import {createPublicWebHandlers} from '../../sources/public-web/handler.mjs';
import {createPrimaryWebSearch,primarySearchTarget} from '../../sources/public-web/primary-search.mjs';
import {familyOperations} from '../registration.mjs';
export const id='public-web',sourceDirectory='public-web';
/** The endpoint is a deployment fact of the provisioned gateway target, never ambient settings discovery. */
const primary=configuration=>{
 const target=primarySearchTarget();
 return target===undefined?undefined:createPrimaryWebSearch({...target,...(configuration.now===undefined?{}:{now:configuration.now})});
};
export const createHandlers=configuration=>createPublicWebHandlers(configuration,familyOperations(id),primary(configuration));
