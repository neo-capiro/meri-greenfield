/** 030 follow-up, case B018-P01: a matched comparison is a fair description, not by itself a causal design.
 * The frozen case is the visible synthetic answer over the fictional clinic notes below (no client, tenant, conversation
 * or run data; the prompt and the answer are reproduced in full because they are the whole evidence). The answer keeps
 * the observed drop, the absent confirmation and the unknown cutoff direction, then says that matching the same two
 * weekdays "would isolate the policy effect": a causal guarantee the supplied facts do not carry.
 *
 * What is read: one clause at a time. An identification claim is a sufficiency frame ("would/can/does ... isolate |
 * identify | attribute", or the present tense "isolates | identifies | attributes") about the policy's effect; a clause
 * that merely says what a design would need is not such a claim. A claim is licensed only when its own clause names a
 * design, the notes supply that design, and the basis is either the supplied design or an assumption named in the same
 * clause. A match names no design: "same two weekdays" matches a dimension and removes only that dimension.
 *
 * What this is: a small frozen fixed-matrix check over eight texts, in the same shape as the 030 calibration rubric. It
 * is not production natural-language grading, it bans no wording, and passing it is not evidence that generated
 * reasoning improved - that needs a separately allocated served run. The last test only shows that the canonical
 * instruction reaches the SDK. */
import test from 'node:test';import assert from 'node:assert/strict';
import {buildConversationOptions,RESPONSE_STYLE,RESPONSE_VOICE} from '../options.mjs';
import {binding,versions} from '../../../control/conversations/test/application-fixture.mjs';
import {BEDROCK_MODEL} from '../provider.mjs';

// B018-P01, frozen as served: the fictional prompt and the punctuation-normalized answer.
const PROMPT="At a clinic, all 600 visits last week averaged 32 minutes. This week's 180 visits recorded by Tuesday averaged 24 minutes; later records are excluded, and a new triage policy began Monday. In at most 80 words, explain what we can conclude about improvement and whether the cutoff biases this week's mean upward or downward. State what comparison would resolve the uncertainty. Use only these facts.";
const ANSWER="The 8-minute drop is consistent with improvement under the new triage policy, but cannot be confirmed yet. Because only Monday-Tuesday visits are included, the cutoff could bias this week's mean in either direction depending on whether early-week visits run shorter or longer than later ones - the direction is unknown from these facts alone. Comparing last week's Monday-Tuesday average to this week's same two-day average would isolate the policy effect from day-of-week variation.";
// Positive control 1: the same facts, the same useful comparison, described for what it is.
const GROUNDED="Last week's 600 visits averaged 32 minutes and this week's 180 recorded visits average 24, so the mean is 8 minutes lower. That does not confirm improvement: the new policy is not the only thing that could move the average. The cutoff also leaves the direction of any bias unknown, because nothing here says whether early-week visits run shorter or longer than later ones. Comparing the same two weekdays in both weeks would make the pair like-for-like for day of week, but it would not separate the policy from case mix, staffing or other changes; treating the change as a policy effect needs a design, or explicit assumptions, that rule those out.";
// Positive control 2: notes that do supply an identifying design, so a causal conclusion is warranted.
const DESIGN_EVIDENCE='This week every visit was assigned by lottery to the new triage policy or the existing one, and each assignment was recorded: 90 visits to the new policy averaged 24 minutes and 90 to the existing one averaged 32 minutes.';
const DESIGN_ANSWER='Assignment was by lottery, so the two groups differ only by chance and the 8-minute gap can be attributed to the triage policy rather than to case mix or day of week. With 90 visits in each group the estimate is imprecise, but the direction is supported.';
// Adverse controls: an unrelated uncertainty sentence, the same sentence joined into the claim, a design word the notes
// do not supply, and the design answer with its design removed.
const UNCERTAINTY_ADDED=`${ANSWER} Treat the figure as provisional.`;
const UNCERTAINTY_JOINED=ANSWER.replace('later ones - the direction is unknown from these facts alone. Comparing','later ones. Even so, comparing').replace('would isolate the policy effect from day-of-week variation.','would isolate the policy effect from day-of-week variation; the estimate is provisional.');
const DESIGN_NOT_SUPPLIED=ANSWER.replace('would isolate the policy effect from day-of-week variation.','would isolate the policy effect from day-of-week variation, since assignment was by lottery.');
const DESIGN_DROPPED=DESIGN_ANSWER.replace('Assignment was by lottery, so the two groups differ only by chance and','The two groups differ only by chance, and');
const GROUNDED_CALLING_IT =GROUNDED.replace('treating the change as a policy effect needs','matching the same two weekdays would isolate the policy effect, and treating the change as such needs');

// A design this matrix can read, and the words that name it. A comparison that matches a dimension ("same two
// weekdays", "like-for-like") is deliberately not one of these: it removes that dimension and nothing else.
const DESIGNS=[['randomisation',/\b(?:randomi[sz](?:ed|ation)|lottery|assigned at random)\b/iu],
 ['difference-in-differences',/\bdifference[- ]in[- ]differences\b/iu],
 ['parallel trends',/\bparallel trends?\b/iu],
 ['control group',/\bcontrol (?:group|site|clinic|period)\b/iu]];
// An identification claim asserts that the comparison settles the cause. A bare mention of the word, or a statement of
// what a design would need, is not such a claim.
const SUFFICIENT=/\b(?:(?:would|will|can|could|does|do|is enough to|suffices to|lets? (?:us|you))\b[^.;]{0,40}?\b(?:isolat|identif|attribut)|(?:isolates|identifies|attributes)\b)/iu;
// "does not isolate" states the limit, so a negated verb is not a claim.
const NEGATION=/\b(?:not|never|cannot|can't|won't|doesn't|don't|isn't|wouldn't|aren't)\b/iu;
const CLAUSE=/[^;:—]+/gu;
const ASSUMPTION=/\b(?:if|only if|assuming|provided that|unless|so long as)\b/iu;

/** Every identification claim, with the clause it sits in and the design that clause names. */
const identificationClaims=text=>{const out=[];
 for(const sentence of text.trim().split(/(?<=[.!?])\s+/u))
  for(const [clause] of sentence.matchAll(CLAUSE)){
   const frame=SUFFICIENT.exec(clause);
   if(frame===null)continue;
   const verb=/[^.;]{0,40}?\b(?:isolat|identif|attribut)/iu.exec(frame[0]);
   if(verb!==null&&NEGATION.test(frame[0].slice(0,verb.index)))continue;
   if(NEGATION.test(clause.slice(Math.max(0,frame.index-30),frame.index)))continue;
   out.push({clause,design:DESIGNS.find(([,pattern])=>pattern.test(clause))?.[0]??null,
    assumption:ASSUMPTION.test(clause)});}
 return out;};

/** @typedef {{claims:object[],unsupported:object[],observedDrop:boolean,notConfirmed:boolean,directionUnknown:boolean,comparison:boolean,words:number}} Reading */
/** @param {string} text @param {{supplies:string[]}} evidence @returns {Reading} */
const read=(text,evidence)=>{const claims=identificationClaims(text);
 // A claim is licensed by the design it names when the notes supply that design, or by an assumption named beside it.
 // A design the notes do not supply is a proposal, not a licence for a conclusion about these facts.
 const unsupported=claims.flatMap(claim=>claim.design===null?[{...claim,reason:'no-design'}]
  :evidence.supplies.includes(claim.design)||claim.assumption?[]:[{...claim,reason:'design-not-supplied'}]);
 return {claims,unsupported,words:text.trim().split(/\s+/u).length,
  observedDrop:/\b8[- ]minutes?\b/iu.test(text)&&/\b(?:drop|drop(?:p)?ed|lower|fell|below)\b/iu.test(text),
  notConfirmed:/\b(?:cannot be confirmed|not confirmed|does not confirm|no confirmed)\b/iu.test(text),
  directionUnknown:/\b(?:either direction|direction[^.;]{0,40}unknown|unknown[^.;]{0,40}direction)\b/iu.test(text),
  comparison:/\b(?:same (?:two )?(?:weekdays?|two-day)|like-for-like|Monday-Tuesday)\b/iu.test(text)};};
const NO_DESIGN={supplies:[]},RANDOMISED={supplies:['randomisation']};

test('the frozen B018 answer keeps the drop, the missing confirmation and the unknown direction, and still isolates the policy effect',()=>{
 assert.ok(PROMPT.includes('In at most 80 words'));
 const r=read(ANSWER,NO_DESIGN);
 assert.ok(r.observedDrop);assert.ok(r.notConfirmed);assert.ok(r.directionUnknown);assert.ok(r.comparison);
 // The defect is one clause: "would isolate the policy effect" over a comparison that only matches a weekday.
 assert.equal(r.claims.length,1);assert.equal(r.unsupported.length,1,r.unsupported.map(u=>u.clause).join(' | '));
 assert.equal(r.unsupported[0].reason,'no-design');assert.match(r.unsupported[0].clause,/would isolate the policy effect/iu);
});
test('a grounded descriptive comparison stays useful: the same weekday match, with what it leaves open',()=>{
 const r=read(GROUNDED,NO_DESIGN);
 assert.ok(r.observedDrop);assert.ok(r.notConfirmed);assert.ok(r.directionUnknown);assert.ok(r.comparison);
 // It proposes the comparison without claiming it settles causation, so it makes no identification claim at all.
 assert.equal(r.claims.length,0,r.claims.map(c=>c.clause).join(' | '));assert.deepEqual(r.unsupported,[]);
});
test('notes that supply an identifying design support the causal conclusion they warrant',()=>{
 assert.match(DESIGN_EVIDENCE,/assigned by lottery/u);
 const r=read(DESIGN_ANSWER,RANDOMISED);
 assert.equal(r.unsupported.length,0);
 assert.equal(r.claims.length,1);assert.equal(r.claims[0].design,'randomisation');
 assert.match(r.claims[0].clause,/can be attributed to the triage policy/iu);
 // The same words are not a licence from notes that do not supply the design.
 assert.equal(read(DESIGN_ANSWER,NO_DESIGN).unsupported.length,1);
});
test('adverse 1: an unrelated uncertainty sentence does not license the causal claim',()=>{
 const r=read(UNCERTAINTY_ADDED,NO_DESIGN);
 assert.ok(r.directionUnknown);
 assert.equal(r.unsupported.length,1,r.unsupported.map(u=>u.clause).join(' | '));
 assert.equal(r.unsupported[0].reason,'no-design');
});
test('adverse 2: hedging the claim in its own sentence does not license it either',()=>{
 const r=read(UNCERTAINTY_JOINED,NO_DESIGN);
 assert.ok(r.directionUnknown);
 assert.equal(r.unsupported.length,1,r.unsupported.map(u=>u.clause).join(' | '));
 assert.equal(r.unsupported[0].reason,'no-design');
});
test('adverse 3: a design word the notes do not supply licenses nothing',()=>{
 const r=read(DESIGN_NOT_SUPPLIED,NO_DESIGN);
 assert.equal(r.claims.length,1);assert.equal(r.claims[0].design,'randomisation');
 // The answer names a design; these notes do not contain it, so the conclusion still fails.
 assert.equal(r.unsupported.length,1);assert.equal(r.unsupported[0].reason,'design-not-supplied');
});
test('adverse 4: the supported design answer loses its licence when the design is removed',()=>{
 const r=read(DESIGN_DROPPED,RANDOMISED);
 assert.equal(r.claims.length,1);assert.equal(r.claims[0].design,null);
 assert.equal(r.unsupported.length,1);assert.equal(r.unsupported[0].reason,'no-design');
});
test('adverse 5: a descriptive comparison cannot be relabelled as an identifying one',()=>{
 const r=read(GROUNDED_CALLING_IT,NO_DESIGN);
 assert.equal(r.unsupported.length,1,r.unsupported.map(u=>u.clause).join(' | '));
 assert.equal(r.unsupported[0].reason,'no-design');
 assert.match(r.unsupported[0].clause,/would isolate the policy effect/iu);
});
test('the canonical append carries the comparison rule (composition only, not model behaviour)',()=>{
 const runtime={binding,versions,cwd:`/workspace/conversations/${binding.conversationId}`,model:BEDROCK_MODEL,region:'us-east-1',maxOutputTokens:4096,providerEnvironment:{},sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+1000,maxTurns:20,maxCostMicroUSD:2000000,maxOutputBytes:1024};
 const append=buildConversationOptions(runtime,new AbortController()).systemPrompt.append;
 const rule='A matched or like-for-like comparison is a fair description, not by itself a causal design: it removes only what it matches, so say what else could move the number, and claim a causal effect only with a design or assumptions that rule those out.';
 assert.ok(RESPONSE_VOICE.includes(rule));assert.ok(append.includes(rule));
 // The rule extends the existing calibration clause and costs RESPONSE_STYLE nothing; its guard is untouched.
 assert.ok(append.includes('In an explanation, a mechanism, causal effect, direction or magnitude needs evidence'));
 assert.ok(RESPONSE_STYLE.length<2000,`${RESPONSE_STYLE.length} characters`);
 assert.ok(!RESPONSE_STYLE.includes(rule),'the guarded string is not inflated to make room');
});
