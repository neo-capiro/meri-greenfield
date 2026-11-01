/** Synthetic canonical settings/resolver tests; no live Core, PostgreSQL or SDK. */
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {describeSkillPlugin} from '../../../../packages/skills/plugin.mjs';
import {assertCapabilityPolicy,readCapabilityPolicy,POLICY_FLAGS} from '../../../worker/conversation/capabilities/policy.mjs';
import {CORE_ROLES,NO_CAPABILITY_PLATFORM,PLUGIN_SKILL_NAMES,PROPOSED_PREVIEW_CAPABILITY_PLATFORM as PLATFORM,compileCapabilityPlatform,createStaticPlatformLimits,
 createRunCapabilityPolicy,createConfiguredRunCapabilityPolicy,tenantCapabilitySettingsReader,projectCapabilityRole} from '../capability-policy.mjs';
import {createSettingsPoolFixture} from '../../../control/settings/test/postgres-store-fixture.mjs';
const code=c=>e=>e?.code===c;
const run=(over={})=>({tenantId:'tenant-one',actorId:'actor-1',conversationId:'00000000-0000-4000-8000-000000000001',actorRole:'standard_user',...over});
const producer=(platform=PLATFORM,readTenantSettings=async()=>({}))=>createRunCapabilityPolicy({platform,readTenantSettings});
const select=/^SELECT \* FROM meri_settings\.tenant_settings WHERE tenant_id=\$1$/u;

test('canonical absent row inherits defaults; stored narrowing is read anew and does not need a profile pin',async()=>{
 const document={defaultTimezone:'UTC',capabilityPolicy:{capabilities:{generalReads:false}}};
 const f=createSettingsPoolFixture([{steps:[{match:select,rows:[],inspect:params=>assert.deepEqual(params,['tenant-one'])}]},
  {steps:[{match:select,rows:[{revision:1,document,document_sha256:hash(document)}]}]}]);
 const p=createConfiguredRunCapabilityPolicy({capabilityPlatform:PLATFORM},{pool:f.pool});
 assert.equal((await p.forRun(run())).generalReads,true);assert.equal((await p.forRun(run())).generalReads,false);
 assert.equal(f.connections(),2);assert.deepEqual(Object.keys(p),['forRun','forActor']);
});

test('forActor is the same platform ∧ tenant ∧ role resolution without a run binding; it refuses unknown roles and malformed input',async()=>{
 const document={defaultTimezone:'UTC',capabilityPolicy:{capabilities:{generalReads:false}}};
 const f=createSettingsPoolFixture([{steps:[{match:select,rows:[],inspect:params=>assert.deepEqual(params,['tenant-one'])}]},{steps:[{match:select,rows:[{revision:1,document,document_sha256:hash(document)}]}]}]);
 const p=createConfiguredRunCapabilityPolicy({capabilityPlatform:PLATFORM},{pool:f.pool});
 const absent=await p.forActor({tenantId:'tenant-one',actorRole:'standard_user'});assert.equal(absent.generalReads,true);
 assert.equal((await p.forActor({tenantId:'tenant-one',actorRole:'standard_user'})).generalReads,false,'a saved narrowing is read anew');
 assert.equal(f.connections(),2);
 await assert.rejects(p.forActor({tenantId:'tenant-one',actorRole:'owner'}),e=>e.code==='CAPABILITY_ROLE_UNKNOWN');
 await assert.rejects(p.forActor({tenantId:'',actorRole:'standard_user'}),e=>e.code==='CAPABILITY_POLICY_REQUEST');
 await assert.rejects(p.forActor({tenantId:'tenant-one',actorRole:'standard_user',conversationId:'x'}),e=>e.message==='INVALID_COMMAND','a run binding field is not part of the actor resolution');
 assert.equal(await producer(NO_CAPABILITY_PLATFORM).forActor({tenantId:'tenant-one',actorRole:'standard_user'}),null);
});

test('default platform enables nothing and full preview preserves every SDK capability and original skill',async()=>{
 assert.equal(await producer(NO_CAPABILITY_PLATFORM).forRun(run()),null);
 assert.deepEqual(Object.keys(compileCapabilityPlatform({}).roleCeilings),CORE_ROLES);
 const p=await producer().forRun(run());for(const flag of POLICY_FLAGS)assert.equal(p[flag],true,flag);
 assert.deepEqual(PLUGIN_SKILL_NAMES,describeSkillPlugin().skills.map(s=>s.name));assert.deepEqual(p.skillNames,PLUGIN_SKILL_NAMES);
 assert.deepEqual(assertCapabilityPolicy(p),p);assert.deepEqual(readCapabilityPolicy({run:{},capabilities:p}),p);
});

test('the actual role selects its ceiling; tenant role narrowing cannot widen either role or platform',async()=>{
 const platform=structuredClone(PLATFORM);platform.roleCeilings.standard_user={...platform.roleCeilings.standard_user,bash:false};
 let tenant={};const p=producer(platform,async()=>tenant);
 assert.equal((await p.forRun(run({actorRole:'user_admin'}))).bash,true,'admin is not intersected with the standard ceiling');
 assert.equal((await p.forRun(run())).bash,false);
 tenant={roles:{user_admin:{generalReads:false}}};assert.equal((await p.forRun(run({actorRole:'user_admin'}))).generalReads,false);
 assert.equal((await p.forRun(run())).generalReads,true);
 tenant={roles:{standard_user:{bash:true}}};await assert.rejects(p.forRun(run()),code('CAPABILITY_ROLE_WIDENING_REFUSED'));
 tenant={capabilities:{maxParallelSubagents:5}};await assert.rejects(p.forRun(run()));
 const off=Object.fromEntries(POLICY_FLAGS.map(flag=>[flag,false]));assert.equal(await producer(PLATFORM,async()=>({capabilities:off})).forRun(run()),null);
});

test('missing, failed or malformed settings/role refuse instead of falling back to platform defaults',async()=>{
 for(const actorRole of [undefined,null,'guest'])await assert.rejects(producer().forRun(run({actorRole})),code('CAPABILITY_ROLE_UNKNOWN'));
 for(const value of [undefined,null])await assert.rejects(producer(PLATFORM,async()=>value).forRun(run()),code('CAPABILITY_TENANT_SETTINGS_REFUSED'));
 const error=Error('settings unavailable');await assert.rejects(producer(PLATFORM,async()=>{throw error;}).forRun(run()),e=>e===error);
 for(const saved of [undefined,{}, {document:{}},{document:{capabilityPolicy:null}}])await assert.rejects(tenantCapabilitySettingsReader({read:async()=>saved})({tenantId:'tenant-one'}),code('CAPABILITY_TENANT_SETTINGS_REFUSED'));
 const document={defaultTimezone:'UTC',capabilityPolicy:{}};
 const f=createSettingsPoolFixture([{steps:[{match:select,rows:[{revision:1,document,document_sha256:'f'.repeat(64)}]}]}]);
 await assert.rejects(createConfiguredRunCapabilityPolicy({capabilityPlatform:PLATFORM},{pool:f.pool}).forRun(run()));
});

test('role projection retains original timestamps and refuses unknown, stale, expired observations',()=>{
 const receipt={role:'user_admin',checkedAtMs:100,expiresAtMs:150};
 assert.deepEqual(projectCapabilityRole(receipt,{started:100,now:110}),{actorRole:'user_admin',checkedAtMs:100,expiresAtMs:150});
 for(const value of [{...receipt,role:undefined},{...receipt,checkedAtMs:99},{...receipt,checkedAtMs:111},{...receipt,expiresAtMs:110}])assert.throws(()=>projectCapabilityRole(value,{started:100,now:110}));
});

test('requests/configuration stay closed and cancellable; obsolete policy pin options are rejected',async()=>{
 const p=producer();for(const bad of [run({conversationId:'not-a-uuid'}),run({tenantId:''}),run({actorId:'x'.repeat(129)})])await assert.rejects(p.forRun(bad),code('CAPABILITY_POLICY_REQUEST'));
 await assert.rejects(p.forRun({...run(),runId:'extra'}));await assert.rejects(p.forRun({...run(),signal:AbortSignal.abort()}),e=>e?.name==='AbortError');
 assert.throws(()=>createRunCapabilityPolicy({platform:PLATFORM}),code('CAPABILITY_PRODUCER_CONFIGURATION'));
 assert.throws(()=>createRunCapabilityPolicy({platform:PLATFORM,readTenantSettings:async()=>({}),pinnedProfiles:['a'.repeat(64)]}),code('CAPABILITY_PRODUCER_CONFIGURATION'));
 for(const capabilityPlatform of [{maximum:{},defaults:{bash:true},roleCeilings:{standard_user:{}}},{maximum:{},defaults:{},roleCeilings:{}}])assert.throws(()=>compileCapabilityPlatform({capabilityPlatform}),code('CAPABILITY_PLATFORM_CONFIGURATION'));
 const read=createStaticPlatformLimits(PLATFORM);assert.equal(await read(),await read());await assert.rejects(read({signal:AbortSignal.abort()}));
});