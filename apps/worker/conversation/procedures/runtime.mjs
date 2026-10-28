// @ts-check
/**
 * Native selected-procedure runtime for one conversation activity (Wave5 MO01/ST16).
 *
 * The persisted selection (saved.request.procedure) is re-resolved through the caller's own authenticated native
 * transport on every activity, never carried forward from an earlier turn, and the returned admission is checked
 * against that exact selection, the run's own client scope and the current time. The result is an immutable
 * point-in-time admission that narrows the run's guidance and read surface: it grants no tool, effect, memory or
 * authority, it never calls a model, and Core remains the owner of every per-call decision.
 */
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {assertProcedureAdmission,assertProcedureSelector,narrowProcedureTools,procedureContextSuffix} from './guidance.mjs';
const fault=code=>Object.assign(Error('PROCEDURE_'+code),{code:'PROCEDURE_'+code});
/** One bounded resolution per activity. The task transport caps an ordinary operation at 3 s, so this matches it. */
export const PROCEDURE_RESOLVE_MAX_MS=3000;

/** The run's selected client is derived from the run's own canonical client scope, never from the selector. */
export const selectedClientFromScopes=scopes=>{const clientScope=(Array.isArray(scopes)?scopes:[]).find(scope=>scope?.kind==='client');return clientScope&&typeof clientScope.resourceId==='string'?clientScope.resourceId:null;};

export function createProcedureRuntime(configuration={}){
 const {resolve,now=Date.now}=own(configuration,['resolve'],['now']);
 if(typeof resolve!=='function'||typeof now!=='function')throw fault('RUNTIME_CONFIGURATION');
 async function prepare(raw){
  const args=own(raw,['binding','versions','request','scopes'],['signal']);nativeSignal(args.signal);
  const binding=data(args.binding),request=data(args.request);validateShape('RunBinding',binding);validateShape('RuntimeVersions',args.versions);
  // No selection: the run is an ordinary conversation and this port changes nothing.
  const stored=request.procedure;
  if(stored===undefined||stored===null)return null;
  const selection=assertProcedureSelector(data(stored));
  const scopes=data(args.scopes),clientId=selectedClientFromScopes(scopes);
  const life=createOperationLifetime({deadlineMs:now()+PROCEDURE_RESOLVE_MAX_MS,now,signal:args.signal,errorFactory:fault});
  try{
   const answered=await life.run(signal=>resolve({binding,versions:args.versions,request,selection,scopes,clientId,signal}));
   const admission=assertProcedureAdmission(data(answered),{selection,clientId,now:now()});
   return Object.freeze({
    identity:admission.identity,manifestDigest:admission.manifestDigest,scope:admission.scope,clientId:admission.clientId,
    allowedTools:Object.freeze([...admission.policy.allowedTools]),requiredTools:Object.freeze([...admission.policy.requiredTools]),
    policy:admission.policy,contract:admission.contract,
    systemPromptAppend:procedureContextSuffix(admission),
    /** Subset-only narrowing; the activity applies it after the full tool list is built. */
    narrow:existing=>narrowProcedureTools(existing,admission.policy.allowedTools),
    validUntil:admission.validUntil,checkedAtMs:now(),
   });
  }finally{life.close();}
 }
 return Object.freeze({prepare});
}
