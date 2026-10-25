/** Actual MCP in-memory transport over the native memory owner; no SDK query or model call. */
import test from 'node:test';import assert from 'node:assert/strict';
import {nativeMemoryFixture} from '../../../../control/intents/test/native-memory-fixture.mjs';
import {mountIntents} from './fixture.mjs';
import {intentPromptSentence} from '../options.mjs';
test('mounted prompt distinguishes pending memory review and absent mount stays unchanged',()=>{
 assert.equal(intentPromptSentence(false),'');assert.match(intentPromptSentence(true),/memory candidates submitted for governed Core review/u);assert.match(intentPromptSentence(true),/not yet saved or published/u);
});
for(const general of [false,true])test(`${general?'General':'client'} memory tool renders pending review and holds exact delivery through worker remount`,async()=>{
 const f=nativeMemoryFixture({general}),m=await mountIntents(f);assert(m);
 try{const out=await m.call('propose_memory',{operation:'save_memory',arguments:f.raw},{toolUseId:'toolu_memory'});
  assert.equal(out.isError,undefined);const result=JSON.parse(out.content[0].text);
  assert.equal(result.status,'review_pending');assert.match(out.content[1].text,/SUBMITTED FOR REVIEW/u);assert.doesNotMatch(out.content[1].text,/PREPARED PROPOSAL/u);
  assert.equal(m.runtime.receipts()[0].status,'review_pending');assert.equal(m.runtime.receipts()[0].reference,result.result.candidateId);
  const second=await mountIntents(f);try{const replay=await second.call('propose_memory',{operation:'save_memory',arguments:f.raw},{toolUseId:'toolu_memory'});assert.deepEqual(JSON.parse(replay.content[0].text),result);assert.equal(f.state.prepares,1);}finally{await second.close();}
 }finally{await m.close();}
});
test('uncertain memory submission never renders nothing changed or suggests task approval retry',async()=>{
 const f=nativeMemoryFixture();f.state.loseProducerAck=true;const m=await mountIntents(f);assert(m);
 try{const out=await m.call('propose_memory',{operation:'save_memory',arguments:f.raw});assert.equal(out.isError,true);assert.match(out.content[0].text,/do not repeat/u);assert.match(out.content[0].text,/pending memory reviews/u);assert.doesNotMatch(out.content[0].text,/Nothing has been|pending approvals/u);}finally{await m.close();}
});
