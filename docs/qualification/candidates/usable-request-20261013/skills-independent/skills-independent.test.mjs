import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import canonicalize from 'canonicalize';
import {selectSkill,listSkills} from '../../../../../packages/skills/index.mjs';
import {compileCommitmentsAudit} from '../../../../../packages/skills/commitments/index.mjs';
import {fixture} from '../../../../../packages/skills/test/commitments-fixture.mjs';
import {assertSkillManifest} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import catalog from '../../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};

const sha=value=>createHash('sha256').update(value).digest('hex');
const root=new URL('../../../../../',import.meta.url);
const compile=f=>compileCommitmentsAudit(f.input,{context:f.context,reads:f.reads});
const changed=(fn)=>{const f=fixture();fn(f);return f;};

test('independent raw14-asset hashes/pins match exact loader values, canonical catalog and original selected inventory',()=>{
 const assets=JSON.parse(readFileSync(new URL('packages/skills/assets.json',root))),inventory=JSON.parse(readFileSync(new URL('docs/coordination/r2/skills.json',root)));
 assert.deepEqual(assets.assets.map(x=>x.skillId).sort(),inventory.records.map(x=>x.fields.ID).sort());
 assert.equal(assets.assets.length,14);assert.equal(assets.catalogSha256,sha(canonicalize(catalog)));
 for(const row of assets.assets){
  const p=new URL(row.prosePath,new URL('packages/skills/index.mjs',root)),m=new URL(row.manifestPath,new URL('packages/skills/index.mjs',root));
  const prose=readFileSync(p),manifest=JSON.parse(readFileSync(m)),loaded=selectSkill(row.skillId,row.skillVersion);
  assert.equal(sha(prose),row.proseSha256);assert.equal(sha(canonicalize(manifest)),row.manifestSha256);
  assert.equal(manifest.prose.sha256,row.proseSha256);assert.equal(loaded.prose,prose.toString());assert.deepEqual(loaded.manifest,manifest);
  assert.deepEqual(loaded.pin,{skillId:row.skillId,skillVersion:row.skillVersion,manifestSha256:row.manifestSha256,proseSha256:row.proseSha256,catalogSha256:assets.catalogSha256});
  assert(Object.isFrozen(loaded.manifest.completion.rubric));assert.equal(loaded.manifest.approval.autoCreateTasks,false);
 }
});

test('every exact14 asset refuses execution through unchanged canonical unavailable operation validator',()=>{
 for(const row of listSkills())assert.throws(()=>assertSkillManifest(selectSkill(row.skillId,row.skillVersion).manifest,catalog),/Skill requires unavailable operation/u);
 assert(catalog.operations.every(x=>x.availability==='unimplemented'&&x.handler===null&&x.qualification==='pending'));
});

test('selection refuses inherited/coercible identifiers and omitted/wildcard versions without invoking conversion',()=>{
 let called=false;const id={toString(){called=true;return 'quick_skill.commitments_audit';}};
 assert.throws(()=>selectSkill(id,'1.0.0'));assert.equal(called,false);
 for(const v of [undefined,null,'latest','*','1','1.0','1.0.0 '])assert.throws(()=>selectSkill('quick_skill.commitments_audit',v));
});

test('Commitments source-read operation must bind the actual mail source, not merely be another allowed operation',()=>{
 const f=changed(f=>f.reads[0].operation={id:'query_tasks',version:'0.2.0'});
 assert.throws(()=>compile(f),/COMMITMENTS_READ_SOURCE/u);
});

test('Commitments source-read operation must bind exact declared Monday source authority',()=>{
 const f=changed(f=>f.reads.at(-1).sources[0].authority='authoritative');
 assert.throws(()=>compile(f),/COMMITMENTS_READ_SOURCE/u);
});

test('actual source authority remains visible on every returned coverage cell and bound passage',()=>{
 const f=fixture();f.input.observations.push(f.observation('monday-track','tracking','client_knowledge_monday'));
 const out=compile(f);for(const cell of out.coverage)assert.equal(cell.authority,f.reads.find(x=>x.sources[0].sourceId===cell.sourceId).sources[0].authority);
 assert.equal(out.commitments[0].promise.authority,'authoritative');assert.equal(out.commitments[0].tracking[0].passage.authority,'derived');
});

test('foreign client record scopes cannot bind even when tenant, context and all byte/version hashes match',()=>{
 const f=changed(f=>f.reads[0].data.records[0].scopes[0].resourceId='70000000-0000-4000-8000-000000000099');
 assert.throws(()=>compile(f),/Evidence lineage mismatch/u);
});

test('zero record scopes cannot be marked a bound source excerpt',()=>{
 assert.throws(()=>compile(changed(f=>f.reads[0].data.records[0].scopes=[])));
});

test('different worker identity and current policy revision refuse unchanged passage bytes',()=>{
 for(const edit of [f=>f.reads[0].binding.workerId='70000000-0000-4000-8000-000000000099',f=>{
  f.reads[0].subject.policyRevision='foreign-policy';f.reads[0].subject.scopes.forEach(s=>s.policyRevision='foreign-policy');f.reads[0].data.records[0].scopes.forEach(s=>s.policyRevision='foreign-policy');}])assert.throws(()=>compile(changed(edit)));
});

test('correct source hash with altered bytes, and correct bytes with altered source hash both refuse',()=>{
 for(const edit of [f=>f.reads[0].data.records[0].content.text+=' Additional claim.',f=>f.reads[0].data.records[0].contentSha256='f'.repeat(64)])assert.throws(()=>compile(changed(edit)),/COMMITMENTS_READ_HASH/u);
});

test('candidate/snippet and missing decisive read cannot verify a promise or claim full coverage',()=>{
 const f=fixture();f.reads=f.reads.slice(1);assert.throws(()=>compile(f),/COMMITMENTS_PASSAGE/u);
 const p=fixture();p.input.observations=[];p.reads=p.reads.slice(1);const out=compile(p);assert.equal(out.status,'partial');assert.equal(out.coverage.find(x=>x.sourceId==='mail').complete,false);assert.equal(out.negativeClaimSupported,false);
 const s=changed(f=>{f.reads[0].method='candidate-search';f.reads[0].data.kind='candidates';f.reads[0].data.records[0].content={kind:'snippet',text:'We will send the draft memo.',readHandle:'opaque'};f.reads[0].coverage.enumerableTotal=null;f.reads[0].continuation.requiredReads=['opaque'];f.reads[0].status='partial';f.reads[0].reasonCode='PARTIAL_COVERAGE';});assert.throws(()=>compile(s));
});

test('complete/stale inconsistency refuses and disclosed partial stale read never supports absence',()=>{
 assert.throws(()=>compile(changed(f=>f.reads[0].sources[0].freshness='stale')),/Incomplete response cannot claim complete/u);
 const f=changed(f=>{f.reads[0].sources[0].freshness='stale';f.reads[0].status='partial';f.reads[0].reasonCode='STALE_SOURCE';});
 const out=compile(f);assert.equal(out.status,'partial');assert.equal(out.coverage[0].freshness,'stale');assert.equal(out.negativeClaimSupported,false);assert.equal(out.commitments[0].completed,false);
});

test('unmapped Monday and entirely absent reads remain visible without false absence',()=>{
 const f=fixture();f.context.mondayBoardIds=[];f.reads=[];f.input.observations=[];const out=compile(f);
 assert.equal(out.status,'partial');assert.equal(out.coverage.length,6);assert(out.coverage.every(x=>!x.complete));assert.equal(out.coverage.find(x=>x.sourceId==='client_knowledge_monday').status,'not-mapped');assert.equal(out.negativeClaimSupported,false);
});

test('suggestion/delivery classifications and all semantic owner/date/tracking outputs stay unverified despite exact bound quotes',()=>{
 const f=fixture();f.input.observations[0].owner='User asserted owner';f.input.observations[0].dueDate='2026-11-01';
 f.input.observations.push(f.observation('suggestion','suggestion','mail'),f.observation('tracking','tracking','tasks'),f.observation('delivery','delivery-claim','client_documents'));
 const out=compile(f),c=out.commitments[0];assert.equal(c.completed,false);assert.equal(c.owner.status,'extracted-unverified');assert.equal(c.dueDate.status,'extracted-unverified');assert.equal(c.classificationVerification,'requires-human-verification');
 assert.equal(c.deliveryClaims[0].classificationVerification,'requires-human-verification');assert.equal(c.trackingLinkVerification,'proposed-link-unverified');assert.equal(out.suggestions[0].classificationVerification,'requires-human-verification');assert.equal(out.negativeClaimSupported,false);assert.deepEqual(out.mutations,[]);
});

test('distinct original records cannot be semantically deduplicated by equal extracted owner/date or similar quote',()=>{
 const f=fixture();f.input.observations.push(f.observation('other-original','promise','meetings'));const out=compile(f);assert.equal(out.commitments.length,2);assert.notEqual(out.commitments[0].originSha256,out.commitments[1].originSha256);
});

test('model attempts to inject completion/verification/citation authority or mutations are refused',()=>{
 for(const [key,value]of [['completed',true],['verification','verified'],['citationUrl','https://synthetic.invalid/source'],['authorizationDecisionId','model-decision'],['mutations',[]]])assert.throws(()=>compile(changed(f=>f.input.observations[0][key]=value)));
});

test('retained current evidence and projection are deep immutable snapshots',()=>{
 const f=fixture(),out=compile(f),quoted=out.commitments[0].promise.quote;f.reads[0].data.records[0].content.text='later caller mutation';f.context.subject.scopes[0].resourceId='later-client';f.input.observations[0].owner='later-owner';
 assert.equal(out.commitments[0].promise.quote,quoted);assert.notEqual(out.subject.scopes[0].resourceId,'later-client');assert.equal(out.commitments[0].owner.status,'unknown');
 assert.throws(()=>out.commitments[0].promise.scopes[0].resourceId='mutable',TypeError);assert.throws(()=>out.coverage.pop(),TypeError);
});
