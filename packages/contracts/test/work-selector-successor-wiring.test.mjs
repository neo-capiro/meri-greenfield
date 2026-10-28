import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationSchema} from '../conversation-application/schema.mjs';
import {conversationApplicationMetadata} from '../conversation-application/protocol.mjs';
import {inputSchema} from '../conversation-input/schema.mjs';
import {conversationInputMetadata} from '../conversation-input/protocol.mjs';
import {initialInputSchema} from '../conversation-initial-input/schema.mjs';
import {conversationInitialInputMetadata} from '../conversation-initial-input/protocol.mjs';
import {historySchema} from '../conversation-history/schema.mjs';
import {conversationHistoryMetadata} from '../conversation-history/protocol.mjs';
import {WORK_JOB_KINDS,WORK_ENTRIES,WORK_SELECTION_SCHEMA} from '../work-selection.mjs';

const OLD=/urn:meri:conversation-application:0\.[0-3]\.0|urn:meri:conversation-input:1\.[0-2]\.0|urn:meri:conversation-initial-input:1\.[0-2]\.0|urn:meri:conversation-history:1\.[0-3]\.0/u;

test('the successor labels are the settled ones and the previous labels are gone from composed source',()=>{
 assert.equal(conversationSchema().$id,'urn:meri:conversation-application:0.4.0');
 assert.equal(conversationApplicationMetadata.schemaId,'urn:meri:conversation-application:0.4.0');
 assert.equal(conversationApplicationMetadata.wireContractVersion,'0.4.0');
 assert.equal(conversationInputMetadata.schemaId,'urn:meri:conversation-input:1.3.0');
 assert.equal(conversationInitialInputMetadata.schemaId,'urn:meri:conversation-initial-input:1.3.0');
 assert.equal(conversationHistoryMetadata.schemaId,'urn:meri:conversation-history:1.4.0');
 for(const composed of [conversationSchema(),inputSchema(),initialInputSchema(),historySchema()]){
  assert.equal(OLD.test(JSON.stringify(composed)),false,composed.$id);
 }
});

test('work is an optional field on both the submit and the stored request, and the stored shape is closed',()=>{
 const {$defs}=conversationSchema(),submit=$defs.ConversationSubmitRequest,stored=$defs.ConversationStoredRequest;
 assert.deepEqual(submit.properties.work,WORK_SELECTION_SCHEMA);
 assert.deepEqual(stored.properties.work,WORK_SELECTION_SCHEMA);
 assert.equal(submit.required.includes('work'),false);
 assert.equal(stored.required.includes('work'),false);
 assert.equal(submit.additionalProperties,false);
 assert.equal(stored.additionalProperties,false);
 assert.deepEqual([...submit.properties.work.properties.jobKind.enum],[...WORK_JOB_KINDS]);
 assert.deepEqual([...submit.properties.work.properties.entry.enum],[...WORK_ENTRIES]);
});

test('every cross-family reference follows the successor labels',()=>{
 assert.equal(inputSchema().$defs.ConversationInputRequest.$ref,'urn:meri:conversation-application:0.4.0#/$defs/ConversationSubmitRequest');
 assert.equal(inputSchema().$defs.ConversationInputStoredRequest.$ref,'urn:meri:conversation-application:0.4.0#/$defs/ConversationStoredRequest');
 assert.equal(initialInputSchema().$defs.ConversationInitialInputRequest.$ref,'urn:meri:conversation-input:1.3.0#/$defs/ConversationInputRequest');
 const records=historySchema().$defs.ConversationHistoryStoredRequest.properties;
 assert.equal(records.work.$ref,'urn:meri:conversation-application:0.4.0#/$defs/ConversationStoredRequest/properties/work');
 assert.equal(records.uploads.$ref,'urn:meri:conversation-application:0.4.0#/$defs/ConversationStoredRequest/properties/uploads');
 assert.equal(records.procedure.$ref,'urn:meri:conversation-application:0.4.0#/$defs/ConversationStoredRequest/properties/procedure');
 assert.equal(records.documentRevision.$ref,'urn:meri:conversation-application:0.4.0#/$defs/ConversationStoredRequest/properties/documentRevision');
});

test('unrelated contract identities were not widened or renamed',()=>{
 const {conversationErrorStatuses}=conversationSchema().$defs.ConversationErrorResponse.properties.error.properties.code.enum
  ?{conversationErrorStatuses:conversationSchema().$defs.ConversationErrorResponse.properties.error.properties.code.enum}:{};
 assert.ok(conversationErrorStatuses.length>0);
 assert.equal(inputSchema().$defs.ConversationInputRequest.$ref.includes('conversation-input:'),false);
});
