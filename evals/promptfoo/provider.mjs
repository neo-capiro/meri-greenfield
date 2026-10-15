/** Promptfoo custom provider: a deterministic scripted runtime over offline targets. No model, SDK query, network or database. */
import {caseById,runnerView,STATUS} from './cases/schema.mjs';
import {runScenario} from './scenarios/index.mjs';
export default class MeriSyntheticProvider {
 id(){return 'meri-synthetic-deterministic';}
 async callApi(prompt,context){
  const c=caseById(context?.vars?.caseId);
  if(!c||c.status!==STATUS.runnable)return {error:'CASE_NOT_RUNNABLE'};
  if(prompt!==c.prompt)return {error:'PROMPT_MISMATCH'};
  const output=await runScenario(runnerView(c));
  return {output:JSON.stringify(output),cost:0,tokenUsage:{total:0,prompt:0,completion:0},metadata:{label:'LOCAL_FIXTURE',caseId:c.caseId}};
 }
}
