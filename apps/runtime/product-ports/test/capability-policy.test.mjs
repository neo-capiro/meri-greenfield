/** SYNTHETIC: the G2 run capability-policy producer over the canonical resolver and validator. No Core, store or SDK. */
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {describeSkillPlugin} from '../../../../packages/skills/plugin.mjs';
import {assertCapabilityPolicy,readCapabilityPolicy,SUBAGENT_TYPES,WORKSPACE_TOOLS,POLICY_FLAGS} from '../../../worker/conversation/capabilities/policy.mjs';
import {READ_FAMILY_IDS} from '../../../worker/conversation/reads/families.mjs';
import {CORE_ROLES,NO_CAPABILITY_PLATFORM,PLUGIN_SKILL_NAMES,PROPOSED_PREVIEW_CAPABILITY_PLATFORM,compileCapabilityPlatform,createStaticPlatformLimits,
 createRunCapabilityPolicy,createConfiguredRunCapabilityPolicy,tenantCapabilitySettingsReader} from '../capability-policy.mjs';
import {createSettingsStoreDouble} from '../../../control/settings/test/fixtures.mjs';
const code=c=>e=>e?.code===c;
const run=(over={})=>({tenantId:'tenant-one',actorId:'actor-1',conversationId:'00000000-0000-4000-8000-000000000001',...over});

test('default configuration enables nothing: no platform block resolves to no capability record for any run',async()=>{
 const producer=createConfiguredRunCapabilityPolicy({});
 assert.equal(producer.profile,null);assert.equal(producer.profileSha256,null);assert.equal(await producer.forRun(run()),null);
 assert.deepEqual(Object.keys(compileCapabilityPlatform({}).roleCeilings),CORE_ROLES);
 assert.equal(readCapabilityPolicy({run:{}}),undefined,'an omitted record keeps first-chat behaviour in the worker');
 // An explicit all-off platform is equally "no capabilities", never an all-off record that would change the projected options.
 assert.equal(await createRunCapabilityPolicy({platform:NO_CAPABILITY_PLATFORM}).forRun(run()),null);
});

test('the proposed preview record is one deterministic profile for every tenant and member, accepted by the worker reader',async()=>{
 const producer=createConfiguredRunCapabilityPolicy({capabilityPlatform:structuredClone(PROPOSED_PREVIEW_CAPABILITY_PLATFORM)}),p=producer.profile;
 for(const flag of POLICY_FLAGS)assert.equal(p[flag],true,flag);
 assert.deepEqual(p.readFamilies,READ_FAMILY_IDS);assert.deepEqual(p.workspaceToolNames,WORKSPACE_TOOLS);assert.deepEqual(p.subagentTypes,SUBAGENT_TYPES);
 assert.equal(p.maxParallelSubagents,4);assert.deepEqual(p.sandboxNetworkDomains,[]);assert.deepEqual(p.skillNames,PLUGIN_SKILL_NAMES);
 assert.deepEqual(PLUGIN_SKILL_NAMES,describeSkillPlugin().skills.map(s=>s.name),'skill allowlist drifted from the SDK plugin');
 assert.equal(producer.profileSha256,canonicalSha256(p));assert.deepEqual(assertCapabilityPolicy(p),p);
 const a=await producer.forRun(run()),b=await producer.forRun(run({tenantId:'tenant-two',actorId:'actor-9',conversationId:'00000000-0000-4000-8000-000000000002'}));
 assert.equal(a,p);assert.equal(b,p);assert.ok(Object.isFrozen(p));
 // The composer attaches it beside `run` in loadForExecution; the worker's reader validates it unchanged.
 assert.deepEqual(readCapabilityPolicy({run:{},request:{},capabilities:JSON.parse(JSON.stringify(a))}),p);
 // Same configuration, same digest: the value the in-image measurement pins.
 assert.equal(createConfiguredRunCapabilityPolicy({capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM}).profileSha256,producer.profileSha256);
});

test('without a trusted per-run role every run is bounded by the narrowest role ceiling, so no member is widened',async()=>{
 const platform={maximum:{workspaceTools:true,bash:true,subagents:true,maxParallelSubagents:4},defaults:{workspaceTools:true,bash:true,subagents:true,maxParallelSubagents:4},
  roleCeilings:{capiro_admin:{workspaceTools:true,bash:true,subagents:true,maxParallelSubagents:4},standard_user:{workspaceTools:true,workspaceToolNames:['Read','Grep'],subagents:true,maxParallelSubagents:2}}};
 const p=await createRunCapabilityPolicy({platform}).forRun(run());
 assert.equal(p.bash,false);assert.deepEqual(p.workspaceToolNames,['Read','Grep']);assert.equal(p.maxParallelSubagents,2);assert.equal(p.subagents,true);
});

test('per-tenant or per-member readers need a profile→pin map; an unmeasured profile refuses instead of running',async()=>{
 const platform=PROPOSED_PREVIEW_CAPABILITY_PLATFORM,pin=createRunCapabilityPolicy({platform}).profileSha256;
 assert.throws(()=>createRunCapabilityPolicy({platform,readTenantSettings:async()=>({})}),code('CAPABILITY_PRODUCER_CONFIGURATION'));
 assert.throws(()=>createRunCapabilityPolicy({platform,readRole:async()=>'standard_user'}),code('CAPABILITY_PRODUCER_CONFIGURATION'));
 for(const pinnedProfiles of [[],['x'],[pin,pin]])assert.throws(()=>createRunCapabilityPolicy({platform,pinnedProfiles}),code('CAPABILITY_PRODUCER_CONFIGURATION'));
 assert.throws(()=>createRunCapabilityPolicy({platform,extra:true}),code('CAPABILITY_PRODUCER_CONFIGURATION'));
 const store=createSettingsStoreDouble(),seen=[];
 const producer=createRunCapabilityPolicy({platform,pinnedProfiles:[pin],readTenantSettings:tenantCapabilitySettingsReader(store),
  readRole:async input=>{seen.push(input);return 'standard_user';}});
 assert.equal(producer.profile,null);assert.equal(producer.profileSha256,null);
 assert.equal(canonicalSha256(await producer.forRun(run())),pin,'an unrestricted tenant resolves to the pinned profile');
 assert.deepEqual(seen.map(({tenantId,actorId})=>({tenantId,actorId})),[{tenantId:'tenant-one',actorId:'actor-1'}]);
 await store.save({kind:'tenant',tenantId:'tenant-one',expectedRevision:0,document:{defaultTimezone:'UTC',capabilityPolicy:{capabilities:{bash:false}}},audit:{auditId:'a',actorId:'admin',platformSha256:null}});
 await assert.rejects(producer.forRun(run()),code('CAPABILITY_PROFILE_UNPINNED'));
 // A tenant that turns everything off resolves to "no capabilities", which the pin never needs to cover.
 const off=Object.fromEntries(POLICY_FLAGS.map(flag=>[flag,false]));
 const quiet=createRunCapabilityPolicy({platform,pinnedProfiles:[pin],readTenantSettings:async()=>({capabilities:off})});
 assert.equal(await quiet.forRun(run()),null);
 await assert.rejects(createRunCapabilityPolicy({platform,pinnedProfiles:[pin],readRole:async()=>'guest'}).forRun(run()),code('CAPABILITY_ROLE_UNKNOWN'));
 await assert.rejects(createRunCapabilityPolicy({platform,pinnedProfiles:[pin],readRole:async()=>null}).forRun(run()),code('CAPABILITY_ROLE_UNKNOWN'));
});

test('run requests are closed and cancellable; the platform record is validated configuration',async()=>{
 const producer=createRunCapabilityPolicy({platform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM});
 for(const bad of [run({conversationId:'not-a-uuid'}),run({tenantId:''}),run({actorId:'x'.repeat(129)})])await assert.rejects(producer.forRun(bad),code('CAPABILITY_POLICY_REQUEST'));
 await assert.rejects(producer.forRun({...run(),runId:'extra'}));
 await assert.rejects(producer.forRun({...run(),signal:AbortSignal.abort()}),e=>e?.name==='AbortError');
 for(const capabilityPlatform of [{maximum:{},defaults:{bash:true},roleCeilings:{standard_user:{}}},{maximum:{},defaults:{},roleCeilings:{}},{maximum:{},defaults:{},roleCeilings:{a:{}},extra:1}])
  assert.throws(()=>compileCapabilityPlatform({capabilityPlatform}),code('CAPABILITY_PLATFORM_CONFIGURATION'));
 const read=createStaticPlatformLimits(compileCapabilityPlatform({capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM}));
 assert.equal(await read({}),await read());await assert.rejects(read({signal:AbortSignal.abort()}),e=>e?.name==='AbortError');
 assert.throws(()=>tenantCapabilitySettingsReader({}),code('CAPABILITY_PRODUCER_CONFIGURATION'));
});
