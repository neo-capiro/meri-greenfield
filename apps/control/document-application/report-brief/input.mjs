/** Private typed report input over the shared legislative subject/fact kernel. Public WordRequest
 * and routes remain unchanged; the evidence rule is the congressional recipe's rule. */
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {fail,text,hash,subject} from '../research-brief/input.mjs';
export {fail,text,hash,subject};
export const REPORT_SECTIONS=Object.freeze(['Summary','Scope and as-of','Findings','Conflicting evidence','Recommendations','Limitations','References']);
export function reportInput(value,pin){
  const i=own(v.snapshot(value),['skill','title','subject','asOf','summary','findings','conflicts','recommendations','limitations']);
  own(i.skill,Object.keys(pin));if(v.hash(i.skill)!==v.hash(pin))fail('REPORT_SKILL_PIN');
  text(i.title,200);i.subject=subject(i.subject);text(i.summary,2000);
  if(typeof i.asOf!=='string'||new Date(Date.parse(i.asOf)).toISOString()!==i.asOf)fail('REPORT_AS_OF');
  if(!Array.isArray(i.findings)||i.findings.length<1||i.findings.length>40)fail('REPORT_INPUT');
  const ids=new Set();
  for(const f of i.findings){
    own(f,['id','kind','text','citations']);text(f.id,64);text(f.text,2000);
    if(ids.has(f.id)||!['excerpt','claim'].includes(f.kind)||!Array.isArray(f.citations)||f.citations.length>10)fail('REPORT_INPUT');ids.add(f.id);
    for(const c of f.citations){
      own(c,['sourceId','recordId','sourceVersionId','start','end'],['url']);
      for(const field of ['sourceId','recordId','sourceVersionId'])text(c[field],256);
      if(!Number.isSafeInteger(c.start)||!Number.isSafeInteger(c.end)||c.start<0||c.end<=c.start)fail('REPORT_CITATION');
      if(c.url!==undefined){text(c.url,1000);const u=new URL(c.url);if(u.protocol!=='https:'||u.username||u.password)fail('REPORT_CITATION');}
    }
    if(f.kind==='excerpt'&&f.citations.length!==1)fail('REPORT_CITATION');
  }
  // A named conflict is disclosure, not an assertion: it must attach to a supplied finding, once.
  if(!Array.isArray(i.conflicts)||i.conflicts.length>20)fail('REPORT_INPUT');
  const named=new Set();
  for(const c of i.conflicts){
    own(c,['findingId','note']);text(c.findingId,64);text(c.note,1000);
    if(!ids.has(c.findingId)||named.has(c.findingId))fail('REPORT_CONFLICT');named.add(c.findingId);
  }
  if(!Array.isArray(i.recommendations)||i.recommendations.length<1||i.recommendations.length>20)fail('REPORT_INPUT');
  i.recommendations.forEach(x=>text(x,1000));
  if(!Array.isArray(i.limitations)||i.limitations.length>20)fail('REPORT_INPUT');
  i.limitations.forEach(x=>text(x,1000));
  return i;
}
