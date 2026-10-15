/** Case vocabulary, validation and loading. The case files are the single owner of every task slot, expectation and status. */
import {readFileSync} from 'node:fs';
const fail=(code,detail)=>{throw Object.assign(new Error(detail?`${code}: ${detail}`:code),{code});};
export const GROUPS=Object.freeze({'data-and-memory':'DM','government-intelligence':'GI','client-work':'CW','deliverables':'DL','agent-product':'AP'});
export const SLOTS_PER_GROUP=12;
export const STATUS=Object.freeze({runnable:'SYNTHETIC_RUNNABLE',awaiting:'AWAITING_APPROVED_REAL_REQUEST_SOURCE'});
export const GRADERS=Object.freeze(['output-format','permissions','factual-claims','usable-file']);
export const OUTPUT_KINDS=Object.freeze(['answer','file','refusal','recovery-state']);
export const SCENARIO_KINDS=Object.freeze(['conversation-history','conversation-foreign-history','conversation-submit-replay','gateway-read','gateway-forged-argument','artifact-text-create','artifact-text-revise','artifact-foreign-download','session-store']);
const SCOPE_KINDS=['tenant','client','mailbox','memory','document','private-user','public'];
const FILE_FORMATS=['txt','docx','xlsx','pptx','pdf'];
const text=(v,max=2000)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const keys=(v,required,optional=[])=>v&&typeof v==='object'&&!Array.isArray(v)&&required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
function validateEvidence(c,awaiting){
 if(!Array.isArray(c.expectedEvidence))fail('CASE_EVIDENCE',c.caseId);
 c.expectedEvidence.forEach((e,i)=>{
  if(!keys(e,['evidenceId','source','path','value','required','describes'])||e.evidenceId!==`${c.caseId}-E${i+1}`||!text(e.source,200)||typeof e.required!=='boolean'||!text(e.describes))fail('CASE_EVIDENCE',c.caseId);
  if(awaiting?(e.path!==null||e.value!==null):!text(e.path,200))fail('CASE_EVIDENCE',c.caseId);
 });
}
function validatePermissions(c){
 const p=c.permissions;if(!keys(p,['principal','scopes','expected'],['refusalCode','forbiddenStrings'])||!text(p.principal,200)||!Array.isArray(p.scopes)||!p.scopes.length||p.scopes.some(s=>!SCOPE_KINDS.includes(s))||!['allowed','denied'].includes(p.expected))fail('CASE_PERMISSIONS',c.caseId);
 if((p.expected==='denied')!==text(p.refusalCode,120)||p.forbiddenStrings!==undefined&&(!Array.isArray(p.forbiddenStrings)||p.forbiddenStrings.some(s=>!text(s,200))))fail('CASE_PERMISSIONS',c.caseId);
}
function validateOutput(c){
 const o=c.outputFormat;if(!o||!OUTPUT_KINDS.includes(o.kind))fail('CASE_OUTPUT',c.caseId);
 if(o.kind==='file'){if(!keys(o,['kind','fileFormat','files','requiredText','maxBytes'])||!FILE_FORMATS.includes(o.fileFormat)||!Number.isSafeInteger(o.files)||o.files<1||o.files>8||!Array.isArray(o.requiredText)||o.requiredText.some(t=>!text(t,500))||!Number.isSafeInteger(o.maxBytes)||o.maxBytes<1||o.maxBytes>16777216)fail('CASE_OUTPUT',c.caseId);}
 else if(!keys(o,['kind']))fail('CASE_OUTPUT',c.caseId);
 const g=c.graders;if(!Array.isArray(g)||new Set(g).size!==g.length||g.some(x=>!GRADERS.includes(x))||!g.includes('output-format')||!g.includes('permissions'))fail('CASE_GRADERS',c.caseId);
 if(g.includes('usable-file')!==(o.kind==='file'))fail('CASE_GRADERS',c.caseId);
 if(g.includes('factual-claims')!==(o.kind!=='refusal')||g.includes('factual-claims')&&!c.expectedEvidence.some(e=>e.required))fail('CASE_GRADERS',c.caseId);
 if((o.kind==='refusal')!==(c.permissions.expected==='denied'))fail('CASE_OUTPUT',c.caseId);
}
/** Throws on any malformed slot; returns the case unchanged. */
export function validateCase(c,group){
 if(!keys(c,['caseId','group','status','synthetic','title','capability','prompt','expectedEvidence','permissions','outputFormat','successCriteria','graders','scenario'])||c.group!==group||!Object.hasOwn(GROUPS,group)||!new RegExp(`^${GROUPS[group]}-\\d{2}$`,'u').test(c.caseId))fail('CASE_SHAPE',c?.caseId);
 if(!text(c.title,200)||!text(c.capability,120)||!Array.isArray(c.successCriteria)||!c.successCriteria.length||c.successCriteria.some(s=>!text(s,500)))fail('CASE_SHAPE',c.caseId);
 const awaiting=c.status===STATUS.awaiting;
 if(awaiting){if(c.synthetic!==false||c.prompt!==null||c.scenario!==null)fail('CASE_STATUS',c.caseId);}
 else if(c.status!==STATUS.runnable||c.synthetic!==true||!text(c.prompt)||!c.prompt.startsWith('SYNTHETIC: ')||!SCENARIO_KINDS.includes(c.scenario?.kind))fail('CASE_STATUS',c.caseId);
 validateEvidence(c,awaiting);validatePermissions(c);validateOutput(c);
 return c;
}
const FILES=Object.keys(GROUPS).map(group=>({group,url:new URL(`./${group}.json`,import.meta.url)}));
/** All 60 slots in group order, validated as a whole cohort. */
export function loadCases(files=FILES){
 const all=[];
 for(const {group,url} of files){const doc=JSON.parse(readFileSync(url,'utf8'));if(!keys(doc,['schema','group','cases'])||doc.schema!=='meri-promptfoo-cases/1'||doc.group!==group||!Array.isArray(doc.cases)||doc.cases.length!==SLOTS_PER_GROUP)fail('CASE_FILE',group);
  for(const c of doc.cases)all.push(Object.freeze(validateCase(c,group)));}
 if(new Set(all.map(c=>c.caseId)).size!==all.length)fail('CASE_DUPLICATE');
 return Object.freeze(all);
}
export const caseById=(id,cases=loadCases())=>cases.find(c=>c.caseId===id)??null;
/** What a runner may see: no expected values, success criteria or refusal codes. */
export const runnerView=c=>Object.freeze({caseId:c.caseId,prompt:c.prompt,scenario:structuredClone(c.scenario),evidence:c.expectedEvidence.map(({evidenceId,path})=>({evidenceId,path}))});
