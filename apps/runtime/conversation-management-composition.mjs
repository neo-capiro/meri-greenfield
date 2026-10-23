/** Trusted in-process bridge to Core's canonical metadata functions. No SQL, title cache, HTTP callback or purge owner. */
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {createConversationAdmissionGuard,createConversationManagementPort} from '../control/conversations/management.mjs';
import {fault} from './config.mjs';
import {conversationTrashProof} from '../control/retention/purge.mjs';
const unavailable=()=>{throw fault('CONVERSATION_MANAGEMENT_UNAVAILABLE');};

/** Deployment must co-locate these exact Core exports and its Prisma owner. A URL, serialized fence or alternate title store is not a port. */
export function createCoreConversationManagementOwner(options){
 const {prisma,core}=own(options,['prisma','core']);
 const read=storageMethod(core,'readManagedConversationMetadata'),owner=storageMethod(core,'readManagedConversationOwner'),manage=storageMethod(core,'manageConversation');
 if(typeof prisma?.withTenant!=='function')throw fault('CONVERSATION_MANAGEMENT_UNAVAILABLE');
 return Object.freeze({
  readMetadata({principal,conversationId}){return read(prisma,principal,conversationId);},
  ownerOf({tenantId,conversationId}){return owner(prisma,{tenantId,conversationId});},
  manage({principal,request},port){return manage(prisma,{tenantId:principal.tenantId,userId:principal.actorId},request,port);},
 });
}
/** Only the explicit bootstrap owner can authorize conversation retention. Other subject kinds need their existing owners. */
export function conversationManagementOwnership(owner){
 if(owner===undefined)return null;
 const read=storageMethod(owner,'ownerOf');
 return Object.freeze({async ownerOf(raw){
  const {tenantId,kind,subjectId}=own(raw,['tenantId','kind','subjectId']);
  if(kind!=='conversation')return unavailable();
  const actor=await read({tenantId,conversationId:subjectId});
  if(typeof actor!=='string'||!actor)return unavailable();return actor;
 }});
}
/** Candidate issuance is constructed before control's product factory. Before bind, after close, or without trusted owners, new work refuses. */
export function createConversationAdmissionRelay(){
 let target=null,closed=false,bound=false;
 return Object.freeze({
  async admit(...args){if(closed||target===null)return unavailable();return target(...args);},
  bind(composition){if(closed||bound)throw fault('CONVERSATION_MANAGEMENT_CONFIGURATION');
   target=storageMethod(composition,'admit');bound=true;},
  close(){closed=true;target=null;},
 });
}
export function createConversationManagementComposition({owner,store,retention}){
 const ready=owner!==undefined&&retention?.startup?.suppression!==null&&retention?.startup?.suppression!==undefined;
 const read=ready?storageMethod(owner,'readMetadata'):unavailable;
 const manage=ready?storageMethod(owner,'manage'):unavailable;
 const readMetadata=async input=>read(input);
 const admit=createConversationAdmissionGuard({readMetadata});
 const port=ready?createConversationManagementPort({store,suppression:retention.startup.suppression}):Object.freeze({withTerminalConversation:async()=>unavailable()});
 return Object.freeze({state:ready?'composed':'owners-unavailable',readMetadata,admit,port,
  manage(input){return manage(input,port);},
 });
}
/** Add the managed-Trash deadline to the shipping purger's existing facts. Unrelated retention purposes never consult this port. */
export function withManagedConversationTrashFacts({facts,owner}){
 const captured=Object.fromEntries(['policy','inventoryFor','sharedFor','holds','liabilities','lastActivityFor'].map(name=>[name,storageMethod(facts,name)]));
 const read=storageMethod(owner,'readMetadata'),readOwner=storageMethod(owner,'ownerOf');
 return Object.freeze({...captured,async conversationTrashFor(subject){
  const actorId=await readOwner({tenantId:subject.tenantId,conversationId:subject.subjectId});
  if(typeof actorId!=='string'||!actorId||subject.ownerActorId!==actorId)return unavailable();
  const row=await read({principal:{tenantId:subject.tenantId,actorId},conversationId:subject.subjectId});
  const proof=conversationTrashProof({tenantId:subject.tenantId,conversationId:row.conversationId,ownerActorId:actorId,
   scopeKind:row.scopeKind,clientId:row.clientId,status:row.status,revision:row.revision,trashedAt:row.trashedAt,restoreUntil:row.restoreUntil},subject);
  // A changed immutable binding/owner during the metadata read is never a usable purge proof.
  if(await readOwner({tenantId:subject.tenantId,conversationId:subject.subjectId})!==actorId)return unavailable();
  return proof;
 }});
}
