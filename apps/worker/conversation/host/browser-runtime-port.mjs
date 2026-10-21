/** Binding adapter for the existing browser runtime port. This module starts no process, proxy, timer or cloud work.
 * The caller owns all supplied ports and their cleanup. The policy function is a trusted current-policy reader, not
 * a policy record supplied by a worker. The egress service independently authenticates its host allocation and
 * policy/currentness lease, and actively closes tunnels on revocation or expiry. Shape checks here prove none of
 * that authority. Process observations, approvals and artifact receipts remain their canonical owners' evidence.
 *
 * Source-only: the production runner does not compose this adapter and the browser activation gate stays held. */
import {posix} from 'node:path';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../../../artifacts/storage/boundary.mjs';
import {validateBrowserPolicy} from '../browser/policy.mjs';
import {validateBrowserInstallation} from '../browser/server.mjs';
import {validateSourceScopes} from '../browser/downloads.mjs';
import {APPROVAL_DEADLINE_MS} from '../browser/permissions.mjs';
import {browserPaths} from '../browser/workspace.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const configuration=()=>fail('BROWSER_HOST_RUNTIME_CONFIGURATION');
/** Required trusted inputs: one canonical RunBinding/workspace, validated installation, a current policy reader,
 * an already-started egress service ({endpoint,grant,revoke}), a real process observer ({waitForExit}), and the
 * canonical approval/artifact/receipt/source-scope ports. No borrowed port is closed by this adapter. */
export function createBrowserHostRuntimePort(raw){
 let c,binding,installation,sourceScopes,readPolicy,grant,revoke,waitForExit,decide,ingest,record;
 try{
  c=own(raw,['binding','cwd','installation','policy','egress','processes','approvals','artifacts','receipts','sourceScopes'],['approvalDeadlineMs']);
  binding=data(c.binding);validateShape('RunBinding',binding);
  if(typeof c.cwd!=='string'||!posix.isAbsolute(c.cwd)||posix.resolve(c.cwd)!==c.cwd||c.cwd.includes('\0')||!c.cwd.endsWith('/'+binding.conversationId)||typeof c.policy!=='function')configuration();
  readPolicy=storageMethod(c,'policy');
  installation=validateBrowserInstallation(data(c.installation),binding);
  grant=storageMethod(c.egress,'grant');revoke=storageMethod(c.egress,'revoke');waitForExit=storageMethod(c.processes,'waitForExit');
  const endpoint=Object.getOwnPropertyDescriptor(c.egress,'endpoint');
  if(!endpoint||!Object.hasOwn(endpoint,'value')||endpoint.value!==installation.egressProxy)configuration();
  sourceScopes=data(validateSourceScopes(data(c.sourceScopes),binding));
  decide=storageMethod(c.approvals,'decide');ingest=storageMethod(c.artifacts,'ingest');record=storageMethod(c.receipts,'record');
  if(c.approvalDeadlineMs!==undefined&&(!Number.isSafeInteger(c.approvalDeadlineMs)||c.approvalDeadlineMs<APPROVAL_DEADLINE_MS.min||c.approvalDeadlineMs>APPROVAL_DEADLINE_MS.max))configuration();
 }catch{configuration();}
 const bindingSha256=canonicalSha256(binding),profile=browserPaths(c.cwd).profile;
 const assertBinding=rawBinding=>{
  let value;try{value=data(rawBinding);validateShape('RunBinding',value);}catch{fail('BROWSER_HOST_BINDING_REFUSED');}
  if(canonicalSha256(value)!==bindingSha256)fail('BROWSER_HOST_BINDING_REFUSED');return value;
 };
 const signalOf=options=>{
  let signal;try{({signal}=own(options??{},[],['signal']));nativeSignal(signal);}catch{fail('BROWSER_HOST_RUNTIME_INPUT');}
  if(signal?.aborted)fail('BROWSER_HOST_CANCELLED');return signal;
 };
 return Object.freeze({
  installation,sourceScopes,
  ...(c.approvalDeadlineMs===undefined?{}:{approvalDeadlineMs:c.approvalDeadlineMs}),
  async policy(request){
   const input=own(request,['binding'],['signal']),bound=assertBinding(input.binding),signal=signalOf({signal:input.signal});
   const value=await readPolicy({binding:bound,signal});
   signalOf({signal});
   if(value===undefined)fail('BROWSER_HOST_POLICY_UNAVAILABLE');
   return validateBrowserPolicy(data(value));
  },
  egress:Object.freeze({
   async grant(request,options){const value=data(request);assertBinding(value.binding);const signal=signalOf(options);return grant(value,{signal});},
   async revoke(request,options){const value=data(own(request,['binding','policySha256']));assertBinding(value.binding);const signal=signalOf(options);return revoke(value,{signal});},
  }),
  processes:Object.freeze({async waitForExit(request,options){
   const value=data(own(request,['binding','profile']));assertBinding(value.binding);
   if(value.profile!==profile)fail('BROWSER_HOST_PROCESS_PROFILE_REFUSED');
   const signal=signalOf(options);return waitForExit(value,{signal});
  }}),
  approvals:Object.freeze({decide}),artifacts:Object.freeze({ingest}),receipts:Object.freeze({record}),
 });
}
