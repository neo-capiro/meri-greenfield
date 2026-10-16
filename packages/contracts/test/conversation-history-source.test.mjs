/** SYNTHETIC shared semantic controls; no generated artifact or external service required. */
import test from 'node:test';import assert from 'node:assert/strict';
import {assertConversationHistoryResponse} from '../conversation-history/validate.mjs';
import {binding,resumed} from './conversation-history-fixture.mjs';
const input={conversationId:binding.conversationId,limit:10};
test('valid resumed prompt keeps a distinct stored requestId and contiguous global ranges',()=>{const body=resumed();assert.notEqual(body.turns[0].request.requestId,body.turns[1].request.requestId);assert.deepEqual(assertConversationHistoryResponse('transcript',body,input),body);});
test('adjacent touched ranges cannot overlap despite valid represented event sequence',()=>{const body=resumed();body.turns[0].lastSequence=2;body.turns[0].sequenceEnd=2;assert.throws(()=>assertConversationHistoryResponse('transcript',body,input),/TURN_MISMATCH/);});
test('adjacent touched ranges cannot leave a global gap',()=>{const body=resumed();body.latestSequenceBase=2;body.turns[1].sequenceBase=2;body.events[1].sequence=3;body.nextSequence=3;body.lastSequence=3;assert.throws(()=>assertConversationHistoryResponse('transcript',body,input),/TURN_MISMATCH/);});
test('older page range cannot extend into latest run when latest is outside this page',()=>{const body=resumed();body.turns[0].lastSequence=2;body.turns[0].sequenceEnd=2;body.turns.pop();body.events.pop();body.nextSequence=1;body.hasMore=true;assert.throws(()=>assertConversationHistoryResponse('transcript',body,{...input,limit:1}),/TURN_MISMATCH/);});
for(const[field,change]of [['prompt',r=>r.prompt='Substituted prompt'],['windowRequest presence',r=>delete r.windowRequest]])test(`resume cannot change stored ${field} while retaining source/logical IDs`,()=>{const body=resumed();change(body.turns[1].request);assert.throws(()=>assertConversationHistoryResponse('transcript',body,input),/PROMPT_LINEAGE_MISMATCH/);});
