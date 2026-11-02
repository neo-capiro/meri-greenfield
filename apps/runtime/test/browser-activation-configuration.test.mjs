/** The browser activation record as control configuration (config.mjs `browserActivation`): accepted shapes, the
 * open-needs-router rule, and role scoping. Pure validation; no owner is constructed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConfiguration} from '../config.mjs';
import {agentcoreControlFixture} from './agentcore-fixture.mjs';
import {EGRESS_REQUIREMENTS_SHA256,HELD_BROWSER_ACTIVATION,BROWSER_ACTIVATION_RENDER_VERIFICATION,compileBrowserActivation,activationOpen} from '../../worker/conversation/browser/activation.mjs';

const tls={privateClient:{clientName:'control.private.invalid',certFile:'/run/meri/native-control-client.pem',keyFile:'/run/meri/native-control-client.key',caFile:'/run/meri/native-issuer-ca.pem'}};
const OPEN=Object.freeze({state:'open',evidence:'docs/qualification/browser-egress/BROWSER-EGRESS-EVIDENCE-20261101.md',evidenceSha256:'a'.repeat(64),requirementsSha256:EGRESS_REQUIREMENTS_SHA256,
 renderVerification:Object.freeze({schema:BROWSER_ACTIVATION_RENDER_VERIFICATION,sourceCommit:'0'.repeat(40),renderedAtMs:1,evidenceSha256:'a'.repeat(64),requirementsSha256:EGRESS_REQUIREMENTS_SHA256})});
const control=()=>structuredClone(agentcoreControlFixture().configuration);

test('absent and held records validate; an open record needs the browser-host family it routes through',()=>{
 const c=control();
 assert.doesNotThrow(()=>validateConfiguration(c,'control'));
 c.browserActivation={state:'held'};assert.doesNotThrow(()=>validateConfiguration(c,'control'));
 c.browserActivation=structuredClone(OPEN);
 assert.throws(()=>validateConfiguration(c,'control'),{code:'BROWSER_ACTIVATION_CONFIGURATION'},'open without a router cannot leave every run failing at browser preparation');
 c.browserHosts={enabled:false};assert.throws(()=>validateConfiguration(c,'control'),{code:'BROWSER_ACTIVATION_CONFIGURATION'});
 c.browserHosts={enabled:true,tls};assert.doesNotThrow(()=>validateConfiguration(c,'control'));
 // The router alone never opens anything: held plus a router is an ordinary held control.
 c.browserActivation={state:'held'};assert.doesNotThrow(()=>validateConfiguration(c,'control'));
 assert.equal(activationOpen(compileBrowserActivation(c.browserActivation)),false);
});

test('malformed records refuse at configuration time instead of silently holding, and only control carries the key',()=>{
 const {renderVerification,...unverified}=OPEN;
 for(const bad of [{state:'open'},unverified,{...OPEN,renderVerification:{...renderVerification,schema:'other/1'}},{...OPEN,renderVerification:{...renderVerification,sourceCommit:'short'}},{...OPEN,renderVerification:{...renderVerification,evidenceSha256:'b'.repeat(64)}},{...OPEN,evidenceSha256:'b'.repeat(64)},{...OPEN,requirementsSha256:'b'.repeat(64)},{...OPEN,evidenceSha256:'nope'},{...OPEN,evidence:'../x'},{state:'held',evidence:'x'},{state:'opened'},true,null]){
  const c=control();c.browserHosts={enabled:true,tls};c.browserActivation=bad;
  assert.throws(()=>validateConfiguration(c,'control'),{code:'BROWSER_ACTIVATION_CONFIGURATION'},JSON.stringify(bad));
 }
 const worker={version:1,profile:'isolated-preview',sourceEnabled:false,limits:{startupMs:3000,shutdownMs:1000,requestMs:1000,requestBytes:131072},
  native:{origin:'https://control.synthetic.invalid',capabilityFile:'/run/secrets/control',loopback:false,maxResponseBytes:2097152,preparedKickoff:true},
  http:{hostname:'0.0.0.0',port:8081,frontendOrigin:'https://frontend.synthetic.invalid'},
  temporal:{address:'temporal.synthetic.invalid:7233',namespace:'meri-first',taskQueue:'meri-v1',tls:{caFile:'/run/secrets/ca',certFile:'/run/secrets/cert',keyFile:'/run/secrets/key'}},
  browserActivation:{state:'held'}};
 assert.throws(()=>validateConfiguration(worker,'temporal-worker'),'the worker never carries the record; control owns it');
 assert.equal(compileBrowserActivation(undefined),HELD_BROWSER_ACTIVATION);
});
