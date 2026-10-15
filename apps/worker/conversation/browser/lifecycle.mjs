/** Browser cleanup for one conversation run, run once on every lifecycle outcome (ended, failed, cancelled), after the
 * SDK query is closed. Order: revoke the run's egress grant at the host control, wait for the host to confirm the
 * Playwright MCP and browser processes have exited, then remove the profile, HOME and output directories and verify
 * their absence. The profile is never removed while its process may still run: an unconfirmed exit leaves it in
 * place and the outcome UNKNOWN for the D005 host destruction backstop. Every step is attempted that may be; any
 * failure rejects with BROWSER_CLEANUP_UNKNOWN carrying the partial receipt. Held or disabled fragments started no
 * process: their cleanup only verifies that no browser state exists. Bounded by its own deadline, independent of the
 * already aborted run signal. */
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {browserPaths,disposeBrowserState} from './workspace.mjs';
export const BROWSER_RUN_OUTCOMES=Object.freeze(['ended','failed','cancelled']);
export const BROWSER_CLEANUP_SCHEMA='meri-browser-cleanup/1';
/** Default and maximum cleanup budget; the drain hard limit (Q-T7) is the upper bound. */
export const BROWSER_CLEANUP_MS=Object.freeze({default:30000,max:130000});
const fault=(code,receipt)=>Object.assign(new Error(code),{code,...(receipt?{receipt}:{})});
/** Trusted host ports (open fragment only): `egress.revoke({binding,policySha256},{signal})` resolves `{revoked:true}`
 * and `processes.waitForExit({binding,profile},{signal})` resolves `{exited:true}` only when the host has observed
 * that no process of this run's browser remains. */
export function createBrowserRunLifecycle({fragment,binding,cwd,egress,processes,now,cleanupMs=BROWSER_CLEANUP_MS.default}){
 const open=fragment?.activation==='open';
 if(typeof now!=='function'||!Number.isSafeInteger(cleanupMs)||cleanupMs<1||cleanupMs>BROWSER_CLEANUP_MS.max||open&&(typeof egress?.revoke!=='function'||typeof processes?.waitForExit!=='function'||typeof fragment.dispose!=='function'))throw fault('BROWSER_CONFIGURATION');
 const paths=open?fragment.paths:browserPaths(cwd);
 let settled;
 async function run(outcome){
  const receipt={schema:BROWSER_CLEANUP_SCHEMA,binding:structuredClone(binding),outcome,activation:fragment?.activation??'not-applicable',egress:'not-applicable',process:'not-applicable',profile:'unknown'};
  const life=createOperationLifetime({deadlineMs:now()+cleanupMs,now,errorFactory:code=>fault(code)});
  const step=async(field,operation,accept)=>{try{receipt[field]=accept(await life.run(operation))?'done':'unknown';}catch{receipt[field]='unknown';}};
  try{
   if(open){
    await step('egress',signal=>egress.revoke({binding:structuredClone(binding),policySha256:fragment.policySha256},{signal}),r=>r?.revoked===true);
    await step('process',signal=>processes.waitForExit({binding:structuredClone(binding),profile:paths.profile},{signal}),r=>r?.exited===true);
    if(receipt.process==='done')await step('profile',signal=>fragment.dispose({signal}),r=>r?.disposed===true);
   }else await step('profile',signal=>disposeBrowserState(paths,{signal}),r=>r?.disposed===true);
  }finally{life.close();}
  const frozen=Object.freeze(receipt);
  if([receipt.egress,receipt.process,receipt.profile].includes('unknown'))throw fault('BROWSER_CLEANUP_UNKNOWN',frozen);
  return frozen;
 }
 return Object.freeze({
  /** Idempotent: the first outcome is the one cleaned up; later calls return the same settlement. */
  settle({outcome}={}){
   if(!BROWSER_RUN_OUTCOMES.includes(outcome))return Promise.reject(fault('BROWSER_CONFIGURATION'));
   settled??=run(outcome);return settled;
  }});
}
