/** Closed first-conversation bindings; compilation performs no IO or allocation. */
import {isAbsolute} from 'node:path';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {compileNativeBrokerPlan} from './native-authority/broker-stack.mjs';
import {createNativeTaskAllocator} from './native-authority/task-allocator.mjs';
import {runOwnerOperations} from '../../packages/contracts/runtime-0.2/validate.mjs';
import {compileNativeTaskAccess} from './native-authority/task-verifier.mjs';
import {allocation} from '../gateway/budget/tool-budget-binding.mjs';
import {createNativeAllocationAdmission} from '../gateway/budget/native-allocation-admission.mjs';
import {assertNativeReadConfiguration,nativeReadOperations} from '../../packages/contracts/runtime-0.2/reads.mjs';
const refuse=()=>{throw Error('PREPARED_CANDIDATE_CONFIGURATION');};
const file=value=>{if(typeof value!=='string'||!isAbsolute(value)||value.includes('/../')||value.length>4096)refuse();};
const origin=value=>{let u;try{u=new URL(value);}catch{refuse();}if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||u.origin!==value)refuse();};
export function compilePreparedCandidateConfiguration(value,versions){
 const c=data(own(value,['identity','runtime','proxyCredentialFile','plan','preparationIntent','allocationJson','qualification','grantIntents','grantId','operations','taskCapabilityFile','controlCapabilityFile','taskRequest','containerName','taskOrigin','taskHttp','objects'],['multiRun','approvedReads']));
 const reads=c.approvedReads===undefined?{}:{approvedReads:assertNativeReadConfiguration(c.approvedReads),operations:data([...new Set([...c.operations,...nativeReadOperations])])};
 // Multi-run mode (S2) is a closed declaration of reviewed static bounds; the durable issuer, capability authority and admission owners are
 // supplied as ports by startup, never named in configuration. Declaring it without those ports fails readiness instead of first-run fallback.
 if(c.multiRun!==undefined){const m=own(c.multiRun,['runWindowMs'],['materialDirectory','dynamicInitialRuns']);if(!Number.isSafeInteger(m.runWindowMs)||m.runWindowMs<60000||m.runWindowMs>86400000)refuse();if(m.materialDirectory!==undefined)file(m.materialDirectory);if(m.dynamicInitialRuns!==undefined&&(m.dynamicInitialRuns!==true||m.materialDirectory===undefined))refuse();}
 const i=own(c.identity,['origin','credentialFile','commandContext']);origin(i.origin);file(i.credentialFile);own(i.commandContext,['binding','clientResolution']);own(i.commandContext.clientResolution,['reference','clientId']);if(i.commandContext.clientResolution.reference!==i.commandContext.clientResolution.clientId)refuse();
 own(c.runtime,['binding','versions','proxyUrl','model','deadlineMs','maxTurns','maxCostMicroUSD','maxOutputBytes'],['sdkSessionKey']);
 const compiled=compileNativeBrokerPlan({runtime:{...c.runtime,proxyCredential:'configuration-validation-only'},plan:c.plan,preparationIntent:c.preparationIntent});
 if(hash(c.runtime.binding)!==hash(i.commandContext.binding)||hash(c.runtime.versions)!==hash(versions)||typeof c.allocationJson!=='string'||typeof c.containerName!=='string'||!/^[A-Za-z0-9_-]{1,255}$/u.test(c.containerName))refuse();
 // Adopted allocation/task-access parsers reject unknown contracts before startup.
 const a=allocation(c.allocationJson);if(c.runtime.maxTurns>a.budgets.maxTurns||c.runtime.maxCostMicroUSD>a.budgets.maxCostMicroUSD||c.runtime.maxOutputBytes>a.budgets.maxOutputBytes||c.runtime.deadlineMs>Date.parse(a.schedule.expiresAt))refuse();compileNativeTaskAccess({identityCredential:'configuration-validation-only',taskCapabilitySha256:'0'.repeat(64),operations:c.operations});
 for(const name of ['proxyCredentialFile','taskCapabilityFile','controlCapabilityFile'])file(c[name]);
 origin(c.taskOrigin);own(c.taskHttp,['hostname','port','frontendOrigin']);if(!['127.0.0.1','0.0.0.0','::1','::'].includes(c.taskHttp.hostname)||!Number.isSafeInteger(c.taskHttp.port)||c.taskHttp.port<1||c.taskHttp.port>65535)refuse();origin(c.taskHttp.frontendOrigin);if(c.taskHttp.frontendOrigin!==c.taskOrigin||Object.keys(runOwnerOperations).some(op=>!c.operations.includes(op)))refuse();
 const o=own(c.objects,['bucket','prefix','expectedBucketOwner','kmsKeyId']);if(!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(o.bucket)||!/^[A-Za-z0-9][A-Za-z0-9/_-]{0,127}$/u.test(o.prefix)||o.prefix.endsWith('/')||o.prefix.includes('//')||o.expectedBucketOwner!=='967807252336'||!/^arn:aws:kms:us-east-1:967807252336:key\/[a-f0-9-]{36}$/u.test(o.kmsKeyId))refuse();
 own(c.taskRequest,['cluster','taskDefinition','networkConfiguration','overrides']);
 if(!Array.isArray(c.grantIntents)||!c.grantIntents.length)refuse();
 const noEffect=()=>{};createNativeTaskAllocator({journal:{claim:noEffect,read:noEffect,record:noEffect},authority:{verify:noEffect},admission:{admit:noEffect,read:noEffect,revoke:noEffect},client:{send:noEffect},original:compiled.original,taskRequest:c.taskRequest,qualification:c.qualification,grantIntents:c.grantIntents,allocationSha256:hash(JSON.parse(c.allocationJson)),containerName:c.containerName});
 const scopes=[{kind:'client',tenantId:c.runtime.binding.tenantId,resourceId:i.commandContext.clientResolution.clientId,policyRevision:c.qualification.policyRevision}];if(c.preparationIntent.authoritySha256!==hash({scopes,selectedClientId:i.commandContext.clientResolution.clientId,policyRevision:c.qualification.policyRevision})||!c.grantIntents.some(g=>g.grantId===c.grantId)||c.grantIntents.some(g=>g.expiresAtMs<c.runtime.deadlineMs))refuse();
 createNativeAllocationAdmission({pool:{connect(){}},allocationJson:c.allocationJson,qualification:c.qualification,grantIntents:c.grantIntents,binding:c.runtime.binding,now:Date.now,limits:{maxRequestMs:3000,maxFactBytes:131072}});
 return Object.freeze({...c,...reads,preparationIntent:compiled.preparationIntent});
}
