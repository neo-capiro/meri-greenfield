/** Actual MCP in-memory transport over the native memory owner; no SDK query or model call. */
import test from 'node:test';import assert from 'node:assert/strict';
import {nativeMemoryFixture} from '../../../../control/intents/test/native-memory-fixture.mjs';
import {mountIntents} from './fixture.mjs';
import {intentPromptSentence} from '../options.mjs';
test('mounted prompt distinguishes pending memory review and absent mount stays unchanged',()=>{
 assert.equal(intentPromptSentence(false),'');assert.match(intentPromptSentence(true),/Memory preparation creates no candidate/u);assert.match(intentPromptSentence(true),/submission remains unavailable/u);
});
for(const general of [false,true])test(`${general?'General':'client'} memory tool renders an unsubmitted proposal and holds exact delivery through worker remount`,async()=>{
 const f=nativeMemoryFixture({general}),m=await mountIntents(f);assert(m);
 try{const out=await m.call('propose_memory',{operation:'save_memory',arguments:f.raw},{toolUseId:'toolu_memory'});
  assert.equal(out.isError,undefined);const result=JSON.parse(out.content[0].text);
  assert.equal(result.status,'approval_required');assert.match(out.content[1].text,/PREPARED MEMORY PROPOSAL/u);assert.match(out.content[1].text,/Submission is unavailable/u);assert.equal(f.journal.rows.size,0);
  assert.equal(m.runtime.receipts()[0].status,'approval_required');assert.equal(m.runtime.receipts()[0].reference,result.proposal.proposalId);
  const second=await mountIntents(f);try{const replay=await second.call('propose_memory',{operation:'save_memory',arguments:f.raw},{toolUseId:'toolu_memory'});assert.deepEqual(JSON.parse(replay.content[0].text),result);assert.equal(f.state.prepares,1);}finally{await second.close();}
 }finally{await m.close();}
});
test('uncertain memory submission never renders nothing changed or suggests task approval retry',async()=>{
 const f=nativeMemoryFixture();f.intentStore.state.loseSettleAck=true;const m=await mountIntents(f);assert(m);
 try{const out=await m.call('propose_memory',{operation:'save_memory',arguments:f.raw});assert.equal(out.isError,true);assert.match(out.content[0].text,/do not repeat/u);assert.match(out.content[0].text,/original conversation request/u);assert.doesNotMatch(out.content[0].text,/Nothing has been|pending approvals/u);}finally{await m.close();}
});
test('a memory request outside the owner contract is refused by the tool contract, never as a governed FAILED delivery',async()=>{
 const f=nativeMemoryFixture({general:true}),m=await mountIntents(f);assert(m);
 try{
  const tool=(await m.client.listTools()).tools.find(t=>t.name==='propose_memory');
  assert.deepEqual(tool.inputSchema.properties.arguments.required,['content']);
  assert.equal(Object.hasOwn(tool.inputSchema.properties.arguments.properties,'clientId'),false);
  // Each of these was accepted by the open record the tool advertised before, and the memory owner then refused it
  // as INVALID_ARGUMENTS with no effect: a retained FAILED delivery for a request that never reached the owner.
  for(const [toolUseId,arguments_] of [['toolu_client_id',{content:'Preference',clientId:null}],['toolu_unknown_field',{text:'Preference'}],['toolu_other_scope',{content:'Preference',scope:'private-user'}],['toolu_over_length',{content:'x'.repeat(4001)}]]){
   const out=await m.call('propose_memory',{operation:'save_memory',arguments:arguments_},{toolUseId});
   assert.equal(out.isError,true,toolUseId);assert.match(out.content[0].text,/Invalid arguments for tool propose_memory/u);
   assert.equal(f.intentStore.rows.size,0,`${toolUseId}: a contract-refused request is not a governed delivery`);
   assert.equal(f.state.prepares,0,`${toolUseId}: the owner is never reached`);
  }
  const ok=await m.call('propose_memory',{operation:'save_memory',arguments:{content:'Preference',key:'brief-length',scope:'personal',ttlDays:14}},{toolUseId:'toolu_in_contract'});
  assert.equal(ok.isError,undefined);assert.equal(JSON.parse(ok.content[0].text).status,'approval_required');assert.equal(f.intentStore.rows.size,1);
 }finally{await m.close();}
});
