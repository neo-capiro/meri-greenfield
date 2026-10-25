/** Actual CLI startup wiring with synthetic configuration and borrowed module boundaries; no listener, secret or SQL effects. */
import test,{mock} from 'node:test';import assert from 'node:assert/strict';
import * as configurationModule from '../config.mjs';
import {agentcoreControlFixture} from './agentcore-fixture.mjs';
import {PROPOSED_PREVIEW_CAPABILITY_PLATFORM} from '../product-ports/capability-policy.mjs';
const state={};
mock.module('../config.mjs',{namedExports:{...configurationModule,async loadConfiguration(){return state.configuration;},async readSecret(){assert.fail('CLI must not read policy/settings material');}}});
mock.module('../read-credential-relay.mjs',{namedExports:{createReadCredentialRelay(){return {port:{nativeCredentialFor(){assert.fail('no credential at composition');}}};}}});
mock.module('../reads-composer.mjs',{namedExports:{async createControlReadsComposer(options){state.composer.push(options);if(state.failure)throw Error('synthetic composition failure');const value={createReadsRuntime(){},familyIds:[],missing:state.missing??[]};state.returned.push(value);return value;}}});
mock.module('../native-authority/routines-owner-composition.mjs',{namedExports:{createAttendedRoutinesOwnerComposition(){let bound=false,missing=false;return {bindCandidate(value){bound=true;missing=value==='missing';},state(){assert.equal(bound,true,'warning requires candidate binding first');return missing?'owners-unavailable':'composed';}};}}});
mock.module('../control.mjs',{namedExports:{async startControl(configuration,ports){state.control.push(ports);ports.routinesCandidateBinder?.(state.candidate);return {address:{port:0},completion:Promise.resolve(),async close(){}};}}});
const {main}=await import('../cli.mjs');
async function start(extra={},options={}){
 Object.assign(state,{configuration:{...agentcoreControlFixture().configuration,...extra},composer:[],returned:[],control:[],failure:false,missing:[],candidate:{},...options});
 const out=[],err=[],writeOut=process.stdout.write,writeErr=process.stderr.write;
 process.stdout.write=value=>{out.push(String(value));return true;};process.stderr.write=value=>{err.push(String(value));return true;};
 try{return {code:await main(['control','--config','synthetic-config']),out:out.join(''),err:err.join('')};}
 finally{process.stdout.write=writeOut;process.stderr.write=writeErr;}
}
test('CLI leaves canonical policy construction to the runtime pool/current-role owner and forwards the actual reads factory',async()=>{
 const result=await start({capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM,reads:{enabled:true,serviceSecretFile:'/synthetic/core',defaultCongress:119}});
 assert.equal(result.code,0,result.err);assert.equal(state.composer.length,1);const options=state.composer[0];
 assert.equal(Object.hasOwn(options,'capabilityPolicy'),false,'no static configuration-only policy may enter discovery');
 assert.equal(options.coreOrigin,state.configuration.agentcore.identity.origin);assert.equal(options.serviceSecretFile,'/synthetic/core');assert.equal(options.defaultCongress,119);
 assert.equal(state.control[0].createReadsRuntime,state.returned[0].createReadsRuntime);
});
test('disabled reads create no composer; missing family diagnostics retain their declared reason',async()=>{
 assert.equal((await start({reads:{enabled:false}})).code,0);assert.equal(state.composer.length,0);assert.equal(state.control[0].createReadsRuntime,undefined);
 const r=await start({reads:{enabled:true,serviceSecretFile:'/synthetic/core'}},{missing:['source-composition:synthetic']});
 assert.equal(r.code,0);assert.match(r.err,/runtime.reads.unavailable/);assert.match(r.err,/source-composition:synthetic/);
});
test('reads composition failure cannot start control with an unbound policy',async()=>{
 const r=await start({reads:{enabled:true,serviceSecretFile:'/synthetic/core'}},{failure:true});assert.equal(r.code,3);assert.equal(state.control.length,0);assert.match(r.err,/RUNTIME_UNAVAILABLE/);
});
test('routines warning is evaluated after candidate binding and only for missing attended owners',async()=>{
 for(const candidate of [{},'missing']){
  const r=await start({routines:{enabled:true,workflow:{}}},{candidate});assert.equal(r.code,0,r.err);
  assert.equal(typeof state.control[0].routinesCandidateBinder,'function');assert.equal(r.err.includes('runtime.routines.attended.unavailable'),candidate==='missing');
 }
});