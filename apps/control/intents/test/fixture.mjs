/** SYNTHETIC composition for intent tests. The real intent mount, journal and preparers run over the real command tool
 * interface, task.create approval-metadata owner, command executor (approval guard, command authority, journal, HTTP
 * source), schedule tool interface and artifact validators. Only the boundaries are synthetic: an in-memory journal
 * store, the scripted metadata/command SQL pools, a fake Fetch, a fixed clock and a stub artifact write port.
 * Nothing here is PostgreSQL, Temporal, S3, SDK or live-authority evidence. */
import {canonicalSha256,assertProposalIntegrity} from '../../../../packages/contracts/validate.mjs';
import {commandToolValidators} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createPostgresApprovalMetadataStore,createTaskCreateApprovalMetadataOwner} from '../../commands/approval-metadata/index.mjs';
import {createMetadataPoolFixture,createMetadataPolicyFixture} from '../../commands/approval-metadata/test/fixture.mjs';
import {createCommandToolInterface} from '../../commands/tool-interface.mjs';
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
   row.state=next;row.outcome=structuredClone(outcome);if(state.loseSettleAck){state.loseSettleAck=false;throw Error('synthetic lost settle ACK');}return structuredClone(row);}}};
}
/** A task.create composition: real metadata owner + real command interface/executor, approvals held by `approvals`. */
export function commandComposition({tenantId='tenant'}={}){
 const f=commandFixture('task.create');
 const binding={...f.binding,tenantId},scopes=f.scopes.map(s=>({...s,tenantId}));
 const commandContext={binding,clientResolution:null},sql=createMetadataPoolFixture(),metadataCalls={prepare:0};
 const policy=createMetadataPolicyFixture({binding,scopes,requiredApprover:{tenantId,actorId:'reviewer'},expiresAt:new Date(NOW+45000).toISOString(),now:()=>f.state.now});
 let n=100;const metadataOwner=createTaskCreateApprovalMetadataOwner({store:createPostgresApprovalMetadataStore({pool:sql.pool}),commandContext,preparePolicy:policy.preparePolicy,now:()=>f.state.now,newId:()=>id(n++)});
 const hooks={};
 const approvalMetadataOwner={async prepare(v){metadataCalls.prepare++;if(hooks.prepare)return hooks.prepare(v,metadataOwner);return metadataOwner.prepare(v);},read:v=>metadataOwner.read(v)};
 // The existing approval control's current decision store: nothing is approved until `approve(proposal)`.
 const approvals=new Map();
 const approvalStore={async getCurrent({proposalId}){const d=approvals.get(proposalId);if(!d)throw Error('no current approval');return JSON.stringify({decision:d,checkedAtMs:f.state.now,revoked:f.state.approvalRevoked});}};
 const approve=proposal=>approvals.set(proposal.proposalId,{proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision:'approved',decidedAt:proposal.createdAt,expiresAt:new Date(NOW+40000).toISOString(),approver:proposal.requiredApprover,policyRevision:'p1'});
 const commandOptions={operation:{id:'create_task',version:'0.2.0'},action:'task.create',outputShape:'TaskCreateToolResult',commandContext,validators:commandToolValidators,assertProposal:assertProposalIntegrity,
  approvalMetadataOwner,executor:f.create({approvalStore}),now:()=>f.state.now,limits:{maxRequestMs:1000,maxFactBytes:65536}};
 /** The existing approved-execution path (`executeApproved`) with an execution request for exactly this proposal. */
 const executeApproved=proposal=>createCommandToolInterface(commandOptions).executeApproved(proposal,{...f.execution,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey},'synthetic');
 return {f,binding,scopes,commandOptions,metadataCalls,hooks,sql,policy,approve,executeApproved,preparer:()=>createCommandIntentPreparer({commandOptions})};
}
export const delivery=n=>'sdk:'+String(n).padStart(64,'0');
/** @param {{binding:object,preparers:object[],store?:object,now?:()=>number,enabled?:boolean,scopes?:any[],resultRelease?:object}} c */
export function mount({binding,preparers,store=createMemoryJournalStore(),now=()=>NOW,enabled=true,scopes=commandFixture('task.create').scopes.map(s=>({...s,tenantId:binding.tenantId})),resultRelease}){
 // Synthetic current-authority boundary only; production must supply its canonical owner, never this fixture.
 const authority=resultRelease??{async check({selection,selectionSha256}){return {authorized:true,selectionSha256,binding:selection.binding,scopes,checkedAtMs:now(),expiresAtMs:NOW+60000};}};
 return {store,mount:createIntentMount({binding,preparers,journalStore:store.port,now,limits:{maxRequestMs:5000},enabled,resultRelease:authority})};
}
