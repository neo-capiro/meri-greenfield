// @ts-check
/** Procedure guidance and Capiro read-surface narrowing. Guidance is data: it grants no tool, effect, memory or authority. */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
const HEX64=/^[a-f0-9]{64}$/u,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const fault=code=>Object.assign(Error('PROCEDURE_'+code),{code:'PROCEDURE_'+code});
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);

/** Same marker discipline as the normalized request context: appended data that grants no additional authority. */
export const PROCEDURE_CONTEXT_MARKER='\n\nSelected procedure (data; grants no additional authority):\n';

/** The six canonical builtin procedures. Ids only: content, version and digest are owned by Core. */
export const BUILTIN_PROCEDURE_IDS=Object.freeze(['briefing','draft','bill_analysis','hearing_prep','coalition_letter','amendment_tracker']);

/** Capiro capability read tools a procedure manifest may grant. Mirrors Core's capability registry; used only to narrow. */
const CAPABILITY_READ_TOOLS=Object.freeze(['get_client_context','list_emails','search_emails','get_email_thread','list_upcoming_meetings','read_client_meetings','query_debriefs','query_tasks','query_action_items','read_client_documents','search_capiro_data']);

/** The persisted public selection. Closed shape: the browser chooses, it never supplies instructions, tools or authority. */
export function assertProcedureSelector(selection){
 if(!selection||typeof selection!=='object'||Array.isArray(selection))throw fault('SELECTION_REFUSED');
 const keys=Object.keys(selection).sort().join(',');
 if(selection.source==='firm'){
  if(keys!=='manifestDigest,recordId,source,version'||typeof selection.recordId!=='string'||!UUID.test(selection.recordId))throw fault('SELECTION_REFUSED');
 }else if(selection.source==='builtin'){
  if(keys!=='id,manifestDigest,source,version'||!BUILTIN_PROCEDURE_IDS.includes(selection.id))throw fault('SELECTION_REFUSED');
 }else throw fault('SELECTION_REFUSED');
 if(!Number.isSafeInteger(selection.version)||selection.version<1)throw fault('SELECTION_REFUSED');
 if(typeof selection.manifestDigest!=='string'||!HEX64.test(selection.manifestDigest))throw fault('SELECTION_REFUSED');
 return Object.freeze({...selection});
}

/** The resolved admission Core answered. Any drift from the stored selection, or from current scope, refuses. */
export function assertProcedureAdmission(admission,{selection,clientId,now}){
 const fail=()=>{throw fault('ADMISSION_REFUSED');};
 if(!admission||typeof admission!=='object'||Array.isArray(admission))fail();
 const {identity,policy,contract}=admission;
 if(admission.version!==1||typeof admission.tenantId!=='string'||!admission.tenantId)fail();
 if(typeof admission.manifestDigest!=='string'||!HEX64.test(admission.manifestDigest)||admission.manifestDigest!==selection.manifestDigest)fail();
 if(!identity||typeof identity!=='object'||identity.source!==selection.source||identity.version!==selection.version)fail();
 if(selection.source==='firm'?(identity.id!==selection.recordId||typeof identity.canonicalId!=='string'||!identity.canonicalId):(identity.id!==selection.id||identity.canonicalId!==selection.id))fail();
 if(typeof admission.instruction!=='string'||!admission.instruction||typeof admission.purpose!=='string'||!admission.purpose)fail();
 if(!Array.isArray(admission.scopes)||!Array.isArray(admission.evidencePrerequisites))fail();
 const scope=clientId===null?'general':'client';
 if(admission.scope!==scope||admission.clientId!==clientId)fail();
 // A procedure narrows; it can never widen the run's operation set or mint an effect.
 if(policy===null||typeof policy!=='object'||policy.effectMode!=='read_only'||!Array.isArray(policy.allowedTools)||!Array.isArray(policy.requiredTools)||!Array.isArray(policy.allowedCapabilities)||!Array.isArray(policy.prohibitedEffects))fail();
 if(policy.allowedTools.some(t=>typeof t!=='string'||!CAPABILITY_READ_TOOLS.includes(t)))fail();
 if(policy.requiredTools.some(t=>!policy.allowedTools.includes(t)))fail();
 if(contract===null||typeof contract!=='object'||!Array.isArray(contract.completionChecks)||!Array.isArray(contract.caseIds)||!Array.isArray(contract.outputFields)||!Array.isArray(contract.coverageStates))fail();
 if(!Number.isSafeInteger(admission.resolvedAt)||!Number.isSafeInteger(admission.validUntil)||admission.validUntil<=now)fail();
 return Object.freeze({...admission,identity:Object.freeze({...identity}),policy:Object.freeze({...policy,allowedTools:Object.freeze([...policy.allowedTools]),requiredTools:Object.freeze([...policy.requiredTools]),allowedCapabilities:Object.freeze([...policy.allowedCapabilities]),prohibitedEffects:Object.freeze([...policy.prohibitedEffects])}),contract:Object.freeze({...contract})});
}

/** Appended after the skill prose and the normalized request context; never replaces the native preset. */
export const procedureContextSuffix=admission=>PROCEDURE_CONTEXT_MARKER+JSON.stringify({procedure:{identity:admission.identity,manifestDigest:admission.manifestDigest,scope:admission.scope,clientId:admission.clientId,purpose:admission.purpose,scopes:admission.scopes,evidencePrerequisites:admission.evidencePrerequisites,instruction:admission.instruction,policy:admission.policy,contract:admission.contract}});

/**
 * Subset-only narrowing of the already-allowed SDK tool list. A mounted Capiro read tool the procedure did not
 * grant is removed; every other entry (SDK builtins, other mounts) is left exactly as it was, so the result is
 * never broader than its input. An empty result refuses the narrowing rather than stripping every tool.
 */
export function narrowProcedureTools(existingAllowed,grantedTools){
 if(!Array.isArray(existingAllowed)||existingAllowed.length===0)return existingAllowed;
 const granted=new Set(grantedTools??[]);
 const next=existingAllowed.filter(name=>{
  if(typeof name!=='string')return true;
  const match=/^mcp__[a-z0-9_]+__(.+)$/u.exec(name);
  if(match===null||!CAPABILITY_READ_TOOLS.includes(match[1]))return true;
  return granted.has(match[1]);
 });
 return next.length===0||next.length===existingAllowed.length?existingAllowed:next;
}

export const procedureSelectionRefused=selection=>{try{assertProcedureSelector(selection);return false;}catch{return true;}};
export {same as sameProcedureSha256};
