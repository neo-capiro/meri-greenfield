/** Current Core configuration narrows this run; no positive answer is cached for tools. */
import {own,data} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertSiteWorkflowSelection} from '../../../../../packages/contracts/site-workflow-selection.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {validateSiteWorkflowManifest,siteWorkflowPolicy} from './manifest.mjs';
import {validateBrowserPolicy} from '../policy.mjs';
const refuse=()=>{throw Object.assign(Error('SITE_WORKFLOW_CURRENT_REFUSED'),{code:'SITE_WORKFLOW_CURRENT_REFUSED'});};
export async function prepareCurrentSiteWorkflow({binding,selection,resolve,policy,signal}){
 const pinned=assertSiteWorkflowSelection(selection);
 policy=validateBrowserPolicy(policy);
 if(typeof resolve!=='function')refuse();
 async function current({signal}={}){
  signal?.throwIfAborted();
  const answered=data(own(await resolve({binding:structuredClone(binding),signal}),['manifest','manifestSha256','enabled']));
  signal?.throwIfAborted();
  const m=validateSiteWorkflowManifest(answered.manifest,{platformMaximumOrigins:policy.allowedOrigins});
  if(answered.enabled!==true||m.siteId!==pinned.siteId||m.workflowId!==pinned.workflowId||m.version!==pinned.version||
    answered.manifestSha256!==pinned.manifestSha256||canonicalSha256(m)!==pinned.manifestSha256)refuse();
  return Object.freeze({...answered,manifest:m});
 }
 const configured=await current({signal}),narrowed=siteWorkflowPolicy(policy,configured.manifest);
 return Object.freeze({configured,policy:narrowed,async assertCurrent(options){await current(options);}});
}
