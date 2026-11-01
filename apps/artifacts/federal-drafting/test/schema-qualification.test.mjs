import test from 'node:test';
import assert from 'node:assert/strict';
import {federalValidatorForOperation} from '../schema-qualification.mjs';
import {textSha256} from '../engine.mjs';
import {USLM_SCHEMA_PROFILE,USLM_SCHEMA_SHA256} from '../../../../packages/contracts/federal-workbench/schema-receipt.mjs';
const receipt=text=>({profile:USLM_SCHEMA_PROFILE,schemaSha256:USLM_SCHEMA_SHA256,
 sourceSha256:textSha256(text),bytes:Buffer.byteLength(text),valid:true});
const options=()=>({deadlineMs:Date.now()+10000});

test('same exact source bytes validate once in one operation; metadata preserves BOM/multibyte hash and length',async()=>{
 const text='\ufeff<bill>😀</bill>',calls=[];let returned;
 const port={async validate(value){calls.push(value);returned=receipt(value);return returned;}},cached=federalValidatorForOperation(port);
 const first=await cached.validate(text,options());returned.bytes=1;
 assert.deepEqual(first,receipt(text));assert.equal(Object.isFrozen(first),true);
 assert.equal(await cached.validate(text,options()),first);assert.deepEqual(calls,[text]);
 const other=text.replace('😀','€');assert.deepEqual(await cached.validate(other,options()),receipt(other));assert.deepEqual(calls,[text,other]);
});

test('operation cache holds at most two exact texts and does not cross operation boundaries',async()=>{
 const calls=[],port={async validate(text){calls.push(text);return receipt(text);}},cached=federalValidatorForOperation(port);
 for(const text of ['A','B','C','C','B','A'])await cached.validate(text,options());
 assert.deepEqual(calls,['A','B','C','A']);
 await federalValidatorForOperation(port).validate('A',options());assert.deepEqual(calls,['A','B','C','A','A']);
 assert.equal(federalValidatorForOperation(null),null);
});

test('rejected validation and malformed receipt are never cached',async()=>{
 for(const malformed of [null,{...receipt('A'),bytes:2},{...receipt('A'),sourceSha256:'0'.repeat(64)},
  {...receipt('A'),schemaSha256:'0'.repeat(64)},{...receipt('A'),profile:'unknown'},{...receipt('A'),extra:true}]){
  let calls=0;const cached=federalValidatorForOperation({async validate(){calls++;return calls===1?malformed:receipt('A');}});
  await assert.rejects(cached.validate('A',options()),{code:'DRAFT_SCHEMA_RECEIPT_INVALID'});
  assert.deepEqual(await cached.validate('A',options()),receipt('A'));assert.equal(calls,2);
 }
 let calls=0;const cached=federalValidatorForOperation({async validate(){if(++calls===1)throw Object.assign(Error('invalid'),{code:'DRAFT_SCHEMA_INVALID'});return receipt('A');}});
 await assert.rejects(cached.validate('A',options()),{code:'DRAFT_SCHEMA_INVALID'});
 await cached.validate('A',options());assert.equal(calls,2);
});

test('operation captures and binds original validator method before port mutation',async()=>{
 let calls=0;const port={marker:'original',async validate(text){assert.equal(this.marker,'original');calls++;return receipt(text);}};
 const cached=federalValidatorForOperation(port);
 port.validate=async()=>{throw Error('substituted method must never run');};
 assert.deepEqual(await cached.validate('A',options()),receipt('A'));assert.equal(calls,1);
});

test('cached success still refuses cancellation, expired or invalid deadline without calling validator',async t=>{
 t.mock.timers.enable({apis:['Date'],now:10000});let calls=0;
 const cached=federalValidatorForOperation({async validate(text){calls++;return receipt(text);}}),opts={deadlineMs:11000};
 await cached.validate('A',opts);const controller=new AbortController();controller.abort();
 await assert.rejects(cached.validate('A',{...opts,signal:controller.signal}),{code:'ARTIFACT_CANCELLED'});
 await assert.rejects(cached.validate('A',{}),{code:'DRAFT_SCHEMA_VALIDATOR_UNAVAILABLE'});
 t.mock.timers.tick(1001);await assert.rejects(cached.validate('A',opts),{code:'ARTIFACT_DEADLINE'});assert.equal(calls,1);
});

test('cancellation during validation never retains a success for reuse',async()=>{
 let calls=0;const controller=new AbortController(),cached=federalValidatorForOperation({async validate(text){calls++;if(calls===1)controller.abort();return receipt(text);}});
 await assert.rejects(cached.validate('A',{...options(),signal:controller.signal}),{code:'ARTIFACT_CANCELLED'});
 await cached.validate('A',options());assert.equal(calls,2);
});
