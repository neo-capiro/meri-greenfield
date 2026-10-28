import test from 'node:test';import assert from 'node:assert/strict';
import {uploadsFamily,createUploadOriginalRemoval} from '../uploads.mjs';
import {captureRuntimePorts,createRuntimeProductApplications} from '../../product-applications.mjs';
import {productReadiness} from '../../product-readiness.mjs';
const now=Date.now,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const configuration={sourceEnabled:true,limits:{requestMs:5000,requestBytes:65536},native:{maxResponseBytes:262144},retention:{},
 artifacts:{enabled:true,region:'us-east-1',bucket:'synthetic-upload-bucket',prefix:'artifacts',expectedBucketOwner:'111122223333',
  kmsKeyId:'arn:aws:kms:us-east-1:111122223333:key/'+id(1)}};
const unused=()=>assert.fail('No SQL, provider or storage IO during composition');
const retention={assertServable:unused,withRelease:unused},sessions={authenticateSession:unused,readCurrentState:unused};
test('production upload family is lazy, borrows exact current sessions/retention, and mounts through captured runtime ports',async()=>{
 const family=uploadsFamily({createS3Client:({region})=>{assert.equal(region,'us-east-1');return {send:unused};}});
 const ports=captureRuntimePorts(family({configuration,pool:{connect:unused},now}).ports);
 assert.equal(ports.uploadApplicationFactory.state(),'composed');assert.throws(()=>ports.uploadApplicationFactory.create({sessions}),/UPLOAD_CONFIGURATION/);
 const app=createRuntimeProductApplications({configuration,sessions,ports,now,retention});
 const result=await app.handle(new Request('https://synthetic.invalid/api/uploads/initiate',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}));
 assert.equal(result.status,403);assert.equal((await result.json()).error.code,'UPLOAD_ACCESS_DENIED');
 assert.equal(productReadiness({ports,sourceEnabled:true,retention}).owners.find(x=>x.name==='uploads.custody').state,'composed');
});
test('source/retention/storage absence keeps upload route unavailable without touching SQL or constructing a client',async()=>{
 for(const change of [{sourceEnabled:false},{retention:undefined},{artifacts:undefined},{artifacts:{enabled:false}}]){
  const c={...configuration,...change},ports=captureRuntimePorts(uploadsFamily({createS3Client:unused})({configuration:c,pool:{connect:unused},now}).ports);
  assert.equal(ports.uploadApplicationFactory,undefined);
  const app=createRuntimeProductApplications({configuration:c,sessions,ports,now});
  const result=await app.handle(new Request('https://synthetic.invalid/api/uploads/status'));
  assert.equal(result.status,503);assert.deepEqual(await result.json(),{error:{code:'UPLOAD_UNAVAILABLE',outcome:'NOT_DISPATCHED'}});
 }
});
test('exact original removal honors current holds and requires native absence after the delete attempt',async()=>{
 const object={objectId:id(3),versionId:'original-version',sha256:'a'.repeat(64),scopes:[]};
 const run=async({held=false,current=false,after='ABSENT',before='PRESENT'}={})=>{
  const calls=[];let reads=0;
  const remove=createUploadOriginalRemoval({keyFor(value){calls.push(['key',value]);return 'original-key';},
   async headVersion(value){calls.push(['head',value]);return {outcome:reads++?after:before};},
   async holdsFor(value){calls.push(['hold',value]);return {legalHold:held,objectLockRetainUntilMs:null};},
   async deleteVersion(value){calls.push(['delete',value]);return {outcome:'UNKNOWN'};}},now);
  const operation=remove({object,deadlineMs:now()+1000,assertCurrent:async()=>{calls.push(['current']);if(current)throw Error('CURRENT_DENIED');}});
  if(held)await assert.rejects(operation,/HELD/);else if(current)await assert.rejects(operation,/CURRENT_DENIED/);
  else if(before==='UNKNOWN'||after==='UNKNOWN'&&before!=='ABSENT')await assert.rejects(operation,/UNCERTAIN/);
  else assert.deepEqual(await operation,{deleted:true,objectId:id(3),versionId:'original-version'});
  return calls;
 };
 for(const opts of [{held:true},{current:true},{before:'UNKNOWN'},{before:'ABSENT'}])assert.equal((await run(opts)).filter(x=>x[0]==='delete').length,0);
 for(const opts of [{},{after:'UNKNOWN'}]){const calls=await run(opts);assert.equal(calls.filter(x=>x[0]==='delete').length,1);assert.deepEqual(calls.find(x=>x[0]==='delete')[1],{key:'original-key',versionId:'original-version'});assert.equal(calls.at(-3)[0],'current');}
});
