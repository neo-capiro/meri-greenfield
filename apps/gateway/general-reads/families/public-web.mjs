/** Discovery and untrusted page consultation retain their distinct native projections.
 * Discovery prefers the approved AWS managed web search MCP target when the deployment names one. */
import {createPublicWebHandlers} from '../../sources/public-web/handler.mjs';
import {createPrimaryWebSearch,primarySearchTarget} from '../../sources/public-web/primary-search.mjs';
import {familyOperations} from '../registration.mjs';
export const id='public-web',sourceDirectory='public-web';
/** The endpoint is a deployment fact of the provisioned gateway target, never ambient settings discovery.
 * The transport/credential boundary is bound once here, so the selected provider is the only paid call on
 * this path and tests can inject a recording fetch instead of resolving ambient AWS credentials. */
const primary=configuration=>{
 const target=primarySearchTarget();
 if(target===undefined)return undefined;
 return createPrimaryWebSearch({...target,...(configuration.now===undefined?{}:{now:configuration.now}),
  ...(configuration.fetchImpl===undefined?{}:{fetchImpl:configuration.fetchImpl}),
  ...(configuration.primaryCredentials===undefined?{}:{credentials:configuration.primaryCredentials})});
};
export const createHandlers=configuration=>{
 // Provider-only ports configure the managed search producer; the shared native/Core handler has a closed
 // allowlist and must never see them (nor may Core secrets be forwarded to managed search).
 const {primaryCredentials,...shared}=configuration??{};
 return createPublicWebHandlers(shared,familyOperations(id),primary({...shared,...(primaryCredentials===undefined?{}:{primaryCredentials})}));
};
