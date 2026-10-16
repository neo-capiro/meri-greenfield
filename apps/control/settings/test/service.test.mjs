/** SYNTHETIC: settings service over the real document validators and canonical capability-policy resolver, with an in-memory store
 * double and a synthetic platform record. Not PostgreSQL, Core membership or live platform-record qualification. */
import test from 'node:test';import assert from 'node:assert/strict';
import {productFailure} from '../../product-access/errors.mjs';
import {createSettingsService,changedFields,TENANT_SETTINGS_PERMISSION} from '../service.mjs';
import {USER_PREFERENCE_DEFAULTS} from '../documents.mjs';
import {PLATFORM,createSettingsStoreDouble} from './fixtures.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const member=(over={})=>Object.freeze({tenantId:'tenant-one',actorId:'actor-1',role:'member',permissions:[],clientIds:[id(901)],membershipRevision:'m1',...over});
const admin=over=>member({actorId:'admin-1',permissions:[TENANT_SETTINGS_PERMISSION],...over});
function setup(platform=PLATFORM){let n=100;const store=createSettingsStoreDouble();const box={platform};
 return {store,box,service:createSettingsService({store,readPlatformLimits:async()=>structuredClone(box.platform),newId:()=>id(n++)})};}
const failed=async(promise,code,field)=>assert.rejects(promise,e=>{const f=productFailure(e);return f?.code===code&&(field===undefined||f.field===field);});
const prefs=over=>({...structuredClone(USER_PREFERENCE_DEFAULTS),notifications:{...USER_PREFERENCE_DEFAULTS.notifications},...over});

test('user preferences: defaults, strict validation with field names, revisioned saves and audit',async()=>{
 const t=setup(),p=member();
 assert.deepEqual(await t.service.readUser({principal:p}),{revision:0,preferences:USER_PREFERENCE_DEFAULTS});
 const saved=await t.service.saveUser({principal:p,body:{expectedRevision:0,preferences:prefs({theme:'dark',timezone:'America/New_York',defaultClientId:id(901).toUpperCase()})}});
 assert.equal(saved.revision,1);assert.equal(saved.preferences.defaultClientId,id(901));
 assert.equal((await t.service.readUser({principal:p})).preferences.timezone,'America/New_York');
 await failed(t.service.saveUser({principal:p,body:{expectedRevision:0,preferences:prefs({theme:'light'})}}),'SETTINGS_REVISION_CONFLICT');
 await failed(t.service.saveUser({principal:p,body:{expectedRevision:1,preferences:prefs({theme:'neon'})}}),'SETTINGS_FIELD_INVALID','theme');
 await failed(t.service.saveUser({principal:p,body:{expectedRevision:1,preferences:prefs({timezone:'Mars/Olympus'})}}),'SETTINGS_FIELD_INVALID','timezone');
 await failed(t.service.saveUser({principal:p,body:{expectedRevision:1,preferences:{...prefs(),notifications:{runCompleted:'yes',approvalRequested:true,memoryReviewed:true}}}}),'SETTINGS_FIELD_INVALID','notifications.runCompleted');
 await failed(t.service.saveUser({principal:p,body:{expectedRevision:1,preferences:{...prefs(),extra:1}}}),'SETTINGS_DOCUMENT_INVALID');
 await failed(t.service.saveUser({principal:p,body:{expectedRevision:1,preferences:prefs({defaultClientId:id(902)})}}),'SETTINGS_CLIENT_REFUSED');
 await failed(t.service.saveUser({principal:p,body:{expectedRevision:'1',preferences:prefs()}}),'SETTINGS_REQUEST_INVALID','expectedRevision');
 assert.equal(t.store.audit.length,1);
 assert.deepEqual(t.store.audit[0].changedFields,['defaultClientId','theme','timezone']);assert.equal(t.store.audit[0].actorId,'actor-1');
});

test('a stored default client is withheld once the member no longer holds that client',async()=>{
 const t=setup();await t.service.saveUser({principal:member(),body:{expectedRevision:0,preferences:prefs({defaultClientId:id(901)})}});
 assert.equal((await t.service.readUser({principal:member({clientIds:[],membershipRevision:'m2'})})).preferences.defaultClientId,null);
});

test('tenant settings: admin-only writes inside the platform maximum; widening refuses with the canonical codes and writes nothing',async()=>{
 const t=setup();
 const ok={defaultTimezone:'America/Chicago',capabilityPolicy:{capabilities:{workspaceTools:true},roles:{member:{maxParallelSubagents:1}}}};
 await failed(t.service.saveTenant({principal:member(),body:{expectedRevision:0,settings:ok}}),'SETTINGS_ADMIN_REQUIRED');
 const saved=await t.service.saveTenant({principal:admin(),body:{expectedRevision:0,settings:ok}});
 assert.equal(saved.revision,1);assert.equal(saved.capabilityStatus,'resolved');
 const widen=async(capabilityPolicy,code,field)=>failed(t.service.saveTenant({principal:admin(),body:{expectedRevision:1,settings:{defaultTimezone:'UTC',capabilityPolicy}}}),code,field);
 await widen({capabilities:{bash:true}},'CAPABILITY_TENANT_WIDENING_REFUSED','capabilityPolicy.bash');
 await widen({capabilities:{maxParallelSubagents:4}},'CAPABILITY_TENANT_WIDENING_REFUSED','capabilityPolicy.maxParallelSubagents');
 await widen({roles:{analyst:{workspaceTools:true}}},'CAPABILITY_ROLE_WIDENING_REFUSED','capabilityPolicy.workspaceTools');
 await widen({roles:{owner:{}}},'CAPABILITY_ROLE_UNKNOWN','capabilityPolicy.owner');
 await widen({capabilities:{notAField:true}},'CAPABILITY_TENANT_SETTINGS_REFUSED','capabilityPolicy');
 await failed(t.service.saveTenant({principal:admin(),body:{expectedRevision:1,settings:{...ok,extra:true}}}),'SETTINGS_DOCUMENT_INVALID');
 await failed(t.service.saveTenant({principal:admin(),body:{expectedRevision:0,settings:ok}}),'SETTINGS_REVISION_CONFLICT');
 assert.equal(t.store.audit.length,1);assert.equal(t.store.docs.get('tenant/tenant-one').revision,1);
 assert.match(t.store.audit[0].platformSha256,/^[a-f0-9]{64}$/u);assert.deepEqual(t.store.audit[0].changedFields,['capabilityPolicy.capabilities','capabilityPolicy.roles','defaultTimezone']);
});

test('tenant read respects the reader role: effective capabilities per role, record and platform limits only for admins',async()=>{
 const t=setup();
 await t.service.saveTenant({principal:admin(),body:{expectedRevision:0,settings:{defaultTimezone:'UTC',capabilityPolicy:{capabilities:{workspaceTools:true,generalReads:true}}}}});
 const asMember=await t.service.readTenant({principal:member()}),asAnalyst=await t.service.readTenant({principal:member({role:'analyst'})});
 assert.equal(asMember.effectiveCapabilities.workspaceTools,true);assert.equal(asAnalyst.effectiveCapabilities.workspaceTools,false);
 assert.equal(asAnalyst.effectiveCapabilities.generalReads,true);assert.deepEqual(asAnalyst.effectiveCapabilities.readFamilies,['mail']);
 assert.equal(Object.hasOwn(asMember,'capabilityPolicy'),false);assert.equal(Object.hasOwn(asMember,'platform'),false);
 const asAdmin=await t.service.readTenant({principal:admin()});assert.deepEqual(asAdmin.capabilityPolicy,{capabilities:{workspaceTools:true,generalReads:true}});assert.equal(asAdmin.platform.maximum.bash,false);
 const unknownRole=await t.service.readTenant({principal:member({role:'guest'})});assert.equal(unknownRole.effectiveCapabilities,null);assert.equal(unknownRole.capabilityStatus,'CAPABILITY_ROLE_UNKNOWN');
 // A later platform narrowing makes the stored tenant record unresolvable rather than silently clipped.
 t.box.platform={...PLATFORM,maximum:{...PLATFORM.maximum,workspaceTools:false},roleCeilings:{member:{generalReads:true},analyst:{generalReads:true}}};
 const narrowed=await t.service.readTenant({principal:member()});assert.equal(narrowed.effectiveCapabilities,null);assert.equal(narrowed.capabilityStatus,'CAPABILITY_TENANT_WIDENING_REFUSED');
});

test('audit is admin-only, tenant-isolated and paged; an unavailable platform record refuses tenant saves',async()=>{
 const t=setup();
 for(let r=0;r<3;r++)await t.service.saveTenant({principal:admin(),body:{expectedRevision:r,settings:{defaultTimezone:r%2?'UTC':'Europe/London',capabilityPolicy:{}}}});
 await t.service.saveTenant({principal:admin({tenantId:'tenant-two'}),body:{expectedRevision:0,settings:{defaultTimezone:'UTC',capabilityPolicy:{}}}});
 await failed(t.service.readAudit({principal:member(),body:{}}),'SETTINGS_ADMIN_REQUIRED');
 const first=await t.service.readAudit({principal:admin(),body:{limit:2}});
 assert.deepEqual(first.entries.map(e=>e.toRevision),[3,2]);assert.equal(first.nextBeforeSequence,first.entries[1].sequence);
 const rest=await t.service.readAudit({principal:admin(),body:{limit:2,beforeSequence:first.nextBeforeSequence}});
 assert.deepEqual(rest.entries.map(e=>e.toRevision),[1]);assert.equal(rest.nextBeforeSequence,null);
 assert.deepEqual((await t.service.readAudit({principal:admin({tenantId:'tenant-two'}),body:{}})).entries.map(e=>e.toRevision),[1]);
 const broken=createSettingsService({store:t.store,readPlatformLimits:async()=>{throw Error('down');},newId:()=>id(1)});
 await failed(broken.saveTenant({principal:admin(),body:{expectedRevision:3,settings:{defaultTimezone:'UTC',capabilityPolicy:{}}}}),'SETTINGS_PLATFORM_UNAVAILABLE');
});

test('changedFields names paths only',()=>{
 assert.deepEqual(changedFields({a:1,n:{x:1,y:2}},{a:1,n:{x:1,y:3},b:true}),['b','n.y']);
});
