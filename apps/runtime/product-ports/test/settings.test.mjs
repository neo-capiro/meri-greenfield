/** SYNTHETIC: the tenant-settings family over the real settings service, routes, product transport, PostgreSQL store statements
 * (scripted pool) and capability resolver, with a fake Core membership gate. Not PostgreSQL, Core or a live platform record. */
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createProductPortsFactory} from '../index.mjs';
import {createSettingsFamily,compileTenantSettingsConfiguration} from '../settings.mjs';
import {PROPOSED_PREVIEW_CAPABILITY_PLATFORM,createRunCapabilityPolicy,compileCapabilityPlatform} from '../capability-policy.mjs';
import {captureRuntimePorts} from '../../product-applications.mjs';
import {productReadiness} from '../../product-readiness.mjs';
import {TENANT_SETTINGS_PERMISSION} from '../../../control/settings/service.mjs';
import {createSettingsPoolFixture} from '../../../control/settings/test/postgres-store-fixture.mjs';
const code=c=>e=>e?.code===c;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const base={limits:{startupMs:1000,shutdownMs:1000,requestMs:25000,requestBytes:131072},native:{maxResponseBytes:2097152}};
const principal=(over={})=>Object.freeze({tenantId:'tenant-one',actorId:'actor-1',role:'standard_user',permissions:[],clientIds:[id(901)],membershipRevision:'m1',...over});
function membership(current){
 const calls=[];
 return {calls,gate:Object.freeze({
  async admit({credential}){calls.push(['admit',credential]);return {principal:current(),expiresAtMs:Date.now()+60000};},
  async recheck({principal:p,credential}){calls.push(['recheck',credential]);return p;}})};
}
const post=(path,body={})=>new Request('https://control.example'+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer native-session'},body:JSON.stringify(body)});
const tenantRead=/^SELECT revision,document,document_sha256 FROM meri_settings\.tenant_settings WHERE tenant_id=\$1$/u;
function compose({configuration,pool,gate}){
 return createProductPortsFactory({families:[['settings',createSettingsFamily]]})(Object.freeze({configuration,pool,client:{},native:{},now:Date.now,
  canonicalProductPorts:gate?{conversationMembership:gate}:{}}));
}

test('absent or disabled tenant settings compose no port and never construct the store',()=>{
 const untouched=new Proxy({},{get(){throw Error('pool touched');}});
 assert.deepEqual(compose({configuration:base,pool:untouched}),{});
 assert.deepEqual(compose({configuration:{...base,tenantSettings:{enabled:false}},pool:untouched,gate:membership(principal).gate}),{});
 const readiness=productReadiness({ports:captureRuntimePorts({}),retention:null,sourceEnabled:false});
 assert.equal(readiness.owners.find(o=>o.name==='settings.tenant').state,'unavailable');
});

test('configuration is closed: malformed opt-in or platform record refuses even before the membership owner exists',()=>{
 assert.equal(compileTenantSettingsConfiguration({}),false);assert.equal(compileTenantSettingsConfiguration({tenantSettings:{enabled:true}}),true);
 for(const tenantSettings of [{},{enabled:'yes'},{enabled:true,extra:1},null])assert.throws(()=>compileTenantSettingsConfiguration({tenantSettings}),code('TENANT_SETTINGS_CONFIGURATION'));
 const wide={maximum:{},defaults:{bash:true},roleCeilings:{standard_user:{}}};
 assert.throws(()=>compose({configuration:{...base,tenantSettings:{enabled:true},capabilityPlatform:wide},pool:{connect(){}}}),code('CAPABILITY_PLATFORM_CONFIGURATION'));
 // Enabled without Core's membership owner: no port, so readiness names the gap instead of serving unauthenticated settings.
 assert.deepEqual(compose({configuration:{...base,tenantSettings:{enabled:true}},pool:{connect(){}}}),{});
});

test('enabled family serves the tenant routes over the membership gate with the static platform record and readiness names it composed',async()=>{
 const f=createSettingsPoolFixture([{steps:[{match:tenantRead,rows:[],inspect:params=>assert.deepEqual(params,['tenant-one'])}]},{steps:[{match:tenantRead,rows:[]}]}]);
 let who=principal();const m=membership(()=>who);
 const configuration={...base,tenantSettings:{enabled:true},capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM};
 const ports=compose({configuration,pool:f.pool,gate:m.gate});
 assert.deepEqual(Object.keys(ports),['settingsApplication']);
 const captured=captureRuntimePorts(ports);
 assert.equal(productReadiness({ports:captured,retention:null,sourceEnabled:false}).owners.find(o=>o.name==='settings.tenant').state,'composed');
 // A member sees only the default timezone and their effective capabilities: the same single profile the run producer pins (G3).
 const member=await (await captured.settingsApplication.handle(post('/api/settings/tenant/read'))).json();
 const producer=createRunCapabilityPolicy({platform:compileCapabilityPlatform(configuration)});
 assert.deepEqual(member,{revision:0,defaultTimezone:'UTC',capabilityStatus:'resolved',effectiveCapabilities:JSON.parse(JSON.stringify(producer.profile))});
 who=principal({actorId:'admin-1',role:'user_admin',permissions:[TENANT_SETTINGS_PERMISSION]});
 const admin=await (await captured.settingsApplication.handle(post('/api/settings/tenant/read'))).json();
 assert.deepEqual(admin.capabilityPolicy,{});assert.deepEqual(admin.platform,JSON.parse(JSON.stringify(compileCapabilityPlatform(configuration))));
 assert.deepEqual(m.calls.map(c=>c[0]),['admit','recheck','admit','recheck']);assert.ok(m.calls.every(c=>c[1]==='native-session'));
 // User-preference paths stay with user-preferences.mjs; this mount answers only the three tenant paths.
 assert.equal((await captured.settingsApplication.handle(post('/api/settings/user/read'))).status,404);
});

test('admin saves narrow inside the platform maximum through the real store statements; widening refuses before any write',async()=>{
 const configuration={...base,tenantSettings:{enabled:true},capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM};
 const settings={defaultTimezone:'UTC',capabilityPolicy:{capabilities:{bash:false}}},sha=canonicalSha256(settings),platformSha=canonicalSha256(compileCapabilityPlatform(configuration));
 const f=createSettingsPoolFixture([{steps:[
  {match:/^INSERT INTO meri_settings\.tenant_settings\(/u,rows:[{revision:1,document:settings,document_sha256:sha}],inspect:params=>assert.deepEqual(params,['tenant-one',1,JSON.stringify(settings),sha,'admin-1'])},
  {match:/^INSERT INTO meri_settings\.settings_audit\(/u,inspect:params=>{assert.equal(params[1],'tenant-one');assert.equal(params[2],'tenant');assert.equal(params[9],platformSha);assert.deepEqual(params[10],['capabilityPolicy.capabilities']);}}]}]);
 let n=500;const admin=principal({actorId:'admin-1',role:'user_admin',permissions:[TENANT_SETTINGS_PERMISSION]});
 const {settingsApplication}=createSettingsFamily({configuration,pool:f.pool,now:Date.now,canonicalProductPorts:{conversationMembership:membership(()=>admin).gate}},{newId:()=>id(n++)}).ports;
 const saved=await settingsApplication.handle(post('/api/settings/tenant/save',{expectedRevision:0,settings}));
 assert.equal(saved.status,200);const body=await saved.json();
 assert.equal(body.revision,1);assert.equal(body.effectiveCapabilities.bash,false);assert.equal(body.effectiveCapabilities.generalReads,true);
 assert.equal(f.committed.length,2);
 // Under the default platform record (no capabilities) any enablement widens the maximum and is refused with the canonical code.
 const none=createSettingsFamily({configuration:{...base,tenantSettings:{enabled:true}},pool:createSettingsPoolFixture([]).pool,canonicalProductPorts:{conversationMembership:membership(()=>admin).gate}}).ports;
 const refused=await none.settingsApplication.handle(post('/api/settings/tenant/save',{expectedRevision:0,settings:{defaultTimezone:'UTC',capabilityPolicy:{capabilities:{workspaceTools:true}}}}));
 assert.equal(refused.status,422);assert.equal((await refused.json()).error.code,'CAPABILITY_TENANT_WIDENING_REFUSED');
 // A member without the tenant permission cannot write.
 const denied=await createSettingsFamily({configuration,pool:createSettingsPoolFixture([]).pool,canonicalProductPorts:{conversationMembership:membership(principal).gate}}).ports.settingsApplication.handle(post('/api/settings/tenant/save',{expectedRevision:0,settings}));
 assert.equal(denied.status,403);assert.equal((await denied.json()).error.code,'SETTINGS_ADMIN_REQUIRED');
});

test('lane B families compose together beside the canonical candidate ports and readiness names each state',async()=>{
 const {createRoutinesFamily}=await import('../routines.mjs'),{createMemoryFamily}=await import('../memory.mjs'),{composeRuntimePorts}=await import('../../product-applications.mjs');
 const gate=membership(principal).gate,configuration={...base,tenantSettings:{enabled:true},capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM};
 const factory=createProductPortsFactory({families:[['settings',createSettingsFamily],['routines',createRoutinesFamily],['memory',createMemoryFamily]]});
 const supplied=factory(Object.freeze({configuration,pool:createSettingsPoolFixture([]).pool,client:{},native:{},now:Date.now,canonicalProductPorts:{conversationMembership:gate}}));
 assert.deepEqual(Object.keys(supplied).sort(),['routinesApplicationFactory','settingsApplication']);
 const ports=composeRuntimePorts({conversationMembership:gate},supplied),census=productReadiness({ports,retention:null,sourceEnabled:false});
 const state=name=>census.owners.find(o=>o.name===name).state;
 assert.deepEqual([state('settings.tenant'),state('schedules.application'),state('schedules.inbox'),state('history.membership')],['composed','disabled','disabled','composed']);
});
