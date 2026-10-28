/** Actual installed assets and request owner; scripted SQL, no provider or native execution. */
import test from 'node:test';import assert from 'node:assert/strict';
import {applicationFixture,binding,id} from './application-fixture.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
import {assertSkillManifest} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
const skills=[{skillId:'quick_skill.bill_watch',skillVersion:'2.0.0'},{skillId:'quick_skill.cited_report',skillVersion:'1.0.0'}];
const documentRevision={artifactId:id(800),versionId:id(801),objectSha256:'a'.repeat(64)};
const windowRequest={basis:'explicit',startInclusive:'2026-10-01T00:00:00Z',endExclusive:'2026-10-24T00:00:00Z',timezone:'UTC'};

test('both exact installed report recipes allocate, admit and reload their full immutable pins',async()=>{
 for(const skill of skills){const f=await applicationFixture({initialInput:true});try{
  const input={...f.input,skill,documentRevision,windowRequest};await f.service.allocateInput({credential:f.credential,input});
  const result=await f.service.admitInput({credential:f.credential,input});assert.deepEqual(result.request.skill,selectSkill(skill.skillId,skill.skillVersion).pin);assert.deepEqual(result.request.documentRevision,documentRevision);assert.equal(f.state.starts,0);
  assert.deepEqual((await f.service.history({credential:f.credential})).request,result.request);assert.equal((await f.service.admitInput({credential:f.credential,input})).replayed,true);
  for(const changed of [{...input,skill:skills.find(s=>s!==skill)},{...input,documentRevision:{...documentRevision,versionId:id(802)}}])await assert.rejects(f.service.admitInput({credential:f.credential,input:changed}));
  assert.equal(f.state.runs.size,1);assert.equal(f.state.starts,0);
 }finally{f.close();}}
});

test('ordinary cited-report selection uses its explicit 0.3 manifest; the frozen receiver still refuses it',async()=>{
 const selected=selectSkill('quick_skill.cited_report','1.0.0');assert.equal(selected.manifest.contractVersion,'0.3.0');assert.throws(()=>assertSkillManifest(selected.manifest,catalog));
 const f=await applicationFixture({initialInput:true});try{const input={...f.input,skill:skills[1],windowRequest};await f.service.allocateInput({credential:f.credential,input});await f.service.admitInput({credential:f.credential,input});assert.deepEqual((await f.service.history({credential:f.credential})).request.skill,selected.pin);}finally{f.close();}
});

test('unsupported pairs, browser pin overrides and current revocation cannot dispatch',async()=>{
 for(const skill of [{...skills[0],skillVersion:'1.1.0'},{...skills[1],skillVersion:'1.0.1'},{skillId:'quick_skill.commitments_audit',skillVersion:'1.0.0'},{...skills[1],manifestSha256:'f'.repeat(64)}]){const f=await applicationFixture({initialInput:true});try{await assert.rejects(f.service.allocateInput({credential:f.credential,input:{...f.input,skill,documentRevision,windowRequest}}));assert.equal(f.state.starts,0);assert.equal(f.state.runs.size,0);}finally{f.close();}}
 const f=await applicationFixture({initialInput:true});try{const input={...f.input,skill:skills[1],documentRevision,windowRequest};await f.service.allocateInput({credential:f.credential,input});f.state.revoked=true;await assert.rejects(f.service.submit({credential:f.credential,input}));assert.equal(f.state.starts,0);assert.equal(await f.store.findRequest(binding,input.requestId,()=>{}),null);}finally{f.close();}
});
