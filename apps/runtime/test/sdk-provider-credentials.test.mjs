import test from 'node:test';import assert from 'node:assert/strict';
import {createSdkProviderCredentials} from '../sdk-provider-credentials.mjs';
const secretArn='arn:aws:secretsmanager:us-east-1:967807252336:secret:synthetic/claude-key-abcdef';
const key='sk-ant-synthetic-test-key-never-a-credential';
test('runtime reads only the configured current secret and accepts its raw or single-key JSON representation',async()=>{
 for(const SecretString of [key,JSON.stringify({ANTHROPIC_API_KEY:key})]){
  const controller=new AbortController();let calls=0;
  const owner=createSdkProviderCredentials({secretArn,client:{async send(command,options){calls++;assert.equal(command.constructor.name,'GetSecretValueCommand');assert.deepEqual(command.input,{SecretId:secretArn,VersionStage:'AWSCURRENT'});assert.equal(options.abortSignal,controller.signal);return {ARN:secretArn,SecretString};},destroy(){assert.fail('borrowed client');}}});
  assert.equal(await owner.read({signal:controller.signal}),key);assert.equal(calls,1);owner.close();await assert.rejects(owner.read(),/CLAUDE_API_CREDENTIAL_UNAVAILABLE/);
 }
});
test('unconfigured, foreign or malformed values cannot become a provider credential or leak in errors',async()=>{
 await assert.rejects(createSdkProviderCredentials().read(),/CLAUDE_API_CREDENTIAL_UNAVAILABLE/);
 for(const arn of ['foreign',secretArn.replace('967807252336','111111111111')])assert.throws(()=>createSdkProviderCredentials({secretArn:arn}),/CLAUDE_API_CREDENTIAL_UNAVAILABLE/);
 for(const result of [{ARN:'other',SecretString:key},{ARN:secretArn,SecretBinary:new Uint8Array([1])},{ARN:secretArn,SecretString:'INVALID_PRIVATE_VALUE'},{ARN:secretArn,SecretString:JSON.stringify({ANTHROPIC_API_KEY:key,extra:key})},{ARN:secretArn,SecretString:'{PRIVATE'}]){
  const owner=createSdkProviderCredentials({secretArn,client:{async send(){return result;}}});
  await assert.rejects(owner.read(),e=>e.message==='CLAUDE_API_CREDENTIAL_UNAVAILABLE'&&!JSON.stringify(e).includes('PRIVATE'));owner.close();
 }
 const owner=createSdkProviderCredentials({secretArn,client:{async send(){throw Error(key);}}});await assert.rejects(owner.read(),e=>!e.stack.includes(key));owner.close();
});
test('cancellation before or during retrieval and closed-owner races never release a key',async()=>{
 let calls=0;const controller=new AbortController();controller.abort();
 const first=createSdkProviderCredentials({secretArn,client:{async send(){calls++;return {ARN:secretArn,SecretString:key};}}});await assert.rejects(first.read({signal:controller.signal}));assert.equal(calls,0);first.close();
 for(const cancellation of ['abort','close']){
  let resolve;const pending=new Promise(r=>{resolve=r;});const signal=new AbortController();
  const owner=createSdkProviderCredentials({secretArn,client:{send(){return pending;}}});const reading=owner.read({signal:signal.signal});
  if(cancellation==='abort')signal.abort();else owner.close();resolve({ARN:secretArn,SecretString:key});await assert.rejects(reading);owner.close();
 }
});
