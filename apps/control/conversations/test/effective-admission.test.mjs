import test from 'node:test';
import assert from 'node:assert/strict';
import {assertConfigurationAdoptionReceipt,assertEffectiveAdmissionDescriptor,resolveEffectiveAdmissionFromRows} from '../effective-admission.mjs';
import {hash} from '../boundary.mjs';
import {binding,id,scopes,versions} from './store-fixture.mjs';

const at=1800000000000;
const oldConfigurationSha256='c'.repeat(64),newConfigurationSha256='d'.repeat(64),laterConfigurationSha256='e'.repeat(64);
const newVersions={...versions,imageDigest:`sha256:${'f'.repeat(64)}`,sdk:'0.3.296'};
const originalRecord={schemaVersion:1,state:'ADMITTED',binding,selectedClientId:id(5),policyRevision:'policy1',versions,configurationSha256:oldConfigurationSha256,createdAtMs:at,expiresAtMs:at+60000};
const original={record:originalRecord,recordSha256:hash(originalRecord)};
const target={...binding,runId:id(11),attemptId:id(12),workerId:id(13),writerFence:2};
const next={...binding,runId:id(21),attemptId:id(22),workerId:id(23),writerFence:3};
const reservation=(source,destination,pins)=>({source,target:destination,facts:{checkpoint:null,noAuthority:{foreclosureSha256:'a'.repeat(64)}},scopes,versions:pins,policyRevision:'policy1',reservedAt:new Date(at+1000).toISOString()});
const reserved=(source,destination,pins,state='RESERVED')=>{const value=reservation(source,destination,pins);return {reservation:value,reservationSha256:hash(value),state};};
const first=reserved(binding,target,versions);
const adoptedReceipt={schemaVersion:1,source:binding,target,originalAdmissionSha256:original.recordSha256,reservationSha256:first.reservationSha256,selectedClientId:id(5),scopes,policyRevision:'policy1',fromConfigurationSha256:oldConfigurationSha256,fromVersions:versions,toConfigurationSha256:newConfigurationSha256,toVersions:newVersions,authorityDecisionSha256:'b'.repeat(64),authorityCheckedAtMs:at+1000,authorityExpiresAtMs:at+30000,adoptedAtMs:at+2000,validUntilMs:at+20000};
const adoption={receipt:adoptedReceipt,receiptSha256:hash(adoptedReceipt)};
const resolve=(bindingValue=binding,reservations=[],adoptions=[])=>resolveEffectiveAdmissionFromRows({binding:bindingValue,original,reservations,adoptions});

test('original descriptor pins the immutable original admission without a reservation or transition',()=>{
 const result=resolve();assert.deepEqual(result.binding,binding);assert.equal(result.originalAdmissionSha256,original.recordSha256);
 assert.equal(result.reservationSha256,null);assert.equal(result.transitionSha256,null);assert.equal(result.configurationSha256,oldConfigurationSha256);
 assert.deepEqual(result.versions,versions);assert.deepEqual(result.scopes,scopes);assert.equal(result.descriptorSha256,hash(Object.fromEntries(Object.entries(result).filter(([key])=>key!=='descriptorSha256'))));
 assert.deepEqual(assertEffectiveAdmissionDescriptor(result),result);
});

test('unadopted reserved target retains the source epoch and its own reservation hash',()=>{
 const result=resolve(target,[first]);assert.deepEqual(result.binding,target);assert.equal(result.reservationSha256,first.reservationSha256);
 assert.equal(result.transitionSha256,null);assert.equal(result.configurationSha256,oldConfigurationSha256);assert.deepEqual(result.versions,versions);
});

test('adopted unused target keeps its binding and adopts only the verified new pins',()=>{
 const result=resolve(target,[first],[adoption]);assert.deepEqual(result.binding,target);assert.equal(result.configurationSha256,newConfigurationSha256);
 assert.deepEqual(result.versions,newVersions);assert.equal(result.transitionSha256,adoption.receiptSha256);
 assert.equal(result.reservationSha256,first.reservationSha256);assert.deepEqual(assertConfigurationAdoptionReceipt(adoptedReceipt),adoptedReceipt);
});

test('next successor inherits adopted configuration and transition lineage with a new reservation hash',()=>{
 const second=reserved(target,next,newVersions),result=resolve(next,[{...first,state:'ACCEPTED'},second],[adoption]);
 assert.deepEqual(result.binding,next);assert.equal(result.configurationSha256,newConfigurationSha256);assert.deepEqual(result.versions,newVersions);
 assert.equal(result.transitionSha256,adoption.receiptSha256);assert.equal(result.reservationSha256,second.reservationSha256);
 assert.notEqual(result.descriptorSha256,resolve(target,[first],[adoption]).descriptorSha256);
});

test('wrong hashes, target, path order, old versions and any injected credential refuse',()=>{
 assert.throws(()=>resolveEffectiveAdmissionFromRows({binding,original:{...original,recordSha256:'0'.repeat(64)},reservations:[],adoptions:[]}),{code:'EFFECTIVE_ADMISSION_CORRUPT'});
 assert.throws(()=>resolve(target,[{...first,reservationSha256:'0'.repeat(64)}]),{code:'EFFECTIVE_ADMISSION_CORRUPT'});
 assert.throws(()=>resolve(next,[first]),{code:'EFFECTIVE_ADMISSION_CORRUPT'});
 assert.throws(()=>resolve(next,[reserved(target,next,newVersions),first]),{code:'EFFECTIVE_ADMISSION_CORRUPT'});
 assert.throws(()=>resolve(next,[{...first,state:'ACCEPTED'},reserved(target,next,versions)],[adoption]),{code:'EFFECTIVE_ADMISSION_CORRUPT'});
 assert.throws(()=>resolve(target,[first],[{receipt:{...adoptedReceipt,target:next},receiptSha256:adoption.receiptSha256}]),{code:'EFFECTIVE_ADMISSION_CORRUPT'});
 assert.throws(()=>resolve(target,[first],[{...adoption,receiptSha256:'0'.repeat(64)}]),{code:'EFFECTIVE_ADMISSION_CORRUPT'});
 assert.throws(()=>assertEffectiveAdmissionDescriptor({...resolve(),credential:'forbidden'}),{code:'EFFECTIVE_ADMISSION_CORRUPT'});
 assert.throws(()=>assertConfigurationAdoptionReceipt({...adoptedReceipt,authorityDecisionSha256:'not-a-digest'}),{code:'EFFECTIVE_ADMISSION_CORRUPT'});
 assert.throws(()=>assertConfigurationAdoptionReceipt({...adoptedReceipt,target:{...target,runId:binding.runId}}),{code:'EFFECTIVE_ADMISSION_CORRUPT'});
});

test('adoption requires a null checkpoint and a bounded authority observation',()=>{
 const checkpointed=reservation(binding,target,versions);checkpointed.facts={checkpoint:{checkpointId:id(91),proofSha256:'a'.repeat(64)},retirement:{physicalStopProven:true},revocation:{receiptSha256:'b'.repeat(64),grantIds:[id(92)]}};
 assert.throws(()=>resolve(target,[{reservation:checkpointed,reservationSha256:hash(checkpointed),state:'RESERVED'}],[{receipt:{...adoptedReceipt,reservationSha256:hash(checkpointed)},receiptSha256:hash({...adoptedReceipt,reservationSha256:hash(checkpointed)})}]),{code:'EFFECTIVE_ADMISSION_CORRUPT'});
 assert.throws(()=>assertConfigurationAdoptionReceipt({...adoptedReceipt,validUntilMs:adoptedReceipt.authorityExpiresAtMs+1}),{code:'EFFECTIVE_ADMISSION_CORRUPT'});
 assert.throws(()=>assertConfigurationAdoptionReceipt({...adoptedReceipt,authorityCheckedAtMs:adoptedReceipt.adoptedAtMs+1}),{code:'EFFECTIVE_ADMISSION_CORRUPT'});
 const premature={...adoptedReceipt,authorityCheckedAtMs:at,adoptedAtMs:at+999};
 assert.throws(()=>resolve(target,[first],[{receipt:premature,receiptSha256:hash(premature)}]),{code:'EFFECTIVE_ADMISSION_CORRUPT'});
 const staleAuthority={...adoptedReceipt,authorityCheckedAtMs:at+999};
 assert.throws(()=>resolve(target,[first],[{receipt:staleAuthority,receiptSha256:hash(staleAuthority)}]),{code:'EFFECTIVE_ADMISSION_CORRUPT'});
});

test('identical receipt replay is stable; a second conflicting adoption is an explicit HOLD',()=>{
 assert.deepEqual(resolve(target,[first],[adoption,adoption]),resolve(target,[first],[adoption]));
 const conflicting={...adoptedReceipt,toConfigurationSha256:laterConfigurationSha256};
 assert.throws(()=>resolve(target,[first],[adoption,{receipt:conflicting,receiptSha256:hash(conflicting)}]),{code:'EFFECTIVE_ADMISSION_HOLD'});
});
