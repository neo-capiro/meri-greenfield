/** Session observations behind one event-stream (re)connect, through the actual conversation HTTP owner, service and session owner. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {receiveConversationRequest} from '../../../../packages/contracts/dist/conversation-application.mjs';
import {allocatedApplicationFixture,binding} from './application-fixture.mjs';

test('a reconnect authenticates once, in its own window, before any header: two session resolves for its first page',async()=>{
 const f=await allocatedApplicationFixture();
 try{
  const request=receiveConversationRequest('submit',new TextEncoder().encode(JSON.stringify(f.input)));
  assert.equal((await f.post('submit',request)).status,200);assert.equal((await f.post('cancel',{})).status,200);
  let resolves=0;f.state.checkCurrentBinding=async()=>{resolves++;};
  const response=await f.app.handle(new Request(`https://meri.invalid/api/conversations/events/${binding.conversationId}/stream`,{headers:{authorization:`Bearer ${f.credential}`,'x-meri-resume-sequence':'0'}}));
  assert.equal(response.status,200);
  assert.equal(resolves,1,'headers follow the window opening pass alone');
  const text=await response.text();
  assert.match(text,/"sequence":1/);
  // The opening pass, then one release recheck for the page. Before: a two-pass history read preceded the window (4 resolves).
  assert.equal(resolves,2);
 }finally{f.close();}
});
