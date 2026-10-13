/** Synthetic dimensions supplied by parent; no native metadata or record bodies. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareOwnedApplicationSchema,verifyOwnedApplicationSchema} from './schema.mjs';
import {createScriptedSchemaFixture as scripted,fixtureMigrationBytes as ddl} from './schema.fixture.mjs';
const fields=['relations','columns','defaults','constraints','indexes','views','types','sequences','triggers','dependencies','comments','labels'];
const bytes=value=>Buffer.byteLength(JSON.stringify(value),'utf8');
const nodes=value=>1+(value!==null&&typeof value==='object'?Object.values(value).reduce((n,x)=>n+nodes(x),0):0);
function inventory(){
 const metadata={},all=[];let ordinal=0;
 for(const [i,kind]of fields.entries()){
  const count=kind==='columns'?4000:396+(i===0||i>=2&&i<=6?1:0);
  metadata[kind]=Array.from({length:count},()=>{
   const n=ordinal++,row={oid:n+1,namespace:`evidence_${n%27}`,kind,name:`synthetic_${n}`,type:'catalog',owner:'qualification_owner',acl:null,ordinal:n,text:'',flag:false};
   if(n<8002)row.marker='retained';all.push(row);return row;
  });
 }
 const distribute=(records,additional)=>{
  assert(Number.isSafeInteger(additional)&&additional>=records.length);
  const each=Math.floor(additional/records.length),remainder=additional%records.length;
  records.forEach((r,i)=>{r.text='x'.repeat(each+(i<remainder?1:0));});
 };
 distribute(metadata.columns,1110747-bytes(metadata.columns));
 const other=fields.filter(k=>k!=='columns').flatMap(k=>metadata[k]);
 distribute(other,3128280-bytes([{unsupported:0,metadata}]));
 return {metadata,all};
}
test('complete8362-record measured inventory retains exact bytes/tail at100000 nodes; next node refuses',async()=>{
 const {metadata,all}=inventory(),rows=[{unsupported:0,metadata}];
 assert.equal(rows.length,1);assert.equal(Object.keys(metadata).length,12);assert.equal(all.length,8362);
 assert(fields.every(k=>metadata[k].length>0&&metadata[k].every(r=>r.text.length>0)));
 assert.equal(bytes(metadata.columns),1110747);assert.equal(bytes(rows),3128280);assert.equal(nodes(rows),100000);
 const namespaces=Array.from({length:27},(_,i)=>({name:`evidence_${i}`,owner:'qualification_owner'}));
 const options={fixture:{schemaScope:{mode:'preserve-declared-evidence',namespaces}},namespaces,preservedMetadata:metadata};
 const s=scripted(options),before=JSON.stringify(metadata),installed=await prepareOwnedApplicationSchema(s.args());
 const fixture={...s.f,schemaSha256:installed.schemaSha256};
 const restored=await verifyOwnedApplicationSchema({...s.args(),fixture});
 assert.equal(restored.schemaSha256,installed.schemaSha256);assert.equal(restored.preservation.metadataSha256,installed.preservation.metadataSha256);
 assert.equal(JSON.stringify(metadata),before);assert.equal(s.log.filter(q=>ddl.includes(q.text)).length,6);
 const tail=metadata.labels.at(-1),original=tail.text;tail.text=tail.text.slice(0,-1)+'y';
 assert.equal(bytes(rows),3128280);assert.equal(nodes(rows),100000);
 await assert.rejects(verifyOwnedApplicationSchema({...s.args(),fixture}),e=>e.outcome==='READ_UNAVAILABLE');
 tail.text=original;tail.overflow=true;assert.equal(nodes(rows),100001);assert(bytes(rows)<4194304);
 const denied=scripted(options);
 await assert.rejects(prepareOwnedApplicationSchema(denied.args()),e=>e.outcome==='NOT_INSTALLED'&&e.stage==='preservation');
 assert.equal(denied.log.filter(q=>ddl.includes(q.text)).length,0);assert.equal(denied.state.commits,0);
 assert.equal(s.log.filter(q=>ddl.includes(q.text)).length,6);assert.equal(s.state.commits,2);assert.equal(s.state.ended,0);assert.equal(denied.state.ended,0);
});
