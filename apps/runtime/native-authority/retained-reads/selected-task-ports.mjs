/** Task-local composition for the retained families with concrete selected-client
 * or immutable-local source ports. The installation chooses exact family ids;
 * this module never widens its approved operation set. */
import {types} from 'node:util';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {CLIENT_SCOPED_SOURCE_FAMILIES,createClientScopedSourceTaskPorts} from './client-scoped-source-task-ports.mjs';
import {createOperationalTaskPorts} from './operational-task-ports.mjs';
import {datasetMetadataTaskPort} from './dataset-metadata-port.mjs';

export {CLIENT_SCOPED_SOURCE_FAMILIES};
export const COMPOSABLE_RETAINED_FAMILIES=Object.freeze([
 ...CLIENT_SCOPED_SOURCE_FAMILIES,'action-items-complete','operational-reads','dataset-metadata']);
const refuse=()=>{throw nativeReadFault('CONFIGURATION');};

export function createSelectedRetainedTaskPorts(configuration){
 const c=own(configuration,['familyIds'],['coreOrigin','fetchImpl','now','operationRefs']);
 const ids=data(c.familyIds);
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||
  ids.some(id=>!COMPOSABLE_RETAINED_FAMILIES.includes(id)))refuse();
 const signedIds=ids.filter(id=>CLIENT_SCOPED_SOURCE_FAMILIES.includes(id));
 const operationalIds=ids.filter(id=>id==='action-items-complete'||id==='operational-reads');
 if(ids.includes('operational-reads')){
  const refs=data(c.operationRefs);
  if(!Array.isArray(refs)||!refs.some(ref=>ref.id==='query_action_items'&&ref.version==='0.2.0')||
   refs.some(ref=>ref.id==='query_tasks'))refuse();
 }
 if((signedIds.length||operationalIds.length)&&(typeof c.fetchImpl!=='function'||types.isProxy(c.fetchImpl)))refuse();
 const signed=signedIds.length?createClientScopedSourceTaskPorts({coreOrigin:c.coreOrigin,fetchImpl:c.fetchImpl,familyIds:signedIds}):null;
 const operational=operationalIds.length?createOperationalTaskPorts({coreOrigin:c.coreOrigin,fetchImpl:c.fetchImpl,now:c.now,enabled:true,
  familyIds:operationalIds}):null;
 return function retainedTaskPorts(raw){
  const p=own(raw,['task'],['getNativeCredential','getNativeCredentialWithExpiry','getSignedSourceCredentials','getServiceSecret','getToolCredential']);
  const families={
   ...(signed?signed({task:p.task,getSignedSourceCredentials:p.getSignedSourceCredentials,
    ...(p.getNativeCredential===undefined?{}:{getNativeCredential:p.getNativeCredential}),
    ...(p.getNativeCredentialWithExpiry===undefined?{}:{getNativeCredentialWithExpiry:p.getNativeCredentialWithExpiry}),
    ...(p.getServiceSecret===undefined?{}:{getServiceSecret:p.getServiceSecret})}).families:{}),
   ...(operational?operational({task:p.task,getNativeCredentialWithExpiry:p.getNativeCredentialWithExpiry,
    getServiceSecret:p.getServiceSecret,...(p.getNativeCredential===undefined?{}:{getNativeCredential:p.getNativeCredential}),
    ...(p.getToolCredential===undefined?{}:{getToolCredential:p.getToolCredential}),
    ...(p.getSignedSourceCredentials===undefined?{}:{getSignedSourceCredentials:p.getSignedSourceCredentials})}).families:{}),
   ...(ids.includes('dataset-metadata')?{'dataset-metadata':datasetMetadataTaskPort()}:{}),
  };
  return Object.freeze({families:Object.freeze(Object.fromEntries(ids.map(id=>[id,families[id]])))});
 };
}
