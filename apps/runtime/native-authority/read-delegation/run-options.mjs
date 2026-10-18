/** The run registry's end-of-run hook for option B (lane RD). `createReadDelegationRunOptions({stopRun})` wraps the composer's
 * `readDelegation.stopRun` so the prepared-run registry (`prepared-run-registry.mjs`, registered like `documentsRunOptions`)
 * can call it from every terminal path (retire → `run_terminal`, the stop route → `cancelled`, registry close → `fenced`) without
 * ever being blocked or failed by it: the delegation refuses locally and aborts in flight synchronously inside `stopRun`
 * (delegation.mjs `stop`), the Core revoke is best-effort with bounded retries, and a failure (or a reason outside
 * `STOP_REASONS`) is reported as one structured stderr event and swallowed. Nothing here holds a credential or a run. */
import {types} from 'node:util';
import {data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {nativeReadFailureCode} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
export const READ_DELEGATION_STOP_FAILED='runtime.read_delegation.stop_failed';
export const READ_DELEGATION_STOP_REASONS=Object.freeze(['run_terminal','cancelled','fenced','superseded']);
const refuse=()=>{throw Object.assign(Error('READ_DELEGATION_RUN_OPTIONS_CONFIGURATION'),{code:'READ_DELEGATION_RUN_OPTIONS_CONFIGURATION'});};
const ordinary=fn=>typeof fn==='function'&&!types.isProxy(fn);
const NOTHING=Object.freeze({stopped:false,revoked:false});
const defaultLog=event=>{process.stderr.write(JSON.stringify(event)+'\n');};
export function createReadDelegationRunOptions({stopRun,log=defaultLog}={}){
 if(!ordinary(stopRun)||!ordinary(log))refuse();
 const report=(binding,reason,error)=>{try{log({event:READ_DELEGATION_STOP_FAILED,reason,code:nativeReadFailureCode(error)??(typeof error?.code==='string'?error.code:'UNKNOWN'),
  ...(binding&&typeof binding==='object'?{runId:binding.runId,attemptId:binding.attemptId}:{})});}catch{}};
 /** Never throws, never rejects: `{stopped,revoked}` from the delegation, or `{stopped:false,revoked:false}` after a reported failure. */
 function stop({binding,reason}={}){
  let pending;
  try{pending=Promise.resolve(stopRun({binding,reason}));}catch(error){report(binding,reason,error);return Promise.resolve(NOTHING);}
  return pending.then(result=>{try{const r=data(result);if(typeof r?.stopped!=='boolean'||typeof r?.revoked!=='boolean')throw Error('RECEIPT');return Object.freeze({stopped:r.stopped,revoked:r.revoked});}catch(error){report(binding,reason,error);return NOTHING;}},
   error=>{report(binding,reason,error);return NOTHING;});
 }
 return Object.freeze({stopRun:stop});
}
