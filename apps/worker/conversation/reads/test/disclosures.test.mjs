/** Actual canonical schema conversion; no SDK or native/provider execution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {advertisedArguments} from '../schema.mjs';
import {READ_FAMILIES} from '../families.mjs';
for(const id of ['search_lda_filings','search_sec_filings','search_fara_registrations'])test(`${id}: worker uses canonical closed schema without authority or defaults`,()=>{
 const c=resolveOperationContract({id,version:'0.2.0'}),s=advertisedArguments(c.descriptor.inputSchema);assert.equal(READ_FAMILIES.disclosures.clientScope,'optional');assert.equal(s.mode,'canonical');assert.deepEqual(s.arguments.parse({}),{});
 for(const extra of [{tenantId:'other'},{actorRole:'capiro_admin'},{normalizationContext:{}},{getCredentials:'model'}, {input:{}}])assert.equal(s.arguments.safeParse(extra).success,false);
});
