/** Actual upstream SDK command objects with synthetic replies; proves the privacy decision, never AWS acceptance. */
import test from 'node:test';import assert from 'node:assert/strict';
import {GetPublicAccessBlockCommand,GetBucketPolicyStatusCommand,GetBucketOwnershipControlsCommand,GetBucketVersioningCommand} from '@aws-sdk/client-s3';
import {createPrivateBucketVerifier} from '../index.mjs';
const NOW=Date.parse('2026-10-15T12:00:00Z'),config={bucket:'synthetic-private-bucket',expectedBucketOwner:'111122223333',now:()=>NOW,maxRequestMs:200};
const named=name=>Object.assign(new Error('synthetic '+name),{name});
function fixture(){
 const calls=[],state={blocks:{BlockPublicAcls:true,IgnorePublicAcls:true,BlockPublicPolicy:true,RestrictPublicBuckets:true},policy:{PolicyStatus:{IsPublic:false}},rules:[{ObjectOwnership:'BucketOwnerEnforced'}],versioning:'Enabled',throws:new Map()};
 const client={async send(command,options){calls.push({command,options});const failure=state.throws.get(command.constructor);if(failure)throw failure;
  if(command instanceof GetPublicAccessBlockCommand)return {PublicAccessBlockConfiguration:state.blocks};
  if(command instanceof GetBucketPolicyStatusCommand)return state.policy;
  if(command instanceof GetBucketOwnershipControlsCommand)return {OwnershipControls:{Rules:state.rules}};
  if(command instanceof GetBucketVersioningCommand)return {Status:state.versioning};
  throw Error('unexpected command');}};
 return {calls,state,verify:()=>createPrivateBucketVerifier({...config,client}).verifyPrivate()};
}
const refused=(promise,code)=>assert.rejects(promise,error=>error.code===code);

test('a fully private bucket is verified with four read-only bucket requests, each bound to the expected owner',async()=>{
 const f=fixture();assert.deepEqual(await f.verify(),{publicAccessBlocked:true,policyPublic:false,objectOwnership:'BucketOwnerEnforced',versioning:'Enabled'});
 assert.deepEqual(f.calls.map(c=>c.command.constructor),[GetPublicAccessBlockCommand,GetBucketPolicyStatusCommand,GetBucketOwnershipControlsCommand,GetBucketVersioningCommand]);
 for(const {command,options} of f.calls){assert.deepEqual(command.input,{Bucket:config.bucket,ExpectedBucketOwner:config.expectedBucketOwner});assert.ok(options.abortSignal instanceof AbortSignal);}
 // No policy at all is not public.
 const none=fixture();none.state.throws.set(GetBucketPolicyStatusCommand,named('NoSuchBucketPolicy'));assert.equal((await none.verify()).policyPublic,false);
});
test('any public-access opening, public policy, ACL-capable ownership or unversioned bucket is not private',async()=>{
 const cases=[
  s=>s.blocks={...s.blocks,BlockPublicAcls:false},s=>s.blocks={...s.blocks,IgnorePublicAcls:false},s=>s.blocks={...s.blocks,BlockPublicPolicy:false},s=>s.blocks={...s.blocks,RestrictPublicBuckets:undefined},
  s=>s.throws.set(GetPublicAccessBlockCommand,named('NoSuchPublicAccessBlockConfiguration')),
  s=>s.policy={PolicyStatus:{IsPublic:true}},s=>s.policy={},
  s=>s.rules=[{ObjectOwnership:'BucketOwnerPreferred'}],s=>s.rules=[{ObjectOwnership:'ObjectWriter'}],s=>s.rules=[],s=>s.throws.set(GetBucketOwnershipControlsCommand,named('OwnershipControlsNotFoundError')),
  s=>s.versioning='Suspended',s=>s.versioning=undefined,
 ];
 for(const change of cases){const f=fixture();change(f.state);await refused(f.verify(),'ARTIFACT_S3_NOT_PRIVATE');}
});
test('an unreadable setting is unverified, never assumed private, and later settings are not read',async()=>{
 for(const Command of [GetPublicAccessBlockCommand,GetBucketPolicyStatusCommand,GetBucketOwnershipControlsCommand,GetBucketVersioningCommand]){
  const f=fixture();f.state.throws.set(Command,named('AccessDenied'));await refused(f.verify(),'ARTIFACT_S3_PRIVACY_UNVERIFIED');assert.equal(f.calls.at(-1).command.constructor,Command);
 }
});
test('invalid bucket identity, clocks and deadlines refuse at construction without IO; a cancelled caller is not verified',async()=>{
 const f=fixture(),client={async send(){f.calls.push(1);}};
 for(const change of [{bucket:'Bad_Bucket'},{bucket:'zone--x-s3'},{expectedBucketOwner:'1234'},{now:undefined},{maxRequestMs:0}])assert.throws(()=>createPrivateBucketVerifier({...config,client,...change}),/ARTIFACT_STORAGE_CONFIGURATION/u);
 assert.equal(f.calls.length,0);
 const abort=new AbortController();abort.abort();const sends=[];await assert.rejects(createPrivateBucketVerifier({...config,client:{async send(command){sends.push(command);return {};}}}).verifyPrivate({signal:abort.signal}));assert.equal(sends.length,0);
});
