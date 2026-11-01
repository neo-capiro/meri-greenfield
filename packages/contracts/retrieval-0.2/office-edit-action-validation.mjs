/** Closed same-document Office edit binding. The model reads an addressable outline of the exact selected
 * Office version and proposes bounded operations on its units; the existing intent journal retains the
 * proposal, the user's Apply publishes a new immutable version through the artifact owner, and this module
 * only correlates shapes. Validation supplies no authority and never reconstructs one. */
import {own,data} from '../commands-0.2/execution-boundary.mjs';
export const OFFICE_EDIT_ACTION='propose_office_edit';
export const OFFICE_EDIT_FORMATS=Object.freeze(['docx','xlsx','pptx']);
export const OFFICE_EDIT_OPERATION_KINDS=Object.freeze(['replace_text','insert_after','delete']);
export const OFFICE_EDIT_STATUSES=Object.freeze(['proposed','applied','rejected','conflict','refused','unknown','expired']);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,hex=/^[a-f0-9]{64}$/u;
const fail=()=>{throw Object.assign(Error('INVALID_RESULT'),{code:'INVALID_RESULT'});};
const text=(value,max,min=0)=>typeof value==='string'&&value.length>=min&&value.length<=max&&value.isWellFormed();
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
export function createOfficeEditValidators({validateShape,canonicalSha256:hash}){
 const same=(a,b)=>hash(a)===hash(b);
 function operation(value){
  const o=data(own(value,['unit','kind','before','after']));
  if(!text(o.unit,200,1)||!OFFICE_EDIT_OPERATION_KINDS.includes(o.kind))fail();
  const string=v=>text(v,20000);
  if(o.kind==='replace_text'&&(!string(o.before)||!string(o.after))||o.kind==='insert_after'&&(o.before!==null||!string(o.after))||o.kind==='delete'&&(!string(o.before)||o.after!==null))fail();
  return o;
 }
 /** Canonical model input: either a read of the selected document or a bounded proposal against it. */
 function normalizeInput(value){
  const raw=data(value);
  if(raw?.action==='read'){own(raw,['action']);return {action:'read'};}
  const r=own(raw,['action','summary','operations']);
  if(r.action!=='propose'||!text(r.summary,500,1)||!Array.isArray(r.operations)||r.operations.length<1||r.operations.length>50)fail();
  return {action:'propose',summary:r.summary,operations:r.operations.map(operation)};
 }
 const isRead=value=>{try{return normalizeInput(value).action==='read';}catch{return false;}};
 function document(value){
  const d=data(own(value,['artifactId','versionId','objectSha256','format','title','filename']));
  if(!uuid.test(d.artifactId)||!uuid.test(d.versionId)||!hex.test(d.objectSha256)||!OFFICE_EDIT_FORMATS.includes(d.format)||!text(d.title,200,1)||!text(d.filename,255,1)||!d.filename.toLowerCase().endsWith('.'+d.format))fail();
  return d;
 }
 function context(value){
  const c=data(own(value,['conversationId','selectedClientId']));
  if(!uuid.test(c.conversationId)||c.selectedClientId!==null&&!uuid.test(c.selectedClientId))fail();return c;
 }
 function scopes(value,binding,selectedClientId){
  if(!Array.isArray(value)||value.length!==1)fail();
  for(const s of value){validateShape('Scope',s);if(s.tenantId!==binding.tenantId||s.kind!==(selectedClientId===null?'private-user':'client')||s.resourceId!==(selectedClientId??binding.actorId))fail();}
  return value;
 }
 function outline(value,format){
  const o=data(own(value,['format','units','truncated']));
  if(o.format!==format||typeof o.truncated!=='boolean'||!Array.isArray(o.units)||o.units.length>2000)fail();
  const seen=new Set();
  for(const raw of o.units){const u=own(raw,['unit','kind','text','editable']);
   if(!text(u.unit,200,1)||!['paragraph','cell','shape'].includes(u.kind)||!text(u.text,20000)||typeof u.editable!=='boolean'||seen.has(u.unit))fail();seen.add(u.unit);}
  return o;
 }
 /** The read answer: current outline of the exact selected version, bound to this run and its current scopes. */
 function readResult(value){
  const v=data(own(value,['status','operation','binding','scopes','document','outline','observedAt','expiresAt']));
  if(v.status!=='read'||v.operation!==OFFICE_EDIT_ACTION)fail();validateShape('RunBinding',v.binding);
  if(!Array.isArray(v.scopes)||!v.scopes.length||v.scopes.length>100)fail();for(const s of v.scopes){validateShape('Scope',s);if(s.tenantId!==v.binding.tenantId)fail();}
  const d=document(v.document);outline(v.outline,d.format);
  if(!instant(v.observedAt)||!instant(v.expiresAt)||Date.parse(v.expiresAt)<=Date.parse(v.observedAt))fail();
  return v;
 }
 function assertProposal(value){
  const p=data(own(value,['kind','operation','proposalId','commandSha256','binding','scopes','context','document','summary','operations','result','createdAt','expiresAt','requiredApprover']));
  if(p.kind!=='office_edit'||p.operation!==OFFICE_EDIT_ACTION||!uuid.test(p.proposalId)||!hex.test(p.commandSha256))fail();
  const {commandSha256,...bound}=p;if(hash(bound)!==commandSha256)fail();
  validateShape('RunBinding',p.binding);validateShape('Identity',p.requiredApprover);
  const c=context(p.context);if(c.conversationId!==p.binding.conversationId)fail();scopes(p.scopes,p.binding,c.selectedClientId);
  document(p.document);
  if(!text(p.summary,500,1)||!Array.isArray(p.operations)||p.operations.length<1||p.operations.length>50)fail();p.operations.forEach(operation);
  const r=own(p.result,['sha256','bytes']);if(!hex.test(r.sha256)||!Number.isSafeInteger(r.bytes)||r.bytes<1||r.bytes>20971520)fail();
  if(!instant(p.createdAt)||!instant(p.expiresAt)||Date.parse(p.expiresAt)<=Date.parse(p.createdAt))fail();
  if(p.requiredApprover.tenantId!==p.binding.tenantId||p.requiredApprover.actorId!==p.binding.actorId)fail();
  return p;
 }
 function assertOutput(value,expectedInput){
  const v=data(own(value,['status','proposal']));if(v.status!=='approval_required')fail();
  const p=assertProposal(v.proposal);
  if(expectedInput!==undefined){const input=normalizeInput(expectedInput);if(input.action!=='propose'||input.summary!==p.summary||!same(input.operations,p.operations))fail();}
  return v;
 }
 function version(value,proposal){
  const r=data(own(value,['artifactId','versionId','parentVersionId','sha256','bytes','filename']));
  if(!uuid.test(r.artifactId)||!uuid.test(r.versionId)||!uuid.test(r.parentVersionId)||!hex.test(r.sha256)||!Number.isSafeInteger(r.bytes)||r.bytes<1||!text(r.filename,255,1))fail();
  if(proposal&&(r.artifactId!==proposal.document.artifactId||r.parentVersionId!==proposal.document.versionId||r.sha256!==proposal.result.sha256||r.bytes!==proposal.result.bytes||r.filename!==proposal.document.filename))fail();
  return r;
 }
 /** The durable reading of what happened to one proposal, correlated with the retained proposal when known. */
 function result(value,proposal){
  const r=data(own(value,['proposalId','proposalStatus','version','code']));
  if(!uuid.test(r.proposalId)||!OFFICE_EDIT_STATUSES.includes(r.proposalStatus)||proposal&&r.proposalId!==proposal.proposalId)fail();
  if(r.code!==null&&!/^[A-Z][A-Z0-9_]{0,79}$/u.test(r.code))fail();
  if(r.proposalStatus==='applied'){if(r.version===null)fail();version(r.version,proposal);}else if(r.version!==null)fail();
  return r;
 }
 return Object.freeze({normalizeInput,isRead,readResult,assertProposal,assertOutput,result,document,version});
}
