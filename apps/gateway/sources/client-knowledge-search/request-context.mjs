/** Semantic search selectors only; clock capture and current native visibility remain CONTROL-owned. */
import {assertSubject,resolveOperationContract,validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {ownFields,frozenData} from '../source-admission.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;

export function captureClientKnowledgeSearchSelection(operation,request){
 try{
  const reference=ownFields(frozenData(operation),['id','version']);
  if(reference.id!=='search_client_knowledge'||reference.version!=='0.2.0')deny('INVALID_ARGUMENTS');
  const contract=resolveOperationContract(reference),raw=frozenData(request);validateShape(contract.binding.input,raw);
  if(!raw.query.trim())deny('INVALID_ARGUMENTS');
  // Core preserves raw client truthiness. Never trim, clip, resolve names or insert the task client.
  if(!raw.clientId)return Object.freeze({clientId:null});
  if(!UUID.test(raw.clientId))deny('INVALID_ARGUMENTS');
  return Object.freeze({clientId:raw.clientId.toLowerCase()});
 }catch{deny('INVALID_ARGUMENTS');}
}

export function assertClientKnowledgeSearchSubject(subject,selection){
 try{
  const current=frozenData(subject),{clientId}=ownFields(frozenData(selection),['clientId']);assertSubject(current);
  if(clientId===null){
   // The native note reads no client/profile/embedding, but still needs a supported current task.
   if(current.kind==='personal')return;
   if(current.kind!=='client'||current.entityType!=='client'||current.entityIds.length!==1||!UUID.test(current.entityIds[0])||
    !current.scopes.some(scope=>scope.kind==='client'&&scope.resourceId.toLowerCase()===current.entityIds[0].toLowerCase())||
    current.scopes.some(scope=>scope.kind==='client'&&scope.resourceId.toLowerCase()!==current.entityIds[0].toLowerCase()))deny('ACCESS_DENIED');
   return;
  }
  if(typeof clientId!=='string'||!UUID.test(clientId)||clientId!==clientId.toLowerCase()||current.kind!=='client'||current.entityType!=='client'||current.entityIds.length!==1||
   current.entityIds[0].toLowerCase()!==clientId||!current.scopes.some(scope=>scope.kind==='client'&&scope.resourceId.toLowerCase()===clientId)||
   current.scopes.some(scope=>scope.kind==='client'&&scope.resourceId.toLowerCase()!==clientId))deny('ACCESS_DENIED');
 }catch{deny('ACCESS_DENIED');}
}
