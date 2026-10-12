/** Shared inert source call admission, no authentication or resource allocation. */
import { types } from 'node:util';
import { snapshotOperationData } from '../../../packages/contracts/retrieval-0.2/operation-contracts.mjs';
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
