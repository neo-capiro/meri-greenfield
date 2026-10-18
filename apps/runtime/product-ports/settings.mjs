/** Tenant settings family (lane 5): the canonical settings service and its tenant routes, mounted as `settingsApplication` over the
 * canonical Core membership gate and the trusted static platform record (`capability-policy.mjs`, decision N3).
 *
 * Composed only when `configuration.tenantSettings.enabled === true` AND the canonical candidate supplies its membership owner
 * (`conversationMembership`). Otherwise the family contributes no port, so `/api/settings/tenant/*` answers SETTINGS_UNAVAILABLE and
 * product readiness reports `settings.tenant: unavailable`. User preferences stay with `apps/runtime/user-preferences.mjs`; only the
 * three tenant paths are mounted here.
 *
 * Construction is ordinary and synchronous: no SQL, connection or secret read. The store needs `meri_settings` (settings migration
 * 0001); with the family enabled and the migration absent every request answers 503 SETTINGS_STORE_UNAVAILABLE, so enable it only
 * after the migration is applied (as for user preferences). */
import {randomUUID} from 'node:crypto';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createProductApplication} from '../../control/product-access/http.mjs';
import {createPostgresSettingsStore} from '../../control/settings/postgres-store.mjs';
import {createSettingsService} from '../../control/settings/service.mjs';
import {createSettingsRoutes} from '../../control/settings/routes.mjs';
import {TENANT_SETTINGS_PATHS,TENANT_SETTINGS_LIMITS as L} from '../../control/settings/tenant-application/protocol.mjs';
import {compileCapabilityPlatform,createStaticPlatformLimits} from './capability-policy.mjs';
const fault=code=>Object.assign(new Error(code),{code});
/** Control-only opt-in `{enabled:boolean}`; absent is off. It selects no owner, credential or store. Also the config.mjs validator. */
export function compileTenantSettingsConfiguration(configuration){
 if(configuration?.tenantSettings===undefined)return false;
 let c;try{c=own(configuration.tenantSettings,['enabled']);}catch{throw fault('TENANT_SETTINGS_CONFIGURATION');}
 if(typeof c.enabled!=='boolean')throw fault('TENANT_SETTINGS_CONFIGURATION');return c.enabled;
}
/** `[name, factory]` family factory. `newId` is a test seam only; production uses randomUUID. */
export function createSettingsFamily(context,{newId=randomUUID}={}){
 const {configuration,pool,now=Date.now,canonicalProductPorts}=context??{};
 if(!compileTenantSettingsConfiguration(configuration))return {ports:{}};
 // The platform record is validated before the membership check, so a bad block fails startup even while Core is absent.
 const platform=compileCapabilityPlatform(configuration),gate=canonicalProductPorts?.conversationMembership;
 if(gate===undefined)return {ports:{}};
 const service=createSettingsService({store:createPostgresSettingsStore({pool}),readPlatformLimits:createStaticPlatformLimits(platform),newId});
 const canonical=createSettingsRoutes({service}),routes=Object.fromEntries(Object.values(TENANT_SETTINGS_PATHS).map(path=>[path,canonical[path]]));
 const application=createProductApplication({gate,routes,now,limits:{
  maxRequestMs:Math.min(configuration.limits.requestMs,L.maxRequestMs),
  maxRequestBytes:Math.min(configuration.limits.requestBytes,L.maxRequestBytes),
  maxResponseBytes:Math.min(configuration.native.maxResponseBytes,L.maxResponseBytes)}});
 return {ports:{settingsApplication:Object.freeze({handle:request=>application.handle(request)})}};
}
