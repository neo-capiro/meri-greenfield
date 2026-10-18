// @ts-check
/** Which general reads appear in a run: the intersection of six gates over trusted inputs only
 * (FABLE-GENERAL-READ-TOOLS-20261015 §2.3). Model output, UI hints and repository flags never take part. Pure.
 *
 * 1. Contract: a catalog descriptor with `sideEffect:'none'` and `approvalBoundary:'none'`.
 * 2. Implemented and qualified: in the current native installation receipt (`installation.operations`).
 * 3. Capability policy: `generalReads` and the family in `readFamilies` (PROPOSAL P8 fields, resolved platform ∧
 *    tenant ∧ role by `capabilities/policy-resolution.mjs`).
 * 4. Actor and tenant eligibility: in the discovery grant (PROPOSAL P1).
 * 5. Client scope: a `required` family needs an authorized client scope on the run; none is implied.
 * 6. Exclusion: a deferred legacy original (the owner's never-implement list) is never registered.
 *
 * A selected skill narrows to its allowed operations; operations another server already exposes are excluded.
 * Gates 3 to 6 are coarse pre-filters: the gateway's full current-authority chain still runs on every call. */
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {sdkToolName} from '../skills/mcp.mjs';
import {READ_FAMILIES} from './families.mjs';
/** @typedef {{id:string,version:string}} OperationRef */
/** @typedef {{operation:OperationRef,family:string,descriptor:any}} AvailableRead */
const key=(/** @type {OperationRef} */op)=>canonicalSha256(op);
const among=(/** @type {readonly OperationRef[]} */list)=>{const keys=new Set(list.map(key));return (/** @type {OperationRef} */op)=>keys.has(key(op));};
/** Names the owner excluded, as recorded in the catalog originals (`disposition:'deferred'`). */
export const DEFERRED_ORIGINALS=Object.freeze(catalog.originals.filter(o=>o.disposition==='deferred').map(o=>o.id));
/** Catalog rows of the constructible families, in catalog order: `{operation, family, descriptor}`.
 * @param {Readonly<Record<string,import('./families.mjs').ReadFamily>>} [families] @returns {AvailableRead[]} */
export function familyReads(families=READ_FAMILIES){
 for(const [family,configuration] of Object.entries(families))if(configuration.operationIds!==undefined){
  const ids=configuration.operationIds;
  if(!Array.isArray(ids)||ids.length===0||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!catalog.operations.some(d=>d.operation.id===id&&d.sideEffect==='none'&&d.approvalBoundary==='none'&&resolveOperationContract(d.operation).binding?.group===family)))throw Error('READ_FAMILY_CONFIGURATION');
 }
 return catalog.operations.flatMap(descriptor=>{const family=resolveOperationContract(descriptor.operation).binding?.group;
  return typeof family==='string'&&Object.hasOwn(families,family)&&(!families[family].operationIds||families[family].operationIds.includes(descriptor.operation.id))?[{operation:descriptor.operation,family,descriptor}]:[];});
}
/** @param {{policy:{generalReads?:boolean,readFamilies?:readonly string[]},installation:{operations:readonly OperationRef[]},
 *  discovery:{operations:readonly OperationRef[]},scopes:readonly {kind:string}[],families?:Readonly<Record<string,import('./families.mjs').ReadFamily>>,
 *  narrowTo?:readonly OperationRef[],exclude?:readonly OperationRef[]}} input
 * @returns {{available:AvailableRead[],unavailable:string[]}} */
export function resolveAvailableReads({policy,installation,discovery,scopes,families=READ_FAMILIES,narrowTo,exclude=[]}){
 const installed=among(installation.operations),eligible=among(discovery.operations),excluded=among(exclude),narrowed=narrowTo===undefined?()=>true:among(narrowTo);
 const deferred=new Set(DEFERRED_ORIGINALS),client=scopes.some(s=>s.kind==='client');
 /** @type {AvailableRead[]} */const available=[];/** @type {string[]} */const unavailable=[];
 for(const row of familyReads(families)){
  const d=row.descriptor,family=families[row.family];
  const open=d.sideEffect==='none'&&d.approvalBoundary==='none'&&
   installed(row.operation)&&
   policy.generalReads===true&&(policy.readFamilies??[]).includes(row.family)&&
   eligible(row.operation)&&
   (client||family.clientScope!=='required'&&!family.requiredClientOperations?.includes(row.operation.id))&&
   !deferred.has(row.operation.id)&&!deferred.has(sdkToolName(row.operation))&&
   narrowed(row.operation)&&!excluded(row.operation);
  if(open)available.push(row);else if(!excluded(row.operation))unavailable.push(d.displayName);
 }
 return {available,unavailable};
}
/** G3: the reads a run's measured release profile mounts (`mount:'profile'` in runtime.mjs): the exact active operation allowlist,
 * contract, capability family policy, deferred exclusion, a selected skill's narrowing and operations another server exposes.
 * Per-run installation, discovery and client scope never widen the fixed tool list: resolveAvailableReads decides, per call,
 * which mounted read answers. An omitted active list mounts no reads.
 * Profile-mode runtime narrows resolveAvailableReads to this fixed set.
 * @param {{policy:{generalReads?:boolean,readFamilies?:readonly string[],activeReadOperations?:readonly OperationRef[]},families?:Readonly<Record<string,import('./families.mjs').ReadFamily>>,
 *  narrowTo?:readonly OperationRef[],exclude?:readonly OperationRef[]}} input @returns {AvailableRead[]} */
export function profileReads({policy,families=READ_FAMILIES,narrowTo,exclude=[]}){
 const excluded=among(exclude),narrowed=narrowTo===undefined?()=>true:among(narrowTo),active=among(policy.activeReadOperations??[]),deferred=new Set(DEFERRED_ORIGINALS);
 return familyReads(families).filter(row=>{const d=row.descriptor;return d.sideEffect==='none'&&d.approvalBoundary==='none'&&
  policy.generalReads===true&&(policy.readFamilies??[]).includes(row.family)&&!deferred.has(row.operation.id)&&!deferred.has(sdkToolName(row.operation))&&
  active(row.operation)&&narrowed(row.operation)&&!excluded(row.operation);});
}
