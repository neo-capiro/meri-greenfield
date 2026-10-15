import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConfiguration} from '../../config.mjs';
import {assembleControl} from '../../control.mjs';
import {candidateFixture} from '../../test/prepared-candidate-fixture.mjs';

const control=telemetry=>{const {configuration}=candidateFixture();return telemetry===undefined?configuration:{...configuration,telemetry};};
test('the optional control telemetry block accepts an https collector origin, interval and service name, or an explicit disable',()=>{
 for(const telemetry of [undefined,{enabled:true,endpoint:'https://collector.synthetic.invalid'},{enabled:false,endpoint:'https://collector.synthetic.invalid'},{enabled:true,endpoint:'https://collector.synthetic.invalid:4318',exportIntervalMs:1000,serviceName:'meri-control-preview'}])
  assert.doesNotThrow(()=>validateConfiguration(control(telemetry),'control'));
});
test('telemetry refuses unknown keys, non-origin or plaintext endpoints, bad intervals and names, and every other role',()=>{
 const base={enabled:true,endpoint:'https://collector.synthetic.invalid'};
 for(const telemetry of [{...base,enabled:'true'},{...base,headers:{authorization:'x'}},{enabled:true},{...base,endpoint:'https://collector.synthetic.invalid/v1/traces'},{...base,endpoint:'https://user:pw@collector.synthetic.invalid'},{...base,endpoint:'http://127.0.0.1:4318'},{...base,endpoint:'http://collector.synthetic.invalid'},{...base,exportIntervalMs:999},{...base,exportIntervalMs:300001},{...base,serviceName:'Meri Control'}])
  assert.throws(()=>validateConfiguration(control(telemetry),'control'),/TELEMETRY_CONFIGURATION|RUNTIME_CONFIGURATION|INVALID_COMMAND/u,JSON.stringify(telemetry));
 const {configuration}=candidateFixture(),{native,http,temporal,version,profile,sourceEnabled,limits}=configuration;
 assert.throws(()=>validateConfiguration({native,http,temporal,version,profile,sourceEnabled,limits,telemetry:base},'temporal-worker'),/RUNTIME_CONFIGURATION|INVALID_COMMAND|TELEMETRY_CONFIGURATION/u);
});
test('a loopback http collector is accepted only with the existing loopback declaration',()=>{
 const c=control({enabled:true,endpoint:'http://127.0.0.1:4318'});c.native={...c.native,loopback:true,origin:'http://127.0.0.1:9'};
 assert.doesNotThrow(()=>validateConfiguration(c,'control'));
});
test('assembleControl refuses a telemetry port without the run-owner hook before composing anything',()=>{
 assert.throws(()=>assembleControl({configuration:{},pool:{},client:{},native:{},telemetry:{}}),/TELEMETRY_CONFIGURATION/u);
});
