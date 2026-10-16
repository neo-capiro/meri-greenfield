/** Model-only facade over canonical durable prepared issuance. No activation, revoke, financial settlement or provider effect here.
 * UNKNOWN never generates or remints. Only an ISSUED durable identity resolves protected material into trusted runtime memory. */
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createPreparedRunIssuer} from './prepared-run-issuer.mjs';
import {createPostgresModelGrantStore} from './prepared-run-issuance-postgres.mjs';
import {createFileModelMaterialAuthority} from './model-material-authority.mjs';
const fail=code=>{throw Object.assign(Error('MODEL_GRANT_'+code),{code:'MODEL_GRANT_'+code});};
export function createModelGrantIssuer({store,authority,now=Date.now,maxRequestMs=3000}){
 const issuer=createPreparedRunIssuer({store,authority,now,maxRequestMs}),uncertain=new Set();
 return Object.freeze({async issue(value){
  const {intent,signal}=own(value,['intent'],['signal']);nativeSignal(signal);if(signal?.aborted)fail('CANCELLED');
  const i=data(own(intent,['issuanceKey','binding','requestSha256','expiresAtMs']));
  try{
   let state=await issuer.read({...i,signal});
   if(state.state!=='ISSUED'){
    if(state.state!=='ABSENT'||uncertain.has(i.issuanceKey))fail('UNKNOWN');
    uncertain.add(i.issuanceKey);
    try{state=await issuer.issue({...i,signal});}catch{state=await issuer.read({...i,signal});}
    if(state.state!=='ISSUED')fail('UNKNOWN');
   }
   // Resolve checks the entire immutable intent and stored grant/digest/reference, including expiry and current material state.
   const proxyCredential=await issuer.resolve({...state.issuance,signal});
   if(typeof proxyCredential!=='string'||!/^[!-~]{32,256}$/u.test(proxyCredential))fail('REFUSED');
   uncertain.delete(i.issuanceKey);
   const r=state.issuance;return {issuanceKey:r.issuanceKey,binding:r.binding,requestSha256:r.requestSha256,expiresAtMs:r.expiresAtMs,grantId:r.grantId,capabilitySha256:r.capabilitySha256,proxyCredential};
  }catch(error){
   // Do not expose authority/store errors, which may contain protected material. No read failure authorizes another generation.
   if(error?.code==='MODEL_GRANT_UNKNOWN')throw error;
   fail(error?.code==='PREPARED_RUN_ISSUER_INTENT_CONFLICT'?'INTENT_CONFLICT':error?.code==='PREPARED_RUN_ISSUER_EXPIRED'?'EXPIRED':'UNKNOWN');
  }
 }});
}
/** Inert startup composition over the approved pool and existing owner-only material directory; no generation or I/O until used. */
export function createPostgresModelGrants({pool,taskMaterialDirectory,now=Date.now,maxRequestMs=3000}){
 return createModelGrantIssuer({store:createPostgresModelGrantStore({pool}),authority:createFileModelMaterialAuthority({taskMaterialDirectory,now}),now,maxRequestMs});
}
