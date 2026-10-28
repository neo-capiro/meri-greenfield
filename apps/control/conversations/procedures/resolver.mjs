// @ts-check
/**
 * Private procedure resolver (Wave5 MO01/ST16).
 *
 * Reads the persisted selection, derives the conversation and selected client from the run's own binding and client
 * scope (never from the selector), asks Core for the admission through the attended service-identity transport, and
 * re-checks that the answer belongs to exactly this selection and this run. Selection is not capability authority:
 * the answer is returned for the caller's own strict validation and never widens a tool set here.
 */
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../../packages/contracts/validate.mjs';
import {assertProcedureSelector} from '../../../worker/conversation/procedures/guidance.mjs';
const fault=code=>Object.assign(Error('PROCEDURE_'+code),{code:'PROCEDURE_'+code});
export const selectedClientFromScopes=scopes=>{const clientScope=(Array.isArray(scopes)?scopes:[]).find(scope=>scope?.kind==='client');return clientScope&&typeof clientScope.resourceId==='string'?clientScope.resourceId:null;};

export function createProcedureResolver(configuration={}){
 const {core,now=Date.now}=own(configuration,['core'],['now']);
 if(!core||typeof core.resolve!=='function'||typeof now!=='function')throw fault('RESOLVER_CONFIGURATION');
 async function resolve(value){
  let v,binding,selection,scopes;
  try{
   v=own(value,['binding','selection','scopes'],['versions','signal','deadlineMs']);nativeSignal(v.signal);
   binding=data(v.binding);scopes=data(v.scopes);validateShape('RunBinding',binding);
   scopes.forEach(scope=>validateShape('Scope',scope));
   selection=assertProcedureSelector(data(v.selection));
  }catch(error){if(typeof error?.code==='string'&&error.code.startsWith('PROCEDURE_'))throw error;throw fault('REQUEST');}
  const selectedClientId=selectedClientFromScopes(scopes);
  const scope=selectedClientId===null?'general':'client';
  const admission=data(await core.resolve({binding,selectedClientId,scope,selector:selection,signal:v.signal,deadlineMs:v.deadlineMs}));
  // The answer must belong to exactly this selection and this run before anything downstream sees it.
  if(admission.manifestDigest!==selection.manifestDigest||admission.clientId!==selectedClientId||admission.scope!==scope)throw fault('ADMISSION_REFUSED');
  if(!admission.identity||admission.identity.source!==selection.source||admission.identity.version!==selection.version)throw fault('ADMISSION_REFUSED');
  if(selection.source==='firm'?admission.identity.id!==selection.recordId:admission.identity.id!==selection.id)throw fault('ADMISSION_REFUSED');
  if(admission.tenantId!==binding.tenantId)throw fault('ADMISSION_REFUSED');
  if(!Number.isSafeInteger(admission.validUntil)||admission.validUntil<=now())throw fault('ADMISSION_REFUSED');
  return admission;
 }
 return Object.freeze({resolve});
}
