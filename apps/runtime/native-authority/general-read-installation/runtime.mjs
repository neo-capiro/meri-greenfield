/** Two-phase CONTROL-only source composition. Existing qualification, policy and budget owners stay borrowed. */
import {types} from 'node:util';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {prepareGeneralReadFamilyHandlers,GENERAL_READ_ADAPTER_FAMILIES} from '../../../gateway/general-reads/integration.mjs';
import {NATIVE_READ_FAMILIES} from '../../../gateway/sources/retained-reads/native-families.mjs';
import {createPostgresConversationStore} from '../../../control/conversations/postgres-store.mjs';
import {familyReads} from '../../../worker/conversation/reads/availability.mjs';
import {createControlGeneralReadRuntime} from '../../general-read-runtime.mjs';
import {createNativeReadCredentialOwner} from '../native-read-credentials/owner.mjs';
import {refuse,synchronous,taskTuple,taskPorts as capturePorts} from './configuration.mjs';

const unavailable=()=>createControlGeneralReadRuntime();
const operationKey=operation=>`${operation.id}@${operation.version}`;
/** Runtime references are derived from the existing SDK policy and canonical constructors, never ledger counts. */
export function installationReadOperations(){return familyReads().filter(row=>GENERAL_READ_ADAPTER_FAMILIES.includes(row.family)).map(row=>Object.freeze({operation:Object.freeze({...row.operation}),family:row.family}));}

export async function prepareGeneralReadInstallation(configuration){
 const c=own(configuration,['familyIds','newId'],['taskPorts','sourceRoot']),ids=data(c.familyIds),rows=installationReadOperations(),supportedFamilies=new Set(rows.map(row=>row.family));
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!supportedFamilies.has(id))||typeof c.newId!=='function'||
  c.taskPorts!==undefined&&(typeof c.taskPorts!=='function'||types.isProxy(c.taskPorts)||types.isAsyncFunction(c.taskPorts)))refuse();
 const prepared=await prepareGeneralReadFamilyHandlers({familyIds:ids}),supported=new Set(rows.map(row=>operationKey(row.operation)));
 function createTask(raw){
  const tuple=taskTuple(raw);
  if(tuple.sourceEnabled!==true||!tuple.approvedReads.enabled||!c.taskPorts)return {gateway:unavailable(),handlers:new Map()};
  const ports=capturePorts(synchronous(c.taskPorts(Object.freeze({...raw}))),tuple);
  if(!ports)return {gateway:unavailable(),handlers:new Map()};
  const families=own(ports.families,[],ids),nativeIds=Object.keys(families).filter(id=>NATIVE_READ_FAMILIES.includes(id));let credentials;
  if(nativeIds.length){
   if(ports.nativeCredentials===undefined)return {gateway:unavailable(),handlers:new Map()};
   const n=own(ports.nativeCredentials,['coreAuthority','getNativeCredential','getServiceSecret'],['defaultCongress','getReadModeServiceSecret','toolCredential','stopSignal']);
   credentials=createNativeReadCredentialOwner({binding:tuple.binding,expiresAtMs:tuple.original.expiresAtMs,store:createPostgresConversationStore({pool:tuple.pool,now:tuple.now}),taskVerifier:tuple.taskVerifier,readCurrentEntry:tuple.readCurrentEntry,taskCapability:tuple.taskCapability,allocationJson:tuple.allocationJson,approvedReads:tuple.approvedReads,coreAuthority:n.coreAuthority,getNativeCredential:n.getNativeCredential,getServiceSecret:n.getServiceSecret,...(n.getReadModeServiceSecret===undefined?{}:{getReadModeServiceSecret:n.getReadModeServiceSecret}),...(n.defaultCongress===undefined?{}:{defaultCongress:n.defaultCongress}),...(n.toolCredential===undefined?{}:{toolCredential:n.toolCredential}),now:tuple.now,enabled:true});
   if(!credentials.available)return {gateway:unavailable(),handlers:new Map()};
  }
  const configured={};
  for(const [id,value] of Object.entries(families)){
   if(NATIVE_READ_FAMILIES.includes(id)){
    const transport=own(value,['origin'],['fetchImpl','maxRequestMs','maxResponseBytes']);
    if(transport.origin!==ports.nativeCredentials.coreAuthority.origin)refuse();
    configured[id]={...transport,credentialsForCall:credentials.credentialsForCall,...(id==='client-registry'?{authorizeResultForCall:credentials.authorizeResultForCall}:{})};
   }else configured[id]=value;
  }
  // A canonical family can retain source-only siblings. Only exact SDK-eligible operations enter installation.
  const handlers=new Map([...prepared.create({families:configured,now:tuple.now,newId:c.newId})].filter(([key])=>supported.has(key)));
  const gateway=createControlGeneralReadRuntime({...ports.gateway,...ports.contextPorts,pool:tuple.pool,allocationJson:tuple.allocationJson,scopes:tuple.scopes,handlers,catalogJson:JSON.stringify(catalog),contracts:{resolveOperationContract},now:tuple.now,newId:c.newId,...(credentials?{nativeReadContextPorts:credentials.nativeReadContextPorts}:{}),...(ports.nativeCredentials?.stopSignal===undefined?{}:{stopSignal:ports.nativeCredentials.stopSignal}),...(c.sourceRoot===undefined?{}:{sourceRoot:c.sourceRoot})});
  return {gateway,handlers};
 }
 return Object.freeze({createReadsRuntime:tuple=>createTask(tuple).gateway,createTaskHandlers:tuple=>createTask(tuple).handlers});
}
