import test from 'node:test';
import assert from 'node:assert/strict';
import * as contract from './schema-contract.mjs';
import {prepareOwnedApplicationSchema as prepare,verifyOwnedApplicationSchema as verify} from './schema.mjs';
import {preservationSnapshot} from './schema-preservation.mjs';
import {createScriptedSchemaFixture as scripted,fixtureMigrationBytes as ddl} from './schema.fixture.mjs';

const MiB=1024*1024,measuredBytes=3128280;
const fields=['relations','columns','defaults','constraints','indexes','views','types','sequences','triggers','dependencies','comments','labels'];
const namespaces=Array.from({length:25},(_,i)=>({name:`retained_${String(i).padStart(2,'0')}`,owner:'qualification_owner'}));
const scope={mode:'preserve-declared-evidence',namespaces};
const bytes=value=>Buffer.byteLength(JSON.stringify(value),'utf8');
const preservation=value=>contract.preservationRows({rows:value});
function sizedRows(size,multibyte=false){
 const value=[{payload:''}],n=size-bytes(value);assert(n>=0);
 value[0].payload=multibyte?'😀'.repeat(Math.floor(n/4))+'x'.repeat(n%4):'x'.repeat(n);
 assert.equal(bytes(value),size);return value;
}
function inventory(size=measuredBytes){
 const metadata=Object.fromEntries(fields.map((field,k)=>[field,Array.from({length:25},(_,i)=>({oid:30000+k*25+i,namespace:namespaces[i].name,definition:`synthetic-${field}-${i}`,acl:null}))]));
 metadata.labels.at(-1).tail='';const rows=[{unsupported:0,metadata}];
 metadata.labels.at(-1).tail='λ'.repeat(Math.floor((size-bytes(rows))/2))+'x'.repeat((size-bytes(rows))%2);
 assert.equal(bytes(rows),size);return {rows,metadata};
}
function fixture(metadata,extra={}){return scripted({fixture:{schemaScope:scope},namespaces,preservedMetadata:metadata,...extra});}
const migrationsRun=s=>s.log.filter(q=>ddl.includes(q.text)).length;
function expectError(outcome,stage){return e=>{assert.equal(e.code,'QUALIFICATION_SCHEMA_REFUSED');assert.equal(e.outcome,outcome);if(stage)assert.equal(e.stage,stage);return true;};}
function replaceResult(s,condition,value){const connect=s.pool.connect.bind(s.pool);s.pool.connect=async()=>{const c=await connect(),query=c.query.bind(c);c.query=async q=>{const r=await query(q);return condition(q.text)?{rows:value}:r;};return c;};}

for(const size of [MiB-1,MiB])test(`ordinary rows accepts exact UTF8 ${size} bytes`,()=>assert.deepEqual(contract.rows({rows:sizedRows(size,true)}),sizedRows(size,true)));
test('ordinary default refuses one byte over1MiB even if caller supplies larger second argument',()=>assert.throws(()=>contract.rows({rows:sizedRows(MiB+1)},4*MiB)));
for(const size of [4*MiB-1,4*MiB])test(`preservation accepts exact UTF8 ${size} bytes`,()=>{
 const raw=sizedRows(size,true),result=preservation(raw);assert.equal(bytes(result),size);assert.deepEqual(result,raw);assert.notEqual(result,raw);assert(Object.isFrozen(result));
});
test('preservation refuses UTF8 byte overflow even with fewer than4MiB JS characters',()=>{const raw=sizedRows(4*MiB+1,true);assert(JSON.stringify(raw).length<4*MiB);assert.throws(()=>preservation(raw));});
test('preservation refuses plain ASCII byte overflow',()=>assert.throws(()=>preservation(sizedRows(4*MiB+1))));
test('preservation exact one row; ordinary1024 rows ceiling unchanged',()=>{
 assert.throws(()=>preservation([]));assert.throws(()=>preservation([{},{}]));assert.throws(()=>preservation({}));
 assert.equal(contract.rows({rows:Array.from({length:1024},()=>null)}).length,1024);assert.throws(()=>contract.rows({rows:Array.from({length:1025},()=>null)}));
});
test('both admissions reject Proxy and accessors without invocation',()=>{
 let effects=0;const proxy=new Proxy({}, {get(){effects++;throw Error('trap');},ownKeys(){effects++;throw Error('trap');},getPrototypeOf(){effects++;throw Error('trap');}});
 for(const fn of [contract.rows,contract.preservationRows]){
  assert.equal(typeof fn,'function');assert.throws(()=>fn(proxy));assert.throws(()=>fn({get rows(){effects++;return [];}}));
  assert.throws(()=>fn({rows:[proxy]}));assert.throws(()=>fn({rows:[{get secret(){effects++;return 'value';}}]}));
 }
 assert.equal(effects,0);
});
test('preservation keeps node and depth guards despite larger byte limit',()=>{
 assert.throws(()=>preservation([{values:Array.from({length:100001},()=>0)}]));
 let deep={};for(let i=0;i<66;i++)deep={next:deep};assert.throws(()=>preservation([deep]));
 const cycle={};cycle.self=cycle;assert.throws(()=>preservation([cycle]));
});
test('all3,128,280 bytes survive preparation and reconstruction unchanged',async()=>{
 const {metadata}=inventory(),before=JSON.stringify(metadata),s=fixture(metadata);
 const r=await prepare(s.args());assert.equal(r.status,'PASS');assert.equal(r.preservation.namespaceCount,25);
 const rebuilt=await verify({...s.args(),fixture:{...s.f,schemaSha256:r.schemaSha256}});
 assert.equal(rebuilt.schemaSha256,r.schemaSha256);assert.deepEqual(rebuilt.preservation,r.preservation);
 assert.equal(JSON.stringify(metadata),before);assert.equal(migrationsRun(s),6);assert.equal(s.state.commits,2);assert.equal(s.state.ended,0);assert.equal(s.releases.length,2);
});
test('mutating the final byte of every metadata array changes retained signature',async()=>{
 const {rows,metadata}=inventory();const f={schemaScope:scope};
 const snap=()=>preservationSnapshot(async()=>preservation(rows),f,namespaces);
 const baseline=await snap();
 for(const field of fields){const row=metadata[field].at(-1);row.definition+='!';assert.notEqual((await snap()).metadataSha256,baseline.metadataSha256,field);row.definition=row.definition.slice(0,-1);}
 const tail=metadata.labels.at(-1);tail.tail=tail.tail.slice(0,-1)+(tail.tail.endsWith('z')?'y':'z');assert.notEqual((await snap()).metadataSha256,baseline.metadataSha256);
});
test('changed measured-inventory tail refuses later reconstruction with no additional DDL',async()=>{
 const {metadata}=inventory(),s=fixture(metadata),r=await prepare(s.args());metadata.labels.at(-1).tail+='!';
 await assert.rejects(verify({...s.args(),fixture:{...s.f,schemaSha256:r.schemaSha256}}),expectError('READ_UNAVAILABLE'));assert.equal(migrationsRun(s),6);assert.equal(s.state.commits,1);assert.equal(s.state.ended,0);
});
test('oversized preservation refuses before first DDL and releases borrowed connection',async()=>{
 const s=fixture(inventory(4*MiB+1).metadata);await assert.rejects(prepare(s.args()),expectError('NOT_INSTALLED','preservation'));
 assert.equal(migrationsRun(s),0);assert.equal(s.state.commits,0);assert.equal(s.releases.length,1);assert.equal(s.state.ended,0);assert(s.log.some(q=>q.text==='ROLLBACK'));
});
test('post-DDL snapshot overflow remains UNKNOWN, never downgraded to not installed',async()=>{
 const {metadata}=inventory(),s=fixture(metadata,{before(text){if(text===ddl.at(-1))metadata.labels.at(-1).tail+='x'.repeat(2*MiB);}});
 await assert.rejects(prepare(s.args()),expectError('UNKNOWN'));assert.equal(migrationsRun(s),6);assert.equal(s.state.commits,0);assert.equal(s.state.ended,0);assert.equal(s.releases.length,1);
});
test('same-size post-DDL last-character mutation remains UNKNOWN',async()=>{
 const {metadata}=inventory(),s=fixture(metadata,{before(text){if(text===ddl.at(-1)){const r=metadata.labels.at(-1);r.tail=r.tail.slice(0,-1)+'z';}}});
 await assert.rejects(prepare(s.args()),expectError('UNKNOWN'));assert.equal(migrationsRun(s),6);assert.equal(s.state.commits,0);
});
test('measured inventory with unsupported object still refuses before DDL',async()=>{
 const s=fixture(inventory().metadata,{unsupported:1});await assert.rejects(prepare(s.args()),expectError('NOT_INSTALLED','preservation'));assert.equal(migrationsRun(s),0);
});
for(const change of [m=>{m.labels={};},m=>{delete m.columns;},m=>{m.extra=[];}])test('large admission does not weaken closed metadata array shape',async()=>{
 const {metadata}=inventory();change(metadata);const s=fixture(metadata);await assert.rejects(prepare(s.args()),expectError('NOT_INSTALLED','preservation'));assert.equal(migrationsRun(s),0);
});
test('nonpreservation query still rejects oversized rows before shape interpretation',async()=>{
 const s=fixture(inventory().metadata);replaceResult(s,text=>text.startsWith('SELECT current_database()'),sizedRows(MiB+1));await assert.rejects(prepare(s.args()),expectError('NOT_INSTALLED','identity'));assert.equal(migrationsRun(s),0);
});
test('preservation SQL alone gets larger limit and retains exact namespace parameters',async()=>{
 const s=fixture(inventory().metadata);await prepare(s.args());const calls=s.log.filter(q=>q.text.startsWith('WITH ns AS'));
 assert.equal(calls.length,2);for(const q of calls){assert.deepEqual(q.values,[namespaces.map(n=>n.name)]);assert.doesNotMatch(q.text,/last_value|prosrc|pg_get_functiondef/);}
});
test('commit acknowledgement loss stays UNKNOWN with measured inventory',async()=>{
 const s=fixture(inventory().metadata,{loseCommit:true});await assert.rejects(prepare(s.args()),expectError('UNKNOWN','commit'));assert.equal(migrationsRun(s),6);assert.equal(s.state.commits,1);assert.equal(s.releases.length,1);assert(s.releases[0]);
});
