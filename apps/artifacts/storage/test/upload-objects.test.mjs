/** Native SDK command transport, synthetic storage only; no cloud acceptance. */
import test from 'node:test';import assert from 'node:assert/strict';
import {GetBucketVersioningCommand,PutObjectCommand,HeadObjectCommand} from '@aws-sdk/client-s3';
import {createS3ArtifactObjects} from '../s3-objects.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createHash} from 'node:crypto';
const digest=x=>createHash('sha256').update(x).digest('hex'),id='11111111-1111-4111-8111-111111111111';
const scope={tenantId:'synthetic',kind:'private-user',resourceId:'synthetic',policyRevision:'p'},scopes=[scope],kms='arn:aws:kms:us-east-1:111122223333:key/22222222-2222-4222-8222-222222222222';
function fixture(){const state={calls:[],value:null,lostAck:false,mutate:null};const client={async send(command){state.calls.push(command);
 if(command instanceof GetBucketVersioningCommand)return {Status:'Enabled'};
 if(command instanceof PutObjectCommand){const a=command.input;state.value={VersionId:'NATIVE-UPLOAD-VERSION',ContentLength:a.Body.length,ChecksumSHA256:a.ChecksumSHA256,ChecksumType:'FULL_OBJECT',ServerSideEncryption:'aws:kms',SSEKMSKeyId:kms,Metadata:a.Metadata};if(state.lostAck)throw Error('ACK_LOST');return structuredClone(state.value);}
 if(command instanceof HeadObjectCommand){if(!state.value)throw {$metadata:{httpStatusCode:404}};const out=structuredClone(state.value);state.mutate?.(out);return out;}throw Error('UNEXPECTED_COMMAND');}};
 const config={client,bucket:'synthetic-uploads',prefix:'uploads',expectedBucketOwner:'111122223333',kmsKeyId:kms,now:Date.now};return {state,config};}
const original=bytes=>({objectId:id,bytes,scopes,requestSha256:'a'.repeat(64)}),observed=bytes=>({objectId:id,bytes:bytes.length,sha256:digest(bytes),scopes,requestSha256:'a'.repeat(64)});
test('default remains8MiB; explicit10MiB upload uses unchanged native integrity fields; larger config rejected',async()=>{
 const f=fixture(),bytes=Buffer.alloc(10*1024*1024,42);
 await assert.rejects(createS3ArtifactObjects(f.config).put(original(bytes)),/STORAGE_INPUT/);assert.equal(f.state.calls.length,0);
 assert.throws(()=>createS3ArtifactObjects({...f.config,maxBytes:bytes.length+1}),/CONFIGURATION/);
 const object=await createS3ArtifactObjects({...f.config,maxBytes:bytes.length}).put(original(bytes));assert.equal(object.bytes,bytes.length);
 const put=f.state.calls.find(c=>c instanceof PutObjectCommand).input;assert.equal(put.IfNoneMatch,'*');assert.equal(put.ChecksumSHA256,Buffer.from(digest(bytes),'hex').toString('base64'));assert.equal(put.Metadata.scopessha256,v.hash(scopes));
});
test('lost ACK exact allocation is read-only reconciled with native VersionId and a pinned second head',async()=>{
 const f=fixture(),bytes=Buffer.from('original'),objects=createS3ArtifactObjects(f.config);f.state.lostAck=true;
 await assert.rejects(objects.put(original(bytes)),/PUT_UNKNOWN/);const before=f.state.calls.length;
 const object=await objects.observePut(observed(bytes));assert.equal(object.versionId,'NATIVE-UPLOAD-VERSION');
 assert.equal(f.state.calls.slice(before).some(c=>c instanceof PutObjectCommand),false);
 const heads=f.state.calls.slice(before).filter(c=>c instanceof HeadObjectCommand);assert.equal(heads.length,2);assert.equal(heads[1].input.VersionId,object.versionId);
});
test('absence is null, tampered native observations fail, neither performs a write',async()=>{
 const f=fixture(),bytes=Buffer.from('original'),objects=createS3ArtifactObjects(f.config);
 assert.equal(await objects.observePut(observed(bytes)),null);assert.equal(f.state.calls.some(c=>c instanceof PutObjectCommand),false);
 await objects.put(original(bytes));
 for(const mutate of [r=>r.Metadata.requestsha256='b'.repeat(64),r=>r.ChecksumType='COMPOSITE',r=>r.SSEKMSKeyId='wrong',r=>r.VersionId='null',r=>r.ContentLength++,r=>r.DeleteMarker=true]){f.state.mutate=mutate;const before=f.state.calls.length;await assert.rejects(objects.observePut(observed(bytes)));assert.equal(f.state.calls.slice(before).some(c=>c instanceof PutObjectCommand),false);}
});
