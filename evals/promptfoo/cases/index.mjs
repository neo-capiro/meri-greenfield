/** Promptfoo test generator: only clearly labelled synthetic slots run; awaiting slots stay out of the executed set. */
import {loadCases,STATUS} from './schema.mjs';
export function promptfooTests(cases=loadCases()){
 return cases.filter(c=>c.status===STATUS.runnable).map(c=>({description:`${c.caseId} [${c.group}] SYNTHETIC ${c.title}`,vars:{caseId:c.caseId,prompt:c.prompt},
  assert:[{type:'javascript',value:'file://graders/index.mjs'}],metadata:{group:c.group,status:c.status,label:'LOCAL_FIXTURE'}}));
}
export default function generateTests(){return promptfooTests();}
