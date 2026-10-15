import test from 'node:test';import assert from 'node:assert/strict';
import Provider from '../provider.mjs';
import grade from '../graders/index.mjs';
import {promptfooTests} from '../cases/index.mjs';
import {loadCases,STATUS} from '../cases/schema.mjs';
const render=(template,vars)=>template.replace(/\{\{(\w+)\}\}/gu,(_,k)=>vars[k]);
test('every generated synthetic test runs through the provider and passes every listed grader',async()=>{
 const provider=new Provider(),tests=promptfooTests();assert.equal(provider.id(),'meri-synthetic-deterministic');
 for(const t of tests){const result=await provider.callApi(render('{{prompt}}',t.vars),{vars:t.vars});
  assert.equal(result.error,undefined,t.vars.caseId);assert.equal(result.cost,0);assert.equal(result.tokenUsage.total,0);assert.equal(result.metadata.label,'LOCAL_FIXTURE');
  const verdict=grade(result.output,{vars:t.vars});assert.equal(verdict.pass,true,`${t.vars.caseId}: ${verdict.reason}`);}
});
test('the provider refuses awaiting slots, unknown cases and prompts that differ from the frozen case',async()=>{
 const provider=new Provider(),awaiting=loadCases().find(c=>c.status===STATUS.awaiting);
 assert.deepEqual(await provider.callApi('anything',{vars:{caseId:awaiting.caseId}}),{error:'CASE_NOT_RUNNABLE'});
 assert.deepEqual(await provider.callApi('anything',{vars:{caseId:'NOPE-1'}}),{error:'CASE_NOT_RUNNABLE'});
 assert.deepEqual(await provider.callApi('SYNTHETIC: changed',{vars:{caseId:'GI-01'}}),{error:'PROMPT_MISMATCH'});
});
test('graders catch a provider output altered after the scripted run',async()=>{
 const provider=new Provider(),run=async id=>{const t=promptfooTests().find(x=>x.vars.caseId===id);return {t,output:JSON.parse((await provider.callApi(t.vars.prompt,{vars:t.vars})).output)};};
 let {t,output}=await run('DL-01');output.files[0].base64=Buffer.from('tampered').toString('base64');assert.match(grade(JSON.stringify(output),{vars:t.vars}).reason,/usable-file: file 0: (SIZE|CHECKSUM)/);
 ({t,output}=await run('CW-02'));output.observed={leak:'CW-02-OWNER-SENTINEL private note'};assert.match(grade(JSON.stringify(output),{vars:t.vars}).reason,/FORBIDDEN_MARKER/);
 ({t,output}=await run('AP-02'));output.evidence['AP-02-E1'].value=1;output.claims[0].value=1;assert.match(grade(JSON.stringify(output),{vars:t.vars}).reason,/EVIDENCE_VALUE/);
});
