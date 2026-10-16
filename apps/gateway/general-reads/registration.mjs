/** Canonical read references for family composition, with no registry of duplicate operation definitions. */
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {types} from 'node:util';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {ownFields} from '../sources/source-admission.mjs';
import {deny} from '../dispatch/operation-result.mjs';
export function familyOperations(family){
 return catalog.operations.filter(d=>d.sideEffect==='none'&&d.approvalBoundary==='none'&&
  resolveOperationContract(d.operation).binding?.group===family).map(d=>Object.freeze({...d.operation}));
}
/** A family is installable only as its exact canonical set; no partial or foreign handlers. */
export function assertFamilyHandlerSet(family,values){
 try{
  const expected=new Set(familyOperations(family).map(operation=>canonicalSha256(operation))),seen=new Set();
  if(expected.size===0||!Array.isArray(values)||types.isProxy(values)||values.length!==expected.size)deny('GATEWAY_CONFIGURATION');
  for(const value of values){
   const row=ownFields(value,['operation','execute']),operation=ownFields(row.operation,['id','version']),key=canonicalSha256(operation);
   if(typeof row.execute!=='function'||types.isProxy(row.execute)||!expected.has(key)||seen.has(key))deny('GATEWAY_CONFIGURATION');
   seen.add(key);
  }
  return values;
 }catch{deny('GATEWAY_CONFIGURATION');}
}
