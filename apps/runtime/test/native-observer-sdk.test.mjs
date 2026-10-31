import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeObserverSession} from '../native-observer-sdk.mjs';
function factory(log,identity={Account:'111122223333',Arn:'arn:aws:sts::111122223333:assumed-role/control/session',UserId:'role:session'}){
 return async configuration=>Object.fromEntries(['sts','ec2','sfn'].map(kind=>[kind,{sdk:Object.fromEntries(
  ['GetCallerIdentity','DescribeInstances','TerminateInstances','DescribeExecution'].map(api=>[`${api}Command`,class{constructor(input){this.input=input;this.api=api;}}])),
 client:{destroy(){log.push({kind,closed:true});},async send(command){log.push({kind,configuration,command});
  return kind==='sts'?identity:{$metadata:{requestId:'request-12345678',httpStatusCode:200}};}}}]));
}
test('STS/EC2/history use the exact same resolved snapshot; no effect before actual identity authentication',async()=>{
 const log=[];let resolutions=0;
 const session=await createNativeObserverSession({accountId:'111122223333',region:'us-east-1',deadlineMs:26000,now:()=>1000,
  resolveCredentials:async()=>{resolutions++;return {accessKeyId:'fixture-key',secretAccessKey:'fixture-secret',sessionToken:'fixture-token'};},
  createClients:factory(log)});
 await assert.rejects(session.send({api:'TerminateInstances',input:{InstanceIds:['i-11111111']}}));
 assert.equal(log.length,0);
 await session.send({api:'GetCallerIdentity',input:{}});
 await session.send({api:'DescribeInstances',input:{InstanceIds:['i-11111111']}});
 await session.send({api:'DescribeExecution',input:{executionArn:'fixture'}});
 assert.equal(resolutions,1);assert.strictEqual(log[0].configuration.credentials,log[1].configuration.credentials);
 assert.strictEqual(log[1].configuration.credentials,log[2].configuration.credentials);
 assert.equal(Object.hasOwn(session,'credentials'),false);session.close();assert.equal(log.filter(x=>x.closed).length,3);
});
test('original deadline/credential expiry and parent cancellation forbid subsequent requests',async()=>{
 let now=1000;const log=[],controller=new AbortController();
 const session=await createNativeObserverSession({accountId:'111122223333',region:'us-east-1',deadlineMs:26000,now:()=>now,
  signal:controller.signal,resolveCredentials:async()=>({accessKeyId:'fixture',secretAccessKey:'fixture',expiration:new Date(2000)}),createClients:factory(log)});
 await session.send({api:'GetCallerIdentity',input:{}});now=2000;
 await assert.rejects(session.send({api:'DescribeInstances',input:{}}));assert.equal(log.length,1);
 now=1500;controller.abort();await assert.rejects(session.send({api:'DescribeInstances',input:{}}));assert.equal(log.length,1);session.close();
});
test('foreign actual STS principal never opens EC2 access',async()=>{
 const log=[],s=await createNativeObserverSession({accountId:'111122223333',region:'us-east-1',deadlineMs:26000,now:()=>1000,
  resolveCredentials:async()=>({accessKeyId:'fixture',secretAccessKey:'fixture'}),createClients:factory(log,
   {Account:'111122223333',Arn:'arn:aws:sts::444455556666:assumed-role/foreign/session',UserId:'foreign'})});
 await assert.rejects(s.send({api:'GetCallerIdentity',input:{}}));
 await assert.rejects(s.send({api:'DescribeInstances',input:{}}));assert.equal(log.length,1);s.close();
});
