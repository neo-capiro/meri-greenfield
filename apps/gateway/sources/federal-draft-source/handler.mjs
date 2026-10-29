import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {ownFields} from '../source-admission.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {retainedCall} from '../retained-reads/call-context.mjs';
import {createRetainedHttpTransport} from '../retained-reads/http-transport.mjs';
import {prepareNativeFederalDraft} from '../../../artifacts/federal-drafting/native-source.mjs';
const routes=Object.freeze({read_federal_draft_source:'/api/clio/tools/read_federal_draft_source'});
export function createFederalDraftSourceHandlers(configuration,operations){
 const {credentialsForCall,...c}=ownFields(configuration,['origin','now'],['getCredentials','credentialsForCall','readSource','fetchImpl','maxRequestMs','maxResponseBytes']);
 if(credentialsForCall!==undefined&&(typeof credentialsForCall!=='function'||c.getCredentials!==undefined))deny('GATEWAY_CONFIGURATION');
 const transport=createRetainedHttpTransport(c),seen=new Set();
 return operations.map(operation=>{
  if(seen.has(operation.id)||operation.version!=='0.2.0')deny('GATEWAY_CONFIGURATION');seen.add(operation.id);
  if(operation.id==='read_federal_draft_source')return createStoredNativeReadHandlers(configuration,[operation],{family:'federal-draft-source',routes})[0];
  if(operation.id!=='prepare_federal_draft')deny('GATEWAY_CONFIGURATION');
  return {operation,async execute(call){try{
   const current=retainedCall(operation,call,c.now);
   // Saved jobs have their own fixed Core operation allowlist. No alias silently
   // substitutes an attended operation into that distinct source authority.
   if(c.readSource)deny('UNAVAILABLE');
   const selected=credentialsForCall?createRetainedHttpTransport({...c,getCredentials:credentialsForCall(operation,call)}):transport;
   const result=await selected.read(current,{path:routes.read_federal_draft_source,method:'POST',body:current.input.selection,serviceSecret:true});
   const prepared=prepareNativeFederalDraft(current.input.selection,result,current.input.operations);
   current.contract.assertOutput(prepared,{request:current.request});
   if(current.signal?.aborted)deny('CANCELLED');if(c.now()>=current.deadlineMs)deny('DEADLINE');
   return JSON.stringify({binding:current.authority.binding,subject:current.authority.subject,operation,argumentsSha256:current.argumentsSha256,result:prepared});
  }catch(error){throw safeFailure(error);}}};
 });
}
