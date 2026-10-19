/** Task-local composition for the retained families with concrete selected-client
 * or immutable-local source ports. The installation chooses exact family ids;
 * this module never widens its approved operation set. */
import {types} from 'node:util';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {CLIENT_SCOPED_SOURCE_FAMILIES,createClientScopedSourceTaskPorts} from './client-scoped-source-task-ports.mjs';
import {createOperationalTaskPorts} from './operational-task-ports.mjs';
import {MEMORY_TASK_FAMILIES,createMemoryTaskPorts} from './memory-task-ports.mjs';
import {datasetMetadataTaskPort} from './dataset-metadata-port.mjs';
import {RESEARCH_FLORIDA_TASK_FAMILIES,createResearchFloridaTaskPorts} from './research-florida-task-ports.mjs';
import {createMailMondayTaskPorts} from './mail-monday-task-ports.mjs';

export {CLIENT_SCOPED_SOURCE_FAMILIES};
export const COMPOSABLE_RETAINED_FAMILIES=Object.freeze([
 ...CLIENT_SCOPED_SOURCE_FAMILIES,...MEMORY_TASK_FAMILIES,
 ...RESEARCH_FLORIDA_TASK_FAMILIES,'client-knowledge-monday',
 'action-items-complete','operational-reads','dataset-metadata']);
export const DELEGATED_RETAINED_FAMILIES=Object.freeze([
 ...CLIENT_SCOPED_SOURCE_FAMILIES,...MEMORY_TASK_FAMILIES,'client-knowledge-monday',
 'action-items-complete','operational-reads']);
const refuse=()=>{throw nativeReadFault('CONFIGURATION');};

export function createSelectedRetainedTaskPorts(configuration){
 const c=own(configuration,['familyIds'],['coreOrigin','fetchImpl','now','operationRefs','memoryContextPortsForTask','retainedAuthority']);
 const ids=data(c.familyIds);
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||
  ids.some(id=>!COMPOSABLE_RETAINED_FAMILIES.includes(id)))refuse();
 const signedIds=ids.filter(id=>CLIENT_SCOPED_SOURCE_FAMILIES.includes(id));
 const memoryIds=ids.filter(id=>MEMORY_TASK_FAMILIES.includes(id));
 const operationalIds=ids.filter(id=>id==='action-items-complete'||id==='operational-reads');
 const researchIds=ids.filter(id=>RESEARCH_FLORIDA_TASK_FAMILIES.includes(id));
 const mondayIds=ids.filter(id=>id==='client-knowledge-monday');
 if(ids.includes('operational-reads')){
  const refs=data(c.operationRefs);
  if(!Array.isArray(refs)||!refs.some(ref=>['query_action_items','query_tasks'].includes(ref.id)&&ref.version==='0.2.0')||
   refs.some(ref=>['query_action_items','query_tasks'].includes(ref.id)&&ref.version!=='0.2.0'))refuse();
 }
 if((signedIds.length||memoryIds.length||operationalIds.length||researchIds.length||mondayIds.length)&&(typeof c.fetchImpl!=='function'||types.isProxy(c.fetchImpl)))refuse();
 const signed=signedIds.length?createClientScopedSourceTaskPorts({coreOrigin:c.coreOrigin,fetchImpl:c.fetchImpl,familyIds:signedIds}):null;
 const memory=memoryIds.length?createMemoryTaskPorts({coreOrigin:c.coreOrigin,fetchImpl:c.fetchImpl,now:c.now,
  familyIds:memoryIds,...(c.memoryContextPortsForTask===undefined?{}:{memoryContextPortsForTask:c.memoryContextPortsForTask})}):null;
 const operational=operationalIds.length?createOperationalTaskPorts({coreOrigin:c.coreOrigin,fetchImpl:c.fetchImpl,now:c.now,enabled:true,
  familyIds:operationalIds}):null;
 const research=researchIds.length?createResearchFloridaTaskPorts({coreOrigin:c.coreOrigin,fetchImpl:c.fetchImpl,now:c.now,
  familyIds:researchIds,enabled:true,...(c.retainedAuthority===undefined?{}:{retainedAuthority:c.retainedAuthority})}):null;
 const monday=mondayIds.length?createMailMondayTaskPorts({coreOrigin:c.coreOrigin,fetchImpl:c.fetchImpl,now:c.now,familyIds:mondayIds}):null;
 return function retainedTaskPorts(raw){
  const p=own(raw,['task'],['getNativeCredential','getNativeCredentialWithExpiry','getSignedSourceCredentials',
   'getMemoryEligibilityCredentials','getServiceSecret','getToolCredential','getAttendedCredentialWithExpiry']);
  const memoryPorts=memory?memory({task:p.task,getSignedSourceCredentials:p.getSignedSourceCredentials,
   ...(p.getMemoryEligibilityCredentials===undefined?{}:{getMemoryEligibilityCredentials:p.getMemoryEligibilityCredentials})}):null;
  const researchPorts=research?research({task:p.task,getNativeCredentialWithExpiry:p.getAttendedCredentialWithExpiry}):null;
  const families={
   ...(signed?signed({task:p.task,getSignedSourceCredentials:p.getSignedSourceCredentials,
    ...(p.getNativeCredential===undefined?{}:{getNativeCredential:p.getNativeCredential}),
    ...(p.getNativeCredentialWithExpiry===undefined?{}:{getNativeCredentialWithExpiry:p.getNativeCredentialWithExpiry}),
    ...(p.getServiceSecret===undefined?{}:{getServiceSecret:p.getServiceSecret})}).families:{}),
   ...(operational?operational({task:p.task,getNativeCredentialWithExpiry:p.getNativeCredentialWithExpiry,
    getServiceSecret:p.getServiceSecret,...(p.getNativeCredential===undefined?{}:{getNativeCredential:p.getNativeCredential}),
    ...(p.getToolCredential===undefined?{}:{getToolCredential:p.getToolCredential}),
    ...(p.getSignedSourceCredentials===undefined?{}:{getSignedSourceCredentials:p.getSignedSourceCredentials})}).families:{}),
   ...(memoryPorts?.families??{}),
   ...(researchPorts?.families??{}),
   ...(monday?monday({task:p.task,getSignedSourceCredentials:p.getSignedSourceCredentials}).families:{}),
   ...(ids.includes('dataset-metadata')?{'dataset-metadata':datasetMetadataTaskPort()}:{}),
  };
  return Object.freeze({families:Object.freeze(Object.fromEntries(ids.map(id=>[id,families[id]]))),
   ...(memoryPorts?.contextPorts||researchPorts?.contextPorts?{contextPorts:Object.freeze({...memoryPorts?.contextPorts,...researchPorts?.contextPorts})}:{})});
 };
}
