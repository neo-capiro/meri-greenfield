import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeSelectedComposition} from '../composition.mjs';
import {createPostgresConversationStore} from '../../../control/conversations/postgres-store.mjs';
import {createSelectedDocumentProposals} from '../../../control/conversations/skills/document-proposal.mjs';
import {createIntentJournal} from '../../../control/intents/journal.mjs';

const denied=()=>assert.fail('startup must not query, dispatch, or prepare a proposal');
test('selected startup composes the real intent journal without exposing its read facet to proposals',async()=>{
 const pool={query:denied,connect:denied,options:{connectionTimeoutMillis:25000,query_timeout:25000}};
 const selected=createNativeSelectedComposition({
  configuration:{agentcore:{approvedReads:{enabled:true}},reads:{defaultCongress:119},limits:{requestMs:25000}},
  pool,store:createPostgresConversationStore({pool}),execution:{authenticate:denied},
  createReadsRuntime:denied,serviceFor:denied,now:()=>1000,
 });
 try{assert.equal(typeof selected.ports.selectedSkillAdmission.admitSelection,'function');assert.equal(typeof selected.ports.selectedController,'object');}
 finally{await selected.close();}
});

test('proposal owner still rejects an unprojected journal with an extra read capability',()=>{
 const journal=createIntentJournal({claim:denied,settle:denied,read:denied});
 assert.deepEqual(Object.keys(journal).sort(),['begin','read','settle']);
 assert.throws(()=>createSelectedDocumentProposals({journal,metadataStore:{insert:denied,read:denied},readCurrent:denied,now:()=>1000}),/INVALID_COMMAND/);
});
