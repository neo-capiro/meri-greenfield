/** The selected client's automatic context reaches the model as data plus one presentation rule: what Capiro has on file,
 * with sources, partiality in the user's terms, and none of the packet's loading or coverage mechanics. Every run also
 * carries the objective rule: an objective or strategy request hands the user into the web app's objective intake. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {requestContextSuffix,REQUEST_CONTEXT_MARKER,CLIENT_CONTEXT_GUIDANCE,CLIENT_CONTEXT_LABEL,OBJECTIVE_INTAKE_LABEL,OBJECTIVE_INTAKE_LINK_TEXT,OBJECTIVE_INTAKE_GENERAL_GUIDANCE,objectiveIntakeGuidance,objectiveIntakePath,objectiveIntakeSuffix} from '../request-context.mjs';
import {automaticContextFixture} from './automatic-context-fixture.mjs';
import {binding} from '../../../control/conversations/test/application-fixture.mjs';
const clientId='00000000-0000-4000-8000-0000000000aa';
const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:'p1'}];
const general=[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:'p1'}];

test('without automatic context the suffix is the data block and the objective rule only',()=>{
 const suffix=requestContextSuffix({window:null,scopes,skill:undefined});
 assert.ok(suffix.startsWith(REQUEST_CONTEXT_MARKER));assert.equal(suffix.includes(CLIENT_CONTEXT_GUIDANCE),false);
 assert.equal(suffix.includes('automaticClientContext'),false);
 const rule=objectiveIntakeSuffix(scopes);assert.ok(suffix.endsWith(rule));
 assert.deepEqual(JSON.parse(suffix.slice(REQUEST_CONTEXT_MARKER.length,suffix.length-rule.length)),{window:null,scopes});
});

test('with a selected client the data block is followed by the presentation rule, in user terms only',()=>{
 const packet=automaticContextFixture(binding,scopes[0].resourceId),suffix=requestContextSuffix({window:null,scopes,skill:undefined,automaticClientContext:packet});
 const rule=CLIENT_CONTEXT_LABEL+CLIENT_CONTEXT_GUIDANCE,tail=objectiveIntakeSuffix(scopes);
 assert.ok(suffix.endsWith(rule+tail));assert.ok(rule.startsWith('\n\nHow to present automaticClientContext (instruction, not data): '),'a blank line and a label separate the rule from the data block');
 assert.deepEqual(JSON.parse(suffix.slice(REQUEST_CONTEXT_MARKER.length,suffix.length-rule.length-tail.length)).automaticClientContext,packet,'the packet bytes are unchanged');
 assert.match(CLIENT_CONTEXT_GUIDANCE,/^automaticClientContext above is what Capiro has on file about the selected client: present it as such, citing each fact's source and date/);
 assert.match(CLIENT_CONTEXT_GUIDANCE,/say plainly in the user's terms that the view is partial and what is missing/);
 assert.match(CLIENT_CONTEXT_GUIDANCE,/Never describe how or when this context was loaded, and never quote its read window, coverage status words, totals, returned or selected counts, sample sizes or field names\.$/);
 // The words the model narrated live from the raw packet never appear as something to say.
 assert.doesNotMatch(CLIENT_CONTEXT_GUIDANCE,/loaded at session start|background context|total items|sample of|preamble|bounded/);
 assert.equal(CLIENT_CONTEXT_GUIDANCE.split(/\.\s/).length,2,'two sentences');
});

test('a client-scoped run hands objective and strategy requests into the intake link for that client',()=>{
 const rule=objectiveIntakeSuffix(scopes);
 assert.ok(rule.startsWith(OBJECTIVE_INTAKE_LABEL),'labelled as an instruction, separated from the data block');
 assert.equal(OBJECTIVE_INTAKE_LABEL,'\n\nObjective and strategy requests (instruction, not data): ');
 assert.equal(rule,OBJECTIVE_INTAKE_LABEL+objectiveIntakeGuidance(clientId));
 // The address is the web app's existing intake route for the selected client, with the Strategy-intake seed it accepts.
 assert.equal(objectiveIntakePath(clientId),`/portfolio/${clientId}/objectives?new=1`);
 assert.ok(rule.includes(`whose address is /portfolio/${clientId}/objectives?new=1&goal=<goal>&context=<context>`));
 assert.ok(rule.includes(`whose text is "${OBJECTIVE_INTAKE_LINK_TEXT}"`));assert.equal(OBJECTIVE_INTAKE_LINK_TEXT,'Start the objective intake');
 assert.ok(rule.includes('exactly one Markdown link'));assert.ok(rule.includes('percent-encoded (spaces as %20)'));
 // The model reasons first (this is what the user asked a colleague for), then offers the handoff; it never refuses, claims a write or prints the address.
 assert.ok(rule.includes('first give your reasoning'));assert.ok(rule.includes('timing such as the fiscal year'));
 assert.ok(rule.includes('Never answer that no capability or tool exists for this, never claim the objective was created, and keep the address as the link target only, never as text in the answer.'));
 // Covers the request shapes the acceptance row and its neighbours use.
 for(const verb of ['create','draft','plan','set up'])assert.ok(rule.includes(verb));assert.ok(rule.includes('or a strategy or plan for one'));
 // Routing prose stays in the user's terms: no internal tool, server or intent names.
 assert.doesNotMatch(rule,/mcp_|meri_intents|intent tool|propose_|INTENT|catalog/);
 // The client id appears only inside the link address, never as something to say.
 assert.equal(rule.split(clientId).length-1,1);
});

test('without a client scope the objective rule explains the client-scoped intake instead of refusing',()=>{
 for(const value of [general,[],undefined,null,[{kind:'client'}],[{kind:'research_portfolio',resourceId:'r'}]]){
  const rule=objectiveIntakeSuffix(value);
  assert.equal(rule,OBJECTIVE_INTAKE_LABEL+OBJECTIVE_INTAKE_GENERAL_GUIDANCE);assert.equal(rule.includes('/portfolio/'),false);
 }
 assert.ok(OBJECTIVE_INTAKE_GENERAL_GUIDANCE.includes('from a conversation scoped to that client'));
 assert.ok(OBJECTIVE_INTAKE_GENERAL_GUIDANCE.includes('never answer that no capability or tool exists for this'));
 assert.ok(requestContextSuffix({window:null,scopes:general,skill:undefined}).endsWith(OBJECTIVE_INTAKE_LABEL+OBJECTIVE_INTAKE_GENERAL_GUIDANCE));
 // Only the first client scope selects the address; a general scope beside it does not.
 assert.ok(objectiveIntakeSuffix([...general,...scopes]).includes(objectiveIntakePath(clientId)));
});
