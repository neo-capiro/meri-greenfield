/** Task-local composition for the retained families with concrete selected-client
 * or immutable-local source ports. The installation chooses exact family ids;
 * this module never widens its approved operation set. */
import {types} from 'node:util';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {CLIENT_SCOPED_SOURCE_FAMILIES,createClientScopedSourceTaskPorts} from './client-scoped-source-task-ports.mjs';
import {createOperationalTaskPorts} from './operational-task-ports.mjs';
import {datasetMetadataTaskPort} from './dataset-metadata-port.mjs';

export const COMPOSABLE_RETAINED_FAMILIES=Object.freeze([
 ...CLIENT_SCOPED_SOURCE_FAMILIES,'action-items-complete','dataset-metadata']);
const refuse=()=>{throw nativeReadFault('CONFIGURATION');};

export function createSelectedRetainedTaskPorts(configuration){
 const c=own(configuration,['familyIds'],['coreOrigin','fetchImpl','now']);
 const ids=data(c.familyIds);
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||
  ids.some(id=>!COMPOSABLE_RETAINED_FAMILIES.includes(id)))refuse();
 const signedIds=ids.filter(id=>CLIENT_SCOPED_SOURCE_FAMILIES.includes(id));
 const action=ids.includes('action-items-complete');
 if((signedIds.length||action)&&(typeof c.fetchImpl!=='function'||types.isProxy(c.fetchImpl)))refuse();
 const signed=signedIds.length?createClientScopedSourceTaskPorts({coreOrigin:c.coreOrigin,fetchImpl:c.fetchImpl,familyIds:signedIds}):null;
 const operational=action?createOperationalTaskPorts({coreOrigin:c.coreOrigin,fetchImpl:c.fetchImpl,now:c.now,enabled:true,
  familyIds:['action-items-complete']}):null;
 return function retainedTaskPorts(raw){
  const p=own(raw,['task'],['getNativeCredential','getNativeCredentialWithExpiry','getSignedSourceCredentials','getServiceSecret']);
  const families={
   ...(signed?signed({task:p.task,getSignedSourceCredentials:p.getSignedSourceCredentials,
    ...(p.getNativeCredential===undefined?{}:{getNativeCredential:p.getNativeCredential}),
    ...(p.getNativeCredentialWithExpiry===undefined?{}:{getNativeCredentialWithExpiry:p.getNativeCredentialWithExpiry}),
    ...(p.getServiceSecret===undefined?{}:{getServiceSecret:p.getServiceSecret})}).families:{}),
   ...(operational?operational({task:p.task,getNativeCredentialWithExpiry:p.getNativeCredentialWithExpiry,
    getServiceSecret:p.getServiceSecret,...(p.getNativeCredential===undefined?{}:{getNativeCredential:p.getNativeCredential})}).families:{}),
   ...(ids.includes('dataset-metadata')?{'dataset-metadata':datasetMetadataTaskPort()}:{}),
  };
  return Object.freeze({families:Object.freeze(Object.fromEntries(ids.map(id=>[id,families[id]])))});
 };
}
