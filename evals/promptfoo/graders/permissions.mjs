/** Allowed cases carry no refusal; denied cases carry exactly the canonical refusal; no forbidden marker appears anywhere in the output. */
export function gradePermissions(output,c){
 const p=c.permissions,problems=[],code=output.refusal?.code??null;
 if(p.expected==='allowed'&&output.refusal!==null)problems.push(`UNEXPECTED_REFUSAL ${code}`);
 if(p.expected==='denied'&&code!==p.refusalCode)problems.push(`REFUSAL_CODE ${code} expected ${p.refusalCode}`);
 const text=JSON.stringify(output);for(const marker of p.forbiddenStrings??[])if(text.includes(marker))problems.push(`FORBIDDEN_MARKER ${marker}`);
 return {pass:problems.length===0,score:problems.length?0:1,reason:problems.length?problems.join('; '):`permission outcome ${p.expected}`};
}
