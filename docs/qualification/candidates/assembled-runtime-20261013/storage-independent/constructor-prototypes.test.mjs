/** Prototype-chain controls complement the retained own getter/proxy failures. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createS3ArtifactObjects,createPostgresArtifactVersions} from '../../../../../apps/artifacts/storage/index.mjs';
const config={bucket:'synthetic-review-bucket',prefix:'independent-review',expectedBucketOwner:'111122223333',kmsKeyId:'arn:aws:kms:us-east-1:111122223333:key/22222222-2222-4222-8222-222222222222',now:Date.now};
for(const kind of ['postgres','s3'])for(const trap of ['inherited getter','proxy prototype'])test(`${kind} refuses ${trap} without invoking it`,()=>{
 let calls=0;const method=kind==='postgres'?'connect':'send';
 const prototype=trap==='inherited getter'?Object.defineProperty({},method,{get(){calls++;return ()=>{};}}):new Proxy({[method](){}},{get(target,name,receiver){calls++;return Reflect.get(target,name,receiver);},getOwnPropertyDescriptor(target,name){calls++;return Reflect.getOwnPropertyDescriptor(target,name);}});
 const port=Object.create(prototype);let refused=false;
 try{if(kind==='postgres')createPostgresArtifactVersions({pool:port,now:Date.now});else createS3ArtifactObjects({...config,client:port});}catch{refused=true;}
 assert.equal(calls,0,'constructor must not invoke active prototype access');assert.equal(refused,true);
});
