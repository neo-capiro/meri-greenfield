/** Personal settings over borrowed control persistence and the captured native membership owner. */
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {createUserPreferencesFeature} from '../control/settings/user-application/feature.mjs';
import {USER_PREFERENCES_LIMITS,userPreferencesUnavailable} from '../control/settings/user-application/protocol.mjs';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {ProductError} from '../control/product-access/errors.mjs';
const TABLES=Object.freeze(['meri_settings.user_preferences','meri_settings.settings_audit']);
/** A control-only opt-in; it never supplies authority, credentials or a persistence owner. */
export function compileControlUserPreferencesConfiguration(configuration){
 if(configuration.userPreferences===undefined)return false;
 const c=own(configuration.userPreferences,['enabled']);
 if(typeof c.enabled!=='boolean')throw new ProductError('USER_PREFERENCES_CONFIGURATION');return c.enabled;
}
export function createRuntimeUserPreferences({configuration,pool,ports,now=Date.now}){
 const enabled=compileControlUserPreferencesConfiguration(configuration),gate=enabled?ports.conversationMembership:undefined;
 let retired=false,ready=false,generation=0;
 const state=()=>retired?'retired':!enabled?'disabled':!gate?'unavailable':ready?'composed':'pending';
 // Disabled/missing-owner construction does not inspect or invoke borrowed database methods.
 const query=enabled&&gate?storageMethod(pool,'query'):undefined;
 const feature=query?createUserPreferencesFeature({enabled:true,pool,gate,now,limits:{
  maxRequestMs:Math.min(configuration.limits.requestMs,USER_PREFERENCES_LIMITS.maxRequestMs),
  maxRequestBytes:Math.min(configuration.limits.requestBytes,USER_PREFERENCES_LIMITS.maxRequestBytes),
  maxResponseBytes:Math.min(configuration.native.maxResponseBytes,USER_PREFERENCES_LIMITS.maxResponseBytes),
 }}):null;
 return Object.freeze({state,handle:request=>ready&&!retired?feature.application.handle(request):userPreferencesUnavailable(),
  async readiness({signal}={}){
   if(!enabled&&!retired)return;
   if(retired||!feature)throw new ProductError('USER_PREFERENCES_UNAVAILABLE');
   const current=++generation;let life;
   try{
    life=createOperationLifetime({now,signal,deadlineMs:now()+configuration.limits.requestMs,errorFactory:()=>new ProductError('USER_PREFERENCES_UNAVAILABLE')});
    const result=await life.run(()=>query('SELECT name,to_regclass(name) AS relation FROM unnest($1::text[]) AS names(name)',[TABLES]));
    life.check();
    if(retired||current!==generation||result.rows.length!==TABLES.length||new Set(result.rows.map(row=>row.name)).size!==TABLES.length||
     result.rows.some(row=>!TABLES.includes(row.name)||typeof row.relation!=='string'))throw new ProductError('USER_PREFERENCES_UNAVAILABLE');
    ready=true;
   }catch{if(current===generation)ready=false;throw new ProductError('USER_PREFERENCES_UNAVAILABLE');}finally{life?.close();}
  },
  close(){retired=true;ready=false;generation++;},
 });
}
