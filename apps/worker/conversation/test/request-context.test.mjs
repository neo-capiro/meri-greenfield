/** The selected client's automatic context reaches the model as data plus one presentation rule: what Capiro has on file,
 * with sources, partiality in the user's terms, and none of the packet's loading or coverage mechanics. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {requestContextSuffix,REQUEST_CONTEXT_MARKER,CLIENT_CONTEXT_GUIDANCE} from '../request-context.mjs';
import {automaticContextFixture} from './automatic-context-fixture.mjs';
import {binding} from '../../../control/conversations/test/application-fixture.mjs';
const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:'00000000-0000-4000-8000-0000000000aa',policyRevision:'p1'}];

test('without a selected client the suffix is the bare data block',()=>{
 const suffix=requestContextSuffix({window:null,scopes,skill:undefined});
 assert.ok(suffix.startsWith(REQUEST_CONTEXT_MARKER));assert.equal(suffix.includes(CLIENT_CONTEXT_GUIDANCE),false);
 assert.equal(suffix.includes('automaticClientContext'),false);
});

test('with a selected client the data block is followed by the presentation rule, in user terms only',()=>{
 const packet=automaticContextFixture(binding,scopes[0].resourceId),suffix=requestContextSuffix({window:null,scopes,skill:undefined,automaticClientContext:packet});
 assert.ok(suffix.endsWith(`\n${CLIENT_CONTEXT_GUIDANCE}`));
 assert.deepEqual(JSON.parse(suffix.slice(REQUEST_CONTEXT_MARKER.length,suffix.length-CLIENT_CONTEXT_GUIDANCE.length-1)).automaticClientContext,packet,'the packet bytes are unchanged');
 assert.match(CLIENT_CONTEXT_GUIDANCE,/^automaticClientContext above is what Capiro has on file about the selected client: present it as such, citing each fact's source and date/);
 assert.match(CLIENT_CONTEXT_GUIDANCE,/say plainly in the user's terms that the view is partial and what is missing/);
 assert.match(CLIENT_CONTEXT_GUIDANCE,/Never describe how or when this context was loaded, and never quote its read window, coverage status words, totals, returned or selected counts, sample sizes or field names\.$/);
 // The words the model narrated live from the raw packet never appear as something to say.
 assert.doesNotMatch(CLIENT_CONTEXT_GUIDANCE,/loaded at session start|background context|total items|sample of|preamble|bounded/);
 assert.equal(CLIENT_CONTEXT_GUIDANCE.split(/\.\s/).length,2,'two sentences');
});
