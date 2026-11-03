/** 024 rewrite fidelity: shortening supplied text keeps its condition, negation and uncertainty.
 * The frozen case is the visible-QA observation B007-03 for a synthetic note (no client, tenant, conversation or run data).
 * The rubric is a small frozenset of claims, so a paraphrase that keeps them passes: it is not an exact-string oracle.
 * The last test proves only that the canonical instruction reaches the SDK, never that the model obeys it; generated text
 * needs a separately allocated visible-QA run. */
import test from 'node:test';import assert from 'node:assert/strict';
import {buildConversationOptions} from '../options.mjs';
import {binding,versions} from '../../../control/conversations/test/application-fixture.mjs';
import {BEDROCK_MODEL} from '../provider.mjs';
const NOTE='The team may launch in June, but only if accessibility review passes. The review is not complete, and no launch date is confirmed.';
// B007-03 answered in 16 words and one sentence. June, the unfinished review and the missing date survive, but "only if
// accessibility review passes" became "pending an incomplete accessibility review", so the condition gating launch is gone.
// Length was never the defect: the answer was well inside the 25-word maximum.
const OBSERVED='The team may launch in June, pending an incomplete accessibility review, but no date is confirmed.';
// Illustration only: the same claims in other words, so no single wording is required.
const PARAPHRASE='The team may launch in June only if the unfinished accessibility review passes; no launch date is confirmed.';
const CONDITIONAL=/\b(only if|if|provided|provided that|contingent on|conditional on|depends? on|requires?)\b/iu;
const SUCCESS=/\b(pass(es|ed)?|approv(es|ed|al)|succe(eds?|ss)|clears?|complete(s|d)?|finish(es|ed)?)\b/iu;
const claims=text=>{const sentences=text.trim().split(/(?<=[.!?])\s+/u);return {
 words:text.trim().split(/\s+/u).length,sentences:sentences.length,
 tentativeJune:/\bjune\b/iu.test(text)&&/\b(may|might|could)\b/iu.test(text),
 // A prerequisite's success is the gate: one clause carries both the conditional and the completion verb.
 reviewPasses:sentences.some(s=>CONDITIONAL.test(s)&&SUCCESS.test(s)&&/review/iu.test(s)),
 reviewUnfinished:/\b(not complete|incomplete|unfinished|not yet (complete|finished|done)|has not (finished|completed))\b/iu.test(text),
 dateUnconfirmed:/(?:no (?:launch )?date[^.;]*confirm|no confirmed (?:launch )?date|date[^.;]*(?:unconfirmed|not confirmed))/iu.test(text)};};
test('the frozen 024 answer is one short sentence that drops the review condition',()=>{
 const c=claims(OBSERVED);
 assert.equal(c.sentences,1);assert.ok(c.words<=25,`${c.words} words`);
 assert.ok(c.tentativeJune);assert.ok(c.reviewUnfinished);assert.ok(c.dateUnconfirmed);
 assert.equal(c.reviewPasses,false,'pending an incomplete review is not a successful review');
});
test('the rubric holds the same claims in different words',()=>{
 // Every claim is read from the supplied note itself; the paraphrase then keeps them in new wording.
 const source=claims(NOTE);
 for(const [claim,held] of Object.entries(source))if(typeof held==='boolean')assert.ok(held,`source: ${claim}`);
 const c=claims(PARAPHRASE);
 assert.equal(c.sentences,1);assert.ok(c.words<=25,`${c.words} words`);
 for(const [claim,held] of Object.entries(c))if(typeof held==='boolean')assert.ok(held,claim);
});
test('the canonical append carries the rewrite guidance (composition only, not model behaviour)',()=>{
 const runtime={binding,versions,cwd:`/workspace/conversations/${binding.conversationId}`,model:BEDROCK_MODEL,region:'us-east-1',maxOutputTokens:4096,providerEnvironment:{},sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+1000,maxTurns:20,maxCostMicroUSD:2000000,maxOutputBytes:1024};
 const append=buildConversationOptions(runtime,new AbortController()).systemPrompt.append;
 assert.ok(append.includes("Rewrite or shorten without dropping a condition, negation, exception or uncertainty; keep a prerequisite's success as the condition, not merely pending."));
 assert.ok(append.includes('treat a stated maximum as a hard cap'));
});
