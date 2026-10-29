/** F1: the actual SDK general-read mount accepts the trusted port that also carries external usage
 * accounting, including when no primary search is configured, and refuses a malformed one. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGeneralReadRuntime} from '../runtime.mjs';
import {binding,scopes,id} from '../../../../../control/conversations/test/store-fixture.mjs';
import catalog from '../../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';

const base = extra => ({binding, scopes, policy: {generalReads: true, readFamilies: [], activeReadOperations: []},
  now: () => Date.now(), deadlineMs: Date.now() + 60000, mount: 'profile', ...extra});
const methodPort = () => Object.freeze({async readAvailability() { throw Error('not called'); }, async execute() { throw Error('not called'); }});

test('a port carrying externalUsage mounts instead of being rejected', async () => {
  const withUsage = Object.freeze({...methodPort(), externalUsage: () => undefined});
  // Accepting the port is the assertion: the mount proceeds (null here only because no reads are active),
  // whereas before this join the closed own() refused the port and threw READ_CONFIGURATION.
  const mounted = await createGeneralReadRuntime(base({port: withUsage}));
  assert.equal(mounted, null);
  const plain = await createGeneralReadRuntime(base({port: methodPort()}));
  assert.equal(plain, null);
});

test('the same port is accepted when the run has no general reads at all', async () => {
  const withUsage = Object.freeze({...methodPort(), externalUsage: () => undefined});
  const disabled = await createGeneralReadRuntime(base({port: withUsage,
    policy: {generalReads: false, readFamilies: [], activeReadOperations: []}}));
  assert.equal(disabled, null, 'primary-disabled behaviour is unchanged');
});

test('a malformed optional method is refused', async () => {
  const broken = Object.freeze({...methodPort(), externalUsage: 1});
  await assert.rejects(() => createGeneralReadRuntime(base({port: broken})), /READ_CONFIGURATION/u);
});

test('an enabled mount with one active read builds the real runtime from the real client port', async () => {
 const operation={id:'query_tasks',version:'0.2.0'},group=resolveOperationContract(operation).binding.group,at=Date.now();
 const port=Object.freeze({
  async readAvailability(){return {installation:{installationId:id(80),baseCatalogSha256:canonicalSha256(catalog),
    executionCatalogSha256:'e'.repeat(64),operations:[operation],checkedAtMs:at-1000,expiresAtMs:at+600000},
   discovery:{binding,policyRevision:scopes[0].policyRevision,operations:[operation],checkedAtMs:at-1000,expiresAtMs:at+600000}};},
  async execute(){throw Error('not called');},
  externalUsage(){return undefined;}});
 const runtime=await createGeneralReadRuntime({binding,scopes,
  policy:{generalReads:true,readFamilies:[group],activeReadOperations:[operation]},
  port,now:()=>Date.now(),deadlineMs:at+60000,mount:'profile'});
 assert.notEqual(runtime,null,'the enabled mount builds a runtime');
 assert.deepEqual(runtime.available,[operation],'the active read is mounted with the accounting method present');
});
