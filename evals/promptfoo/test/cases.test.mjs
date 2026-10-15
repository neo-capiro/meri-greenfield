import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {loadCases,validateCase,runnerView,caseById,GROUPS,STATUS,SLOTS_PER_GROUP} from '../cases/schema.mjs';
import {promptfooTests} from '../cases/index.mjs';
const cases=loadCases(),here=new URL('../',import.meta.url);
const clone=id=>structuredClone(cases.find(c=>c.caseId===id));
test('sixty slots cover the five capability groups with twelve each and unique identifiers',()=>{
 assert.equal(cases.length,60);assert.deepEqual(Object.keys(GROUPS),['data-and-memory','government-intelligence','client-work','deliverables','agent-product']);
 for(const group of Object.keys(GROUPS))assert.equal(cases.filter(c=>c.group===group).length,SLOTS_PER_GROUP,group);
 assert.equal(new Set(cases.map(c=>c.caseId)).size,60);
});
test('every slot states expected evidence, permissions, output format and success criteria',()=>{
 for(const c of cases){assert.ok(c.expectedEvidence.length||c.outputFormat.kind==='refusal',c.caseId);assert.ok(['allowed','denied'].includes(c.permissions.expected));assert.ok(c.permissions.scopes.length);assert.ok(c.outputFormat.kind);assert.ok(c.successCriteria.length);}
});
test('only clearly labelled synthetic slots are runnable; slots needing real requests await an approved source',()=>{
 const runnable=cases.filter(c=>c.status===STATUS.runnable),awaiting=cases.filter(c=>c.status===STATUS.awaiting);
 assert.equal(runnable.length+awaiting.length,60);assert.ok(runnable.length>=2*Object.keys(GROUPS).length);
 for(const group of Object.keys(GROUPS))assert.ok(runnable.some(c=>c.group===group),group);
 for(const c of runnable){assert.equal(c.synthetic,true);assert.match(c.prompt,/^SYNTHETIC: /);assert.ok(c.scenario.kind);}
 for(const c of awaiting){assert.equal(c.synthetic,false);assert.equal(c.prompt,null);assert.equal(c.scenario,null);assert.ok(c.expectedEvidence.every(e=>e.path===null&&e.value===null));}
});
test('validation rejects unlabelled synthetic prompts, prefilled awaiting slots and mismatched graders',()=>{
 const reject=(c,code)=>assert.throws(()=>validateCase(c,c.group),e=>e.code===code);
 let c=clone('GI-01');c.prompt='Find awards';reject(c,'CASE_STATUS');
 c=clone('GI-03');c.prompt='SYNTHETIC: invented';reject(c,'CASE_STATUS');
 c=clone('GI-03');c.expectedEvidence[0].value=3;reject(c,'CASE_EVIDENCE');
 c=clone('DL-01');c.graders=c.graders.filter(g=>g!=='usable-file');reject(c,'CASE_GRADERS');
 c=clone('DM-02');delete c.permissions.refusalCode;reject(c,'CASE_PERMISSIONS');
 c=clone('DM-01');c.permissions.scopes=['everything'];reject(c,'CASE_PERMISSIONS');
 c=clone('DM-01');c.status='RUNNABLE';reject(c,'CASE_STATUS');
 c=clone('DM-01');c.caseId='GI-99';reject(c,'CASE_SHAPE');
 c=clone('AP-01');c.scenario.kind='live-model';reject(c,'CASE_STATUS');
 c=clone('DM-01');c.extra=true;reject(c,'CASE_SHAPE');
});
test('the runner view carries no expected values, criteria or refusal codes',()=>{
 for(const c of cases.filter(x=>x.status===STATUS.runnable)){const view=runnerView(c),text=JSON.stringify(view);
  assert.deepEqual(Object.keys(view).sort(),['caseId','evidence','prompt','scenario']);assert.ok(view.evidence.every(e=>Object.keys(e).sort().join()==='evidenceId,path'));
  if(c.permissions.refusalCode)assert.ok(!text.includes(c.permissions.refusalCode),c.caseId);}
 assert.equal(caseById('NOPE-1',cases),null);
});
test('the promptfoo config wires the custom provider, the case generator and the grader assertion',()=>{
 const yaml=readFileSync(new URL('promptfooconfig.yaml',here),'utf8');
 assert.match(yaml,/^prompts:\n  - '\{\{prompt\}\}'$/mu);assert.match(yaml,/^providers:\n  - id: file:\/\/provider\.mjs$/mu);assert.match(yaml,/^tests: file:\/\/cases\/index\.mjs$/mu);
 for(const path of ['provider.mjs','cases/index.mjs','graders/index.mjs'])assert.ok(existsSync(new URL(path,here)),path);
 const tests=promptfooTests(cases);assert.equal(tests.length,cases.filter(c=>c.status===STATUS.runnable).length);
 for(const t of tests){assert.match(t.description,/SYNTHETIC/);assert.deepEqual(t.assert,[{type:'javascript',value:'file://graders/index.mjs'}]);assert.equal(t.vars.prompt,caseById(t.vars.caseId,cases).prompt);assert.equal(t.metadata.label,'LOCAL_FIXTURE');}
 assert.ok(!tests.some(t=>caseById(t.vars.caseId,cases).status===STATUS.awaiting));
});
