/** Actual CLI sequencing; configuration file I/O, CA filesystem readback and service allocation are synthetic. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import * as config from '../config.mjs';
import * as trust from '../control-ca-bundle.mjs';
import {agentcoreControlFixture} from './agentcore-fixture.mjs';

const base=agentcoreControlFixture().configuration;
const configuration={version:1,profile:'isolated-preview',sourceEnabled:false,versions:base.versions,
 limits:{startupMs:30000,shutdownMs:1000,requestMs:25000,requestBytes:131072},
 http:{hostname:'0.0.0.0',port:8083,frontendOrigin:'https://ui.synthetic.invalid'},
 temporal:{address:'temporal.synthetic.invalid:7233',namespace:'meri',taskQueue:'meri-schedules',tls:{caFile:'/run/meri/temporal-ca.pem',certFile:'/run/meri/temporal-client.pem',keyFile:'/run/meri/temporal-client.key'}},
 scheduledDispatch:{enabled:true,conversationTaskQueue:'meri-conversations',maxConcurrentActivities:1},
 database:{connectionFile:'/run/meri/database.uri'},
 native:{origin:'https://control.synthetic.invalid',capabilityFile:'/run/meri/control-capability',serverCaFile:'/run/meri/control-ca.pem',serverCaSha256:'a'.repeat(64),loopback:false,maxResponseBytes:131072},
 routines:{enabled:true,core:{origin:'https://core.synthetic.invalid',serviceSecretFile:'/run/meri/core-service-secret',unattendedGrant:{issuer:'synthetic:core',kid:'fire',publicKey:generateKeyPairSync('ed25519').publicKey.export({format:'jwk'})}}}};
let events,refuseCa;
mock.module('../config.mjs',{namedExports:{...config,async loadConfiguration(_path,role){return config.validateConfiguration(configuration,role);}}});
mock.module('../control-ca-bundle.mjs',{namedExports:{...trust,async verifyControlCaBundle(c){
 events.push('verify-ca');assert.deepEqual(c,configuration);
 if(refuseCa)throw Object.assign(Error('synthetic missing or modified CA'),{code:'STATIC_INIT_CONTROL_CA_REFUSED'});
}}});
mock.module('../schedule-service.mjs',{namedExports:{async startScheduleWorker(c,{runtimePortsFactory}){
 events.push('start-service');assert.deepEqual(c,configuration);assert.equal(typeof runtimePortsFactory,'function');
 return {address:{port:8083},completion:Promise.resolve(),async close(){events.push('close');}};
}}});
const {main}=await import('../cli.mjs');

async function run(ca,{refused=false}={}){
 const priorProduct=process.env.MERI_PRODUCT_PREVIEW_REQUIRED,priorCa=process.env.NODE_EXTRA_CA_CERTS;
 const stdout=process.stdout.write,stderr=process.stderr.write;let diagnostic='';events=[];refuseCa=refused;
 try{
  process.env.MERI_PRODUCT_PREVIEW_REQUIRED='1';process.env.NODE_EXTRA_CA_CERTS=ca;
  process.stdout.write=()=>true;process.stderr.write=value=>{diagnostic+=value;return true;};
  return {exit:await main(['schedule-worker','--config','/run/meri/schedule-worker.json']),events,diagnostic};
 }finally{
  process.stdout.write=stdout;process.stderr.write=stderr;
  for(const [key,value] of [['MERI_PRODUCT_PREVIEW_REQUIRED',priorProduct],['NODE_EXTRA_CA_CERTS',priorCa]])if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
}
test('Schedule verifies composite bytes before allocating owners, database or Temporal resources',async()=>{
 assert.deepEqual(await run(trust.CONTROL_NODE_CA_FILE),{exit:0,events:['verify-ca','start-service','close'],diagnostic:''});
 assert.deepEqual(await run(trust.CONTROL_NODE_CA_FILE,{refused:true}),{exit:2,events:['verify-ca'],diagnostic:'RUNTIME_CONFIGURATION\n'});
});
test('Schedule refuses the former private-only trust environment before starting its service',async()=>{
 assert.deepEqual(await run(configuration.native.serverCaFile),{exit:2,events:['verify-ca'],diagnostic:'RUNTIME_CONFIGURATION\n'});
});
