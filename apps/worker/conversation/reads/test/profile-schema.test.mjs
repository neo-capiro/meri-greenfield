/** The worker advertises the selected 0.3 profile request from the exact pinned owner schema. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {advertisedArguments,canonicalInputSchema} from '../schema.mjs';

const current=resolveOperationContract({id:'get_client_context',version:'0.3.0'});
const asOf='2026-10-12T12:00:00.000Z';

test('profile 0.3 uses the immutable v03 schema and only advertises caller input',()=>{
 const bytes=readFileSync(new URL('../../../../../packages/contracts/retrieval-0.2/client-knowledge-profile-v03.schema.json',import.meta.url));
 const sha256=createHash('sha256').update(bytes).digest('hex');
 assert.equal(sha256,'7d422f92a4771b2d7e869e45371396c12b8a69934f9cb8ca50f5821ccab514a2');
 assert.deepEqual(current.descriptor.inputSchema,{id:'urn:meri:retrieval:client-knowledge-profile:0.3.0#/$defs/ClientKnowledgeProfileRequest',sha256});
 assert.deepEqual(current.descriptor.outputSchema,{id:'urn:meri:retrieval:client-knowledge-profile:0.3.0#/$defs/ClientKnowledgeProfileOutput',sha256});
 const canonical=canonicalInputSchema(current.descriptor.inputSchema),advertised=advertisedArguments(current.descriptor.inputSchema);
 assert.deepEqual(canonical.required,['clientId']);assert.equal(advertised.mode,'canonical');
 assert.deepEqual(advertised.arguments.parse({clientId:'Named client'}),{clientId:'Named client'});
 for(const extra of [{asOf},{readWindow:{startedAt:asOf,completedAt:asOf}},{tenantId:'forged'}])
  assert.equal(advertised.arguments.safeParse({clientId:'Named client',...extra}).success,false);
 assert.throws(()=>resolveOperationContract({id:'get_client_context',version:'0.2.0'}));
});
