import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {main} from '../cli.mjs';
import {validateConfiguration} from '../config.mjs';
import {binding,versions} from '../../control/conversations/test/application-fixture.mjs';
import {candidateFixture} from './prepared-candidate-fixture.mjs';

test('product runner CLI refuses absent or incorrect measured entrypoint pin before runtime startup',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'meri-runner-pin-')),file=join(directory,'task.json'),previous=process.env.MERI_RUNNER_SHA256,write=process.stderr.write;
 let diagnostic='';
 try{
  const configured={version:1,profile:'isolated-preview',sourceEnabled:false,
   limits:{startupMs:3000,shutdownMs:1000,requestMs:1000,requestBytes:131072},
   native:{origin:'https://native.example.invalid',capabilityFile:join(directory,'task-capability'),loopback:false,maxResponseBytes:131072},
   binding,versions,workspace:directory.replaceAll('\\','/')+'/workspace/'+binding.conversationId,proxyOrigin:'https://proxy.example.invalid',
   captureOwnsClose:true,bootstrap:{expiresAtMs:Date.now()+30000,remote:true}};
  assert.doesNotThrow(()=>validateConfiguration(configured,'conversation-runner'));
  await writeFile(file,JSON.stringify(configured));
  process.stderr.write=value=>{diagnostic+=value;return true;};
  delete process.env.MERI_RUNNER_SHA256;
  assert.equal(await main(['conversation-runner','--config',file]),2);
  assert.equal(diagnostic,'RUNTIME_CONFIGURATION\n');
  diagnostic='';process.env.MERI_RUNNER_SHA256='0'.repeat(64);
  assert.equal(await main(['conversation-runner','--config',file]),2);
  assert.equal(diagnostic,'RUNTIME_CONFIGURATION\n');
 }finally{process.stderr.write=write;if(previous===undefined)delete process.env.MERI_RUNNER_SHA256;else process.env.MERI_RUNNER_SHA256=previous;await rm(directory,{recursive:true,force:true});}
});
test('product control task definition requires split private listener before secret or network startup',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'meri-private-control-')),file=join(directory,'control.json'),previous=process.env.MERI_PRODUCT_PREVIEW_REQUIRED,write=process.stderr.write;
 let diagnostic='';
 try{
  const configuration=structuredClone(candidateFixture().configuration);
  delete configuration.nativeCandidate;
  configuration.native.capabilityFile=join(directory,'native');configuration.database.connectionFile=join(directory,'database');
  configuration.temporal.tls={caFile:join(directory,'ca'),certFile:join(directory,'cert'),keyFile:join(directory,'key')};
  assert.doesNotThrow(()=>validateConfiguration(configuration,'control'));
  await writeFile(file,JSON.stringify(configuration));
  process.stderr.write=value=>{diagnostic+=value;return true;};
  process.env.MERI_PRODUCT_PREVIEW_REQUIRED='1';
  assert.equal(await main(['control','--config',file]),2);
  assert.equal(diagnostic,'RUNTIME_CONFIGURATION\n');
  diagnostic='';process.env.MERI_PRODUCT_PREVIEW_REQUIRED='0';
  assert.equal(await main(['control','--config',file]),2);
  assert.equal(diagnostic,'RUNTIME_CONFIGURATION\n');
 }finally{process.stderr.write=write;if(previous===undefined)delete process.env.MERI_PRODUCT_PREVIEW_REQUIRED;else process.env.MERI_PRODUCT_PREVIEW_REQUIRED=previous;await rm(directory,{recursive:true,force:true});}
});
