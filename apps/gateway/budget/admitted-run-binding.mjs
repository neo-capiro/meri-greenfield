/** Closed configured admission identities; no credential minting or activation. */
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {allocation,parseToolGrantFacts,same} from './tool-budget-binding.mjs';
import {refuse} from './postgres-budget-store.mjs';
export function admittedConfiguration(value){
 const c=own(value,['pool','allocationJson','grantFactsJsons','now','limits']);
 const limits=data(own(c.limits,['maxRequestMs','maxFactBytes']));
 if(!c.pool||typeof c.pool.connect!=='function'||typeof c.now!=='function'||!Number.isSafeInteger(limits.maxRequestMs)||limits.maxRequestMs<1||limits.maxRequestMs>30000||!Number.isSafeInteger(limits.maxFactBytes)||limits.maxFactBytes<1||limits.maxFactBytes>131072)refuse('ADMITTED_RUN_CONFIGURATION');
 const a=allocation(c.allocationJson),raw=data(c.grantFactsJsons);
 if(!Array.isArray(raw)||raw.length<1||raw.length>16)refuse('ADMITTED_RUN_CONFIGURATION');
 const facts=raw.map(text=>parseToolGrantFacts(text,a)),first=facts[0],seen=new Set();
 for(const f of facts){if(seen.has(f.grantId)||!same(f.binding,first.binding)||!same(f.qualificationBinding,first.qualificationBinding))refuse('ADMITTED_RUN_CONFIGURATION');seen.add(f.grantId);}
 if(Buffer.byteLength(JSON.stringify(facts))>limits.maxFactBytes)refuse('ADMITTED_RUN_CONFIGURATION');
 return {...c,limits,a,facts,binding:first.binding,policyRevision:first.qualificationBinding.policyRevision,allocationSha256:canonicalSha256(a)};
}
export function currentInput(binding,options){
 const b=data(binding),o=own(options,[],['signal']);nativeSignal(o.signal);validateShape('RunBinding',b);return {binding:b,signal:o.signal};
}
export function integer(value){
 if(typeof value==='string'&&/^(0|[1-9][0-9]*)$/.test(value))value=Number(value);
 if(!Number.isSafeInteger(value)||value<0)refuse('ADMITTED_RUN_STORED_VALUE');return value;
}
export function dbTime(value){if(!(value instanceof Date)||!Number.isSafeInteger(value.getTime()))refuse('ADMITTED_RUN_STORED_VALUE');return value.getTime();}
export function assertRun(row,f){
 const q=f.qualificationBinding;
 if(!row||row.run_id!==q.runId||row.attempt!==q.attempt||row.worker_arn!==q.workerArn||row.fence!==q.fence||row.policy_revision!==q.policyRevision)refuse('ADMITTED_RUN_REFUSED');
}
