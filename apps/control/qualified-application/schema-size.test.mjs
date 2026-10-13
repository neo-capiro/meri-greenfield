/** Scripted metadata only: no native database or native evidence is read. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareOwnedApplicationSchema,verifyOwnedApplicationSchema} from './schema.mjs';
import {rows} from './schema-contract.mjs';
import {createScriptedSchemaFixture as scripted,fixtureMigrationBytes as ddl} from './schema.fixture.mjs';
const LIMIT=4*1024*1024,ORDINARY=1024*1024,MEASURED=3128280;
const namespaces=Array.from({length:27},(_,i)=>({name:`evidence_${String(i).padStart(2,'0')}`,owner:'qualification_owner'}));
const scope={mode:'preserve-declared-evidence',namespaces};
const fields=['relations','columns','defaults','constraints','indexes','views','types','sequences','triggers','dependencies','comments','labels'];
const bytes=x=>Buffer.byteLength(JSON.stringify(x),'utf8');
function metadata(size,multibyte=false){
 const m=Object.fromEntries(fields.map(kind=>[kind,namespaces.map((n,i)=>({namespace:n.name,ordinal:i,kind,marker:'retained'}))]));
 const tail=m.labels.at(-1);tail.definition='';const remaining=size-bytes([{unsupported:0,metadata:m}]);assert(remaining>=0);
 tail.definition=multibyte?'é'.repeat(Math.floor(remaining/2))+'x'.repeat(remaining%2):'x'.repeat(remaining);
 assert.equal(bytes([{unsupported:0,metadata:m}]),size);return m;
}
const fixture=(m,extra={})=>scripted({fixture:{schemaScope:scope},namespaces,preservedMetadata:m,...extra});
const writes=s=>s.log.filter(q=>ddl.includes(q.text));
for(const [size,multi]of [[MEASURED,false],[LIMIT,false],[LIMIT,true]])test(`complete ${size}-byte ${multi?'multibyte':'ASCII'} inventory installs and reconstructs exactly`,async()=>{
 const m=metadata(size,multi),before=JSON.stringify(m),s=fixture(m),r=await prepareOwnedApplicationSchema(s.args());
 const v=await verifyOwnedApplicationSchema({...s.args(),fixture:{...s.f,schemaSha256:r.schemaSha256}});
 assert.equal(v.schemaSha256,r.schemaSha256);assert.equal(v.preservation.metadataSha256,r.preservation.metadataSha256);assert.equal(JSON.stringify(m),before);assert.equal(writes(s).length,6);assert.equal(s.state.commits,2);assert.equal(s.state.ended,0);
});
for(const multi of [false,true])test(`preservation byte+1 ${multi?'multibyte':'ASCII'} refuses before any DDL`,async()=>{
 const s=fixture(metadata(LIMIT+1,multi));await assert.rejects(prepareOwnedApplicationSchema(s.args()),e=>e.stage==='preservation'&&e.outcome==='NOT_INSTALLED');assert.equal(writes(s).length,0);assert.equal(s.state.commits,0);assert.equal(s.state.ended,0);
});
test('complete measured-size tail change during migration is UNKNOWN, never successful preservation',async()=>{
 const m=metadata(MEASURED),s=fixture(m,{before(text){if(text===ddl[5])m.labels.at(-1).definition=m.labels.at(-1).definition.slice(0,-1)+'y';}});
 await assert.rejects(prepareOwnedApplicationSchema(s.args()),e=>e.outcome==='UNKNOWN');assert.equal(writes(s).length,6);assert.equal(s.state.commits,0);
});
test('complete measured-size tail change on reconstruction refuses without rewriting',async()=>{
 const m=metadata(MEASURED),s=fixture(m),r=await prepareOwnedApplicationSchema(s.args());m.labels.at(-1).definition=m.labels.at(-1).definition.slice(0,-1)+'y';
 await assert.rejects(verifyOwnedApplicationSchema({...s.args(),fixture:{...s.f,schemaSha256:r.schemaSha256}}),e=>e.outcome==='READ_UNAVAILABLE');assert.equal(writes(s).length,6);assert.equal(s.state.commits,1);
});
test('overflow after submitted migrations remains UNKNOWN and cannot COMMIT',async()=>{
 const m=metadata(LIMIT),s=fixture(m,{before(text){if(text===ddl[5])m.labels.at(-1).definition+='x';}});
 await assert.rejects(prepareOwnedApplicationSchema(s.args()),e=>e.outcome==='UNKNOWN');assert.equal(writes(s).length,6);assert.equal(s.state.commits,0);
});
test('ordinary rows retain exact1MiB/+1 UTF8 boundary and1024 row ceiling',()=>{
 const input=[{text:''}];input[0].text='é'.repeat(Math.floor((ORDINARY-bytes(input))/2))+'x'.repeat((ORDINARY-bytes(input))%2);assert.equal(bytes(input),ORDINARY);assert.deepEqual(rows({rows:input}),input);input[0].text+='x';assert.throws(()=>rows({rows:input}));assert.equal(rows({rows:Array(1024).fill(null)}).length,1024);assert.throws(()=>rows({rows:Array(1025).fill(null)}));
});
for(const kind of ['count','depth','nodes','accessor','proxy','metadata-shape','unsupported'])test(`preservation ${kind} guard survives scoped byte ceiling`,async()=>{
 let touched=0;const m=metadata(MEASURED),s=fixture(m),connect=s.pool.connect.bind(s.pool);
 s.pool.connect=async()=>{const c=await connect(),query=c.query.bind(c);c.query=async q=>{const r=await query(q);if(!q.text.startsWith('WITH ns AS'))return r;
  if(kind==='count')r.rows.push(structuredClone(r.rows[0]));
  if(kind==='depth'){let nested={};for(let i=0;i<65;i++)nested={nested};r.rows[0].metadata.labels=[nested];}
  if(kind==='nodes')r.rows[0].metadata.labels=Array(250001).fill(null);
  if(kind==='accessor')Object.defineProperty(r.rows[0].metadata,'labels',{enumerable:true,get(){touched++;return [];}});
  if(kind==='proxy')r.rows[0].metadata.labels=new Proxy([],{ownKeys(){touched++;return [];}});
  if(kind==='metadata-shape')r.rows[0].metadata.extra=[];
  if(kind==='unsupported')r.rows[0].unsupported=1;
  return r;};return c;};
 await assert.rejects(prepareOwnedApplicationSchema(s.args()),e=>e.outcome==='NOT_INSTALLED');assert.equal(writes(s).length,0);assert.equal(s.state.commits,0);assert.equal(touched,0);
});
test('ordinary catalog does not acquire preservation4MiB allowance',async()=>{
 const m=metadata(MEASURED),s=fixture(m,{preexisting:[{padding:'x'.repeat(ORDINARY)}]});await assert.rejects(prepareOwnedApplicationSchema(s.args()),e=>e.outcome==='NOT_INSTALLED'&&e.stage==='ownership');assert.equal(writes(s).length,0);
});
