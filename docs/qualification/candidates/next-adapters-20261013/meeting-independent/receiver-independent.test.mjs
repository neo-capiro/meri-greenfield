import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeetingReadHandler} from '../../../../../apps/gateway/sources/meetings/handler.mjs';
import {meetingFixture,NOW,operations,clientId,meetingId,noteId} from '../../../../../apps/gateway/sources/meetings/test/fixtures.mjs';

test('canonical meeting handler preserves receiver identity of an ordinary borrowed read port',async()=>{
 const f=meetingFixture(operations.read,{clientId,meetingId,sourceKind:'note',sourceId:noteId}),state=new WeakMap();let calls=0,received;
 const adapter={async read(call){calls++;received=call;const page=state.get(this);if(!page)throw Error('SCRIPTED_RECEIVER_MISSING');return structuredClone(page);}};state.set(adapter,f.page);
 const execute=createMeetingReadHandler({operation:operations.read,adapter,now:()=>NOW});const out=JSON.parse(await execute(f.call));assert.deepEqual(out,f.page);assert.equal(calls,1);assert.deepEqual(received.input,f.input);assert.deepEqual(received.authority,f.authority);assert.equal(out.evidenceReady,false);
});
