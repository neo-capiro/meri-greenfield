/** F1: the actual SDK general-read mount accepts the trusted port that also carries external usage
 * accounting, including when no primary search is configured, and refuses a malformed one. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGeneralReadRuntime} from '../runtime.mjs';
import {binding,scopes,id} from '../../../../../apps/control/conversations/test/store-fixture.mjs';
import catalog from '../../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {familyReads,profileReads} from '../availability.mjs';
import {READ_FAMILIES} from '../families.mjs';

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

test('an enabled runtime mounts the same reads with or without the accounting method', async () => {
 // The policy grants a canonical read from the current registry, and the trusted port carrying the
 // accounting method must be transparent to what mounts.
 const row=familyReads().find(entry=>READ_FAMILIES[entry.family]?.clientScope!=='required');
 const policy={generalReads:true,readFamilies:[row.family],activeReadOperations:[row.operation]};
 assert.deepEqual(profileReads({policy}).map(entry=>entry.operation),[row.operation],'the policy grants the read');
 const at=Date.now();
 const portWithMethod=Object.freeze({...methodPort(),externalUsage(){return undefined;}});
 const build=port=>createGeneralReadRuntime({binding,scopes,policy,port,now:()=>Date.now(),deadlineMs:at+60000,mount:'profile'});
 const plain=await build(methodPort()),withMethod=await build(portWithMethod);
 assert.equal(withMethod===null,plain===null,'the optional method changes nothing about mounting');
 assert.deepEqual(withMethod?.available,plain?.available);
});
