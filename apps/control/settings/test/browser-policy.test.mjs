import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createSettingsService,TENANT_SETTINGS_PERMISSION} from '../service.mjs';
import {productFailure} from '../../product-access/errors.mjs';
import {PLATFORM,createSettingsStoreDouble} from './fixtures.mjs';
import {DEFAULT_BROWSER_POLICY} from '../../../worker/conversation/browser/policy.mjs';
const policy={...DEFAULT_BROWSER_POLICY,allowedOrigins:['https://records.example','https://notices.example']};
const browserPlatform={maximum:policy,defaults:policy,roleCeilings:{member:policy,analyst:{...policy,allowedOrigins:['https://records.example']}}};
const admin={tenantId:'settings-browser',actorId:'admin',role:'member',permissions:[TENANT_SETTINGS_PERMISSION],clientIds:[]};
const base={defaultTimezone:'UTC',capabilityPolicy:{}};
function fixture(){const store=createSettingsStoreDouble();return {store,service:createSettingsService({store,newId:randomUUID,readPlatformLimits:async()=>PLATFORM,readBrowserPlatformLimits:async()=>browserPlatform})};}
const rejected=(promise,code)=>assert.rejects(promise,e=>productFailure(e)?.code===code);
test('browser admin writes share existing revision/audit and old-client omission preserves restrictions',async()=>{
 const {store,service}=fixture(),save=(expectedRevision,settings)=>service.saveTenant({principal:admin,body:{expectedRevision,settings}});
 const browserPolicy={browser:{allowedOrigins:['https://records.example']}};
 await save(0,{...base,browserPolicy});await save(1,{...base,defaultTimezone:'America/Chicago'});
 const result=await service.readTenant({principal:admin});assert.deepEqual(result.browserPolicy,browserPolicy);assert.equal(result.revision,2);
 assert.deepEqual(store.audit[1].changedFields,['defaultTimezone']);
 const member=await service.readTenant({principal:{...admin,permissions:[]}});assert.equal(Object.hasOwn(member,'browserPlatform'),false);assert.equal(Object.hasOwn(member,'browserPolicy'),false);assert.deepEqual(member.effectiveBrowserPolicy.allowedOrigins,['https://records.example']);
 await rejected(save(1,base),'SETTINGS_REVISION_CONFLICT');assert.equal(store.audit.length,2);
 await save(2,{...base,browserPolicy:{}});assert.equal((await service.readTenant({principal:admin})).effectiveBrowserPolicy.allowedOrigins.length,2);
});
test('role widening and nonadmin writes fail without changing saved settings',async()=>{
 const {store,service}=fixture(),save=browserPolicy=>service.saveTenant({principal:admin,body:{expectedRevision:0,settings:{...base,browserPolicy}}});
 await rejected(save({browser:{allowedOrigins:['https://outside.example']}}),'BROWSER_TENANT_WIDENING_REFUSED');
 await rejected(save({roles:{analyst:{allowedOrigins:['https://notices.example']}}}),'BROWSER_ROLE_WIDENING_REFUSED');
 await rejected(save(null),'BROWSER_TENANT_SETTINGS_REFUSED');
 await rejected(service.saveTenant({principal:{...admin,permissions:[]},body:{expectedRevision:0,settings:{...base,browserPolicy:{}}}}),'SETTINGS_ADMIN_REQUIRED');
 assert.equal(store.audit.length,0);
});
