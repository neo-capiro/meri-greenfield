import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';

const hash=text=>createHash('sha256').update(text).digest('hex');
const schemaSha256='c68c058345f99689144c183c99d47552f3d56aa365ff1380127a9180fe18ce44';
const source='\ufeff<bill>synthetic 😀</bill>';
let handler,calls=0;
test.mock.module('../../process.mjs',{namedExports:{runArtifactProcess:async(...args)=>{calls++;return handler(...args);}}});
const {createFederalSchemaValidator}=await import('../schema-validator.mjs');
const receipt=text=>({profile:'uslm-2.1.0',schemaSha256,sourceSha256:hash(text),bytes:Buffer.byteLength(text),valid:true});
async function fixture(t){const tempRoot=await mkdtemp(join(tmpdir(),'meri-schema-adapter-test-'));t.after(()=>rm(tempRoot,{recursive:true,force:true}));
 calls=0;return {tempRoot,validator:createFederalSchemaValidator({pythonExecutable:process.execPath,tempRoot})};}

test('fixed process boundary binds exact source/BOM, receipt, deadline and owned workspace cleanup',async t=>{
 const {tempRoot,validator}=await fixture(t),controller=new AbortController(),deadlineMs=Date.now()+60000;
 handler=async(executable,args,options)=>{assert.equal(executable,process.execPath);assert.deepEqual(args.slice(0,2),['-I','-B']);
  assert.equal(isAbsolute(args[2]),true);assert.match(args[2],/schema_validator\.py$/);assert.equal(options.maxOutput,4096);
  assert.equal(options.signal,controller.signal);assert.ok(options.deadlineMs<deadlineMs&&options.deadlineMs>Date.now());
  assert.deepEqual(JSON.parse(options.input),{text:source,sha256:hash(source)});assert.match(options.cwd,/meri-federal-schema-/);
  return {stdout:Buffer.from(JSON.stringify(receipt(source)))};};
 assert.deepEqual(await validator.validate(source,{deadlineMs,signal:controller.signal}),receipt(source));
 assert.equal(calls,1);assert.deepEqual(await readdir(tempRoot),[]);
});

test('invalid UTF8 scalar/size and pre-cancelled or expired request start no process',async t=>{
 const {tempRoot,validator}=await fixture(t),deadlineMs=Date.now()+10000,controller=new AbortController();controller.abort();
 for(const text of ['', '\ud800','nul\0','a'.repeat(131073)])await assert.rejects(validator.validate(text,{deadlineMs}),{code:'DRAFT_SCHEMA_INVALID'});
 await assert.rejects(validator.validate(source,{deadlineMs,signal:controller.signal}),{code:'ARTIFACT_CANCELLED'});
 await assert.rejects(validator.validate(source,{deadlineMs:1}),{code:'ARTIFACT_DEADLINE'});
 await assert.rejects(validator.validate(source,{}),{code:'DRAFT_SCHEMA_VALIDATOR_UNAVAILABLE'});
 assert.equal(calls,0);assert.deepEqual(await readdir(tempRoot),[]);
});

test('mismatched or malformed process success cannot certify a source and always cleans up',async t=>{
 const {tempRoot,validator}=await fixture(t);
 for(const value of [{...receipt(source),sourceSha256:'0'.repeat(64)},{...receipt(source),schemaSha256:'0'.repeat(64)},
  {...receipt(source),bytes:1},{...receipt(source),valid:false},{...receipt(source),extra:true},null,'not-json']){
  handler=async()=>({stdout:Buffer.from(value==='not-json'?value:JSON.stringify(value))});
  await assert.rejects(validator.validate(source,{deadlineMs:Date.now()+10000}),{code:'DRAFT_SCHEMA_VALIDATOR_UNAVAILABLE'});
  assert.deepEqual(await readdir(tempRoot),[]);
 }
});

test('typed content refusal is inert; infrastructure/process failure cannot leak source diagnostics',async t=>{
 const {tempRoot,validator}=await fixture(t);
 for(const [code,expected] of [['SCHEMA_INVALID','DRAFT_SCHEMA_INVALID'],['MANIFEST_HASH_MISMATCH','DRAFT_SCHEMA_VALIDATOR_UNAVAILABLE'],
  ['UNKNOWN','DRAFT_SCHEMA_VALIDATOR_UNAVAILABLE']]){
  handler=async()=>{throw Object.assign(Error('PRIVATE CONTENT'),{code:'ARTIFACT_PROCESS_FAILED',receipt:{exitCode:1},stdout:Buffer.from(JSON.stringify({valid:false,code})),stderr:Buffer.from('PRIVATE CONTENT')});};
  await assert.rejects(validator.validate(source,{deadlineMs:Date.now()+10000}),error=>error.code===expected&&error.message===expected&&!error.stdout&&!error.stderr&&!error.receipt);
  assert.deepEqual(await readdir(tempRoot),[]);
 }
 for(const code of ['ARTIFACT_DEADLINE','ARTIFACT_CANCELLED','ARTIFACT_CLEANUP_FAILED','ARTIFACT_OUTPUT_LIMIT']){
  handler=async()=>{throw Object.assign(Error('PRIVATE CONTENT'),{code,stdout:Buffer.from('PRIVATE CONTENT')});};
  await assert.rejects(validator.validate(source,{deadlineMs:Date.now()+10000}),{code:code==='ARTIFACT_OUTPUT_LIMIT'?'DRAFT_SCHEMA_VALIDATOR_UNAVAILABLE':code});
  assert.deepEqual(await readdir(tempRoot),[]);
 }
});

test('cancellation observed after child completion withholds receipt and cleans owned workspace',async t=>{
 const {tempRoot,validator}=await fixture(t),controller=new AbortController();
 handler=async()=>{controller.abort();return {stdout:Buffer.from(JSON.stringify(receipt(source)))};};
 await assert.rejects(validator.validate(source,{deadlineMs:Date.now()+10000,signal:controller.signal}),{code:'ARTIFACT_CANCELLED'});
 assert.deepEqual(await readdir(tempRoot),[]);
});
