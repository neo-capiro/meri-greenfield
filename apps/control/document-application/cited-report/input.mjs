/** Private typed input of the general long-form cited report. The subject and window are NOT model input:
 * they arrive from the trusted selection, so no model output can widen or substitute the scope. Public
 * WordRequest and routes remain unchanged. */
import {artifactValidators as v,assertSubject,assertWindow} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
export const fail = code => {throw Object.assign(new Error(code),{code});};
export const text = (value,max=4000) => {
  if(typeof value!=='string'||!value.trim()||value.length>max||!value.isWellFormed()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value))fail('CITED_REPORT_INPUT');
  return value;
};
export const hash = value => /^[a-f0-9]{64}$/u.test(value??'');
export const CITED_REPORT_SECTIONS=Object.freeze(['Summary','Scope and as-of','Findings','Conflicting evidence','Recommendations','Limitations','References']);
/** The flat, trusted read selector of a resolved subject; it carries no free text and no model field. */
export const selectorSubject=subject=>subject.kind==='client'?{kind:'client',entityId:subject.entityIds[0]}:
 subject.kind==='portfolio'?{kind:'portfolio',rosterVersionId:subject.rosterVersionId}:
 subject.kind==='personal'?{kind:'personal'}:null;
/** The canonical selected subject/window of this run, exactly as the real caller supplies it. */
export function reportSelection(raw,context,manifest){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('CITED_REPORT_SELECTION');
 const s=own(v.snapshot(raw),['subject','window'],['mondayBoardIds']);
 assertSubject(s.subject,context.binding);assertWindow(s.window);
 if(!manifest.subjectKinds.includes(s.subject.kind)||
  s.subject.scopes.some(scope=>!context.scopes.some(current=>v.hash(current)===v.hash(scope)))||
  !manifest.windowBases.includes(s.window.basis)||selectorSubject(s.subject)===null)fail('CITED_REPORT_SELECTION');
 if(s.mondayBoardIds!==undefined&&(!Array.isArray(s.mondayBoardIds)||s.mondayBoardIds.length>100||
  new Set(s.mondayBoardIds).size!==s.mondayBoardIds.length||s.mondayBoardIds.some(id=>typeof id!=='string'||!id||id.length>256)))fail('CITED_REPORT_SELECTION');
 return s;
}
export function citedReportInput(value,pin){
 const i=own(v.snapshot(value),['skill','title','asOf','summary','findings','conflicts','recommendations','limitations']);
 own(i.skill,Object.keys(pin));if(v.hash(i.skill)!==v.hash(pin))fail('CITED_REPORT_SKILL_PIN');
 text(i.title,200);text(i.summary,2000);
 if(typeof i.asOf!=='string'||new Date(Date.parse(i.asOf)).toISOString()!==i.asOf)fail('CITED_REPORT_AS_OF');
 if(!Array.isArray(i.findings)||i.findings.length<1||i.findings.length>40)fail('CITED_REPORT_INPUT');
 const ids=new Set();
 for(const f of i.findings){
  own(f,['id','kind','text','citations']);text(f.id,64);text(f.text,2000);
  if(ids.has(f.id)||!['excerpt','claim'].includes(f.kind)||!Array.isArray(f.citations)||f.citations.length>10)fail('CITED_REPORT_INPUT');ids.add(f.id);
  for(const c of f.citations){
   own(c,['sourceId','recordId','sourceVersionId','start','end'],['url']);
   for(const field of ['sourceId','recordId','sourceVersionId'])text(c[field],256);
   if(!Number.isSafeInteger(c.start)||!Number.isSafeInteger(c.end)||c.start<0||c.end<=c.start)fail('CITED_REPORT_CITATION');
   if(c.url!==undefined){text(c.url,1000);const u=new URL(c.url);if(u.protocol!=='https:'||u.username||u.password)fail('CITED_REPORT_CITATION');}
  }
  if(f.kind==='excerpt'&&f.citations.length!==1)fail('CITED_REPORT_CITATION');
 }
 // A named conflict is disclosure, not an assertion: it must attach to a supplied finding, once.
 if(!Array.isArray(i.conflicts)||i.conflicts.length>20)fail('CITED_REPORT_INPUT');
 const named=new Set();
 for(const c of i.conflicts){
  own(c,['findingId','note']);text(c.findingId,64);text(c.note,1000);
  if(!ids.has(c.findingId)||named.has(c.findingId))fail('CITED_REPORT_CONFLICT');named.add(c.findingId);
 }
 if(!Array.isArray(i.recommendations)||i.recommendations.length<1||i.recommendations.length>20)fail('CITED_REPORT_INPUT');
 i.recommendations.forEach(x=>text(x,1000));
 if(!Array.isArray(i.limitations)||i.limitations.length>20)fail('CITED_REPORT_INPUT');
 i.limitations.forEach(x=>text(x,1000));
 return i;
}
