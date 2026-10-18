import test from 'node:test';import assert from 'node:assert/strict';
import {createOccurrenceRelay} from '../occurrence-relay.mjs';
const binding={tenantId:'tenant',conversationId:'00000000-0000-4000-8000-000000000001'};
test('unbound or closed, the relay answers null (attended); bound, it forwards the selection and the check to the schedule owner',async()=>{
 const relay=createOccurrenceRelay();assert.equal(relay.state(),'unbound');assert.equal(await relay.port.readOccurrence({binding}),null);
 const seen=[];relay.bind({async readOccurrenceForConversation(selection,check){seen.push(selection);check();return {occurrence:1};}});
 assert.deepEqual(await relay.port.readOccurrence({binding}),{occurrence:1});assert.deepEqual(seen,[binding]);
 await assert.rejects(relay.port.readOccurrence({binding,signal:AbortSignal.abort()}),{code:'OCCURRENCE_RELAY_CANCELLED'});
 assert.throws(()=>relay.bind({readOccurrenceForConversation(){}}),{code:'OCCURRENCE_RELAY_CONFIGURATION'});
 relay.close();assert.equal(await relay.port.readOccurrence({binding}),null);
});
test('malformed bindings and owners refuse',async()=>{
 const relay=createOccurrenceRelay();relay.bind({async readOccurrenceForConversation(){return null;}});
 for(const b of [undefined,{},{tenantId:'t'},{tenantId:'',conversationId:binding.conversationId},{tenantId:'t',conversationId:'nope'}])await assert.rejects(relay.port.readOccurrence({binding:b}),{code:'OCCURRENCE_RELAY_REQUEST'});
 assert.throws(()=>createOccurrenceRelay().bind({}),{code:'OCCURRENCE_RELAY_CONFIGURATION'});
});
