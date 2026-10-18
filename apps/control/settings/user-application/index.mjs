/** User-only API over canonical settings and fresh membership owners. No listener, platform policy or approval authority. */
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../../../artifacts/storage/boundary.mjs';
import {createProductApplication} from '../../product-access/http.mjs';
import {ProductError} from '../../product-access/errors.mjs';
import {userPreferences} from '../documents.mjs';
import {createSettingsRoutes} from '../routes.mjs';
import {USER_PREFERENCES_PATHS,USER_PREFERENCES_LIMITS,USER_PREFERENCES_DOMAIN_ERRORS} from './protocol.mjs';
export function createUserPreferencesApplication(configuration){
 const c=own(configuration,['gate','service','now','limits']),limits=data(own(c.limits,['maxRequestMs','maxRequestBytes','maxResponseBytes']));
 if(typeof c.now!=='function'||Object.entries(limits).some(([key,value])=>!Number.isSafeInteger(value)||value<1||value>USER_PREFERENCES_LIMITS[key]))throw new ProductError('PRODUCT_CONFIGURATION');
 const gate=Object.freeze({admit:storageMethod(c.gate,'admit'),recheck:storageMethod(c.gate,'recheck')});
 const service=Object.freeze({readUser:storageMethod(c.service,'readUser'),saveUser:storageMethod(c.service,'saveUser')});
 const canonical=createSettingsRoutes({service}),routes={};
 for(const path of Object.values(USER_PREFERENCES_PATHS)){
  const route=canonical[path];
  routes[path]={errors:USER_PREFERENCES_DOMAIN_ERRORS,effect:route.effect,async handle(call){
   const result=await route.handle(call);
   try{
    const record=data(own(result,['revision','preferences']));
    if(!Number.isSafeInteger(record.revision)||record.revision<0)throw Error('invalid record');
    const preferences=userPreferences(record.preferences,call.principal);
    return data({owner:{tenantId:call.principal.tenantId,actorId:call.principal.actorId},revision:record.revision,preferences});
   }catch{throw new ProductError('SETTINGS_STORE_STATE',route.effect?'RESULT_NOT_RELEASED':null);}
  }};
 }
 return createProductApplication({gate,routes,now:c.now,limits});
}
