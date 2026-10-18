/** ACTUAL intent journal store + command proposal reader (dot item 4: Meri owns the approval-wait proposal reader) over the
 * scripted SQL pool. No DB, driver, Core or approval authority. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createPostgresIntentJournalStore,createPostgresCommandProposalReader} from '../postgres-journal.mjs';
import {createIntentJournal} from '../journal.mjs';
import {createPreparedSchedulePoolFixture} from './prepared-schedule-fixture.mjs';
import {fixture as commandFixture,NOW} from '../../test/commands-fixture.mjs';
import {createJournalProposalReader} from '../../../runtime/product-ports/lifecycle.mjs';
async function setup({state='PREPARED',mutate}={}){
 const f=commandFixture('task.create'),sql=createPreparedSchedulePoolFixture(),journal=createIntentJournal(createPostgresIntentJournalStore({pool:sql.pool}));
 const proposal=structuredClone(f.proposal),binding=proposal.command.binding,deliveryId='sdk:'+'c'.repeat(64);
 const record={operation:{id:'create_task',version:'0.2.0'},argumentsSha256:'d'.repeat(64)};
 const outcome={result:{status:'approval_required',proposal},release:{binding,scopes:proposal.command.scopes,expiresAtMs:NOW+60000}};
 await journal.begin({binding,deliveryId,record});
 if(state!=='PENDING')await journal.settle({binding,deliveryId,record,state:'PREPARED',outcome});
 if(mutate)mutate([...sql.state.rows.values()][0]);
 const selection={tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,proposalId:proposal.proposalId};
 return {f,sql,proposal,binding,selection,reader:createPostgresCommandProposalReader({pool:sql.pool})};
}
const unknown=p=>assert.rejects(p,e=>e?.code==='UNKNOWN');
test('reads the PREPARED command proposal only for its own tenant, actor and conversation, frozen and read-only',async()=>{
 const s=await setup(),p=await s.reader.readProposal(s.selection);
 assert.deepEqual(p,s.proposal);assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.command.binding));
 assert.equal(await s.reader.readProposal({...s.selection,actorId:'other-actor'}),null);
 assert.equal(await s.reader.readProposal({...s.selection,conversationId:'00000000-0000-4000-8000-000000000099'}),null);
 assert.equal(await s.reader.readProposal({...s.selection,tenantId:'other-tenant'}),null);
 assert.ok(s.sql.state.queries.filter(q=>q.sql.startsWith('BEGIN')).slice(-4).every(q=>q.sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));
});
test('pending custody is absent; tampered, rebound or ambiguous custody is refused, never disclosed',async()=>{
 // A PENDING delivery has no retained proposal yet: absent, not an approvable proposal.
 const pending=await setup({state:'PENDING'});assert.equal(await pending.reader.readProposal(pending.selection),null);
 const tampered=await setup({mutate:row=>{row.outcome.result.proposal.command.arguments.title='changed';}});await unknown(tampered.reader.readProposal(tampered.selection));
 const rebound=await setup({mutate:row=>{row.outcome.release.binding={...row.outcome.release.binding,writerFence:2};}});await unknown(rebound.reader.readProposal(rebound.selection));
 const twice=await setup();twice.sql.state.selectRows=(sql,params)=>{const row=[...twice.sql.state.rows.values()][0];return [structuredClone(row),structuredClone(row)];};await unknown(twice.reader.readProposal(twice.selection));
 await assert.rejects(twice.reader.readProposal({...twice.selection,proposalId:'not-a-uuid'}),e=>e?.code==='INVALID_ARGUMENTS');
 await assert.rejects(twice.reader.readProposal({...twice.selection,credential:'execution-token'}));
});
test('lifecycle approvals.read adapter: closed input (no credential), same run only',async()=>{
 const s=await setup(),read=createJournalProposalReader({pool:s.sql.pool});
 assert.equal(hash(await read({proposalId:s.proposal.proposalId,binding:s.binding,scopes:s.proposal.command.scopes})),hash(s.proposal));
 await assert.rejects(read({proposalId:s.proposal.proposalId,binding:s.binding,scopes:[],credential:'capiro-meri-execution+jwt'}),e=>e?.code==='APPROVAL_REFUSED');
 await assert.rejects(read({proposalId:s.proposal.proposalId,binding:{...s.binding,runId:'00000000-0000-4000-8000-000000000077'},scopes:[]}),e=>e?.code==='APPROVAL_REFUSED');
 await assert.rejects(read({proposalId:'00000000-0000-4000-8000-000000000078',binding:s.binding,scopes:[]}),e=>e?.code==='APPROVAL_REFUSED');
});
