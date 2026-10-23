/** Closed original-task transport facts. These facts never grant task authority. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
export const remoteFault=()=>Object.assign(Error('REMOTE_TASK_REFUSED'),{code:'REMOTE_TASK_REFUSED'});
export const executionFault=code=>Object.assign(Error('NATIVE_EXECUTION_'+code),{code:'NATIVE_EXECUTION_'+code});
const refuse=()=>{throw remoteFault();};
export function remoteOriginal(value){const v=data(own(value,['binding','executionKey','executionId','planSha256','expiresAtMs','versions']));validateShape('RunBinding',v.binding);validateShape('RuntimeVersions',v.versions);
 if(v.executionKey!==hash(v.binding)||v.executionId!==v.executionKey||!digest(v.planSha256)||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<1)refuse();return v;}
export const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
export function exactOriginal(value,original){const v=remoteOriginal(value);if(hash(v)!==hash(original))refuse();return v;}
