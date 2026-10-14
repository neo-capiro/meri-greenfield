/** Canonical private native task receipt; no receipt grants task ownership. */
import {own,data,hash,validateShape,fail} from './boundary.mjs';
export function createExecutionBinding(configuration){const c=own(configuration,['binding','versions','plan','expiresAtMs']),binding=data(c.binding),versions=data(c.versions),plan=data(c.plan);validateShape('RunBinding',binding);validateShape('RuntimeVersions',versions);
 if(!Number.isSafeInteger(c.expiresAtMs)||c.expiresAtMs<1)fail('NATIVE_EXECUTION_CONFIGURATION');const executionKey=hash(binding);return data({binding,executionKey,executionId:executionKey,planSha256:hash({binding,versions,plan}),expiresAtMs:c.expiresAtMs,versions});}
export function assertNativeExecution(value,original){const v=data(value);own(v,['binding','executionId','planSha256','expiresAtMs','taskId','versions','state','physicalStopProven']);validateShape('RunBinding',v.binding);validateShape('RuntimeVersions',v.versions);
 if(hash(v.binding)!==hash(original.binding)||v.executionId!==original.executionId||v.planSha256!==original.planSha256||v.expiresAtMs!==original.expiresAtMs||
  typeof v.taskId!=='string'||!v.taskId||v.taskId.length>256||hash(v.versions)!==hash(original.versions)||!['executing','stopped'].includes(v.state)||typeof v.physicalStopProven!=='boolean'||v.state==='executing'&&v.physicalStopProven||v.state==='stopped'&&!v.physicalStopProven)fail('NATIVE_EXECUTION_NATIVE_REFUSED');return v;
}
