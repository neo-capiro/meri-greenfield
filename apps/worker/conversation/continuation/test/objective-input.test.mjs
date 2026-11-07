import test from 'node:test';
import assert from 'node:assert/strict';
import {createConversationInput,createObjectiveConversationInput} from '../input.mjs';
const requestId='71000000-0000-4000-8000-000000000001';
test('Objective initial SDK input preserves large complete text; ordinary initial input and all enqueue paths stay bounded',async()=>{
 const prompt='Synthetic complete context.\n'.repeat(24000);
 assert.throws(()=>createConversationInput({requestId,prompt}),/SDK_INPUT_REFUSED/);
 const input=createObjectiveConversationInput({requestId,prompt});
 try{
  const first=await input.prompt[Symbol.asyncIterator]().next();assert.equal(first.value.message.content,prompt);
  assert.throws(()=>input.enqueue({controlId:requestId,prompt}),/SDK_INPUT_REFUSED/);
 }finally{input.close();}
 assert.throws(()=>createObjectiveConversationInput({requestId,prompt:'é'.repeat(393217)}),/SDK_INPUT_REFUSED/);
 assert.throws(()=>createConversationInput({requestId,prompt,objective:true}));
});
