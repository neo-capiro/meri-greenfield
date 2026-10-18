/** Exact Core routes for the seven selected-client signed reads. The gateway and
 * run delegation retain authorization, reservation, budget and token ownership. */
import {types} from 'node:util';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeReadConfiguration,nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {retainedOrigin} from '../../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {familyOperations} from '../../../gateway/general-reads/registration.mjs';
import {signedRetainedSourceOperation} from '../../../gateway/sources/retained-reads/signed-source-operations.mjs';

export const CLIENT_SCOPED_SOURCE_FAMILIES=Object.freeze(['client-knowledge-profile','client-documents','entity-candidates','tenant-contacts','meeting-source']);
const refuse=code=>{throw nativeReadFault(code);};

/** A task-local slice for exactly the retained families present in the reviewed
 * installation. Other retained families need their own genuine task ports. */
export function createClientScopedSourceTaskPorts(configuration){
 const c=own(configuration,['coreOrigin','fetchImpl'],['familyIds']);
 if(typeof c.fetchImpl!=='function'||types.isProxy(c.fetchImpl))refuse('CONFIGURATION');
 const families=c.familyIds===undefined?CLIENT_SCOPED_SOURCE_FAMILIES:c.familyIds;
 if(!Array.isArray(families)||!families.length||new Set(families).size!==families.length||families.some(family=>!CLIENT_SCOPED_SOURCE_FAMILIES.includes(family)))refuse('CONFIGURATION');
 const origin=retainedOrigin(c.coreOrigin),endpoints=Object.freeze(Object.fromEntries(families.map(family=>{
  const operations=familyOperations(family);
  if(!operations.length||operations.some(operation=>!signedRetainedSourceOperation(operation)))refuse('CONFIGURATION');
  return [family,Object.freeze(Object.fromEntries(operations.map(operation=>
   [operation.id,`${origin}/api/clio/tools/${operation.id}`])))];
 })));
 return function taskPorts(raw){
  const ports=own(raw,['task','getSignedSourceCredentials'],['getNativeCredential','getNativeCredentialWithExpiry','getServiceSecret']);
  if(typeof ports.getSignedSourceCredentials!=='function'||types.isProxy(ports.getSignedSourceCredentials))refuse('CONFIGURATION');
  // `task` is the reads composer's already validated task tuple. Do not widen
  // its authority or require unrelated task fields in this transport slice.
  const approved=assertNativeReadConfiguration(ports.task?.approvedReads);
  if(approved.enabled!==true)refuse('UNAVAILABLE');
  const transport=family=>Object.freeze({endpoints:endpoints[family],getCredentials:ports.getSignedSourceCredentials,
   fetchImpl:c.fetchImpl,maxRequestMs:approved.maxExecuteMs,maxResponseBytes:approved.maxResponseBytes});
  return Object.freeze({families:Object.freeze(Object.fromEntries(families.map(family=>[family,transport(family)])))});
 };
}
