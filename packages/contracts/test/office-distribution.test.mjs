import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {generateOfficeContracts} from '../generate-office.mjs';
import * as published from '@capiro/meri-contracts/office-application';

test('the public package exports the canonical Office receiver without private source imports',async()=>{
 const packageJson=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 assert.deepEqual(packageJson.exports['./office-application'],{
  types:'./dist/office-application.d.ts',default:'./dist/office-application.mjs'});
 assert.equal(published.OFFICE_SCHEMA,'meri.office-application/1');
 assert.equal(typeof published.receiveOfficeDownload,'function');
 assert.equal(typeof published.receiveOfficeResponse,'function');
});
test('Office receiver is deterministic and runs in a browser realm without Node or external modules',async()=>{
 await generateOfficeContracts({check:true});
 const context=vm.createContext({TextEncoder,TextDecoder,Response,Request,Headers,AbortController,AbortSignal,ReadableStream,crypto:globalThis.crypto,setTimeout,clearTimeout});
 const source=await readFile(new URL('../dist/office-application.mjs',import.meta.url),'utf8');
 const module=new vm.SourceTextModule(source,{context});await module.link(()=>{throw Error('External browser dependency');});await module.evaluate();
 assert.equal(vm.runInContext('typeof process',context),'undefined');assert.equal(vm.runInContext('typeof Buffer',context),'undefined');
 const {OFFICE_SCHEMA,receiveOfficeRequest,receiveOfficeResponse}=module.namespace;
 const bytes=value=>new TextEncoder().encode(JSON.stringify(value)),id='11111111-1111-4111-8111-111111111111';
 const selected=receiveOfficeRequest('read',bytes({schema:OFFICE_SCHEMA,draftId:id,versionId:id}));
 const result=await receiveOfficeResponse('read',403,bytes({schema:OFFICE_SCHEMA,error:{code:'ACCESS_DENIED',outcome:'READ_UNAVAILABLE'}}),selected);
 assert.equal(result.error.code,'ACCESS_DENIED');assert.ok(Object.isFrozen(result));
 await assert.rejects(receiveOfficeResponse('read',403,bytes({schema:OFFICE_SCHEMA,error:{code:['ACCESS_DENIED'],outcome:'READ_UNAVAILABLE'}}),selected));
});
