/** Synthetic catalog dimensions only; no native packet, PostgreSQL or SQL execution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotOperationData} from '../../../packages/contracts/retrieval-0.2/operation-contracts.mjs';
import {rows,preservationRows} from './schema-contract.mjs';
import {preservationSnapshot} from './schema-preservation.mjs';
import {prepareOwnedApplicationSchema as prepare,verifyOwnedApplicationSchema as verify} from './schema.mjs';
import {createScriptedSchemaFixture as scripted,fixtureMigrationBytes as ddl} from './schema.fixture.mjs';
const fields=['relations','columns','defaults','constraints','indexes','views','types','sequences','triggers','dependencies','comments','labels'];
const bytes=value=>Buffer.byteLength(JSON.stringify(value),'utf8');
const nodes=value=>1+(value!==null&&typeof value==='object'?Object.values(value).reduce((n,x)=>n+nodes(x),0):0);
const namespaces=Array.from({length:25},(_,i)=>({name:`evidence_${i}`,owner:'qualification_owner'}));
const scope={mode:'preserve-declared-evidence',namespaces};
function inventory(){
 const metadata={};let ordinal=0,other=0;
 for(const kind of fields){
  const count=kind==='columns'?3000:487+(other++<5?1:0);
  metadata[kind]=Array.from({length:count},()=>{
   const n=ordinal++,r={oid:n+30000,namespace:`evidence_${n%25}`,kind,name:`object_${n}`,owner:'qualification_owner',acl:null,parent:30000+(n%127),type:23,ordinal:n,nullable:n%2===0,definition:`catalog ${kind} ${n}`,collation:null,identity:'',generated:'',valid:true,ready:true,comment:null,flags:0};
   if(n>=7129)delete r.comment;return r;
  });
 }
 const extend=(records,additional)=>{
  assert(Number.isSafeInteger(additional)&&additional>=0);const each=Math.floor(additional/records.length),rest=additional%records.length;
  records.forEach((r,i)=>{r.definition+='x'.repeat(each+(i<rest?1:0));});
 };
 extend(metadata.columns,1110747-bytes(metadata.columns));
 extend(fields.filter(k=>k!=='columns').flatMap(k=>metadata[k]),3128280-bytes([{unsupported:0,metadata}]));
 return metadata;
}
const fixture=(metadata,extra={})=>scripted({fixture:{schemaScope:scope},namespaces,preservedMetadata:metadata,...extra});
const migrations=s=>s.log.filter(q=>ddl.includes(q.text)).length;
test('157661-node decoder and157658-node metadata retain all8362 records through install and reconstruction',async()=>{
 const metadata=inventory(),envelope=[{unsupported:0,metadata}],before=JSON.stringify(metadata);
 assert.equal(Object.keys(metadata).length,12);assert.equal(Object.values(metadata).reduce((n,a)=>n+a.length,0),8362);assert.equal(nodes(envelope),157661);assert.equal(nodes(metadata),157658);
 assert.equal(bytes(metadata.columns),1110747);assert.equal(bytes(envelope),3128280);
 const decoded=preservationRows({rows:envelope});assert.deepEqual(decoded,envelope);assert.notEqual(decoded,envelope);assert(Object.isFrozen(decoded[0].metadata.labels.at(-1)));
 const direct=await preservationSnapshot(async()=>envelope,{schemaScope:scope},namespaces);assert.equal(direct.namespaceCount,25);
 const s=fixture(metadata),installed=await prepare(s.args()),f={...s.f,schemaSha256:installed.schemaSha256};
 const restored=await verify({...s.args(),fixture:f});assert.equal(restored.schemaSha256,installed.schemaSha256);assert.equal(restored.preservation.metadataSha256,installed.preservation.metadataSha256);assert.equal(JSON.stringify(metadata),before);assert.equal(migrations(s),6);assert.equal(s.state.commits,2);assert.equal(s.state.ended,0);
 metadata.labels.at(-1).definition+='!';await assert.rejects(verify({...s.args(),fixture:f}),e=>e.outcome==='READ_UNAVAILABLE');assert.equal(migrations(s),6);assert.equal(s.state.commits,2);
});
test('full downstream metadata cannot bypass its own structural or byte bounds',async()=>{
 const base=Object.fromEntries(fields.map(k=>[k,[]]));base.labels=Array(250000).fill(null);
 await assert.rejects(preservationSnapshot(async()=>[{unsupported:0,metadata:base}],{schemaScope:scope},namespaces));
 base.labels=[{definition:'x'.repeat(4194304)}];await assert.rejects(preservationSnapshot(async()=>[{unsupported:0,metadata:base}],{schemaScope:scope},namespaces));
});
test('ordinary100000 nodes remain strict while preservation250000 exact and+1 use a fixed profile',()=>{
 assert.equal(snapshotOperationData(Array(99999).fill(null)).length,99999);assert.throws(()=>snapshotOperationData(Array(100000).fill(null)));
 assert.throws(()=>snapshotOperationData(Array(100000).fill(null),{nodes:250000}));
 assert.throws(()=>rows({rows:[{values:Array(99998).fill(null)}]}));
 const accepted=[{values:Array(249997).fill(null)}];assert.equal(nodes(accepted),250000);assert.equal(preservationRows({rows:accepted})[0].values.length,249997);
 accepted[0].values.push(null);assert.equal(nodes(accepted),250001);assert.throws(()=>preservationRows({rows:accepted}));
});
test('every retained array tail contributes to the full metadata digest beyond100000 nodes',async()=>{
 const metadata=inventory(),snap=()=>preservationSnapshot(async()=>preservationRows({rows:[{unsupported:0,metadata}]}),{schemaScope:scope},namespaces),first=await snap();
 for(const field of fields){const r=metadata[field].at(-1),before=r.definition;r.definition+='!';assert.notEqual((await snap()).metadataSha256,first.metadataSha256,field);r.definition=before;}
});
test('tail substitution after DDL at157661 nodes remains UNKNOWN without commit or retry',async()=>{
 const metadata=inventory(),s=fixture(metadata,{before(text){if(text===ddl.at(-1)){const r=metadata.labels.at(-1);r.definition=r.definition.slice(0,-1)+'y';}}});
 await assert.rejects(prepare(s.args()),e=>e.outcome==='UNKNOWN');assert.equal(migrations(s),6);assert.equal(s.state.commits,0);assert.equal(s.state.ended,0);
});
for(const kind of['proxy','accessor','cycle','sparse','depth'])test(`preservation increased profile retains inert ${kind} refusal`,()=>{
 let touched=0,value;
 if(kind==='proxy')value=new Proxy({},{ownKeys(){touched++;throw Error('trap');},getPrototypeOf(){touched++;throw Error('trap');}});
 if(kind==='accessor')value={get x(){touched++;return 1;}};
 if(kind==='cycle'){value={};value.self=value;}
 if(kind==='sparse')value=Array(3);
 if(kind==='depth'){value={};for(let i=0;i<65;i++)value={value};}
 assert.throws(()=>preservationRows({rows:[{value}]}));assert.equal(touched,0);
});
