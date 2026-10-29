/** F1: the actual SDK general-read mount accepts the trusted port that also carries external usage
 * accounting, including when no primary search is configured, and refuses a malformed one. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGeneralReadRuntime} from '../runtime.mjs';
import {binding,scopes,id} from '../../../../../apps/control/conversations/test/store-fixture.mjs';
import catalog from '../../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {familyReads} from '../availability.mjs';
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

test('an enabled mount with one active read builds the real runtime from the real client port', async () => {
 // Take a canonical read from the current family registry rather than a hand-picked id, so the case
 // exercises the same availability resolution production uses.
 let mounted=null,chosen=null;
 for(const row of familyReads().filter(row=>READ_FAMILIES[row.family]?.clientScope!=='required').slice(0,12)){
  const at=Date.now(),operation=row.operation;
  const port=Object.freeze({
   async readAvailability(){return {installation:{installationId:id(80),baseCatalogSha256:canonicalSha256(catalog),
     executionCatalogSha256:'e'.repeat(64),operations:[operation],checkedAtMs:at-1000,expiresAtMs:at+600000},
    discovery:{binding,policyRevision:scopes[0].policyRevision,operations:[operation],checkedAtMs:at-1000,expiresAtMs:at+600000}};},
   async execute(){throw Error('not called');},
   externalUsage(){return undefined;}});
  const built=await createGeneralReadRuntime({binding,scopes,
   policy:{generalReads:true,readFamilies:[row.family],activeReadOperations:[operation]},
   port,now:()=>Date.now(),deadlineMs:at+60000,mount:'profile'});
  if(built!==null&&built.available.length>0){mounted=built;chosen=operation;break;}
 }
 assert.ok(chosen,'a canonical active read builds an enabled runtime with the accounting method present');
 assert.deepEqual(mounted.available,[chosen]);
});
