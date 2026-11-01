import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePrivateMeetingSqlPolicy} from './private-meeting-sql-policy.mjs';
import {createRunCapabilityPolicy} from '../../apps/runtime/product-ports/capability-policy.mjs';
import {profileReads} from '../../apps/worker/conversation/reads/availability.mjs';
import {GENERAL_READ_TARIFFS} from '../../apps/gateway/budget/general-read-tariffs.mjs';
const ids=['describe_capiro_data','query_capiro_data'];
const prior=ids.map(id=>({id,version:'0.3.0'})),current=ids.map(id=>({id,version:'0.4.0'}));
const roles=['standard_user','user_admin','capiro_admin'];
const profile=()=>({generalReads:true,readFamilies:['mail','capiro-data-v3'],activeReadOperations:[...prior],bash:false});
const fixture=()=>({platform:{maximum:profile(),defaults:profile(),roleCeilings:Object.fromEntries(roles.map(role=>[role,profile()]))},
 approvedReads:{schemaVersion:'meri-native-general-reads/1',enabled:true,operations:prior,maxExecuteMs:5000,maxRequestBytes:65536,maxResponseBytes:1048576}});

test('offline successor preparation adds only the exact family/operations and is immutable/idempotent',()=>{
 const input=fixture(),before=structuredClone(input),next=preparePrivateMeetingSqlPolicy(input);
 assert.deepEqual(input,before);
 for(const p of [next.platform.maximum,next.platform.defaults,...Object.values(next.platform.roleCeilings)])
  assert.deepEqual(p,{...profile(),readFamilies:['mail','capiro-data-v3','capiro-data-v4'],activeReadOperations:[...prior,...current]});
 assert.deepEqual(next.approvedReads,{...before.approvedReads,operations:[...prior,...current]});
 assert.deepEqual(preparePrivateMeetingSqlPolicy(next),next);
 for(const id of ids){assert.equal(GENERAL_READ_TARIFFS[`${id}@0.4.0`].class,'db');assert.equal(GENERAL_READ_TARIFFS[`${id}@0.4.0`].chargeMicrousd,1);}
});

test('new platform policy mounts current SQL exactly once and retains canonical tenant/role denials',async()=>{
 const {platform}=preparePrivateMeetingSqlPolicy(fixture());
 for(const actorRole of roles){
  const owner=createRunCapabilityPolicy({platform,readTenantSettings:async()=>({})});
  const policy=await owner.forRun({tenantId:'synthetic',actorId:'synthetic',conversationId:'10000000-0000-4000-8000-000000000001',actorRole});
  assert.deepEqual(profileReads({policy}).map(r=>r.operation),current);
 }
 for(const tenant of [{capabilities:{generalReads:false}},{capabilities:{readFamilies:['mail']}},{roles:{standard_user:{readFamilies:['mail']}}}]){
  const owner=createRunCapabilityPolicy({platform,readTenantSettings:async()=>tenant});
  const policy=await owner.forRun({tenantId:'synthetic',actorId:'synthetic',conversationId:'10000000-0000-4000-8000-000000000001',actorRole:'standard_user'});
  assert.deepEqual(profileReads({policy:policy??{}}),[]);
 }
});

test('preparation refuses missing prior operation, disabled gates and unrelated malformed/widening policy',()=>{
 for(const mutate of [x=>x.platform.defaults.generalReads=false,x=>x.platform.maximum.activeReadOperations=[],
  x=>delete x.platform.roleCeilings.user_admin,x=>x.approvedReads.enabled=false,x=>x.approvedReads.operations=[],
  x=>x.platform.defaults.bash=true,x=>x.platform.defaults.unknown=true,
  x=>x.platform.defaults.readFamilies=['mail'],x=>x.platform.defaults.activeReadOperations.push(prior[0])]){
  const input=fixture();mutate(input);assert.throws(()=>preparePrivateMeetingSqlPolicy(input));
 }
});
