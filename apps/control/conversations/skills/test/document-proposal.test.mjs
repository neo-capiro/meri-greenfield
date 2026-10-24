import test from 'node:test';
import assert from 'node:assert/strict';
import {createSelectedDocumentProposals} from '../document-proposal.mjs';
import {createIntentJournal} from '../../../intents/journal.mjs';
import {createPostgresApprovalMetadataStore} from '../../../commands/approval-metadata/postgres-store.mjs';
import {createMetadataPoolFixture} from '../../../commands/approval-metadata/test/fixture.mjs';
import {createCommitmentsAuditCompiler} from '../../../document-application/commitments-audit/compose.mjs';
import {createRelationshipBriefCompiler} from '../../../document-application/relationship-brief/compose.mjs';
import * as commitments from '../../../document-application/commitments-audit/test/fixtures.mjs';
import * as relationships from '../../../document-application/relationship-brief/test/fixtures.mjs';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';

export async function proposalFixture(kind='commitments'){
 const domain=kind==='commitments'?commitments:relationships,context=domain.unitContext(),selection=(kind==='commitments'?domain.selection:domain.selected)(context),reads=[];
 const compiler=(kind==='commitments'?createCommitmentsAuditCompiler:createRelationshipBriefCompiler)({now:()=>domain.NOW,defaultCongress:119,async readSource(call){const result=domain.sourcePage(call);reads.push({deliveryId:'compiler:'+hash({ordinal:reads.length,operation:call.operation,request:call.request}),operation:call.operation,request:call.request,resultSha256:hash(result),result});return result;}});
 const prepared=await compiler.prepare(domain.makeInput(),context,{selection}),request={requestId:domain.uid(901),prompt:'Selected research',skill:prepared.provenance.skill,window:selection.window,windowRequest:null};
 const sql=createMetadataPoolFixture(),rows=new Map(),state={now:domain.NOW,currentCalls:0,metadataCalls:0,deny:false,mutate:null,failMetadata:false,loseSettle:false};
 const store=createPostgresApprovalMetadataStore({pool:sql.pool}),metadataStore={read:store.read,async insert(...args){state.metadataCalls++;const r=await store.insert(...args);if(state.failMetadata)throw Error('lost metadata ACK');return r;}};
 const journal=createIntentJournal({async claim({key,record}){const k=hash(key),row=rows.get(k);if(row)return {claimed:false,entry:structuredClone(row)};rows.set(k,{record:structuredClone(record),state:'PENDING',outcome:null});return {claimed:true};},async settle({key,record,state:next,outcome}){const row=rows.get(hash(key));assert.equal(row.state,'PENDING');assert.equal(hash(row.record),hash(record));Object.assign(row,{state:next,outcome:structuredClone(outcome)});if(state.loseSettle)throw Error('lost journal ACK');return structuredClone(row);}});
 const readCurrent=async()=>{state.currentCalls++;if(state.deny)throw Error('current denied');const r={binding:context.binding,scopes:context.scopes,checkedAtMs:state.now,expiresAtMs:domain.NOW+60000};state.mutate?.(r);return r;};
 const config={journal,metadataStore,readCurrent,now:()=>state.now},call={prepared,binding:context.binding,request,selection,reads};
 return {state,rows,sql,context,call,config,owner:createSelectedDocumentProposals(config)};
}
for(const kind of ['commitments','relationships'])test(`${kind}: real compiler prepares one immutable native proposal and restart replays it`,async()=>{
 const f=await proposalFixture(kind),first=await f.owner.prepare(f.call),second=await createSelectedDocumentProposals(f.config).prepare(f.call);
 assert.deepEqual(second,first);assert.equal(first.command.action,'document.draft');assert.equal(first.command.contractVersion,'0.2.0');assert.equal(first.command.arguments.preparationSha256,hash(f.call.prepared));assert.deepEqual(first.command.binding,f.context.binding);assert.deepEqual(first.command.scopes,f.context.scopes);assert.equal(f.state.metadataCalls,1);assert.equal(f.sql.rows.size,1);assert.equal(f.rows.size,1);assert.equal([...f.rows.values()][0].state,'PREPARED');
 assert.equal(JSON.stringify(first).includes('budgetTicket'),false);assert.equal(JSON.stringify(first).includes('allocation'),false);
});
for(const kind of ['binding','scope','expired','stale'])test(`current ${kind} refusal precedes durable claim and metadata`,async()=>{
 const f=await proposalFixture();f.state.mutate=r=>{if(kind==='binding')r.binding={...r.binding,writerFence:2};if(kind==='scope')r.scopes=[];if(kind==='expired')r.expiresAtMs=f.state.now;if(kind==='stale')r.checkedAtMs--;};
 await assert.rejects(f.owner.prepare(f.call),/CURRENT/);assert.equal(f.rows.size,0);assert.equal(f.state.metadataCalls,0);
});
test('copied compiler object or changed selected skill cannot create metadata',async()=>{
 const f=await proposalFixture();await assert.rejects(f.owner.prepare({...f.call,prepared:structuredClone(f.call.prepared)}));await assert.rejects(f.owner.prepare({...f.call,request:{...f.call.request,skill:{...f.call.request.skill,skillVersion:'2.0.0'}}}));assert.equal(f.rows.size,0);
});
test('lost metadata acknowledgement leaves unknown and never prepares again',async()=>{
 const f=await proposalFixture();f.state.failMetadata=true;await assert.rejects(f.owner.prepare(f.call),/UNKNOWN/);f.state.failMetadata=false;await assert.rejects(f.owner.prepare(f.call),/UNKNOWN/);assert.equal(f.state.metadataCalls,1);assert.equal(f.sql.rows.size,1);assert.equal([...f.rows.values()][0].state,'UNKNOWN');
});
test('lost successful journal acknowledgement replays the exact stored proposal without metadata replay',async()=>{
 const f=await proposalFixture();f.state.loseSettle=true;await assert.rejects(f.owner.prepare(f.call),/UNKNOWN/);f.state.loseSettle=false;const p=await f.owner.prepare(f.call);assert.equal(p.command.action,'document.draft');assert.equal(f.state.metadataCalls,1);
});
test('revoked current access blocks retained proposal release',async()=>{
 const f=await proposalFixture();await f.owner.prepare(f.call);f.state.deny=true;await assert.rejects(f.owner.prepare(f.call));assert.equal(f.state.metadataCalls,1);
});
test('corrupt retained proposal or release binding is refused without a replacement',async()=>{
 for(const change of [e=>e.outcome.result.proposal.command.arguments.title='forged',e=>e.outcome.release.binding.writerFence++]){const f=await proposalFixture();await f.owner.prepare(f.call);change([...f.rows.values()][0]);await assert.rejects(f.owner.prepare(f.call));assert.equal(f.state.metadataCalls,1);}
});
test('cancellation before preparation never claims or stores',async()=>{
 const f=await proposalFixture(),controller=new AbortController();controller.abort();await assert.rejects(f.owner.prepare({...f.call,signal:controller.signal}));assert.equal(f.rows.size,0);assert.equal(f.state.metadataCalls,0);
});
