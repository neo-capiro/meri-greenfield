/** Shared inert source call admission, no authentication or resource allocation. */
import { types } from 'node:util';
import { snapshotOperationData } from '../../../packages/contracts/retrieval-0.2/operation-contracts.mjs';
import {assertSubject,resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import { deny } from '../dispatch/operation-result.mjs';

export function ownFields(value, required, optional=[]) {
  if (!value || typeof value!=='object' || types.isProxy(value) || Array.isArray(value) ||
      ![Object.prototype,null].includes(Object.getPrototypeOf(value))) deny('INVALID_ARGUMENTS');
  const descriptors=Object.getOwnPropertyDescriptors(value), names=Reflect.ownKeys(descriptors);
  if (names.some(key=>typeof key!=='string'||!required.concat(optional).includes(key)||
      !descriptors[key].enumerable||!Object.hasOwn(descriptors[key],'value'))||required.some(key=>!Object.hasOwn(descriptors,key))) deny('INVALID_ARGUMENTS');
  return Object.fromEntries(names.map(key=>[key,descriptors[key].value]));
}
export function frozenData(value) {
  const copied=snapshotOperationData(value), pending=[copied];
  while(pending.length){const item=pending.pop();if(item&&typeof item==='object'){pending.push(...Object.values(item));Object.freeze(item);}}
  return copied;
}

/** Inert correlation/limit validation for a control-composed source call. This is
 * not a permission decision: the source's existing Core receiver owns access. */
export function assertReadContext(value,operation,now){
  const a=frozenData(ownFields(value,['binding','subject','executionSha256','policyRevision','scopes','sourceIds','deadlineMs','maxOutputBytes']));
  try{validateShape('RunBinding',a.binding);assertSubject(a.subject,a.binding);}catch{deny('ACCESS_DENIED');}
  const contract=resolveOperationContract(operation),same=(x,y)=>canonicalSha256(x)===canonicalSha256(y);
  if(typeof a.executionSha256!=='string'||!/^[a-f0-9]{64}$/u.test(a.executionSha256)||
      typeof a.policyRevision!=='string'||!a.policyRevision||a.policyRevision!==a.subject.policyRevision||
      !Array.isArray(a.scopes)||!a.scopes.length||new Set(a.scopes.map(canonicalSha256)).size!==a.scopes.length||
      contract.descriptor.sideEffect!=='none'||contract.descriptor.approvalBoundary!=='none'||
      !Array.isArray(a.sourceIds)||!same([...a.sourceIds].sort(),[...new Set(contract.descriptor.sourceRequirements.map(s=>s.sourceId))].sort())||
      !Number.isSafeInteger(a.maxOutputBytes)||a.maxOutputBytes<1||a.maxOutputBytes>16777216)deny('ACCESS_DENIED');
  for(const scope of a.scopes){try{validateShape('Scope',scope);}catch{deny('ACCESS_DENIED');}
    if(scope.tenantId!==a.binding.tenantId||scope.policyRevision!==a.policyRevision)deny('ACCESS_DENIED');}
  // Mailbox labels are projected from the ordinary actor-owned Core inventory.
  // They are not execution grants; Core intersects them with current ownership.
  if(a.subject.scopes.some(scope=>!a.scopes.some(parent=>same(scope,parent))&&
      !(contract.binding.group==='mail'&&scope.kind==='mailbox')))deny('ACCESS_DENIED');
  if(!Number.isSafeInteger(a.deadlineMs)||!Number.isSafeInteger(now())||a.deadlineMs<=now())deny('DEADLINE');
  return a;
}
