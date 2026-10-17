/** Pure native resource capture. The private owner and native inline domain gate retain current authority. */
import {snapshotOperationData} from '../../../../packages/contracts/retrieval-0.2/operation-contracts.mjs';
import {assertSubject,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {ownFields} from '../source-admission.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
const IDS=new Set(['get_business_development_context','get_business_development_recent_changes']);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;

export function captureBusinessDevelopmentResource(operation,request,subject){
 let reference,raw,selected;
 try{reference=ownFields(snapshotOperationData(operation),['id','version']);}catch{deny('INVALID_ARGUMENTS');}
 if(!IDS.has(reference.id)||reference.version!=='0.2.0')deny('UNAVAILABLE');
 try{raw=resolveOperationContract(reference).normalizeInput(request,{}).request;}catch{deny('INVALID_ARGUMENTS');}
 try{selected=snapshotOperationData(subject);assertSubject(selected);}catch{deny('ACCESS_DENIED');}
 if(!selected.scopes.length)deny('ACCESS_DENIED');
 if(selected.kind==='personal'){
  if(selected.scopes.some(scope=>!(scope.kind==='tenant'&&scope.resourceId===selected.tenantId||
   scope.kind==='private-user'&&scope.resourceId===selected.actorId)))deny('ACCESS_DENIED');
  // Native authorizeScope owns this actor's explicit conversation/prospect before content reads.
  return Object.freeze({conversationId:raw.conversationId.toLowerCase(),clientId:null});
 }
 if(selected.kind!=='client'||selected.entityType!=='client'||selected.entityIds.length!==1||
  !UUID.test(selected.entityIds[0]))deny('ACCESS_DENIED');
 const clientId=selected.entityIds[0].toLowerCase();
 if(selected.scopes.some(scope=>scope.kind!=='client'||scope.resourceId.toLowerCase()!==clientId))deny('ACCESS_DENIED');
 // Canonical input already requires the explicit Core UUID without trimming or coercion.
 return Object.freeze({conversationId:raw.conversationId.toLowerCase(),clientId});
}
