import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeAllocationRelay} from '../native-allocation-relay.mjs';
test('the relay refuses before binding and after close, binds exactly once, and delegates after bind',async()=>{
 const relay=createNativeAllocationRelay();
 await assert.rejects(async()=>relay.resolve({binding:{}}),e=>e.code==='NATIVE_HOST_ALLOCATION_UNAVAILABLE');
 const reader={async resolve(v){return {ok:true,input:v};}};
 relay.bind(reader);
 assert.deepEqual(await relay.resolve({binding:{tenantId:'t'}}),{ok:true,input:{binding:{tenantId:'t'}}});
 await assert.rejects(async()=>relay.bind(reader),e=>e.code==='NATIVE_HOST_ALLOCATION_BINDING');
 assert.deepEqual(relay.close(),{closed:true});
 await assert.rejects(async()=>relay.resolve({binding:{}}),e=>e.code==='NATIVE_HOST_ALLOCATION_UNAVAILABLE');
});
test('the relay refuses a non-reader binding',()=>{
 const relay=createNativeAllocationRelay();
 assert.throws(()=>relay.bind({}),e=>e.code==='NATIVE_HOST_ALLOCATION_BINDING');
 assert.throws(()=>relay.bind(null),e=>e.code==='NATIVE_HOST_ALLOCATION_BINDING');
});
