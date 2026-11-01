import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareResearchSqlPolicy} from './research-sql-policy.mjs';
import {prepareSqlCoveragePolicy} from './sql-coverage-policy.mjs';
import {assertCapabilityPolicy} from '../../apps/worker/conversation/capabilities/policy.mjs';
import {resolveCapabilityPolicy} from '../../apps/worker/conversation/capabilities/policy-resolution.mjs';
import {profileReads,resolveAvailableReads} from '../../apps/worker/conversation/reads/availability.mjs';
const ids=['describe_capiro_data','query_capiro_data'],roles=['standard_user','user_admin','capiro_admin'];
const ops=version=>ids.map(id=>({id,version})),prior=ops('0.3.0'),current=ops('0.5.0');
const profile=()=>({generalReads:true,readFamilies:['mail','capiro-data-v3'],activeReadOperations:structuredClone(prior),bash:false,skillPlugin:false,sandboxNetworkDomains:['example.invalid']});
const fixture=()=>({platform:{maximum:profile(),defaults:profile(),roleCeilings:Object.fromEntries(roles.map(role=>[role,profile()]))},approvedReads:{schemaVersion:'meri-native-general-reads/1',enabled:true,operations:structuredClone(prior),maxExecuteMs:5000,maxRequestBytes:65536,maxResponseBytes:1048576}});
const profiles=value=>[value.platform.maximum,value.platform.defaults,...roles.map(role=>value.platform.roleCeilings[role])];
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

test('preparation adds only v5 family and two operations to all five profiles and installation; immutable/idempotent',()=>{
 const input=freeze(fixture()),before=structuredClone(input),next=prepareResearchSqlPolicy(input);
 assert.deepEqual(input,before);
 for(const p of profiles(next))assert.deepEqual(p,{...profile(),readFamilies:['mail','capiro-data-v3','capiro-data-v5'],activeReadOperations:[...prior,...current]});
 assert.deepEqual(next.approvedReads,{...before.approvedReads,operations:[...prior,...current]});
 assert.deepEqual(prepareResearchSqlPolicy(next),next);
 assert.equal(JSON.stringify(next).includes('0.4.0'),false);
});
test('existing v4 and all unrelated knobs/role restrictions remain exact',()=>{
 const input=fixture();for(const p of profiles(input)){p.readFamilies.push('capiro-data-v4');p.activeReadOperations.push(...ops('0.4.0'));}
 input.platform.roleCeilings.auditor={generalReads:false,bash:false,readFamilies:['mail'],activeReadOperations:[],sandboxNetworkDomains:[]};input.approvedReads.operations.push(...ops('0.4.0'));
 const before=structuredClone(input),next=prepareResearchSqlPolicy(input);
 assert.deepEqual(input,before);assert.deepEqual(next.platform.roleCeilings.auditor,before.platform.roleCeilings.auditor);
 for(let i=0;i<5;i++){const p=profiles(next)[i],old=profiles(before)[i];assert.deepEqual(p,{...old,readFamilies:[...old.readFamilies,'capiro-data-v5'],activeReadOperations:[...old.activeReadOperations,...current]});}
 assert.deepEqual(next.approvedReads,{...before.approvedReads,operations:[...before.approvedReads.operations,...current]});
});
test('a partially prepared v5 pair completes once without duplicates',()=>{
 const input=fixture();for(const p of profiles(input)){p.readFamilies.push('capiro-data-v5');p.activeReadOperations.push(current[1]);}input.approvedReads.operations.push(current[1]);
 const next=prepareResearchSqlPolicy(input);for(const p of profiles(next))assert.deepEqual(p.activeReadOperations,[...prior,current[1],current[0]]);
 assert.deepEqual(next.approvedReads.operations,[...prior,current[1],current[0]]);assert.deepEqual(prepareResearchSqlPolicy(next),next);
});
test('canonical v2→v3 preparation composes with v5 without adding legacy v4',()=>{
 const input=fixture();for(const p of profiles(input)){p.readFamilies=['mail','capiro-data'];p.activeReadOperations=ops('0.2.0');}input.approvedReads.operations=ops('0.2.0');
 const before=structuredClone(input),v3=prepareSqlCoveragePolicy(input),next=prepareResearchSqlPolicy(v3);
 assert.deepEqual(input,before);for(const p of profiles(next)){assert.deepEqual(p.readFamilies,['mail','capiro-data','capiro-data-v3','capiro-data-v5']);assert.deepEqual(p.activeReadOperations,[...ops('0.2.0'),...prior,...current]);}
 assert.deepEqual(next.approvedReads.operations,[...ops('0.2.0'),...prior,...current]);
});
test('source-style omitted families are materialized by the canonical defaults before the existing v2 preparer',()=>{
 const input=fixture();for(const p of profiles(input)){delete p.readFamilies;p.activeReadOperations=ops('0.2.0');}input.approvedReads.operations=ops('0.2.0');
 assert.throws(()=>prepareSqlCoveragePolicy(input));
 const explicit=structuredClone(input);for(const p of profiles(explicit))p.readFamilies=[...assertCapabilityPolicy(p).readFamilies];
 const next=prepareResearchSqlPolicy(prepareSqlCoveragePolicy(explicit));
 for(const role of roles)assert.deepEqual(profileReads({policy:resolveCapabilityPolicy({platform:next.platform,tenant:{},role})}).map(r=>r.operation),current);
 assert.equal(input.platform.maximum.readFamilies,undefined);
});
test('all three admitted roles prefer v5 once; exact saved pins remain exact',()=>{
 const next=prepareResearchSqlPolicy(fixture());
 for(const role of roles){const policy=resolveCapabilityPolicy({platform:next.platform,tenant:{},role});assert.deepEqual(profileReads({policy}).map(r=>r.operation),current);assert.deepEqual(profileReads({policy,narrowTo:prior}).map(r=>r.operation),prior);}
});
test('tenant and tenant-role denials remain effective; discovery denial never downgrades',()=>{
 const next=prepareResearchSqlPolicy(fixture());
 for(const tenant of [{capabilities:{generalReads:false}},{capabilities:{readFamilies:['mail']}},{capabilities:{activeReadOperations:[]}},{roles:{standard_user:{readFamilies:['mail']}}},{roles:{standard_user:{activeReadOperations:[]}}}]){
  const policy=resolveCapabilityPolicy({platform:next.platform,tenant,role:'standard_user'});assert.deepEqual(profileReads({policy}),[]);
 }
 const policy=resolveCapabilityPolicy({platform:next.platform,tenant:{},role:'standard_user'});
 assert.deepEqual(resolveAvailableReads({policy,installation:{operations:next.approvedReads.operations},discovery:{operations:prior},scopes:[]}).available,[]);
 assert.deepEqual(resolveAvailableReads({policy,installation:{operations:prior},discovery:{operations:prior},scopes:[]}).available.map(r=>r.operation),prior);
});
test('every prerequisite profile and approvedReads refuses missing v3 or disabled gates without mutation',()=>{
 for(let i=0;i<5;i++)for(const mutate of [p=>p.generalReads=false,p=>p.activeReadOperations.pop(),p=>p.readFamilies=['mail']]){const input=fixture();mutate(profiles(input)[i]);const before=structuredClone(input);assert.throws(()=>prepareResearchSqlPolicy(input));assert.deepEqual(input,before);}
 for(const mutate of [x=>delete x.platform.roleCeilings.user_admin,x=>x.approvedReads.enabled=false,x=>x.approvedReads.operations.pop()]){const input=fixture();mutate(input);const before=structuredClone(input);assert.throws(()=>prepareResearchSqlPolicy(input));assert.deepEqual(input,before);}
});
test('canonical malformed, duplicate, unknown and widening policy inputs refuse',()=>{
 for(const mutate of [x=>x.platform.defaults.bash=true,x=>x.platform.defaults.unknown=true,x=>x.platform.maximum.readFamilies.push('unknown'),x=>x.platform.maximum.activeReadOperations.push(prior[0]),x=>x.approvedReads.operations.push(prior[0]),x=>x.approvedReads.maxExecuteMs=30001,x=>x.approvedReads.operations.push({id:'query_capiro_data',version:'0.6.0'}),x=>x.platform.roleCeilings.standard_user.sandboxNetworkDomains.push('wider.invalid')]){const input=fixture();mutate(input);assert.throws(()=>prepareResearchSqlPolicy(input));}
});
