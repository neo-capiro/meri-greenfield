/** Synthetic structural dimensions only; no native packet, SQL engine or customer data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {snapshotOperationData} from '../../../packages/contracts/retrieval-0.2/operation-contracts.mjs';
import {rows,preservationRows} from './schema-contract.mjs';
import {preservationSnapshot,assertNamespaces} from './schema-preservation.mjs';
import {prepareOwnedApplicationSchema,verifyOwnedApplicationSchema} from './schema.mjs';
import {createScriptedSchemaFixture as scripted,fixtureMigrationBytes as ddl} from './schema.fixture.mjs';
const fields=['relations','columns','defaults','constraints','indexes','views','types','sequences','triggers','dependencies','comments','labels'];
const counts=[1000,3000,200,400,400,100,1000,100,100,1800,200,62];
const namespaces=Array.from({length:25},(_,i)=>({name:'evidence_'+String(i).padStart(2,'0'),owner:'qualification_owner'}));
const scope={mode:'preserve-declared-evidence',namespaces};
const bytes=x=>Buffer.byteLength(JSON.stringify(x));
const envelope=m=>[{unsupported:0,metadata:m}];
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function nodes(x){let n=0,stack=[x];while(stack.length){const v=stack.pop();n++;if(v&&typeof v==='object')stack.push(...Object.values(v));}return n;}
function complete(){let ordinal=0;const m=Object.fromEntries(fields.map((field,i)=>[field,Array.from({length:counts[i]},()=>{const n=ordinal++;return Object.fromEntries(Array.from({length:n<7129?18:17},(_,j)=>['k'+String(j).padStart(2,'0'),j===0?'tail-'+n:j%5===0?null:j%3===0?true:n+j]));})]));
 m.sequences[0].k00='9223372036854775807';m.columns[0].k00+='x'.repeat(1110747-bytes(m.columns));
 m.labels.at(-1).k00+='x'.repeat(3128280-bytes(envelope(m)));
 assert.equal(Object.values(m).reduce((n,a)=>n+a.length,0),8362);assert.equal(nodes(m),157658);assert.equal(nodes(envelope(m)),157661);assert.equal(bytes(m.columns),1110747);assert.equal(bytes(envelope(m)),3128280);return m;
}
function fixture(m,extra={}){const s=scripted({fixture:{schemaScope:scope},namespaces,preservedMetadata:m,...extra});s.call=()=>({...s.args(),deadlineMs:Date.now()+15000});return s;}
const writes=s=>s.log.filter(q=>ddl.includes(q.text));
const empty=()=>Object.fromEntries(fields.map(k=>[k,[]]));
const expectedNamespaces=()=>namespaces.map((n,i)=>({owner:n.owner,acl:null,oid:String(30000+i),name:n.name}));

test('complete measured dimensions pass both decoding stages without truncation',async()=>{
 const m=complete(),raw=envelope(m),before=JSON.stringify(raw),decoded=preservationRows({rows:raw});
 assert.deepEqual(decoded,raw);assert(Object.isFrozen(decoded));assert(Object.isFrozen(decoded[0].metadata.columns.at(-1)));
 const n=assertNamespaces(expectedNamespaces(),{schemaScope:scope,user:'qualification_owner'},false);
 const receipt=await preservationSnapshot(async()=>decoded,{schemaScope:scope},n);
 assert.equal(receipt.metadataSha256,digest({namespaces:n,metadata:m}));assert.equal(receipt.namespaceCount,25);
 assert.equal(JSON.stringify(raw),before);assert.equal(decoded[0].metadata.sequences[0].k00,'9223372036854775807');
});
test('complete measured dimensions install and reconstruct with all six exact migrations and original hash',async()=>{
 const m=complete(),s=fixture(m),r=await prepareOwnedApplicationSchema(s.call());const v=await verifyOwnedApplicationSchema({...s.call(),fixture:{...s.f,schemaSha256:r.schemaSha256}});
 assert.equal(v.schemaSha256,r.schemaSha256);assert.equal(v.preservation.metadataSha256,r.preservation.metadataSha256);assert.equal(r.relationCount,13);assert.equal(r.runtimeQualified,false);assert.equal(r.poolClosed,false);assert.deepEqual(writes(s).map(q=>q.text),ddl);assert.equal(s.state.commits,2);assert.equal(s.state.ended,0);
});
for(const field of fields)test(`entire ${field} tail participates in pre/post migration preservation`,async()=>{
 const m=complete(),s=fixture(m,{before(text){if(text===ddl.at(-1))m[field].at(-1).k00+='changed';}});
 await assert.rejects(prepareOwnedApplicationSchema(s.call()),e=>e.stage==='catalog'&&e.outcome==='UNKNOWN');assert.equal(writes(s).length,6);assert.equal(s.state.commits,0);assert.equal(s.state.ended,0);
});
for(const field of fields)test(`entire ${field} tail participates in reconstruction digest`,async()=>{
 const m=complete(),s=fixture(m),r=await prepareOwnedApplicationSchema(s.call());m[field].at(-1).k00+='changed';
 await assert.rejects(verifyOwnedApplicationSchema({...s.call(),fixture:{...s.f,schemaSha256:r.schemaSha256}}),e=>e.outcome==='READ_UNAVAILABLE');assert.equal(writes(s).length,6);assert.equal(s.state.commits,1);assert.equal(s.state.ended,0);
});
for(const count of[249999,250000,250001])test(`preservation fixed total node boundary ${count}`,()=>{
 const m=empty();m.labels=Array(count-16).fill(null);const raw=envelope(m);assert.equal(nodes(raw),count);assert(bytes(raw)<4194304);
 if(count<=250000)assert.deepEqual(preservationRows({rows:raw}),raw);else assert.throws(()=>preservationRows({rows:raw}));
});
for(const amount of[4194304,4194305])for(const multibyte of[false,true])test(`preservation exact serialized bytes ${amount} multibyte=${multibyte}`,()=>{
 const m=empty();m.labels=[''];const room=amount-bytes(envelope(m));m.labels[0]=(multibyte?'é'.repeat(Math.floor(room/2))+'x'.repeat(room%2):'x'.repeat(room));assert.equal(bytes(envelope(m)),amount);
 if(amount===4194304)assert.deepEqual(preservationRows({rows:envelope(m)}),envelope(m));else assert.throws(()=>preservationRows({rows:envelope(m)}));
});
for(const depth of[64,65])test(`preservation exact depth ${depth}`,()=>{
 let nested=null;for(let i=0;i<depth-4;i++)nested={x:nested};const m=empty();m.labels=[nested];
 if(depth===64)assert.doesNotThrow(()=>preservationRows({rows:envelope(m)}));else assert.throws(()=>preservationRows({rows:envelope(m)}));
});
for(const kind of['proxy','accessor','cycle','sparse','hidden','symbol','nan','infinity'])test(`preservation inert ${kind} refuses without hook execution`,()=>{
 let touched=0;const m=empty();
 if(kind==='proxy')m.labels=new Proxy([],{ownKeys(){touched++;return[];}});
 if(kind==='accessor')Object.defineProperty(m,'labels',{enumerable:true,get(){touched++;return[];}});
 if(kind==='cycle')m.labels=[m];if(kind==='sparse')m.labels=Array(3);if(kind==='hidden')Object.defineProperty(m,'secret',{value:1});if(kind==='symbol')m[Symbol('x')]=1;if(kind==='nan')m.labels=[NaN];if(kind==='infinity')m.labels=[Infinity];
 assert.throws(()=>preservationRows({rows:envelope(m)}));assert.equal(touched,0);
});
test('ordinary node/depth/byte/row limits remain separate and unchanged',()=>{
 assert.equal(nodes(Array(99999).fill(null)),100000);assert.doesNotThrow(()=>snapshotOperationData(Array(99999).fill(null)));assert.throws(()=>snapshotOperationData(Array(100000).fill(null)));
 const value=[{padding:''}];value[0].padding='x'.repeat(1048576-bytes(value));assert.doesNotThrow(()=>rows({rows:value}));value[0].padding+='x';assert.throws(()=>rows({rows:value}));assert.equal(rows({rows:Array(1024).fill(null)}).length,1024);assert.throws(()=>rows({rows:Array(1025).fill(null)}));
 assert.throws(()=>snapshotOperationData(complete()));let deep=null;for(let i=0;i<65;i++)deep={x:deep};assert.throws(()=>snapshotOperationData(deep));
});
test('exact row count, closed metadata and unsupported-object refusal remain',async()=>{
 const m=empty();assert.throws(()=>preservationRows({rows:[]}));assert.throws(()=>preservationRows({rows:[...envelope(m),...envelope(m)]}));
 await assert.rejects(preservationSnapshot(async()=>[{unsupported:1,metadata:m}],{schemaScope:scope},[]));
 await assert.rejects(preservationSnapshot(async()=>[{unsupported:0,metadata:{...m,extra:[]}}],{schemaScope:scope},[]));
});
test('post-DDL node overflow cannot commit or claim rollback success',async()=>{
 const m=complete(),s=fixture(m,{before(text){if(text===ddl.at(-1))m.labels=Array(250001).fill(null);}});
 await assert.rejects(prepareOwnedApplicationSchema(s.call()),e=>e.outcome==='UNKNOWN');assert.equal(writes(s).length,6);assert.equal(s.state.commits,0);
});
test('lost COMMIT acknowledgement preserves UNKNOWN and does not retry',async()=>{
 const s=fixture(complete(),{loseCommit:true});await assert.rejects(prepareOwnedApplicationSchema(s.call()),e=>e.stage==='commit'&&e.outcome==='UNKNOWN');assert.equal(writes(s).length,6);assert.equal(s.state.commits,1);assert.equal(s.log.filter(q=>q.text==='COMMIT').length,1);assert.equal(s.state.ended,0);
});
test('complete measured metadata independently passes the downstream snapshot choke point',async()=>{
 const m=complete(),n=assertNamespaces(expectedNamespaces(),{schemaScope:scope,user:'qualification_owner'},false);
 const result=await preservationSnapshot(async()=>envelope(m),{schemaScope:scope},n);
 assert.equal(result.metadataSha256,digest({namespaces:n,metadata:m}));
});
test('ordinary callers cannot widen resource limits with a second argument',()=>{
 assert.throws(()=>snapshotOperationData(Array(100000).fill(null),{nodes:1000000,depth:1000,bytes:32000000}));
 const m=empty();m.labels=Array(250001).fill(null);
 assert.throws(()=>preservationRows({rows:envelope(m)},{nodes:1000000,maxNodes:1000000,maxBytes:32000000}));
});
