import test from 'node:test';
import assert from 'node:assert/strict';
import {redactAttributes,truncateAttributeValue,MAX_ATTRIBUTE_BYTES} from '../redaction.mjs';

test('secret-shaped keys are dropped regardless of case or position',()=>{
 const out=redactAttributes({'meri.run.id':'r1','x-api-token':'t','Authorization':'Bearer x','set-cookie':'c','meri.capability.credential':'k','refresh_TOKEN_hash':'h','http.request.method':'POST'});
 assert.deepEqual(out,{'meri.run.id':'r1','http.request.method':'POST'});assert.ok(Object.isFrozen(out));
});
test('values over 512 bytes are cut at a code-point boundary and marked; values at the limit pass unchanged',()=>{
 const exact='a'.repeat(MAX_ATTRIBUTE_BYTES);assert.deepEqual(redactAttributes({k:exact}),{k:exact});
 const long=redactAttributes({k:'b'.repeat(MAX_ATTRIBUTE_BYTES+1)});assert.equal(long.k.length,MAX_ATTRIBUTE_BYTES);assert.equal(long['k.truncated'],true);
 // A three-byte character straddling the limit is dropped whole, never split into invalid UTF-8.
 const {value,truncated}=truncateAttributeValue('a'.repeat(MAX_ATTRIBUTE_BYTES-1)+'€');assert.equal(truncated,true);assert.equal(value,'a'.repeat(MAX_ATTRIBUTE_BYTES-1));
 assert.ok(Buffer.byteLength(value)<=MAX_ATTRIBUTE_BYTES);
});
test('only finite primitives and short primitive arrays survive; arrays are truncated element-wise',()=>{
 const out=redactAttributes({n:1,b:false,nan:Number.NaN,inf:Infinity,u:undefined,nil:null,o:{a:1},f:()=>1,arr:['x','y'.repeat(600)],mixed:['x',{}],big:Array(65).fill(1)});
 assert.deepEqual(Object.keys(out).sort(),['arr','arr.truncated','b','n']);assert.equal(out.arr[1].length,MAX_ATTRIBUTE_BYTES);
});
test('absent or non-object attributes produce an empty frozen set',()=>{for(const v of [undefined,null,'s',3])assert.deepEqual(redactAttributes(v),{});});
