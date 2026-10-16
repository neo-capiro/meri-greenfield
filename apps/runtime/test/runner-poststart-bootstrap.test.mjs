import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {binding,versions} from '../../control/conversations/test/store-fixture.mjs';
import {runRunnerPoststart} from '../runner-poststart-bootstrap.mjs';
const ca=Buffer.from('synthetic public CA bytes'),caSha=createHash('sha256').update(ca).digest('hex'),taskArn='arn:aws:ecs:us-east-1:967807252336:task/test/'+'a'.repeat(32),metadata={TaskARN:taskArn,Cluster:'arn:aws:ecs:us-east-1:967807252336:cluster/test',Containers:[{Name:'worker'}]},original=createExecutionBinding({binding,versions,plan:{test:'poststart-client'},expiresAtMs:Date.now()+60000});
const expected={binding,taskArn,taskRevision:1,expiresAtMs:original.expiresAtMs,versions,origin:'https://control.invalid',san:['control.invalid'],caSha256:caSha,capabilitySha256:'c'.repeat(64),materialRef:'material:'+original.executionKey,bootstrapRef:'d'.repeat(64)};
const result={schemaVersion:1,original,expected,delivery:{...expected,capability:'synthetic-secret',config:{},ca:ca.toString('base64')},tls:{zone:'runner.invalid',ca:ca.toString('base64'),cert:ca.toString('base64'),candidate:{taskArn,executionKey:original.executionKey,bindingSha256:hash(binding),expiresAtMs:original.expiresAtMs}}};
const config={origin:'https://control.invalid',controlCaBase64:ca.toString('base64'),controlCaSha256:caSha,metadataUri:'http://169.254.170.2/v4/synthetic',directory:'/run/meri/poststart',maxStartupMs:2000};
function fixture(post){let writes=0,releases=0;return {dependencies:{async readMetadata(){return metadata;},createTransport(){return {post};},createCsr(){return {csrPem:'synthetic CSR',keyPem:'synthetic private key',signProof:message=>{assert.equal(message.toString(),'synthetic challenge nonce is long');return 'synthetic-proof';}};},async createDirectory(){return {dev:1,ino:2,uid:1000};},async writeTls(){writes++;return {descriptor:{zone:'runner.invalid',caFile:'/run/meri/poststart/tls/ca',certFile:'/run/meri/poststart/tls/cert',keyFile:'/run/meri/poststart/tls/key',candidateFile:'/run/meri/poststart/tls/candidate',metadataFile:'/run/meri/poststart/tls/metadata'},receipt:{directory:{path:'/run/meri/poststart/tls',dev:1,ino:3,uid:1000},files:[]}};},async materialize(){writes++;return {configFile:'/run/meri/poststart/bootstrap/runner-config.json',caFile:'/run/meri/poststart/bootstrap/control-ca.pem',receipt:{directory:{path:'/run/meri/poststart/bootstrap',dev:1,ino:4,uid:1000},files:[]}};},async release(){releases++;}},counts:()=>({writes,releases})};}
const pending=()=>Object.assign(Error('RUNNER_POSTSTART_PENDING'),{code:'RUNNER_POSTSTART_PENDING'});
const challenge={schemaVersion:1,challengeId:'11111111-1111-4111-8111-111111111111',proofMessage:Buffer.from('synthetic challenge nonce is long').toString('base64'),expiresAtMs:Date.now()+15000};
test('pre-CLI retries only authenticated pending challenge, then writes local files',async()=>{
 let calls=0;const deadlines=[];const f=fixture(async(step,body,{deadlineMs})=>{calls++;deadlines.push(deadlineMs);if(step==='challenge'){if(calls===1)throw pending();assert.equal(body.taskArn,taskArn);return challenge;}assert.equal(step,'redeem');assert.equal(body.proofBase64,'synthetic-proof');return result;});
 const resolved=await runRunnerPoststart(config,f.dependencies);assert.equal(calls,3);assert.ok(deadlines.every(value=>value>0&&value<=config.maxStartupMs));assert.ok(deadlines[2]<=deadlines[0]);assert.equal(resolved.configFile,'/run/meri/poststart/bootstrap/runner-config.json');assert.equal(resolved.controlCaFile,'/run/meri/poststart/bootstrap/control-ca.pem');assert.equal(resolved.tls.zone,'runner.invalid');assert.equal(f.counts().writes,2);
});
test('redeem refusal and wrong static CA hash never write files or retry',async()=>{
 let calls=0;const f=fixture(async step=>{calls++;if(step==='challenge')return challenge;throw Error('denied');});
 await assert.rejects(runRunnerPoststart(config,f.dependencies));assert.equal(calls,2);assert.equal(f.counts().writes,0);
 await assert.rejects(runRunnerPoststart({...config,controlCaSha256:'0'.repeat(64)},f.dependencies));assert.equal(calls,2);
});
test('incomplete material write calls exact cleanup and reports failure',async()=>{
 const f=fixture(async step=>step==='challenge'?challenge:result);f.dependencies.materialize=async()=>{throw Error('write failed');};
 await assert.rejects(runRunnerPoststart(config,f.dependencies),/write failed/);assert.equal(f.counts().releases,1);
});
