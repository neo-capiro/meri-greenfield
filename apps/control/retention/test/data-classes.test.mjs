/** The complete data-class inventory: every retained class has one owner, one deletion path and one retention rule; the policy, the
 * reference enumeration and the row owners derive their vocabularies from it; serving claims are checked against the owners' source;
 * the planned editor-draft class cannot carry data. Synthetic: no database, bucket or credential. */
import test from 'node:test';import assert from 'node:assert/strict';import {existsSync,readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {randomUUID} from 'node:crypto';
import {dataClasses,policyClasses,retainedClasses,externalRequestClasses,rowTargetClasses,rowTargetSubjectKind,plannedClasses,dataClass} from '../data-classes.mjs';
import {classes,externalClasses,rowClasses,rowClassSubjectKind,enumerateReferences} from '../inventory.mjs';
import {parseRetentionPolicy} from '../policy.mjs';
import {createPostgresRetentionJournal} from '../postgres-journal.mjs';
import {policy,snapshot,subjectOf} from './fixture.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const source=path=>readFileSync(root+path,'utf8');

test('the inventory names every retained data class the product holds, each with an owner, a deletion path, a retention rule and a serving rule',()=>{
 // The required inventory (lane brief and audit matrix row "Retention, deletion and restore"), mapped to registry classes.
 const required={conversations:['conversation'],'runs and events':['conversation','events','nextRuns','nativeJournals'],'artifacts and versions':['artifactVersions'],'stored objects':['uploads','lifecycle','completionCheckpoints','selectedOutputs'],'memory proposals':['memoryProposals'],receipts:['receipts'],schedules:['schedules'],budgets:['budgets'],'logs and telemetry':['logs','telemetry'],'editor drafts (planned)':['editorDrafts']};
 for(const [name,ids] of Object.entries(required))for(const id of ids)assert.ok(dataClass(id),`${name}: ${id} is registered`);
 assert.deepEqual(plannedClasses,['editorDrafts'],'only the editor drafts are planned');
 const ids=dataClasses.map(c=>c.id);assert.equal(new Set(ids).size,ids.length,'one entry per class');
 for(const c of dataClasses){
  assert.ok(['row-target','object-version','external-request','retain'].includes(c.deletion),c.id);assert.ok(['policy','policy-retained'].includes(c.rule),c.id);
  assert.equal(c.rule==='policy-retained',c.deletion==='retain',`${c.id}: a retained class has the retained rule and only it`);
  assert.ok(c.subjectKinds.length>=1&&c.subjectKinds.every(k=>['conversation','artifact','schedule'].includes(k)),c.id);
  assert.ok(['retention-read-gate','admission-gate','not-served','external','subject-unsupported'].includes(c.serving.gate),c.id);
  assert.equal(c.serving.gate==='subject-unsupported',c.subjectKinds.some(k=>!['conversation','artifact'].includes(k)),`${c.id}: only a class of an unsupported subject kind is declared unsuppressible`);
  if(c.owner===null)assert.ok(typeof c.pendingOwner==='string'&&c.pendingOwner.length>10,`${c.id}: a class without an owner yet names the pending owner`);else assert.ok(existsSync(root+c.owner),`${c.id}: owner ${c.owner} exists`);
  if(c.status==='active'&&['rows','rows+objects'].includes(c.storage))assert.ok(c.tables.length>=1,`${c.id}: stored rows name their tables`);
 }
});

test('serving claims hold in the owners\' source: every gated class is served by an owner that consults the canonical read gate',()=>{
 for(const c of dataClasses.filter(c=>c.status==='active')){
  if(c.serving.gate==='retention-read-gate')assert.match(source(c.serving.owner),/assertServable/,`${c.id}: ${c.serving.owner} consults the read gate before serving`);
  // Admission-gated data is only served to runs the lifecycle owner admitted through the gated history read.
  if(c.serving.gate==='admission-gate'){assert.equal(c.serving.owner,'apps/control/conversations/lifecycle/service.mjs',c.id);assert.match(source(c.serving.owner),/:service\.history;/u,`${c.id}: every lifecycle operation reads through the gated history`);}
 }
 assert.match(source('apps/control/conversations/service.mjs'),/retentionGate&&!cleanup\)\{await life\.run\(\(\)=>retentionGate\.assertServable/u,'the gated history consults the read gate on every non-cleanup read');
});

test('policy, enumeration and row owners derive their vocabularies from the registry; retained classes are never purgeable',()=>{
 assert.deepEqual(classes,policyClasses);assert.deepEqual(externalClasses,retainedClasses);assert.deepEqual(rowClasses,rowTargetClasses);assert.deepEqual(rowClassSubjectKind,rowTargetSubjectKind);
 assert.deepEqual([...retainedClasses].sort(),['budgets','logs','telemetry']);assert.deepEqual(externalRequestClasses,['memoryProposals']);
 assert.ok(!policyClasses.includes('editorDrafts'),'a planned class is not configured');
 for(const id of retainedClasses)assert.ok(!rowTargetClasses.includes(id),id);
 assert.equal(rowTargetSubjectKind.artifactVersions,'artifact');assert.equal(rowTargetSubjectKind.schedules,'schedule');for(const id of rowTargetClasses.filter(x=>!['artifactVersions','schedules'].includes(x)))assert.equal(rowTargetSubjectKind[id],'conversation',id);
 const p=policy();assert.equal(parseRetentionPolicy(p).policyId,'policy-synthetic');
 for(const id of ['schedules','receipts','memoryProposals','budgets','telemetry']){const missing=structuredClone(p);delete missing.classes[id];assert.throws(()=>parseRetentionPolicy(missing),/INVALID_COMMAND|RETENTION_POLICY_INVALID/,`${id} must be configured`);}
 for(const id of retainedClasses){const purgeable=structuredClone(p);purgeable.classes[id].purgeable=true;assert.throws(()=>parseRetentionPolicy(purgeable),/RETENTION_POLICY_INVALID/,`${id} cannot be made purgeable`);}
 const planned=structuredClone(p);planned.classes.editorDrafts={retentionMs:7*86400000,purgeable:true};assert.throws(()=>parseRetentionPolicy(planned),/INVALID_COMMAND/,'a planned class cannot be configured before it exists');
});

test('enumeration: the planned class is refused, every row of a row-target class becomes an exact target, and conversation rows are enumerated only for a conversation',()=>{
 const s=subjectOf();assert.throws(()=>enumerateReferences({...snapshot(s),editorDrafts:[{draftId:randomUUID()}]}),/RETENTION_CLASS_PLANNED/);
 assert.doesNotThrow(()=>enumerateReferences({...snapshot(s),editorDrafts:[]}),'an empty planned list carries no data');
 const full={...snapshot(s),nextRuns:[{targetRunId:randomUUID()}],schedules:[{scheduleId:randomUUID()}],receipts:[{receiptId:randomUUID()}],budgetRuns:[{runId:randomUUID()}],memoryProposals:[{candidateId:randomUUID()}]};
 const inv=enumerateReferences(full),targeted=new Set(inv.rowTargets.map(t=>t.className)),rowed=new Set(inv.rows.map(r=>r.className));
 for(const id of rowTargetClasses.filter(x=>x!=='artifactVersions'))assert.ok(targeted.has(id),`${id} has row targets`);
 for(const id of [...retainedClasses,...externalRequestClasses])assert.ok(rowed.has(id)&&!targeted.has(id),`${id} is enumerated without a row target`);
 assert.ok(inv.rowTargets.some(t=>t.className==='conversation'&&t.key===s.subjectId),'the conversation row itself is a target');
 const a=subjectOf('artifact'),invA=enumerateReferences(snapshot(a,{artifactVersions:[{versionId:randomUUID(),object:{objectId:randomUUID(),versionId:'v1',sha256:'2'.repeat(64)}}]}));
 assert.deepEqual([...new Set(invA.rowTargets.map(t=>t.className))],['artifactVersions'],'an artifact subject carries no conversation or event rows of its own');
});

test('the PostgreSQL row owner admits only the row classes its schema amendments allow; every other registered row class is refused at preflight without a connection',async()=>{
 let connects=0;const journal=createPostgresRetentionJournal({pool:{connect(){connects++;throw Error('no connection expected');},query(){connects++;throw Error('no query expected');}}});
 assert.deepEqual([...journal.rowClasses].sort(),['artifactVersions','sdkSession']);for(const id of journal.rowClasses)assert.ok(rowTargetClasses.includes(id),id);
 const key=`tenant-a:conversation:${randomUUID()}`;
 for(const className of rowTargetClasses.filter(id=>!journal.rowClasses.includes(id)&&rowTargetSubjectKind[id]==='conversation'))
  await assert.rejects(journal.rows.preflight(key,{rowSteps:[{className,target:{className,key:randomUUID()}}]}),e=>e.code==='RETENTION_ROW_CLASS_UNSUPPORTED',className);
 await assert.rejects(journal.rows.purge(key,{rowSteps:[{className:'events',target:{className:'events',key:randomUUID()}}]}),e=>e.code==='RETENTION_ROW_CLASS_UNSUPPORTED','purge refuses before opening a transaction');
 await assert.rejects(journal.rows.preflight(key,{rowSteps:[{className:'artifactVersions',target:{artifactVersionId:randomUUID()}}]}),e=>e.code==='RETENTION_INVALID_REQUEST','a row class of another subject kind keeps the DA-1 refusal');
 assert.equal(connects,0);
});
