/** Promptfoo javascript assertion: grades a provider output against the repository case, never against anything the output claims about itself. */
import {caseById,STATUS} from '../cases/schema.mjs';
import {gradeFactualClaims} from './factual-claims.mjs';
import {gradeUsableFile} from './usable-file.mjs';
import {gradePermissions} from './permissions.mjs';
import {gradeOutputFormat} from './output-format.mjs';
export const GRADER_FUNCTIONS=Object.freeze({'output-format':gradeOutputFormat,'permissions':gradePermissions,'factual-claims':gradeFactualClaims,'usable-file':gradeUsableFile});
export function gradeCase(outputText,c){
 if(!c||c.status!==STATUS.runnable)return {pass:false,score:0,reason:'CASE_NOT_RUNNABLE'};
 let output;try{output=JSON.parse(outputText);}catch{return {pass:false,score:0,reason:'OUTPUT_NOT_JSON'};}
 if(!output||typeof output!=='object'||Array.isArray(output))return {pass:false,score:0,reason:'OUTPUT_NOT_OBJECT'};
 const componentResults=c.graders.map(name=>({...GRADER_FUNCTIONS[name](output,c),assertion:{type:'javascript',value:name}}));
 return {pass:componentResults.every(r=>r.pass),score:componentResults.reduce((s,r)=>s+r.score,0)/componentResults.length,reason:componentResults.map(r=>`${r.assertion.value}: ${r.reason}`).join(' | '),componentResults};
}
export default function grade(output,context){return gradeCase(output,caseById(context?.vars?.caseId));}
