import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeTaskAuthority} from '../../../../../apps/runtime/native-authority/task-authority.mjs';
import {fixture,NOW} from '../../../../../apps/runtime/native-authority/test/fixture.mjs';

test('non-string digest cannot execute coercion or dispatch task capability before refusal',async()=>{
 const f=fixture();let coerced=0,effects=0;
 const authority=createNativeTaskAuthority({enabled:true,now:()=>NOW,native:{call(){effects++;throw Error('unexpected native dispatch');}}});
 const inputSha256={toString(){coerced++;return 'a'.repeat(64);}};
 await assert.rejects(authority.verify({capability:'synthetic-opaque',binding:f.binding,operation:'runner/session/register',inputSha256}),{code:'WORKER_AUTHORITY_REFUSED'});
 assert.deepEqual({coerced,effects},{coerced:0,effects:0});
});
