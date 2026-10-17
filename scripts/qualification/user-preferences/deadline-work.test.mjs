import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createDeadlineWork,isDeadlineWorkError} from './deadline-work.mjs';

function clock(initial=0){
 let at=initial,next=0;const timers=new Map();
 return {
  now:()=>at,setTimer(fn,ms){const id=++next;timers.set(id,{fn,at:at+ms});return id;},clearTimer:id=>timers.delete(id),
  jump(ms){at+=ms;},advance(ms){at+=ms;for(const [id,timer]of [...timers].sort((a,b)=>a[1].at-b[1].at))if(timer.at<=at){timers.delete(id);timer.fn();}},
  pending:()=>timers.size,
 };
}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
const work=(time,deadlineMs)=>createDeadlineWork({deadlineMs,now:time.now,setTimer:time.setTimer,clearTimer:time.clearTimer});
const deadline=started=>error=>isDeadlineWorkError(error)&&error.code==='PG_NORMAL_WORK_DEADLINE'&&error.started===started&&!Object.hasOwn(error,'outcome');
const unknown=started=>error=>isDeadlineWorkError(error)&&error.code==='PG_NORMAL_WORK_UNKNOWN'&&error.outcome==='UNKNOWN'&&error.started===started&&error.cancelled===false;

test('construction is inert and expired work allocates no client or timer',async()=>{
 const normal=createDeadlineWork({deadlineMs:100,now:()=>100,setTimer(){assert.fail('expired work acquired timer');},clearTimer(){assert.fail('expired work cleared unowned timer');}});
 await assert.rejects(normal.connect(()=>assert.fail('expired work allocated client')),deadline(false));
 await assert.rejects(normal.query({query(){assert.fail('expired work invoked query');}},'NEVER'),deadline(false));
 assert.throws(()=>createDeadlineWork({deadlineMs:NaN}),/PG_NORMAL_WORK_CONFIGURATION/u);
 createDeadlineWork({deadlineMs:100,now(){assert.fail('construction read clock');},setTimer(){assert.fail('construction acquired timer');}});
});

test('a slow successful sequence cannot issue its next SQL at the normal-work reserve',async()=>{
 const time=clock(),normal=work(time,100),calls=[],client={query(config){calls.push(config);time.jump(60);return {rows:[{synthetic:true}]};}};
 assert.deepEqual(await normal.query(client,'FIRST'),{rows:[{synthetic:true}]});
 time.jump(40);await assert.rejects(normal.query(client,'AFTER_RESERVE'),deadline(false));
 assert.deepEqual(calls,[{text:'FIRST',values:undefined,query_timeout:100}]);assert.equal(time.pending(),0);
});

test('connect rechecks after owned-client allocation and never invokes a driver after the reserve',async()=>{
 const time=clock(),normal=work(time,100),owned=[];let connects=0;
 await assert.rejects(normal.connect(timeout=>{assert.equal(timeout,100);const client={connect(){connects++;}};owned.push(client);time.jump(100);return client;}),deadline(false));
 assert.equal(owned.length,1,'caller retains allocated client for separate cleanup');assert.equal(connects,0);assert.equal(time.pending(),0);
});

test('connection and query driver limits are capped to the remaining normal-work time',async()=>{
 const time=clock(),normal=work(time,10000),query=deferred(),calls=[];
 const client=await normal.connect(timeout=>{assert.equal(timeout,3000);return {connect:()=>undefined,query(config){calls.push(config);return query.promise;}};});
 time.jump(9900);const pending=normal.query(client,'SYNTHETIC',['value']);assert.deepEqual(calls,[{text:'SYNTHETIC',values:['value'],query_timeout:100}]);
 time.jump(99);query.resolve({rowCount:1});assert.deepEqual(await pending,{rowCount:1});assert.equal(time.pending(),0);
});

test('a late connection remains unknown and cannot admit any subsequent SQL',async()=>{
 const time=clock(),normal=work(time,100),connection=deferred();let queries=0,closes=0,connects=0;
 const client={connect(){connects++;return connection.promise;},query(){queries++;},end(){closes++;}};
 const pending=normal.connect(()=>client),rejected=assert.rejects(pending,unknown(true));time.advance(100);await rejected;
 connection.resolve();await Promise.resolve();await Promise.resolve();
 await assert.rejects(normal.query(client,'NEVER_AFTER_LATE_CONNECT'),unknown(false));
 await assert.rejects(normal.connect(()=>assert.fail('uncertainty allocated another client')),unknown(false));
 assert.deepEqual({connects,queries,closes},{connects:1,queries:0,closes:0});assert.equal(time.pending(),0);
 await client.end();assert.equal(closes,1,'cleanup remains separately owned and permitted');
});

test('an in-flight query timeout is unknown rather than physical cancellation or safe retry',async()=>{
 const time=clock(),normal=work(time,20000),response=deferred();let completed=0,calls=0,cancels=0;
 const client={query(config){calls++;assert.equal(config.query_timeout,7000);return response.promise.then(value=>{completed++;return value;});},cancel(){cancels++;}};
 const pending=normal.query(client,'SYNTHETIC_EFFECT'),rejected=assert.rejects(pending,unknown(true));time.advance(7000);await rejected;
 response.resolve({syntheticEffect:true});await Promise.resolve();await Promise.resolve();
 assert.deepEqual({completed,calls,cancels},{completed:1,calls:1,cancels:0});await assert.rejects(normal.query(client,'NO_RETRY'),unknown(false));assert.equal(time.pending(),0);
});

test('a late acknowledgement is rejected even when the timer callback has not run',async()=>{
 const time=clock(),normal=work(time,50),response=deferred();const pending=normal.query({query:()=>response.promise},'SYNTHETIC');
 time.jump(50);response.resolve({rows:['late']});await assert.rejects(pending,unknown(true));assert.equal(time.pending(),0);
});

test('a late driver rejection is handled while the known SQL trigger refusal remains exact',async()=>{
 const time=clock(),normal=work(time,20000),response=deferred(),pending=normal.query({query:()=>response.promise},'SYNTHETIC');
 const rejected=assert.rejects(pending,unknown(true));time.advance(7000);await rejected;response.reject(Error('late synthetic driver rejection'));await Promise.resolve();await Promise.resolve();assert.equal(time.pending(),0);
 const current=clock(),fresh=work(current,100),trigger=Object.assign(Error('synthetic trigger refusal'),{code:'P0001'});
 await assert.rejects(fresh.query({query:()=>Promise.reject(trigger)},'SYNTHETIC_TRIGGER'),error=>error===trigger&&!isDeadlineWorkError(error));assert.equal(current.pending(),0);
 assert.equal(isDeadlineWorkError(Object.assign(Error('lookalike'),{code:'PG_NORMAL_WORK_UNKNOWN'})),false);
});

test('CLI help remains inert with process, connection and filesystem mutation ports forbidden',()=>{
 const cli=new URL('./cli.mjs',import.meta.url).href;
 const script=`import net from 'node:net';import tls from 'node:tls';import cp from 'node:child_process';import fs from 'node:fs/promises';import {syncBuiltinESMExports} from 'node:module';
 const forbidden=()=>{throw Error('RESOURCE_ACQUIRED_BY_HELP');};net.connect=net.createConnection=tls.connect=forbidden;for(const key of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])cp[key]=forbidden;for(const key of ['mkdir','writeFile','rm','unlink','rename'])fs[key]=forbidden;syncBuiltinESMExports();process.argv=['node','cli','--help'];await import(${JSON.stringify(cli)});`;
 const stdout=execFileSync(process.execPath,['--input-type=module','--eval',script],{encoding:'utf8',timeout:5000,windowsHide:true});
 assert.match(stdout,/Usage: node scripts\/qualification\/user-preferences\/cli[.]mjs --help/u);assert.doesNotMatch(stdout,/RESOURCE_ACQUIRED/u);
});
