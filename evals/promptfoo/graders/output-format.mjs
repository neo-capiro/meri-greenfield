/** The output answers the case it was asked for, in the expected envelope kind. */
export function gradeOutputFormat(output,c){
 const problems=[];if(output.caseId!==c.caseId)problems.push('CASE_ID');if(output.kind!==c.outputFormat.kind)problems.push(`KIND ${output.kind} expected ${c.outputFormat.kind}`);
 if(!Array.isArray(output.claims)||!Array.isArray(output.files)||!output.evidence||typeof output.evidence!=='object')problems.push('ENVELOPE');
 return {pass:problems.length===0,score:problems.length?0:1,reason:problems.length?problems.join('; '):`${c.outputFormat.kind} envelope`};
}
