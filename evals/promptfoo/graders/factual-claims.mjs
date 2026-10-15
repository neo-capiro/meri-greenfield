/** Factual claims are correct only when each cites expected evidence whose observed value and provenance equal the frozen expectation. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
const same=(a,b)=>{try{return canonicalSha256(a)===canonicalSha256(b);}catch{return false;}};
export function gradeFactualClaims(output,c){
 const expected=new Map(c.expectedEvidence.map(e=>[e.evidenceId,e])),claims=Array.isArray(output.claims)?output.claims:[],evidence=output.evidence&&typeof output.evidence==='object'?output.evidence:{};
 if(!claims.length)return {pass:false,score:0,reason:'NO_CLAIMS'};
 const problems=[],cited=new Set();let correct=0;
 claims.forEach((claim,index)=>{
  const ids=Array.isArray(claim?.evidenceIds)?claim.evidenceIds:[];
  const fault=!ids.length?'UNCITED':!Object.hasOwn(claim,'value')?'NO_VALUE':ids.map(id=>{const e=expected.get(id),seen=evidence[id];
   if(!e)return 'UNEXPECTED_EVIDENCE';if(!seen||!Object.hasOwn(seen,'value'))return 'EVIDENCE_NOT_OBSERVED';if(seen.source!==e.source||seen.path!==e.path)return 'EVIDENCE_PROVENANCE';
   if(!same(seen.value,e.value))return 'EVIDENCE_VALUE';if(!same(claim.value,e.value))return 'CLAIM_VALUE';return null;}).find(Boolean)??null;
  if(fault)problems.push(`claim ${index}: ${fault}`);else{correct++;ids.forEach(id=>cited.add(id));}
 });
 for(const e of c.expectedEvidence)if(e.required&&!cited.has(e.evidenceId))problems.push(`${e.evidenceId}: REQUIRED_EVIDENCE_UNSUPPORTED`);
 return {pass:problems.length===0,score:correct/claims.length,reason:problems.length?problems.join('; '):`${correct}/${claims.length} claims match expected evidence`};
}
