/** Private invocation boundary; canonical run identity is owned by control. */
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../packages/contracts/validate.mjs';
import {assertExecutionIdentity,isExecutionOutcome} from '../control/conversations/execution-boundary.mjs';
import {assertNativeReadConfiguration} from '../../packages/contracts/runtime-0.2/reads.mjs';

export const AGENTCORE_SESSION_HEADER='x-amzn-bedrock-agentcore-runtime-session-id';
export const AGENTCORE_INVOCATION_BYTES=131072;
export const agentcoreFault=code=>Object.assign(Error(code),{code});
export function invocationInput(value){
 const v=data(own(value,['execution','versions','credential'],['sourceEnabled','approvedReads','intents','browser']));
 assertExecutionIdentity(v.execution);validateShape('RuntimeVersions',v.versions);
 if(typeof v.credential!=='string'||! /^[A-Za-z0-9._~+\/-]{1,8192}={0,2}$/u.test(v.credential)||v.sourceEnabled!==undefined&&typeof v.sourceEnabled!=='boolean')throw agentcoreFault('AGENTCORE_REQUEST_REFUSED');
 if(v.approvedReads!==undefined)assertNativeReadConfiguration(v.approvedReads);
 for(const key of ['intents','browser'])if(v[key]!==undefined&&(!v[key]||typeof v[key]!=='object'||Object.keys(v[key]).length!==1||typeof v[key].enabled!=='boolean'))throw agentcoreFault('AGENTCORE_REQUEST_REFUSED');
 if(Buffer.byteLength(JSON.stringify(v))>AGENTCORE_INVOCATION_BYTES)throw agentcoreFault('AGENTCORE_REQUEST_REFUSED');return v;
}
export function settlementResult(value,execution){
 const v=data(own(value,['execution','state','settled']));
 assertExecutionIdentity(v.execution);
 if(hash(v.execution)!==hash(execution)||v.settled!==true||!isExecutionOutcome(v.state))throw agentcoreFault('AGENTCORE_RESULT_REFUSED');return v;
}
export function settlementFor(execution,state){return settlementResult({execution,state,settled:true},execution);}
