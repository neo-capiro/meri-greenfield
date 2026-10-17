/** User-only preference service. Settings membership, document validation, CAS and audit retain their existing owners. */
import {ProductError,asProductError} from '../product-access/errors.mjs';
import {closed} from '../product-access/shape.mjs';
import {USER_PREFERENCE_DEFAULTS,releasedUserPreferences,userPreferences} from './documents.mjs';
import {settingsRevision,settingsAuditId} from './save-metadata.mjs';
export function createUserPreferencesService({store,newId}={}){
 if(['read','save'].some(k=>typeof store?.[k]!=='function')||typeof newId!=='function')throw new ProductError('PRODUCT_CONFIGURATION');
 const guard=fn=>async value=>{try{return await fn(value);}catch(error){throw asProductError(error,'SETTINGS_UNAVAILABLE');}};
 return Object.freeze({
  readUser:guard(async({principal,signal})=>{
   const stored=await store.read({kind:'user',tenantId:principal.tenantId,actorId:principal.actorId,signal});
   return Object.freeze({revision:stored?.revision??0,preferences:releasedUserPreferences(stored?.document??USER_PREFERENCE_DEFAULTS,principal)});
  }),
  saveUser:guard(async({principal,body,signal,recheckMembership})=>{
   const r=closed(body,['expectedRevision','preferences'],[],'SETTINGS_REQUEST_INVALID'),expectedRevision=settingsRevision(r.expectedRevision);
   const preferences=userPreferences(r.preferences,principal);
   if(recheckMembership!==undefined){if(typeof recheckMembership!=='function')throw new ProductError('PRODUCT_CONFIGURATION');await recheckMembership();}
   const saved=await store.save({kind:'user',tenantId:principal.tenantId,actorId:principal.actorId,expectedRevision,document:preferences,initialDocument:USER_PREFERENCE_DEFAULTS,signal,
    audit:{auditId:settingsAuditId(newId),actorId:principal.actorId,platformSha256:null}});
   return Object.freeze({revision:saved.revision,preferences});
  }),
 });
}
