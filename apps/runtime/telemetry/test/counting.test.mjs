import test from 'node:test';
import assert from 'node:assert/strict';
import {types} from 'node:util';
import {createTurnTelemetry} from '../turn-context.mjs';
import {countingFetch,countingAwsClient,countingPool,classifyStatus} from '../counting.mjs';
const binding={runId:'11111111-1111-4111-8111-111111111111',attemptId:'22222222-2222-4222-8222-222222222222'};
function fixture(){const lines=[],telemetry=createTurnTelemetry({service:'control',write:line=>lines.push(JSON.parse(line))});return {lines,telemetry};}

test('fetch preserves resolved result and errors; counts known Core routes once and filters other origins',async()=>{
 const {telemetry}=fixture(),result={status:200},error=Object.assign(Error('private'),{name:'TimeoutError'});
 let calls=0;const fetchImpl=async url=>{calls++;if(url.endsWith('membership'))throw error;return result;};
 const counted=countingFetch(fetchImpl,telemetry,{origin:'https://core.test'});
 assert.equal(countingFetch(counted,telemetry),counted);assert.equal(types.isProxy(counted),false);
 await telemetry.within(binding,async()=>{
  assert.equal(await counted('https://core.test/api/clio/application-authority/identity'),result);
  await assert.rejects(counted('https://core.test/api/clio/application-authority/membership'),e=>e===error);
  assert.equal(await counted('https://runner.test/runner/load'),result);
 });
 const counts=telemetry.counters(binding);assert.equal(calls,3);assert.deepEqual(counts.core,{identity:{'2xx':1},membership:{timeout:1}});assert.equal(counts.clerkReadsEstimate,3);
});

test('status classification covers specific and general failures without reading error messages',()=>{
 for(const [status,expected] of [[200,'2xx'],[204,'2xx'],[401,'401'],[403,'403'],[409,'409'],[404,'4xx'],[503,'503'],[500,'5xx']])assert.equal(classifyStatus(status),expected);
 assert.equal(classifyStatus(undefined,{code:'DEADLINE'}),'timeout');assert.equal(classifyStatus(undefined,{code:'ECONNRESET'}),'unanswered');
});

test('AWS preserves callback and promise forms, synchronous errors and ordinary facade',async()=>{
 const {telemetry}=fixture(),value={},failure=Error('same'),client={token:Symbol(),send(command,callback){assert.equal(this,client);if(command.fail)throw failure;if(callback){callback(null,value);return 'callback-return';}return Promise.resolve(value);},destroy(){return this.token;}};
 class DescribeTasksCommand{};const wrapped=countingAwsClient(client,telemetry);
 assert.equal(types.isProxy(wrapped),false);assert.equal(countingAwsClient(wrapped,telemetry),wrapped);assert.equal(wrapped.destroy(),client.token);
 await telemetry.within(binding,async()=>{
  assert.equal(await wrapped.send(new DescribeTasksCommand()),value);
  assert.equal(wrapped.send(new DescribeTasksCommand(),(error,result)=>{assert.equal(error,null);assert.equal(result,value);}), 'callback-return');
  assert.throws(()=>wrapped.send(Object.assign(new DescribeTasksCommand(),{fail:true})),e=>e===failure);
 });
 assert.deepEqual(telemetry.counters(binding).aws,{DescribeTasks:{success:2,error:1}});
});

test('pool and acquired-client queries count exactly once, including pool reuse of instrumented client',async()=>{
 const {telemetry}=fixture(),value={rows:[]},failure=Error('query'),release=()=>{},client={release,query(sql,callback){assert.equal(this,client);if(sql==='fail'){if(callback){callback(failure);return 'callback';}throw failure;}if(callback){callback(null,value);return 'callback';}return Promise.resolve(value);}};
 const pool={connect(callback){if(callback){callback(null,client,release);return 'connect-return';}return Promise.resolve(client);},query(...args){return client.query(...args);},end(){return 'ended';}};
 const counted=countingPool(pool,telemetry);assert.equal(counted,pool);assert.equal(types.isProxy(counted),false);assert.equal(countingPool(counted,telemetry),counted);
 await telemetry.within(binding,async()=>{
  assert.equal(await counted.connect(),client);assert.equal(await client.query('select'),value);
  assert.equal(await counted.query('select'),value);
  assert.equal(counted.connect((error,result,returnedRelease)=>{assert.equal(error,null);assert.equal(result,client);assert.equal(returnedRelease,release);}), 'connect-return');
  assert.equal(counted.query('select',(error,result)=>{assert.equal(error,null);assert.equal(result,value);}), 'callback');
  assert.throws(()=>client.query('fail'),e=>e===failure);
  counted.query('fail',error=>assert.equal(error,failure));
 });
 assert.equal(counted.end(),'ended');assert.equal(telemetry.counters(binding).db.statements,5);
});

test('throwing telemetry recorder never changes an I/O result or original error',async()=>{
 const result={status:200},failure=Error('port'),telemetry={now:()=>0,recordCore(){throw Error('recorder');},recordAws(){throw Error('recorder');},recordDb(){throw Error('recorder');}};
 assert.equal(await countingFetch(async()=>result,telemetry)('https://core.test/identity'),result);
 await assert.rejects(countingFetch(async()=>{throw failure;},telemetry)('https://core.test/context'),e=>e===failure);
 assert.equal(await countingPool({query:async()=>result},telemetry).query('private sql'),result);
 assert.equal(await countingAwsClient({send:async()=>result},telemetry).send({}),result);
});

test('immutable injected pool keeps identity and behavior while missed instrumentation is visible',async()=>{
 const {telemetry}=fixture(),result={rows:[]},query=async()=>result,connect=async()=>({query});
 const pool=Object.freeze({query,connect});
 assert.equal(countingPool(pool,telemetry),pool);assert.equal(pool.query,query);assert.equal(pool.connect,connect);
 assert.equal(await pool.query('select'),result);assert.equal(telemetry.telemetryDropped,1);
 assert.equal(countingPool(pool,telemetry),pool);assert.equal(telemetry.telemetryDropped,1);
});
