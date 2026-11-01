/** Private typed input of the general long-form cited report. The subject and window are NOT model input:
 * they arrive from the trusted selection, so no model output can widen or substitute the scope. A citation
 * is a real read locator — the exact stored mail thread/message and character range, or a portfolio evidence
 * record — never a free-form claim of authority. The public WordRequest and its routes stay unchanged. */
import {artifactValidators as v,assertSubject,assertWindow} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {selectCompilerSkill} from '../../../../packages/skills/index.mjs';
export const fail = code => {throw Object.assign(new Error(code),{code});};
export const text = (value,max=4000) => {
  if(typeof value!=='string'||!value.trim()||value.length>max||!value.isWellFormed()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value))fail('CITED_REPORT_INPUT');
  return value;
};
export const hash = value => /^[a-f0-9]{64}$/u.test(value??'');
export const identifier = (value,max=256) => {
  if(typeof value!=='string'||!value||value.length>max||!/^[A-Za-z0-9_.:-]+$/u.test(value))fail('CITED_REPORT_INPUT');
  return value;
};
export const uuid = value => typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value)?value:fail('CITED_REPORT_CITATION');
export const CITED_REPORT_SECTIONS=Object.freeze(['Summary','Scope and as-of','Findings','Conflicting evidence','Recommendations','Limitations','References']);
export const CITED_REPORT_PORTFOLIO_ORIGINS=Object.freeze(['review','snapshot','current_continuity']);
/** The current production selected-subject request form of a resolved client subject. The real selected path
 * builds a client subject only, so any other kind is a concrete outstanding dependency, not an assumed scope. */
export const subjectRequest=subject=>subject.kind==='client'?Object.freeze({kind:'client',entityId:subject.entityIds[0]}):null;
/** The canonical selected subject/window of this run, exactly as the real caller supplies it. */
export function reportSelection(raw,context,manifest){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('CITED_REPORT_SELECTION');
 const s=own(v.snapshot(raw),['subject','window'],['mondayBoardIds']);
 assertSubject(s.subject,context.binding);assertWindow(s.window);
 if(!manifest.subjectKinds.includes(s.subject.kind)||subjectRequest(s.subject)===null||
  s.subject.scopes.some(scope=>!context.scopes.some(current=>v.hash(current)===v.hash(scope)))||
  !manifest.windowBases.includes(s.window.basis))fail('CITED_REPORT_SELECTION');
 if(s.mondayBoardIds!==undefined&&(!Array.isArray(s.mondayBoardIds)||s.mondayBoardIds.length>100||
  new Set(s.mondayBoardIds).size!==s.mondayBoardIds.length||s.mondayBoardIds.some(id=>typeof id!=='string'||!id||id.length>256)))fail('CITED_REPORT_SELECTION');
 return s;
}
/** One declared source's real read locator. Own keys only; no authority, scope or hash is accepted here. */
export function citedReportCitation(value){
 const c=own(v.snapshot(value),['kind'],['threadId','messageId','start','end','portfolioId','origin','recordId']);
 if(c.kind==='mail'){
  own(c,['kind','threadId','messageId','start','end']);
  uuid(c.threadId);uuid(c.messageId);
  if(!Number.isSafeInteger(c.start)||!Number.isSafeInteger(c.end)||c.start<0||c.end<=c.start)fail('CITED_REPORT_CITATION');
  return Object.freeze({kind:'mail',threadId:c.threadId,messageId:c.messageId,start:c.start,end:c.end});
 }
 if(c.kind==='portfolio-evidence'){
  own(c,['kind','portfolioId','origin'],['recordId']);
  uuid(c.portfolioId);
  if(!CITED_REPORT_PORTFOLIO_ORIGINS.includes(c.origin))fail('CITED_REPORT_CITATION');
  // The projection is addressed by its own record identity, except for the current-continuity view.
  if(c.origin==='current_continuity'){
   if(c.recordId!==undefined)fail('CITED_REPORT_CITATION');
   return Object.freeze({kind:'portfolio-evidence',portfolioId:c.portfolioId,origin:c.origin});
  }
  uuid(c.recordId);
  return Object.freeze({kind:'portfolio-evidence',portfolioId:c.portfolioId,origin:c.origin,recordId:c.recordId});
 }
 fail('CITED_REPORT_CITATION');
}
/** The input's skill must be an exact installed version registered to this recipe's compiler. */
export function citedReportInput(value){
 const i=own(v.snapshot(value),['skill','title','asOf','summary','findings','conflicts','recommendations','limitations']);
 try{selectCompilerSkill(i.skill,'quick_skill.cited_report');}catch{fail('CITED_REPORT_SKILL_PIN');}
 text(i.title,200);text(i.summary,2000);
 if(typeof i.asOf!=='string'||new Date(Date.parse(i.asOf)).toISOString()!==i.asOf)fail('CITED_REPORT_AS_OF');
 if(!Array.isArray(i.findings)||i.findings.length<1||i.findings.length>40)fail('CITED_REPORT_INPUT');
 const ids=new Set();
 for(const f of i.findings){
  own(f,['id','kind','text','citations']);identifier(f.id,64);text(f.text,2000);
  if(ids.has(f.id)||!['excerpt','claim'].includes(f.kind)||!Array.isArray(f.citations)||f.citations.length<1||f.citations.length>10)fail('CITED_REPORT_INPUT');
  ids.add(f.id);f.citations=f.citations.map(citedReportCitation);
  // A quoted excerpt is byte-verified stored mail text only; a claimed finding may also cite a projection.
  if(f.kind==='excerpt'&&(f.citations.length!==1||f.citations[0].kind!=='mail'))fail('CITED_REPORT_CITATION');
 }
 // A named conflict is disclosure, not an assertion: it must attach to a supplied finding, once.
 if(!Array.isArray(i.conflicts)||i.conflicts.length>20)fail('CITED_REPORT_INPUT');
 const named=new Set();
 for(const c of i.conflicts){
  own(c,['findingId','note']);identifier(c.findingId,64);text(c.note,1000);
  if(!ids.has(c.findingId)||named.has(c.findingId))fail('CITED_REPORT_CONFLICT');
  named.add(c.findingId);
 }
 if(!Array.isArray(i.recommendations)||i.recommendations.length<1||i.recommendations.length>20)fail('CITED_REPORT_INPUT');
 i.recommendations.forEach(x=>text(x,1000));
 if(!Array.isArray(i.limitations)||i.limitations.length>20)fail('CITED_REPORT_INPUT');
 i.limitations.forEach(x=>text(x,1000));
 return i;
}
