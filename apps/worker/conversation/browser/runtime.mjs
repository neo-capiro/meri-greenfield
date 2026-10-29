/** Activity-facing browser preparation for one conversation run: obtains the run's effective policy from the trusted
 * control owner, builds the fragment through the activation gate (`createBrowserCapability`), grants the run's egress
 * at the host control when the fragment is open, and returns the run's cleanup. Nothing is launched here: the SDK
 * starts the MCP process when the query starts.
 *
 * `port` is the trusted browser runtime (never run data): `policy({binding,signal})` returns the effective
 * `resolveBrowserPolicy` result for this run's actor; `installation`, `sourceScopes`, `approvals`, `artifacts`,
 * `receipts` are the fragment's ports; `egress.grant(grant,{signal})` installs the run's grant at the host control
 * and resolves `{granted:true,policySha256}`; `egress.revoke` and `processes.waitForExit` serve the cleanup
 * (`lifecycle.mjs`). A failure after the grant was attempted settles the cleanup before rethrowing. */
import {createBrowserCapability} from './index.mjs';
import {createEgressGrant} from './egress-control.mjs';
import {createBrowserRunLifecycle} from './lifecycle.mjs';
import {prepareCurrentSiteWorkflow} from './site-workflows/current.mjs';
import {siteWorkflowEnablement} from './site-workflows/manifest.mjs';
const fault=code=>Object.assign(new Error(code),{code});
/** Installs the run's egress grant for an open fragment at the host control; on any failure settles the run's cleanup
 * (the grant may be partly installed) and rethrows. */
export async function grantBrowserEgress({fragment,egress,binding,deadlineMs,lifecycle,signal}){
 try{
  if(typeof egress?.grant!=='function')throw fault('BROWSER_CONFIGURATION');
  const grant=createEgressGrant({binding,policy:fragment.policy,expiresAtMs:deadlineMs});
  if(grant.policySha256!==fragment.policySha256)throw fault('BROWSER_EGRESS_GRANT_REFUSED');
  const ack=await egress.grant(grant,{signal});
  if(ack?.granted!==true||ack.policySha256!==grant.policySha256)throw fault('BROWSER_EGRESS_GRANT_REFUSED');
  return grant;
 }catch(error){
  // A grant may have reached the host even when its acknowledgement was lost. If revocation or process exit cannot
  // be verified, that unknown cleanup outcome must take precedence over the grant error so the caller fails the run
  // and destroys the disposable host. Keep the original grant failure as the cause for local diagnosis.
  try{await lifecycle.settle({outcome:'failed'});}
  catch(cleanupError){
   if(cleanupError instanceof Error&&cleanupError.cause===undefined)cleanupError.cause=error;
   throw cleanupError;
  }
  throw error;
 }
}
export async function prepareBrowserRun({port,binding,cwd,deadlineMs,now,signal,siteWorkflow,siteWorkflows}){
 if(typeof port?.policy!=='function'||typeof now!=='function')throw fault('BROWSER_CONFIGURATION');
 let policy=await port.policy({binding:structuredClone(binding),signal}),workflow;
 const createFragment=()=>createBrowserCapability({binding,cwd,policy,installation:port.installation,sourceScopes:port.sourceScopes,approvals:port.approvals,artifacts:port.artifacts,receipts:port.receipts,approvalDeadlineMs:port.approvalDeadlineMs,now,assertCurrent:workflow?.assertCurrent});
 let fragment=createFragment(),lifecycle=createBrowserRunLifecycle({fragment,binding,cwd,egress:port.egress,processes:port.processes,now});
 if(siteWorkflow!==undefined){
  try{
   workflow=await prepareCurrentSiteWorkflow({binding,selection:siteWorkflow,resolve:siteWorkflows?.resolve,policy,signal});
   const activation=siteWorkflowEnablement(workflow.configured.manifest,{current:workflow.configured});
   if(!activation.enabled)throw fault(activation.reasons[0]);
   policy=workflow.policy;fragment=createFragment();
   lifecycle=createBrowserRunLifecycle({fragment,binding,cwd,egress:port.egress,processes:port.processes,now});
  }catch(error){
   try{await lifecycle.settle({outcome:'failed'});}catch(cleanupError){if(cleanupError.cause===undefined)cleanupError.cause=error;throw cleanupError;}
   throw error;
  }
 }
 let session;
 if(fragment.activation==='open'){
  try{
   // No direct upstream-only MCP launch: an open browser requires the trusted
   // host's composed execution/output/control owner before exposing its shim.
   if(typeof port.sessions?.open!=='function')throw fault('BROWSER_SESSION_OWNER_REQUIRED');
   await grantBrowserEgress({fragment,egress:port.egress,binding,deadlineMs,lifecycle,signal});
   session=await port.sessions.open({binding:structuredClone(binding),policy:fragment.policy,deadlineMs,manifest:workflow?.configured.manifest??null});
   if(typeof session?.destroy!=='function'||JSON.stringify(session.mcpServers)!==JSON.stringify(fragment.mcpServers))throw fault('BROWSER_SESSION_OWNER_REQUIRED');
  }catch(error){
   try{await session?.destroy({trigger:'disconnect'});}finally{await lifecycle.settle({outcome:'failed'});}throw error;
  }
 }
 let settled;
 const settle=input=>settled??=(async()=>{let error;
  try{await session?.destroy({trigger:input?.outcome==='ended'?'conversation-end':'disconnect'});}catch(caught){error=caught;}
  const receipt=await lifecycle.settle(input);if(error)throw error;return receipt;
 })();
 return Object.freeze({fragment,status:fragment.status,settle});
}
