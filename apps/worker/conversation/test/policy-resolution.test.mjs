/** Effective capability policy = platform maximum ∧ tenant settings ∧ role ceiling (∧ tenant role narrowing). Pure; no SDK, I/O or clock. */
import test from 'node:test';import assert from 'node:assert/strict';
import {assertCapabilityPolicy,SUBAGENT_TYPES,WORKSPACE_TOOLS,POLICY_KEYS} from '../capabilities/policy.mjs';
import {resolveCapabilityPolicy,intersectCapabilityPolicies,assertPlatformCapabilityLimits,assertTenantCapabilitySettings,wideningField} from '../capabilities/policy-resolution.mjs';
const P=assertCapabilityPolicy;
const maximum={subagents:true,auditHooks:true,compactionHooks:true,skillPlugin:true,workspaceTools:true,subagentProgress:true,subagentTypes:['research','analysis','verification'],maxParallelSubagents:3,bash:true,workspaceToolNames:['Read','Write','Edit','Glob','Grep'],skillNames:['meri-meeting-prep','meri-research-company','meri-bill-analysis'],sandboxNetworkDomains:['*.github.com','pypi.org']};
const defaults={auditHooks:true,workspaceTools:true,workspaceToolNames:['Read','Glob','Grep'],subagentTypes:['research'],skillNames:['meri-meeting-prep'],maxParallelSubagents:1};
const roleCeilings={admin:maximum,analyst:{...maximum,bash:false,maxParallelSubagents:2,sandboxNetworkDomains:['api.github.com']},viewer:{auditHooks:true,workspaceTools:true,workspaceToolNames:['Read'],subagentTypes:[],skillNames:[]}};
const platform={maximum,defaults,roleCeilings};
const codeOf=(fn)=>{try{fn();}catch(e){return [e.code,e.field];}return null;};
const resolve=(tenant,role='admin')=>resolveCapabilityPolicy({platform,tenant,role});

test('no tenant record: platform defaults bounded by the role ceiling',()=>{
 assert.deepEqual(resolve(undefined),P(defaults),'admin ceiling is the maximum, so defaults pass through unchanged');
 assert.deepEqual(resolve({}),P(defaults));
 const viewer=resolve({},'viewer');assert.deepEqual(viewer.workspaceToolNames,['Read']);assert.equal(viewer.subagents,false);assert.deepEqual(viewer.skillNames,[]);assert.equal(viewer.skillPlugin,false);
 assert.doesNotThrow(()=>P(viewer),'every result passes assertCapabilityPolicy');
});

test('tenant admins enable and restrict inside the platform maximum',()=>{
 const enabled=resolve({capabilities:{subagents:true,subagentProgress:true,subagentTypes:['research','verification'],maxParallelSubagents:3,workspaceToolNames:['Read','Write'],bash:true,sandboxNetworkDomains:['api.github.com','pypi.org']}});
 assert.equal(enabled.subagents,true);assert.equal(enabled.subagentProgress,true);assert.deepEqual(enabled.subagentTypes,['research','verification']);assert.equal(enabled.maxParallelSubagents,3);
 assert.deepEqual(enabled.workspaceToolNames,['Read','Write']);assert.equal(enabled.bash,true);assert.deepEqual(enabled.sandboxNetworkDomains,['api.github.com','pypi.org'],'a sub-domain of a platform wildcard is a narrowing');
 const restricted=resolve({capabilities:{auditHooks:false,workspaceTools:false}});assert.equal(restricted.auditHooks,false);assert.equal(restricted.workspaceTools,false);
});

test('a tenant setting that would widen the platform maximum is refused with a stable code naming the field, never clipped',()=>{
 for(const [capabilities,field] of [[{subagentTypes:['artifact_production']},'subagentTypes'],[{maxParallelSubagents:4},'maxParallelSubagents'],[{skillNames:null},'skillNames'],[{skillNames:['meri-meeting-prep','meri-other']},'skillNames'],[{sandboxNetworkDomains:['github.com']},'sandboxNetworkDomains'],[{sandboxNetworkDomains:['*.pypi.org']},'sandboxNetworkDomains'],[{sandboxNetworkDomains:['example.com']},'sandboxNetworkDomains']])
  assert.deepEqual(codeOf(()=>resolve({capabilities})),['CAPABILITY_TENANT_WIDENING_REFUSED',field],JSON.stringify(capabilities));
 const narrow={...platform,maximum:{...maximum,compactionHooks:false},roleCeilings:{admin:{...maximum,compactionHooks:false}}};
 assert.deepEqual(codeOf(()=>resolveCapabilityPolicy({platform:narrow,tenant:{capabilities:{compactionHooks:true}},role:'admin'})),['CAPABILITY_TENANT_WIDENING_REFUSED','compactionHooks']);
 assert.deepEqual(codeOf(()=>assertTenantCapabilitySettings({capabilities:{workspaceToolNames:['Read','WebFetch']}},assertPlatformCapabilityLimits(platform))),['CAPABILITY_POLICY_REFUSED',undefined],'a value outside the catalog is invalid, not a widening');
 assert.throws(()=>resolve({capabilities:{unknownCapability:true}}),/INVALID_COMMAND/);assert.throws(()=>resolve({other:{}}),/INVALID_COMMAND/);
});

test('the user role ceiling narrows the effective policy and a tenant may only narrow it further',()=>{
 const tenant={capabilities:{workspaceToolNames:['Read','Write'],bash:true,sandboxNetworkDomains:['*.github.com'],maxParallelSubagents:3}};
 const analyst=resolve(tenant,'analyst');assert.deepEqual(analyst.workspaceToolNames,['Read','Write']);assert.equal(analyst.bash,false,'Bash is above the analyst ceiling');assert.deepEqual(analyst.sandboxNetworkDomains,['api.github.com']);assert.equal(analyst.maxParallelSubagents,2);
 const narrowed=resolve({...tenant,roles:{analyst:{workspaceToolNames:['Read'],auditHooks:false}}},'analyst');assert.deepEqual(narrowed.workspaceToolNames,['Read']);assert.equal(narrowed.auditHooks,false);
 assert.deepEqual(resolve({...tenant,roles:{analyst:{workspaceToolNames:['Read']}}},'admin').workspaceToolNames,['Read','Write'],'another role\'s narrowing does not apply');
 assert.deepEqual(codeOf(()=>resolve({roles:{analyst:{bash:true}}},'admin')),['CAPABILITY_ROLE_WIDENING_REFUSED','bash'],'the tenant record is refused whichever user asks');
 assert.deepEqual(codeOf(()=>resolve({roles:{viewer:{subagents:true,subagentTypes:['research']}}},'viewer')),['CAPABILITY_ROLE_WIDENING_REFUSED','subagents']);
 assert.deepEqual(codeOf(()=>resolve({roles:{auditor:{}}})),['CAPABILITY_ROLE_UNKNOWN','auditor']);
 for(const role of ['auditor','Admin','',undefined,7,'__proto__','constructor'])assert.deepEqual(codeOf(()=>resolveCapabilityPolicy({platform,tenant:{},role})),['CAPABILITY_ROLE_UNKNOWN',undefined],String(role));
});

test('empty intersections switch the scoped capability off and still validate',()=>{
 const disjoint={...platform,roleCeilings:{...roleCeilings,writer:{...maximum,subagentTypes:['analysis'],workspaceToolNames:['Write'],skillNames:['meri-bill-analysis']}}};
 const r=resolveCapabilityPolicy({platform:disjoint,tenant:{capabilities:{subagents:true,subagentProgress:true,subagentTypes:['research'],skillPlugin:true,workspaceToolNames:['Read']}},role:'writer'});
 assert.deepEqual([r.subagentTypes,r.subagents,r.subagentProgress],[[],false,false]);assert.deepEqual([r.workspaceToolNames,r.workspaceTools],[[],false]);assert.deepEqual([r.skillNames,r.skillPlugin],[[],false]);
 assert.deepEqual(P(r),r);
 assert.deepEqual(intersectCapabilityPolicies(P({sandboxNetworkDomains:['pypi.org']}),P({sandboxNetworkDomains:['*.github.com']})).sandboxNetworkDomains,[]);
 assert.deepEqual(intersectCapabilityPolicies(P({workspaceTools:true,workspaceToolNames:['Read']}),P({workspaceTools:true,workspaceToolNames:['Write']})).workspaceTools,false);assert.equal(intersectCapabilityPolicies(P({bash:true}),P({workspaceTools:true})).bash,false,'Bash eligibility ANDs like every flag');
});

test('intersection: flags AND, allowlists intersect (wildcards cover sub-domains, not the apex), parallelism takes the minimum',()=>{
 const a=P({subagents:true,auditHooks:true,subagentTypes:['verification','research'],maxParallelSubagents:4,skillNames:null,sandboxNetworkDomains:['*.github.com','pypi.org']});
 const b=P({subagents:true,compactionHooks:true,subagentTypes:['research','analysis'],maxParallelSubagents:2,skillNames:['meri-meeting-prep'],sandboxNetworkDomains:['api.github.com','github.com','files.pypi.org']});
 const ab=intersectCapabilityPolicies(a,b),ba=intersectCapabilityPolicies(b,a);
 assert.equal(ab.auditHooks,false);assert.equal(ab.compactionHooks,false);assert.equal(ab.subagents,true);assert.deepEqual(ab.subagentTypes,['research']);assert.equal(ab.maxParallelSubagents,2);assert.deepEqual(ab.skillNames,['meri-meeting-prep']);
 assert.deepEqual(ab.sandboxNetworkDomains,['api.github.com']);
 for(const key of POLICY_KEYS){const x=ab[key],y=ba[key];assert.deepEqual(Array.isArray(x)?[...x].sort():x,Array.isArray(y)?[...y].sort():y,`commutative up to order: ${key}`);}
});

test('resolution is idempotent and monotone',()=>{
 const tenant={capabilities:{subagents:true,subagentTypes:['research','analysis'],workspaceToolNames:['Read','Write'],bash:true,sandboxNetworkDomains:['api.github.com']},roles:{analyst:{maxParallelSubagents:1}}};
 for(const role of ['admin','analyst','viewer']){
  const r=resolve(tenant,role);
  assert.deepEqual(resolve(tenant,role),r,'deterministic');assert.deepEqual(intersectCapabilityPolicies(r,r),r,'intersect(p,p) is p');assert.deepEqual(P(P(r)),r);
  assert.deepEqual(intersectCapabilityPolicies(r,P(maximum)),r,'already inside the maximum');
  const {sandboxNetworkDomains,...rest}=r;void sandboxNetworkDomains;
  assert.deepEqual(resolveCapabilityPolicy({platform,tenant:{capabilities:{...rest,sandboxNetworkDomains:[...r.sandboxNetworkDomains]},roles:tenant.roles},role}),r,'feeding the result back as the tenant setting changes nothing');
  assert.equal(wideningField(r,P(maximum)),undefined);assert.equal(wideningField(r,P(roleCeilings[role])),undefined,'never above the role ceiling');
 }
 assert.deepEqual(intersectCapabilityPolicies(P({}),P({})),P({}),'all-off stays all-off');
});

test('platform limits are validated: defaults and role ceilings must sit inside the maximum',()=>{
 assert.deepEqual(codeOf(()=>assertPlatformCapabilityLimits({...platform,defaults:{...defaults,maxParallelSubagents:4}})),['CAPABILITY_PLATFORM_LIMITS_REFUSED','defaults.maxParallelSubagents']);
 assert.deepEqual(codeOf(()=>assertPlatformCapabilityLimits({...platform,roleCeilings:{admin:{...maximum,subagentTypes:[...SUBAGENT_TYPES]}}})),['CAPABILITY_PLATFORM_LIMITS_REFUSED','roleCeilings.admin.subagentTypes']);
 assert.deepEqual(codeOf(()=>assertPlatformCapabilityLimits({...platform,roleCeilings:{}})),['CAPABILITY_PLATFORM_LIMITS_REFUSED','roleCeilings']);
 for(const roleCeilingsValue of [[],null,{'Bad Role':{}},Object.fromEntries(Array.from({length:33},(_,i)=>[`r${i}`,{}]))])assert.equal(codeOf(()=>assertPlatformCapabilityLimits({...platform,roleCeilings:roleCeilingsValue}))?.[0],'CAPABILITY_PLATFORM_LIMITS_REFUSED',JSON.stringify(roleCeilingsValue));
 assert.throws(()=>assertPlatformCapabilityLimits({maximum,defaults}),/INVALID_COMMAND/);
 const limits=assertPlatformCapabilityLimits(platform);assert.ok(Object.isFrozen(limits)&&Object.isFrozen(limits.roleCeilings));assert.deepEqual(limits.maximum.workspaceToolNames,[...WORKSPACE_TOOLS]);
});
