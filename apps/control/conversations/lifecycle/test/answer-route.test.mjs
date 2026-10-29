/** The existing authenticated control route accepts a clarifying-answer control and refuses a malformed one.
 * Real mounted route (`/api/conversations/control`), stub lifecycle owner: no database, no provider. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createConversationLifecycleApplication} from '../http.mjs';
import {assertLifecycleCommand} from '../../../../../packages/contracts/conversation-lifecycle/validate.mjs';
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`;
const control={controlId:id(20),intent:'answer',questionId:id(21),answers:{'How should I format the output?':'Summary'}};
function app(){const seen=[];const service={// The real service validates the command before any effect; the stub does the same so the route is exercised with it.
  control:async({credential,input})=>{const value=assertLifecycleCommand(input);seen.push({credential,input});return {controlId:value.controlId,intent:value.intent,state:'APPLIED'};},inspectCheckpoint:async()=>({}),
 // The lifecycle mount reuses the existing conversation HTTP owner, which requires its three frozen public routes.
 submit:async()=>{throw Error('NOT_UNDER_TEST');},history:async()=>{throw Error('NOT_UNDER_TEST');},cancel:async()=>{throw Error('NOT_UNDER_TEST');}};
 return {seen,handle:createConversationLifecycleApplication({service,now:()=>1760486400000}).handle};}
const post=(handle,body,{authorization='Bearer synthetic',type='application/json'}={})=>handle(new Request('https://meri.invalid/api/conversations/control',{method:'POST',headers:{authorization,'content-type':type},body:JSON.stringify(body)}));

test('the mounted control route hands an answer control to the lifecycle owner unchanged',async()=>{
 const {seen,handle}=app(),result=await post(handle,control);
 assert.equal(result.status,200);
 assert.deepEqual(seen.map(s=>s.input),[control],'the answer intent reaches the owner exactly as the browser sent it');
 assert.equal(seen[0].credential,'synthetic');
});

test('the route refuses a malformed answer before any lifecycle effect',async()=>{
 const {seen,handle}=app();
 for(const body of [
  {controlId:id(20),intent:'answer',answers:{Q:'A'}},
  {controlId:id(20),intent:'answer',questionId:'not-a-uuid',answers:{Q:'A'}},
  {controlId:id(20),intent:'answer',questionId:id(21),answers:{}},
  {...control,prompt:'and a prompt'},
 ]){
  const result=await post(handle,body);
  assert.ok(result.status===400||result.status===403,`${JSON.stringify(body).slice(0,80)} -> ${result.status}`);
 }
 assert.deepEqual(seen,[],'nothing reached the owner');
});
