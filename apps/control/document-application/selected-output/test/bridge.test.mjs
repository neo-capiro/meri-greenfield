import test from 'node:test';import assert from 'node:assert/strict';
import {bridgeFixture} from './fixture.mjs';import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
for(const skill of ['quick_skill.commitments_audit','quick_skill.relationship_brief'])test(`${skill}: separate approved output current context produces actual DOCX without source mutation`,{timeout:60000},async()=>{const f=await bridgeFixture(skill);try{const p=await f.prepare(),before=canonicalSha256(p),r=await f.deliver(p);assert.equal(r.state,'delivered');assert.equal(canonicalSha256(p),before);assert.notEqual(r.outputBinding.runId,r.sourceBinding.runId);assert.equal(r.artifact.version.binding.runId,r.outputBinding.runId);assert.equal(r.lineage.sourceDeadlineMs,p.context.deadlineMs);assert.equal(r.artifact.version.evidence.length,p.context.evidence.length);assert.equal(f.output.stats().generations,1);assert(f.state.accessPhases.includes('approval'));assert(f.state.accessPhases.includes('effect'));assert(f.state.accessPhases.includes('release'));assert.equal(f.output.stats().nativeDatabase,false);}finally{await f.close();}});
test('missing approval is pending with no IDs/effect; cloned source object cannot acquire preparation identity',async()=>{const f=await bridgeFixture();try{const p=await f.prepare();f.state.approved=false;const r=await f.deliver(p);assert.equal(r.state,'awaiting-output-approval');assert.equal(Object.hasOwn(r,'artifact'),false);assert.equal(f.output.stats().generations,0);await assert.rejects(f.deliver(structuredClone(p)));}finally{await f.close();}});
for(const key of ['sourcePinsSha256','outputBinding','scopes','policyRevision','approvalDecision','deadlineMs','maxBytes'])test(`approved output ${key} substitution refuses before artifact effects`,async()=>{const f=await bridgeFixture();try{const p=await f.prepare();f.state.receiptMutator=r=>r[key]=key==='outputBinding'?f.sourceBinding:key==='scopes'?[]:key==='deadlineMs'?0:key==='maxBytes'?2097152:'changed';await assert.rejects(f.deliver(p));assert.equal(f.output.stats().generations,0);}finally{await f.close();}});
for(const key of ['allocationSha256','grantId','approvalReceiptId'])test(`retired ${key} cannot authorize an output`,async()=>{const f=await bridgeFixture();try{const p=await f.prepare();f.state.receiptMutator=r=>r[key]=key==='grantId'?'72000000-0000-4000-8000-000000000099':'a'.repeat(64);await assert.rejects(f.deliver(p));assert.equal(f.output.stats().generations,0);}finally{await f.close();}});

test('native retained source revocation refuses output despite a retained preparation',async()=>{const f=await bridgeFixture();try{const p=await f.prepare();f.state.revokedSource=true;await assert.rejects(f.deliver(p));assert.equal(f.output.stats().generations,0);}finally{await f.close();}});
for(const key of ['evidenceSha256','sourcePinsSha256','scopes','policyRevision','checkedAtMs','expiresAtMs'])test(`current retained evidence ${key} substitution refuses before generation`,async()=>{const f=await bridgeFixture();try{const p=await f.prepare();f.state.accessMutator=r=>r[key]=key==='scopes'?[]:key==='checkedAtMs'||key==='expiresAtMs'?0:'changed';await assert.rejects(f.deliver(p));assert.equal(f.output.stats().generations,0);}finally{await f.close();}});
test('retired synthetic access receipt cannot authorize retained evidence',async()=>{const f=await bridgeFixture();try{const p=await f.prepare();f.state.accessMutator=r=>r.accessReceiptId='72000000-0000-4000-8000-000000000099';await assert.rejects(f.deliver(p));assert.equal(f.output.stats().generations,0);}finally{await f.close();}});
test('retired grant ID is refused rather than becoming current output authority',async()=>{const f=await bridgeFixture();try{const p=await f.prepare();f.state.receiptMutator=r=>r.grantId='72000000-0000-4000-8000-000000000099';await assert.rejects(f.deliver(p));assert.equal(f.output.stats().generations,0);}finally{await f.close();}});
test('read refuses unretained/cloned preparation and caller credential before native output reads',async()=>{const f=await bridgeFixture();try{const p=await f.prepare();await assert.rejects(f.bridge.read({sourcePrepared:structuredClone(p),versionId:'72000000-0000-4000-8000-000000000099',intent:'download'}));await assert.rejects(f.bridge.read({sourcePrepared:p,versionId:'72000000-0000-4000-8000-000000000099',intent:'download',credential:'model-selected'}));assert.equal(f.state.readCalls.length,0);}finally{await f.close();}});

// Scripted rendering isolates real approval/session/journal/object/readback behavior; actual DOCX renderer cases above remain required.
import {createHash} from 'node:crypto';
import {createPostgresArtifactService} from '../../../../artifacts/postgres-service.mjs';
function scriptedRendering(f){const state={calls:0};f.output.artifactOptions.executor={async execute({request}){state.calls++;const bytes=Buffer.from(JSON.stringify(request));return {bytes,inspection:{sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,format:request.format,nativeOpened:false,rendered:false,recalculated:false,members:[],details:{paragraphs:request.content.blocks.filter(block=>block.kind==='paragraph').length,tables:0,pictures:0}}};}};return state;}
test('renewed output deadline leaves immutable document content and invocation unchanged',async()=>{
 const f=await bridgeFixture();try{const renderer=scriptedRendering(f),p=await f.prepare(),first=await f.deliver(p);
  f.output.artifactOptions.context.deadlineMs-=100;const replay=await f.deliver(p);
  assert.deepEqual(replay.artifact.version,first.artifact.version);assert.equal(replay.lineageSha256,first.lineageSha256);assert.equal(renderer.calls,1);
  assert.equal(Object.hasOwn(first.lineage,'outputDeadlineMs'),false);assert.equal(Object.hasOwn(first.lineage,'approvalReceiptId'),false);
 }finally{await f.close();}
});
for(const key of ['decision','approver','policyRevision','decidedAt','expiresAt'])test(`actual Core decision ${key} refusal precedes generation`,async()=>{
 const f=await bridgeFixture();try{const renderer=scriptedRendering(f),p=await f.prepare();f.state.receiptMutator=r=>{const d=r.approvalDecision;
  if(key==='decision')d.decision='rejected';if(key==='approver')d.approver.actorId='foreign';if(key==='policyRevision')d.policyRevision='foreign';
  if(key==='decidedAt')d.decidedAt=new Date(f.output.now()+1000).toISOString();if(key==='expiresAt')d.expiresAt=new Date(f.output.now()-1).toISOString();};
  await assert.rejects(f.deliver(p));assert.equal(renderer.calls,0);assert.equal(f.output.stats().deliveries,0);
 }finally{await f.close();}
});
for(const skill of ['quick_skill.commitments_audit','quick_skill.relationship_brief'])test(`${skill}: actual approval publishes in the same current run without an output-run allocation`,async()=>{
 const f=await bridgeFixture(skill,{sameRun:true});try{const renderer=scriptedRendering(f),p=await f.prepare(),before=canonicalSha256(p),out=await f.deliver(p);
  assert.deepEqual(out.outputBinding,p.context.binding);assert.deepEqual(out.artifact.version.binding,p.context.binding);assert.deepEqual(out.artifact.version.evidence,p.context.evidence);
  assert.equal(canonicalSha256(p),before);assert.equal(renderer.calls,1);assert.deepEqual((await f.deliver(p)).artifact.version,out.artifact.version);assert.equal(renderer.calls,1);
  f.state.approved=false;await assert.rejects(f.bridge.read({sourcePrepared:p,versionId:out.artifact.version.versionId,intent:'download'}));assert.equal(renderer.calls,1);
 }finally{await f.close();}
});
for(const skill of ['quick_skill.commitments_audit','quick_skill.relationship_brief'])test(`${skill}: approved cross-run source evidence remains unchanged through native publication and replay`,async()=>{
 const f=await bridgeFixture(skill);try{const renderer=scriptedRendering(f),p=await f.prepare(),original=canonicalSha256(p),out=await f.deliver(p);
  assert.equal(out.artifact.version.contractVersion,'0.2.0');assert.notDeepEqual(out.artifact.version.binding,p.context.binding);assert.deepEqual(out.artifact.version.evidence,p.context.evidence);
  assert(out.artifact.version.evidence.every(e=>canonicalSha256(e.binding)===canonicalSha256(p.context.binding)&&!Object.hasOwn(e,'authorizationDecisionId')));
  const again=await f.deliver(p);assert.deepEqual(again.artifact.version,out.artifact.version);assert.equal(renderer.calls,1);assert.equal(canonicalSha256(p),original);
  const read=await f.bridge.read({sourcePrepared:p,versionId:out.artifact.version.versionId,intent:'download'});assert.equal(createHash('sha256').update(read.bytes).digest('hex'),out.artifact.version.object.sha256);
  f.state.revokedSource=true;await assert.rejects(f.bridge.read({sourcePrepared:p,versionId:out.artifact.version.versionId,intent:'download'}));assert.equal(renderer.calls,1);
 }finally{await f.close();}
});
test('ordinary document writer refuses earlier source run evidence without the private approved projection',async()=>{
 const f=await bridgeFixture();try{const renderer=scriptedRendering(f),p=await f.prepare(),{ids,...o}=f.output.artifactOptions;
  assert.throws(()=>createPostgresArtifactService({...o,context:{...o.context,evidence:p.context.evidence}}),/ARTIFACT_EVIDENCE_BINDING/);assert.equal(renderer.calls,0);assert.equal(f.output.stats().deliveries,0);
 }finally{await f.close();}
});
for(const change of ['stale receipt','foreign source binding','changed source proof'])test(`approved projection refuses ${change} before native generation`,async()=>{
 const f=await bridgeFixture();try{const renderer=scriptedRendering(f),p=await f.prepare();f.state.accessMutator=r=>{if(change==='stale receipt')r.expiresAtMs=f.output.now();if(change==='foreign source binding')r.sourceBinding={...r.sourceBinding,runId:'72000000-0000-4000-8000-000000000099'};if(change==='changed source proof')r.evidenceSha256='f'.repeat(64);};
 await assert.rejects(f.deliver(p));assert.equal(renderer.calls,0);assert.equal(f.output.stats().deliveries,0);
 }finally{await f.close();}
});
