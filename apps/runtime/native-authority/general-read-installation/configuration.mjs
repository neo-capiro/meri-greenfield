/** Local correlation of existing admitted facts. Canonical admission/current verifiers retain authority. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../../packages/contracts/validate.mjs';
import {assertNativeReadConfiguration,nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {parseAdmittedGrantSet} from '../../../gateway/budget/admitted-run-binding.mjs';
import {matchesCapability} from '../task-verifier.mjs';
const same=(a,b)=>hash(a)===hash(b),digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
export const refuse=()=>{throw nativeReadFault('CONFIGURATION');};
export const synchronous=value=>{if(types.isPromise(value)){Promise.prototype.then.call(value,()=>{},()=>{});refuse();}return value;};
export function taskTuple(raw){
 const t=own(raw,['pool','binding','original','allocationJson','grantFactsJsons','grantId','taskArn','issuanceFactsSha256','runRequestSha256','scopes','readCurrentEntry','currentOwner','sourceEnabled','limits','now','taskVerifier','taskCapability','approvedReads'],['signal']);nativeSignal(t.signal);
 const binding=data(t.binding),scopes=data(t.scopes),original=data(t.original),approvedReads=assertNativeReadConfiguration(t.approvedReads),{allocation,facts}=parseAdmittedGrantSet(t),grant=facts.find(row=>row.grantId===t.grantId);
 validateShape('RunBinding',binding);if(!Array.isArray(scopes)||!scopes.length)refuse();scopes.forEach(scope=>validateShape('Scope',scope));
 if(!grant||!same(grant.binding,binding)||!same(original.binding,binding)||grant.qualificationBinding.workerArn!==t.taskArn||!matchesCapability(t.taskCapability,grant.capabilitySha256)||
  scopes.some(scope=>scope.tenantId!==binding.tenantId||scope.policyRevision!==grant.qualificationBinding.policyRevision)||!digest(t.issuanceFactsSha256)||!digest(t.runRequestSha256)||
  typeof t.now!=='function'||typeof t.readCurrentEntry!=='function'||!Number.isSafeInteger(original.expiresAtMs)||original.expiresAtMs<=t.now()||typeof t.sourceEnabled!=='boolean'||!t.pool||typeof t.pool.connect!=='function')refuse();
 return {...t,binding,scopes,original,approvedReads,allocation,grant};
}
export function taskPorts(raw,tuple){
 const c=own(synchronous(raw),['gateway','families'],['nativeCredentials','contextPorts']),g=own(c.gateway,[],['authority','limits','producerContext','producer','credential','readCurrentInstallation','discoveryOwner','namespace','sourceEnabled']);
 const required=['authority','limits','producerContext','producer','credential','readCurrentInstallation','discoveryOwner'];
 if(tuple.sourceEnabled!==true||!tuple.approvedReads.enabled||g.sourceEnabled!==true||required.some(key=>g[key]===undefined))return null;
 const context=data(g.producerContext),producer=data(own(g.producer,['namespace','executionId']));
 if(!same(context,tuple.grant)||g.credential!==tuple.taskCapability||!matchesCapability(g.credential,context.capabilitySha256)||producer.executionId!==tuple.original.executionId||typeof producer.namespace!=='string'||!producer.namespace)refuse();
 if(typeof g.readCurrentInstallation!=='function'||typeof g.authority.identify!=='function'||typeof g.authority.check!=='function'||typeof g.discoveryOwner.readDiscoveryGrant!=='function')refuse();
 return {...c,gateway:{...g,producerContext:context,producer},contextPorts:c.contextPorts===undefined?{}:own(c.contextPorts,[],['memoryContextPorts','mailContextPorts','retainedContextPorts'])};
}
