/** Actual preparation/intent owners over synthetic metadata SQL and journal boundaries. No execution or source adapter. */
import {canonicalSha256,assertProposalIntegrity} from '../../../../packages/contracts/validate.mjs';
import {commandToolValidators} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createPostgresApprovalMetadataStore,createTaskCreateApprovalMetadataOwner,createTaskUpdateApprovalMetadataOwner} from '../../commands/approval-metadata/index.mjs';
import {assertTaskUpdateProposal} from '../../../../packages/contracts/commands-0.2/validate.mjs';
import {createMetadataPoolFixture,createMetadataPolicyFixture} from '../../commands/approval-metadata/test/fixture.mjs';
import {fixture as commandFixture,id,NOW} from '../../test/commands-fixture.mjs';
import {createIntentMount} from '../mount.mjs';
import {createCommandIntentPreparer} from '../command-preparer.mjs';
export {id,NOW,canonicalSha256};
/** SYNTHETIC in-memory journal store (`port`) with ACK-loss injection (`state.loseClaimAck`, `state.loseSettleAck`, `state.claimDown`). */
export function createMemoryJournalStore(){
 const rows=new Map(),state={claims:0,settles:0,loseClaimAck:false,loseSettleAck:false,claimDown:false};
 const k=key=>JSON.stringify([key.tenantId,key.actorId,key.conversationId,key.deliveryId]);
 return {rows,state,port:{
  async claim({key,record}){state.claims++;if(state.claimDown)throw Error('synthetic store unavailable');const at=k(key);
   if(rows.has(at))return {claimed:false,entry:structuredClone(rows.get(at))};
   rows.set(at,{record:structuredClone(record),state:'PENDING',outcome:null});if(state.loseClaimAck){state.loseClaimAck=false;throw Error('synthetic lost claim ACK');}return {claimed:true};},
  async settle({key,record,state:next,outcome}){state.settles++;const at=k(key),row=rows.get(at);
   if(!row||row.state!=='PENDING'||canonicalSha256(row.record)!==canonicalSha256(record))throw Error('synthetic settle refused');
   row.state=next;row.outcome=structuredClone(outcome);if(state.loseSettleAck){state.loseSettleAck=false;throw Error('synthetic lost settle ACK');}return structuredClone(row);},
  async read({key}){if(state.readDown)throw Error('synthetic store unavailable');const row=rows.get(k(key));return row?structuredClone({record:row.record,state:row.state,outcome:row.outcome}):null;},
  async list({conversation:c,after=null,limit}){if(state.readDown)throw Error('synthetic store unavailable');
   const mine=[...rows].map(([at,row])=>[JSON.parse(at),row]).filter(([[t,a,conv]])=>t===c.tenantId&&a===c.actorId&&conv===c.conversationId);
   const start=after===null?0:mine.findIndex(([[,,,d]])=>d===after)+1;if(after!==null&&start===0)throw Error('synthetic cursor refused');
   const page=mine.slice(start,start+limit).map(([[,,,deliveryId],row],i)=>structuredClone({deliveryId,createdAt:new Date(NOW+start+i).toISOString(),record:row.record,state:row.state,outcome:row.outcome}));
   return {entries:page,next:mine.length>start+limit?page.at(-1).deliveryId:null};},
  async listForActor({actor:a,after=null,limit}){if(state.readDown)throw Error('synthetic store unavailable');
   // Newest first: insertion order stands in for created_at, so the reverse of the map order is the page order.
   const mine=[...rows].map(([at,row])=>[JSON.parse(at),row]).filter(([[t,actor]])=>t===a.tenantId&&actor===a.actorId).reverse();
   const start=after===null?0:mine.findIndex(([[,,conv,d]])=>conv===after.conversationId&&d===after.deliveryId)+1;if(after!==null&&start===0)throw Error('synthetic cursor refused');
   const page=mine.slice(start,start+limit).map(([[,,conversationId,deliveryId],row],i)=>structuredClone({conversationId,deliveryId,createdAt:new Date(NOW-start-i).toISOString(),record:row.record,state:row.state,outcome:row.outcome}));
   const last=page.at(-1);return {entries:page,next:mine.length>start+limit?{conversationId:last.conversationId,deliveryId:last.deliveryId}:null};}}};
}
/** A task.create composition: real metadata owner + real prepare-only command interface. */
export function commandComposition({tenantId='tenant',action='task.create',approverActorId='reviewer'}={}){
 const f=commandFixture(action);
 const binding={...f.binding,tenantId},scopes=f.scopes.map(s=>({...s,tenantId}));
 const commandContext=action==='task.update'?{binding}:{binding,clientResolution:null},sql=createMetadataPoolFixture(),metadataCalls={prepare:0};
 const policy=createMetadataPolicyFixture({binding,scopes,requiredApprover:{tenantId,actorId:approverActorId},expiresAt:new Date(NOW+45000).toISOString(),now:()=>f.state.now});
 const factory=action==='task.update'?createTaskUpdateApprovalMetadataOwner:createTaskCreateApprovalMetadataOwner;
 let n=100;const metadataOwner=factory({store:createPostgresApprovalMetadataStore({pool:sql.pool}),commandContext,preparePolicy:policy.preparePolicy,now:()=>f.state.now,newId:()=>id(n++)});
 const hooks={};
 const approvalMetadataOwner={async prepare(v){metadataCalls.prepare++;if(hooks.prepare)return hooks.prepare(v,metadataOwner);return metadataOwner.prepare(v);},read:v=>metadataOwner.read(v)};
 const commandOptions={operation:{id:action==='task.update'?'update_task':'create_task',version:'0.2.0'},action,commandContext,validators:commandToolValidators,assertProposal:action==='task.update'?assertTaskUpdateProposal:assertProposalIntegrity,
  approvalMetadataOwner,now:()=>f.state.now,limits:{maxRequestMs:1000,maxFactBytes:65536}};
 return {f,binding,scopes,commandOptions,metadataCalls,hooks,sql,policy,preparer:()=>createCommandIntentPreparer({commandOptions})};
}
export const delivery=n=>'sdk:'+String(n).padStart(64,'0');
/** @param {{binding:object,preparers:object[],store?:object,now?:()=>number,enabled?:boolean,scopes?:any[],resultRelease?:object}} c */
export function mount({binding,preparers,store=createMemoryJournalStore(),now=()=>NOW,enabled=true,scopes=commandFixture('task.create').scopes.map(s=>({...s,tenantId:binding.tenantId})),resultRelease}){
 // Synthetic current-authority boundary only; production must supply its canonical owner, never this fixture.
 const authority=resultRelease??{async check({selection,selectionSha256}){return {authorized:true,selectionSha256,binding:selection.binding,scopes,checkedAtMs:now(),expiresAtMs:now()+60000};}};
 return {store,mount:createIntentMount({binding,preparers,journalStore:store.port,now,limits:{maxRequestMs:5000},enabled,resultRelease:authority})};
}
