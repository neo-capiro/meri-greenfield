import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {main,productWorkerTrustsPinnedServerCa} from '../cli.mjs';
import {validateConfiguration} from '../config.mjs';
import {agentcoreControlFixture} from './agentcore-fixture.mjs';

async function refused(role,configuration,{product='1',valid=true}={}){
 const directory=await mkdtemp(join(tmpdir(),'meri-product-startup-')),file=join(directory,'config.json');
 const previous=process.env.MERI_PRODUCT_PREVIEW_REQUIRED,write=process.stderr.write;let diagnostic='';
 try{
  if(valid)assert.doesNotThrow(()=>validateConfiguration(configuration,role));
  await writeFile(file,JSON.stringify(configuration));
  process.stderr.write=value=>{diagnostic+=value;return true;};
  process.env.MERI_PRODUCT_PREVIEW_REQUIRED=product;
  assert.equal(await main([role,'--config',file]),2);
  assert.equal(diagnostic,'RUNTIME_CONFIGURATION\n');
 }finally{process.stderr.write=write;if(previous===undefined)delete process.env.MERI_PRODUCT_PREVIEW_REQUIRED;else process.env.MERI_PRODUCT_PREVIEW_REQUIRED=previous;await rm(directory,{recursive:true,force:true});}
}
function worker(){return {version:1,profile:'isolated-preview',sourceEnabled:false,
 limits:{startupMs:3000,shutdownMs:1000,requestMs:1000,requestBytes:131072},
 native:{origin:'https://control.synthetic.invalid',capabilityFile:'/run/meri/native',loopback:false,maxResponseBytes:131072,preparedKickoff:true},
 http:{hostname:'0.0.0.0',port:8081,frontendOrigin:'https://frontend.synthetic.invalid'},
 temporal:{address:'temporal.synthetic.invalid:7233',namespace:'meri',taskQueue:'meri',tls:{caFile:'/run/meri/ca',certFile:'/run/meri/cert',keyFile:'/run/meri/key'}}};}

test('removed conversation runner role is rejected before file material or runtime startup',async()=>{
 await refused('conversation-runner',{}, {valid:false});
});
test('product control requires its split private listener before secret or network startup',async()=>{
 const configuration=structuredClone(agentcoreControlFixture().configuration);delete configuration.privateHttp;
 await refused('control',configuration);
 await refused('control',configuration,{product:'0'});
});
test('product Temporal poller refuses a loopback native origin before secret or network startup',async()=>{
 const configuration=worker();configuration.native.origin='http://127.0.0.1';configuration.native.loopback=true;
 await refused('temporal-worker',configuration);
});
test('product Temporal poller refuses missing private control CA trust before secret or network startup',async()=>{
 await refused('temporal-worker',worker());
});
test('product Temporal poller trusts only the configured private control CA loaded before Node startup',()=>{
 const c={native:{serverCaFile:'/run/meri/control-ca.pem',serverCaSha256:'a'.repeat(64)}};
 assert.equal(productWorkerTrustsPinnedServerCa(c,{NODE_EXTRA_CA_CERTS:'/run/meri/control-ca.pem'}),true);
 for(const value of [undefined,'','/opt/meri/certs/rds-global-bundle.pem','/run/meri/client-ca.pem','/tmp/control-ca.pem'])
  assert.equal(productWorkerTrustsPinnedServerCa(c,value===undefined?{}:{NODE_EXTRA_CA_CERTS:value}),false,String(value));
 for(const serverCaFile of [undefined,'/run/meri/../etc/ca.pem','/run/meri/nested/ca.pem','/run/meri/ca.crt'])
  assert.equal(productWorkerTrustsPinnedServerCa({native:{serverCaFile}},{NODE_EXTRA_CA_CERTS:serverCaFile}),false,String(serverCaFile));
 assert.equal(productWorkerTrustsPinnedServerCa({temporal:{}},{NODE_EXTRA_CA_CERTS:'/run/meri/control-ca.pem'}),false);
});
