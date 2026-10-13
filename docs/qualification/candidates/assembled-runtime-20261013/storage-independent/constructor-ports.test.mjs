/** Counterexamples for configured port admission without getter/proxy execution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createS3ArtifactObjects,createPostgresArtifactVersions} from '../../../../../apps/artifacts/storage/index.mjs';
const require=createRequire(new URL('../../../../../apps/artifacts/storage/package.json',import.meta.url));
const {S3Client}=require('@aws-sdk/client-s3');
const {Pool}=require('pg');
const config={bucket:'synthetic-review-bucket',prefix:'independent-review',expectedBucketOwner:'111122223333',kmsKeyId:'arn:aws:kms:us-east-1:111122223333:key/22222222-2222-4222-8222-222222222222',now:Date.now};
for(const kind of ['postgres','s3'])for(const trap of ['getter','proxy'])test(`${kind} constructor refuses ${trap} method without executing it`,()=>{
 let calls=0;const method=kind==='postgres'?'connect':'send';
 const port=trap==='getter'?Object.defineProperty({},method,{enumerable:true,get(){calls++;return ()=>{};}}):new Proxy({[method](){}},{get(target,name,receiver){calls++;return Reflect.get(target,name,receiver);}});
 let refused=false;
 try{if(kind==='postgres')createPostgresArtifactVersions({pool:port,now:Date.now});else createS3ArtifactObjects({...config,client:port});}catch{refused=true;}
 assert.equal(calls,0,'constructor must not execute configured method access');assert.equal(refused,true,'active method access must be refused');
});
test('actual native Pool/S3Client prototype methods remain valid and constructors do no IO',async()=>{
 let credentialReads=0;const pool=new Pool({host:'synthetic.invalid',user:'synthetic',password:'synthetic',database:'synthetic'});
 const client=new S3Client({region:'us-east-1',maxAttempts:1,credentials:async()=>{credentialReads++;return {accessKeyId:'SYNTHETIC',secretAccessKey:'SYNTHETIC'};}});
 try{assert.ok(createPostgresArtifactVersions({pool,now:Date.now}));assert.ok(createS3ArtifactObjects({...config,client}));assert.equal(pool.totalCount,0);assert.equal(credentialReads,0);}finally{client.destroy();await pool.end();}
});
