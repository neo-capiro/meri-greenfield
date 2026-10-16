/** SYNTHETIC composition census; no infrastructure allocation or live owner qualification. */
import test from 'node:test';import assert from 'node:assert/strict';
import {productReadiness} from '../product-readiness.mjs';
test('missing owners are individually named and schedule registration remains placement-pending',()=>{
 const result=productReadiness({ports:{configuredOwners:['identityContext']},retention:null,sourceEnabled:false});
 assert.equal(result.ready,false);for(const name of ['lifecycle.currentAuthority','lifecycle.admissionRetirement','lifecycle.approvals','actions.application','history.membership','history.nextTurn','proxy.modelGrants'])assert.ok(result.missingOwners.includes(name));
 assert.equal(result.owners.find(o=>o.name==='sources.currentInstallation').state,'disabled');
 assert.equal(result.owners.find(o=>o.name==='schedules.dispatchWorker').state,'unregistered-placement-pending');
 assert.ok(Object.isFrozen(result.owners));
});
test('composed owners do not conceal remaining source, model grant or placement gaps',()=>{
 const result=productReadiness({ports:{configuredOwners:['identityContext','transitionAuthority','continuationAdmission','approvals','artifactOptionsOwner','artifactStore','actionApplication','selectedController','sdkSessionOwner','sdkSessionSnapshot','conversationMembership','conversationTurns','retentionLedgerSink']},retention:{},sourceEnabled:true});
 assert.equal(result.ready,false);assert.deepEqual(result.missingOwners,['sources.currentInstallation','proxy.modelGrants','schedules.dispatchWorker']);
});
