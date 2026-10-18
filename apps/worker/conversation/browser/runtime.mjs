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
export async function prepareBrowserRun({port,binding,cwd,deadlineMs,now,signal}){
 if(typeof port?.policy!=='function'||typeof now!=='function')throw fault('BROWSER_CONFIGURATION');
 const policy=await port.policy({binding:structuredClone(binding),signal});
 const fragment=createBrowserCapability({binding,cwd,policy,installation:port.installation,sourceScopes:port.sourceScopes,approvals:port.approvals,artifacts:port.artifacts,receipts:port.receipts,approvalDeadlineMs:port.approvalDeadlineMs,now});
 const lifecycle=createBrowserRunLifecycle({fragment,binding,cwd,egress:port.egress,processes:port.processes,now});
 if(fragment.activation==='open')await grantBrowserEgress({fragment,egress:port.egress,binding,deadlineMs,lifecycle,signal});
 return Object.freeze({fragment,status:fragment.status,settle:lifecycle.settle});
}
