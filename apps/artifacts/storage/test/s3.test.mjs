/** Actual upstream SDK commands/client with synthetic replies; never AWS acceptance. */
import test from 'node:test';import assert from 'node:assert/strict';import {Readable} from 'node:stream';import {createHash} from 'node:crypto';
import {S3Client,PutObjectCommand,GetObjectCommand,HeadObjectCommand,GetBucketVersioningCommand} from '@aws-sdk/client-s3';
import {createS3ArtifactObjects,createConfiguredS3ArtifactObjects} from '../s3-objects.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
const NOW=Date.parse('2026-10-13T18:00:00Z'),ID='11111111-1111-4111-8111-111111111111',KMS='arn:aws:kms:us-east-1:111122223333:key/22222222-2222-4222-8222-222222222222';
const bytes=Buffer.from('Synthetic immutable native object'),scope={tenantId:'synthetic-tenant',kind:'client',resourceId:ID,policyRevision:'synthetic-policy'},scopes=[scope],digest=b=>createHash('sha256').update(b).digest('hex');
const config={bucket:'synthetic-versioned-bucket',prefix:'meri-artifacts',expectedBucketOwner:'111122223333',kmsKeyId:KMS,now:()=>NOW,maxRequestMs:200,maxBytes:4096};
const input={objectId:ID,bytes,scopes,requestSha256:'a'.repeat(64)};
function fixture(){const calls=[],state={versioning:'Enabled',conflict:false,mutate:null,body:()=>Readable.from([bytes]),afterPut:null},object={objectId:ID,versionId:'SYNTHETIC_NATIVE_VERSION_1',sha256:digest(bytes),bytes:bytes.length,scopes};
 const fields=()=>({VersionId:object.versionId,ContentLength:bytes.length,ChecksumSHA256:Buffer.from(object.sha256,'hex').toString('base64'),ChecksumType:'FULL_OBJECT',ServerSideEncryption:'aws:kms',SSEKMSKeyId:KMS,
  Metadata:{objectid:ID,contentsha256:object.sha256,scopessha256:v.hash(scopes),requestsha256:input.requestSha256}});
 const client={async send(command,options){calls.push({command,options});if(command instanceof GetBucketVersioningCommand)return {Status:state.versioning};
  if(command instanceof PutObjectCommand){if(state.conflict)throw {$metadata:{httpStatusCode:412}};if(state.afterPut)state.afterPut();return fields();}
  const result=fields();if(command instanceof GetObjectCommand)result.Body=state.body();if(state.mutate)state.mutate(result,command);return result;}};
 return {calls,state,object,client,create:changes=>createS3ArtifactObjects({...config,client,...changes})};}
test('native SDK command objects use immutable key/full checksum/KMS/account and exact native version head/get',async()=>{
 const f=fixture(),objects=f.create(),object=await objects.put(input);assert.equal(object.versionId,'SYNTHETIC_NATIVE_VERSION_1');assert.notEqual(object.versionId,object.sha256);
 assert.deepEqual(await objects.get(object),bytes);const put=f.calls.find(c=>c.command instanceof PutObjectCommand).command.input;
 assert.equal(put.IfNoneMatch,'*');assert.equal(put.Key,`meri-artifacts/${v.hash(scopes)}/${ID}/${digest(bytes)}`);assert.equal(put.ServerSideEncryption,'aws:kms');assert.equal(put.SSEKMSKeyId,KMS);
 assert.equal(put.ChecksumType,'FULL_OBJECT');assert.equal(put.ExpectedBucketOwner,'111122223333');assert.ok(f.calls.every(c=>c.options.abortSignal instanceof AbortSignal));
 for(const {command}of f.calls.filter(c=>c.command instanceof GetObjectCommand||c.command instanceof HeadObjectCommand)){assert.equal(command.input.VersionId,object.versionId);assert.equal(command.input.ChecksumMode,'ENABLED');assert.ok(!Object.hasOwn(command.input,'ServerSideEncryption'));}
});
test('conditional replay verifies current native head/request metadata then the exact native version',async()=>{
 const f=fixture();f.state.conflict=true;assert.deepEqual(await f.create().put(input),f.object);assert.equal(f.calls.filter(c=>c.command instanceof PutObjectCommand).length,1);
 assert.equal(f.calls.filter(c=>c.command instanceof HeadObjectCommand).length,2);f.state.mutate=r=>r.Metadata.requestsha256='b'.repeat(64);await assert.rejects(f.create().put(input),/PUT_UNKNOWN/);
});
test('bucket suspended/unversioned and missing/native-null/checksum/composite/KMS/identity metadata fail closed',async()=>{
 for(const versioning of [undefined,'Suspended']){const f=fixture();f.state.versioning=versioning;await assert.rejects(f.create().put(input),/VERSIONING_REQUIRED/);assert.equal(f.calls.some(c=>c.command instanceof PutObjectCommand),false);}
 for(const mutate of [r=>r.VersionId='null',r=>r.VersionId='FOREIGN_NATIVE_VERSION',r=>r.ChecksumSHA256='bad',r=>r.ChecksumType='COMPOSITE',r=>r.SSEKMSKeyId='foreign',r=>r.ServerSideEncryption='AES256',
  r=>r.Metadata.scopessha256='0'.repeat(64),r=>r.Metadata.objectid='foreign',r=>r.ContentLength++,r=>r.DeleteMarker=true]){const f=fixture();f.state.mutate=mutate;await assert.rejects(f.create().get(f.object));}
});
test('get byte corruption/overflow and cancellation retire actual stream bodies',async()=>{
 for(const kind of ['corrupt','overflow','cancel']){const f=fixture(),controller=new AbortController();let destroyed=false;
  f.state.body=()=>{const body=Readable.from([kind==='overflow'?Buffer.concat([bytes,bytes]):Buffer.from('corrupt')]);body.on('close',()=>destroyed=true);if(kind==='cancel')controller.abort();return body;};
  await assert.rejects(f.create().get(f.object,controller.signal));await new Promise(r=>setImmediate(r));assert.equal(destroyed,true);}
});
test('parked send deadlines have no late reads and acquired late bodies are destroyed',async()=>{
 const f=fixture(),park=Promise.withResolvers();let destroyed=false;const client={async send(command,options){if(command instanceof GetObjectCommand)return park.promise;return f.client.send(command,options);}};
 await assert.rejects(f.create({client,maxRequestMs:20}).get(f.object),/DEADLINE/);const body=Readable.from([bytes]);body.on('close',()=>destroyed=true);park.resolve({Body:body});await new Promise(r=>setImmediate(r));assert.equal(destroyed,true);
});
test('constructor/import are inert; credentials required explicitly and borrowed client never disposed',()=>{
 const f=fixture();let credentialReads=0;const owned=createConfiguredS3ArtifactObjects({...config,region:'us-east-1',credentials:async()=>{credentialReads++;return {accessKeyId:'SYNTHETIC',secretAccessKey:'SYNTHETIC'};}});assert.equal(credentialReads,0);owned.close();
 assert.throws(()=>createConfiguredS3ArtifactObjects({...config,region:'us-east-1'}));assert.throws(()=>createConfiguredS3ArtifactObjects({...config,region:'us-east-1',credentials:()=>{},endpoint:'http://unsafe.invalid'}));
 assert.equal(f.calls.length,0);assert.throws(()=>f.create({prefix:'../escape'}));
});
test('actual installed S3Client serialization/deserialization runs through an injected handler without network',async()=>{
 const f=fixture(),requests=[];let credentialCalls=0;
 const handler={async handle(request){requests.push(request);const head=request.method==='HEAD',versioning=request.query?.versioning!==undefined;
  const headers={'x-amz-version-id':f.object.versionId,'x-amz-checksum-sha256':Buffer.from(f.object.sha256,'hex').toString('base64'),'x-amz-checksum-type':'FULL_OBJECT',
   'x-amz-server-side-encryption':'aws:kms','x-amz-server-side-encryption-aws-kms-key-id':KMS,'content-length':String(bytes.length),
   'x-amz-meta-objectid':ID,'x-amz-meta-contentsha256':f.object.sha256,'x-amz-meta-scopessha256':v.hash(scopes),'x-amz-meta-requestsha256':input.requestSha256};
  return {response:{statusCode:200,headers,body:versioning?Readable.from(['<VersioningConfiguration><Status>Enabled</Status></VersioningConfiguration>']):head?undefined:request.method==='PUT'?Readable.from([]):Readable.from([bytes])}};},destroy(){}};
 const client=new S3Client({region:'us-east-1',endpoint:'https://synthetic.invalid',maxAttempts:1,requestHandler:handler,credentials:async()=>{credentialCalls++;return {accessKeyId:'SYNTHETIC_ACCESS',secretAccessKey:'SYNTHETIC_SECRET'};}});
 try{const objects=createS3ArtifactObjects({...config,client});const object=await objects.put(input);assert.deepEqual(await objects.get(object),bytes);assert.ok(credentialCalls>0);assert.equal(requests.filter(r=>r.method==='PUT').length,1);assert.equal(requests.find(r=>r.method==='PUT').headers['if-none-match'],'*');}finally{client.destroy();}
});
