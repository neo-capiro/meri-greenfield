import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSqlCoveragePolicy} from './sql-coverage-policy.mjs';
import {createRunCapabilityPolicy} from '../../apps/runtime/product-ports/capability-policy.mjs';
import {profileReads} from '../../apps/worker/conversation/reads/availability.mjs';
import {GENERAL_READ_TARIFFS} from '../../apps/gateway/budget/general-read-tariffs.mjs';
const ids=['describe_capiro_data','query_capiro_data'];
const old=ids.map(id=>({id,version:'0.2.0'})),current=ids.map(id=>({id,version:'0.3.0'}));
const roles=['standard_user','user_admin','capiro_admin'];
const profile=()=>({generalReads:true,readFamilies:['mail'],activeReadOperations:[...old],bash:false});
const fixture=()=>({platform:{maximum:profile(),defaults:profile(),roleCeilings:Object.fromEntries(roles.map(role=>[role,profile()]))},
 approvedReads:{schemaVersion:'meri-native-general-reads/1',enabled:true,operations:old,maxExecuteMs:5000,maxRequestBytes:65536,maxResponseBytes:1048576}});

test('both successor operations retain the exact DB tariff without a provider charge exemption',()=>{
 for(const id of ids){
  const next=GENERAL_READ_TARIFFS[`${id}@0.3.0`],prior=GENERAL_READ_TARIFFS[`${id}@0.2.0`];
  assert.equal(next.class,'db');assert.equal(next.chargeMicrousd,1);assert.equal(next.chargeMicrousd,prior.chargeMicrousd);
  assert.match(next.evidence,/no paid provider call/);
 }
});

test('preparation adds only the exact SQL families/successors, leaving all other settings and input unchanged',()=>{
 const input=fixture(),before=structuredClone(input),next=prepareSqlCoveragePolicy(input);
 assert.deepEqual(input,before);
 for(const p of [next.platform.maximum,next.platform.defaults,...Object.values(next.platform.roleCeilings)]){
  assert.deepEqual(p,{...profile(),readFamilies:['mail','capiro-data','capiro-data-v3'],activeReadOperations:[...old,...current]});
 }
 assert.deepEqual(next.approvedReads,{...before.approvedReads,operations:[...old,...current]});
 assert.deepEqual(prepareSqlCoveragePolicy(next),next);
});
test('every intended role can mount only the current SQL version after policy preparation',async()=>{
 const {platform}=prepareSqlCoveragePolicy(fixture());
 const owner=createRunCapabilityPolicy({platform,readTenantSettings:async()=>({})});
 for(const actorRole of roles){
  const policy=await owner.forRun({tenantId:'synthetic',actorId:'synthetic',conversationId:'10000000-0000-4000-8000-000000000001',actorRole});
  assert.deepEqual(profileReads({policy}).map(row=>row.operation),current);
 }
});
test('canonical tenant and role narrowing still withhold SQL after the platform gap is corrected',async()=>{
 const {platform}=prepareSqlCoveragePolicy(fixture());
 for(const tenant of [{capabilities:{generalReads:false}},{capabilities:{readFamilies:['mail']}},{roles:{standard_user:{readFamilies:['mail']}}}]){
  const owner=createRunCapabilityPolicy({platform,readTenantSettings:async()=>tenant});
  const policy=await owner.forRun({tenantId:'synthetic',actorId:'synthetic',conversationId:'10000000-0000-4000-8000-000000000001',actorRole:'standard_user'});
  assert.deepEqual(profileReads({policy:policy??{}}),[]);
 }
});
test('preparation refuses a disabled gate, missing retained operation or missing role instead of widening it',()=>{
 for(const mutate of [x=>x.platform.defaults.generalReads=false,x=>x.platform.roleCeilings.standard_user.generalReads=false,
  x=>delete x.platform.roleCeilings.user_admin,x=>x.approvedReads.enabled=false,
  x=>x.platform.maximum.activeReadOperations=[],x=>x.approvedReads.operations=[],
  x=>x.platform.defaults.unknown=true,x=>x.platform.defaults.bash=true,
  x=>x.platform.maximum.readFamilies.push('unknown'),x=>x.platform.defaults.activeReadOperations.push(old[0])]){
  const input=fixture();mutate(input);assert.throws(()=>prepareSqlCoveragePolicy(input));
 }
});
