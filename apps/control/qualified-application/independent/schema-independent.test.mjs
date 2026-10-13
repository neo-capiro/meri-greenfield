import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareOwnedApplicationSchema as prepare,verifyOwnedApplicationSchema as verify} from '../schema.mjs';

// Only scripted boundary receipts; this does not execute or emulate PostgreSQL.
const descriptor=()=>({mode:'owned-disposable-qualification',fixtureId:'11111111-1111-1111-1111-111111111111',host:'127.0.0.1',port:55432,database:'meri_qualification_test',user:'qualification_owner',systemIdentifier:'1234567890123456789',serverStartTime:'2026-10-13T00:00:00.000Z',serverVersion:'170011',schemaSha256:null});
function boundary({identity={},namespaces=[],before=async()=>{},connect=async()=>{},release=()=>{}}={}){
 const fixture=descriptor(),queries=[],released=[];let acquisitions=0,ended=0;
 const pool={options:{host:fixture.host,port:fixture.port,database:fixture.database,user:fixture.user,connectionTimeoutMillis:5000,query_timeout:6000},async connect(){acquisitions++;await connect();return {async query(config){const {text}=config;queries.push(text);await before(text);if(text.startsWith('SELECT current_database()'))return {rows:[{database:fixture.database,username:fixture.user,address:fixture.host,port:fixture.port,version:fixture.serverVersion,start_ms:String(Date.parse(fixture.serverStartTime)),fsync:'on',synchronous_commit:'on',system_identifier:fixture.systemIdentifier,search_path:'public',...identity}]};if(text.startsWith('SELECT pg_catalog.pg_try'))return {rows:[{acquired:true}]};if(text.startsWith('SELECT nspname'))return {rows:namespaces};return {rows:[]};},release(error){released.push(error);release(error);}};},end(){ended++;}};
 return {pool,fixture,queries,released,get acquisitions(){return acquisitions;},get ended(){return ended;},args:()=>({pool,fixture,deadlineMs:Date.now()+5000})};
}
const denied=(outcome,stage)=>e=>e.code==='QUALIFICATION_SCHEMA_REFUSED'&&e.outcome===outcome&&(!stage||e.stage===stage)&&!JSON.stringify(e).includes('PRIVATE');
test('namespace query must not hide pgx_private through SQL underscore wildcard',async()=>{
 const b=boundary({namespaces:[{name:'pgx_private'}]});await assert.rejects(prepare(b.args()),denied('NOT_INSTALLED','ownership'));
 const sql=b.queries.find(s=>s.startsWith('SELECT nspname'));
 assert.ok(sql);assert.equal(sql.includes("NOT LIKE 'pg_%'"),false,'underscore must be literal when excluding reserved pg_ namespaces');
 assert.equal(b.queries.some(s=>s.includes('CREATE TABLE')),false);
});
for(const [key,value]of [['address','192.0.2.1'],['username','postgres'],['system_identifier','234'],['start_ms','1'],['fsync','off'],['synchronous_commit','off']])test(`independent engine identity ${key} refuses before DDL`,async()=>{
 const b=boundary({identity:{[key]:value}});await assert.rejects(prepare(b.args()),denied('NOT_INSTALLED','identity'));assert.equal(b.queries.some(s=>s.includes('CREATE TABLE')),false);assert.equal(b.released.length,1);assert.equal(b.ended,0);
});
test('own and inherited hostile port accessors and proxy cannot run during admission',async()=>{
 let effects=0;const b=boundary();for(const pool of [new Proxy(b.pool,{get(){effects++;throw Error('PRIVATE');}}),Object.create({get connect(){effects++;throw Error('PRIVATE');}})])await assert.rejects(prepare({...b.args(),pool}),denied('NOT_INSTALLED'));assert.equal(effects,0);assert.equal(b.acquisitions,0);
});
test('verify without retained digest and install with a retained digest allocate nothing',async()=>{
 const b=boundary();await assert.rejects(verify(b.args()),denied('READ_UNAVAILABLE','admission'));await assert.rejects(prepare({...b.args(),fixture:{...b.fixture,schemaSha256:'a'.repeat(64)}}),denied('NOT_INSTALLED','admission'));assert.equal(b.acquisitions,0);
});
test('cancel during borrowed acquisition releases late client and sends no SQL',async()=>{
 let arrived,resolve;const entered=new Promise(r=>arrived=r),gate=new Promise(r=>resolve=r),abort=new AbortController();const b=boundary({connect:async()=>{arrived();await gate;}});const p=prepare({...b.args(),signal:abort.signal});await entered;abort.abort();await assert.rejects(p,denied('NOT_INSTALLED'));resolve();await new Promise(r=>setTimeout(r,10));assert.equal(b.queries.length,0);assert.equal(b.released.length,1);assert.equal(b.ended,0);
});
test('cancellation while advisory lock waits prevents first migration after it returns',async()=>{
 let arrive,resolve;const entered=new Promise(r=>arrive=r),gate=new Promise(r=>resolve=r),abort=new AbortController();const b=boundary({before:async text=>{if(text.startsWith('SELECT pg_catalog.pg_try')){arrive();await gate;}}});const p=prepare({...b.args(),signal:abort.signal});await entered;abort.abort();await assert.rejects(p,denied('NOT_INSTALLED','ownership'));resolve();await new Promise(r=>setTimeout(r,10));assert.equal(b.queries.some(s=>s.includes('CREATE TABLE')),false);assert.equal(b.queries.includes('COMMIT'),false);assert.equal(b.queries.includes('ROLLBACK'),true);assert.equal(b.released.length,1);
});
test('first submitted migration failure is terminal UNKNOWN, not a clean pre-effect refusal',async()=>{
 const b=boundary({before(text){if(text.includes('CREATE TABLE'))throw new Proxy({}, {get(){throw Error('PRIVATE');},getPrototypeOf(){throw Error('PRIVATE');}});}});await assert.rejects(prepare(b.args()),denied('UNKNOWN','migration'));assert.equal(b.queries.filter(s=>s.includes('CREATE TABLE')).length,1);assert.equal(b.queries.includes('COMMIT'),false);assert.equal(b.released.length,1);assert.equal(b.ended,0);
});
test('host clock crossing original cutoff after identity cannot proceed to ownership or DDL',async()=>{
 let now=Date.now();const b=boundary({before(text){if(text.startsWith('SELECT current_database'))now+=101;}});await assert.rejects(prepare({...b.args(),now:()=>now,deadlineMs:now+100}),denied('NOT_INSTALLED','identity'));assert.equal(b.queries.some(s=>s.startsWith('SELECT pg_catalog.pg_try')),false);assert.equal(b.queries.some(s=>s.includes('CREATE TABLE')),false);
});
