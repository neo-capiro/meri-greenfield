/** Pure finite-selector capture; no native authority is inferred. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {captureHearingClientSelection} from '../request-context.mjs';
import {clientId} from './fixture.mjs';

test('omitted, null and blank clients capture explicit null without mutating the request',()=>{
 for(const request of [{},{clientId:null},{clientId:'   '}]){const copy=structuredClone(request);assert.equal(captureHearingClientSelection(request),null);assert.deepEqual(request,copy);}
});
test('UUID capture preserves bounded original reference and canonicalizes only exact identity casing',()=>{
 const selected=clientId.replaceAll('9','A'),request={clientId:`  ${selected}  `},resolution=captureHearingClientSelection(request);
 assert.deepEqual(resolution,{reference:selected,clientId:selected.toLowerCase()});assert.ok(Object.isFrozen(resolution));assert.equal(Object.hasOwn(resolution,'authorized'),false);assert.equal(request.clientId,`  ${selected}  `);
});
test('names, truncated references and trailing-space clip boundaries remain unavailable',()=>{
 for(const reference of ['A client name','x'.repeat(79)+' y',clientId+'x'.repeat(60),'invalid-uuid'])assert.throws(()=>captureHearingClientSelection({clientId:reference}),{message:'UNAVAILABLE'});
});
test('the native second trim after clipping preserves a UUID at the exact 80-character boundary',()=>{
 const raw=clientId+' '.repeat(80-clientId.length)+'X',request={clientId:raw};
 assert.deepEqual(captureHearingClientSelection(request),{reference:clientId,clientId});assert.equal(request.clientId,raw);
});
test('canonical request shape and inert-data checks reject authority hints and getters without effects',()=>{
 let calls=0;for(const request of [{clientId,tenantId:'foreign'},{clientId:123},{get clientId(){calls++;return clientId;}}])assert.throws(()=>captureHearingClientSelection(request));assert.equal(calls,0);
});
