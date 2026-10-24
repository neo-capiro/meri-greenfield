import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {objectiveGenerationStartMetadata as metadata,requireObjectiveGenerationStartRequest as request,
 receiveObjectiveGenerationStartResponse as receive} from '../objective-generation.mjs';
const id='00000000-0000-4000-8000-000000000021';

test('public Objective request captures only the saved job pointer, without browser authority',()=>{
 assert.deepEqual(request({generationJobId:id}),{generationJobId:id});
 for(const value of [{jobId:id},{generationJobId:id,tenantId:'foreign'},{generationJobId:id,notAfterMs:1},
  {generationJobId:'invalid'},[],null,Object.defineProperty({},'generationJobId',{enumerable:true,get(){throw Error('must not execute');}})])
  assert.throws(()=>request(value),/OBJECTIVE_GENERATION_WIRE_INVALID/u);
});
test('public receiver binds the start acknowledgement to the same saved job and exact status',()=>{
 const receipt={state:'requested',generationJobId:id};
 assert.deepEqual(receive(202,JSON.stringify(receipt),id),receipt);
 for(const [status,value,expected] of [[200,receipt,id],[202,{...receipt,generationJobId:id.replace(/21$/u,'22')},id],
  [202,{...receipt,completed:true},id],[202,{state:'completed',generationJobId:id},id],[202,receipt,'invalid']])
  assert.throws(()=>receive(status,JSON.stringify(value),expected),/OBJECTIVE_GENERATION_WIRE_INVALID/u);
 for(const [status,code] of [[400,'OBJECTIVE_GENERATION_REFUSED'],[403,'OBJECTIVE_GENERATION_REFUSED'],[401,'SESSION_REFUSED'],
  [503,'OBJECTIVE_GENERATION_UNAVAILABLE'],[503,'OBJECTIVE_GENERATION_UNKNOWN']])
  assert.deepEqual(receive(status,JSON.stringify({error:{code}}),id),{error:{code}});
 assert.throws(()=>receive(503,JSON.stringify({error:{code:'untrusted'}}),id));
 assert.throws(()=>receive(202,' '.repeat(metadata.responseBytes+1),id));
});
test('package deliberately exports its standalone browser and declaration files',async()=>{
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 assert.deepEqual(pkg.exports['./objective-generation'],{types:'./objective-generation.d.ts',default:'./objective-generation.mjs'});
 for(const path of ['objective-generation.mjs','objective-generation.d.ts'])assert.ok(pkg.files.includes(path));
 assert.equal(metadata.path,'/api/objective-generation/start');
});
