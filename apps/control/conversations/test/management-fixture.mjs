/** Actual SQL store and retention owners over scripted connections; Core is an
 * explicit synthetic metadata port. The separate Core suite owns its transactions. */
import {createPostgresConversationStore} from '../postgres-store.mjs';
import {initialInputFixture} from './initial-input-fixture.mjs';
import {binding,id,scopes} from './store-fixture.mjs';
import {MODEL_CATALOG} from '../../../../packages/contracts/test/model-selection-fixture.mjs';
import {createRetentionLedger,createMemoryLedgerSink} from '../../retention/ledger.mjs';
import {createMemoryRetentionJournal} from '../../retention/memory-journal.mjs';
import {createServingGate,createRecoveryReconciler} from '../../retention/reconciliation.mjs';
import {createSuppressionOwner} from '../../retention/suppression.mjs';
import {createConversationManagementService} from '../history/management.mjs';
import {MANAGEMENT_VERSION} from '../../../../packages/contracts/conversation-history/protocol.mjs';
import {ProductError} from '../../product-access/errors.mjs';
export {binding,id,scopes};
export const check=()=>{};
export async function managementFixture(){const f=initialInputFixture(),p=await f.proposal(),principal={tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[id(5)]};
 const metadata={conversationId:binding.conversationId,title:'Original',status:'active',revision:'0',scopeKind:'client',clientId:id(5),updatedAt:new Date(f.now()).toISOString(),archivedAt:null,trashedAt:null,restoreUntil:null};
 let current=metadata;const receipts=new Map(),faults={apply:null,read:null,afterApply:null},applies=[];
 const clone=v=>structuredClone(v),core={async metadata(){return clone(current);},async summaries(request){return {version:MANAGEMENT_VERSION,conversations:current.status===request.status?[clone(current)]:[],nextBefore:null};},
  async registration(){return {conversation:p.acceptance.conversation,recheckActive:async()=>{if(current.status!=='active')throw Error('Core inactive');}};},
  async read(q){await faults.read?.(q);const r=receipts.get(q.requestId);return {version:MANAGEMENT_VERSION,requestId:q.requestId,current:clone(current),receipt:r?.receipt??null,releaseRetention:Boolean(r?.suppressionRequestId&&current.status==='active'&&current.revision===r.receipt.conversation.revision),suppressionRequestId:r?.suppressionRequestId&&current.status==='active'&&current.revision===r.receipt.conversation.revision?r.suppressionRequestId:null};},
  async apply(q){applies.push(q.requestId);await faults.apply?.(q);if(receipts.has(q.requestId))return core.read(q);if(current.revision!==q.expectedRevision)throw new ProductError('CONVERSATION_MANAGEMENT_CONFLICT','NOT_DISPATCHED');
   const old=current,suppressionRequestId=q.operation==='restore'&&old.status==='trashed'?[...receipts].find(([,r])=>r.receipt.conversation.revision===old.revision)?.[0]??null:null;
   current={...current,revision:String(BigInt(current.revision)+1n)};
   if(q.operation==='trash')Object.assign(current,{status:'trashed',trashedAt:new Date(f.now()).toISOString(),restoreUntil:new Date(f.now()+30*86400000).toISOString()});
   else if(q.operation==='archive')Object.assign(current,{status:'archived',archivedAt:new Date(f.now()).toISOString()});
   else if(q.operation==='restore')Object.assign(current,{status:'active',archivedAt:null,trashedAt:null,restoreUntil:null});else current.title=q.title;
   receipts.set(q.requestId,{receipt:{version:MANAGEMENT_VERSION,requestId:q.requestId,conversation:clone(current)},suppressionRequestId});await faults.afterApply?.(q);return core.read(q);
  }};
 const assertConversationActive=async()=>{if(current.status!=='active')throw Error('Core inactive');};
 const store=createPostgresConversationStore({pool:f.pool,now:f.now,modelCatalog:MODEL_CATALOG,assertConversationActive});
 const sink=createMemoryLedgerSink(),ledger=createRetentionLedger({sink,now:f.now}),journal=createMemoryRetentionJournal(),serving=createServingGate(),ownership={async ownerOf({tenantId,subjectId}){return f.state.conversations.get(`${tenantId}:${subjectId}`)?.owner_actor_id??null;}};
 const suppression=createSuppressionOwner({ledger,journal,serving,ownership,now:f.now}),service=createConversationManagementService({store,suppression}),subject={tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId};
 const request=(operation,extra={})=>({version:MANAGEMENT_VERSION,requestId:id(80),conversationId:binding.conversationId,expectedRevision:current.revision,operation,...extra});
 return {...f,p,principal,store,core,applies,receipts,faults,sink,ledger,journal,serving,suppression,subject,request,service,get metadata(){return current;},setMetadata:v=>{current=v;},
  manage:q=>service.manage({principal,request:q,management:core}),register:()=>store.management.register({principal,conversation:p.acceptance.conversation,recheckActive:assertConversationActive},check),
  recover:()=>createRecoveryReconciler({ledger,journal,serving,now:f.now}).reconcile()};
}
