/** 030 follow-up, case B018-P01: a matched comparison is a fair description, not by itself a causal design.
 * The frozen case is the visible synthetic answer over the fictional clinic notes below (no client, tenant, conversation
 * or run data; the prompt and the answer are reproduced in full because they are the whole evidence). The answer keeps
 * the observed drop, the absent confirmation and the unknown cutoff direction, then says that matching the same two
 * weekdays "would isolate the policy effect": a causal guarantee the supplied facts do not carry.
 *
 * What is read: one clause at a time. An identification claim is a sufficiency frame ("would/can/does ... isolate |
 * identify | attribute", or the present tense "isolates | identifies | attributes") about the policy's effect. Negation
 * is bound to the verb itself, so "would not isolate" states the limit and makes no claim. A claim is licensed only by a
 * design the notes supply, or by a conditional premise that itself carries that design: a condition over something else
 * ("if these notes are accurate") licenses nothing, and a design named only in the conclusion is not a premise.
 *
 * Word counts are labelled where they matter: the grounded positive is 112 words and the "would not isolate" text 74,
 * against the frozen prompt's 80-word cap, so both are calibration inputs rather than complete answers to it.
 *
 * What this is: a small frozen fixed-matrix check over eleven texts, in the same shape as the 030 calibration rubric. It
 * is not production natural-language grading, it bans no wording, and passing it is not evidence that generated
 * reasoning improved - that needs a separately allocated served run. The last test only shows that the canonical
 * instruction reaches the SDK within its unchanged policy footprint. */
import test from 'node:test';import assert from 'node:assert/strict';
import {buildConversationOptions,RESPONSE_STYLE,RESPONSE_VOICE} from '../options.mjs';
import {binding,versions} from '../../../control/conversations/test/application-fixture.mjs';
import {BEDROCK_MODEL} from '../provider.mjs';

// B018-P01, frozen as served: the fictional prompt and the punctuation-normalized answer.
const PROMPT="At a clinic, all 600 visits last week averaged 32 minutes. This week's 180 visits recorded by Tuesday averaged 24 minutes; later records are excluded, and a new triage policy began Monday. In at most 80 words, explain what we can conclude about improvement and whether the cutoff biases this week's mean upward or downward. State what comparison would resolve the uncertainty. Use only these facts.";
const ANSWER="The 8-minute drop is consistent with improvement under the new triage policy, but cannot be confirmed yet. Because only Monday-Tuesday visits are included, the cutoff could bias this week's mean in either direction depending on whether early-week visits run shorter or longer than later ones - the direction is unknown from these facts alone. Comparing last week's Monday-Tuesday average to this week's same two-day average would isolate the policy effect from day-of-week variation.";
// Positive control 1: the same facts, the same useful comparison, described for what it is. Calibration-only: 112 words.
const GROUNDED="Last week's 600 visits averaged 32 minutes and this week's 180 recorded visits average 24, so the mean is 8 minutes lower. That does not confirm improvement: the new policy is not the only thing that could move the average. The cutoff also leaves the direction of any bias unknown, because nothing here says whether early-week visits run shorter or longer than later ones. Comparing the same two weekdays in both weeks would make the pair like-for-like for day of week, but it would not separate the policy from case mix, staffing or other changes; treating the change as a policy effect needs a design, or explicit assumptions, that rule those out.";
// Positive control 2: notes that do supply an identifying design, so a causal estimate is warranted. Counts and means
// alone carry no outcome variation, so the answer keeps the point estimate and says what it cannot quantify.
const DESIGN_EVIDENCE='This week every visit was assigned by lottery to the new triage policy or the existing one, and each assignment was recorded: 90 visits to the new policy averaged 24 minutes and 90 to the existing one averaged 32 minutes.';
const DESIGN_ANSWER='Assignment by lottery lets us attribute an estimated 8-minute reduction to the triage policy rather than to case mix or day of week. With only each group\'s mean and 90 visits, the sampling uncertainty is not quantified, so the true size is not settled and the direction is an estimate, not a certainty.';
// Positive control 3: a hypothesis whose own premise carries the design, so it asserts nothing the notes must supply.
const CONDITIONAL_HYPOTHESIS='If assignment were by lottery, the difference in means could identify the policy average effect in expectation, under no interference and comparable measurement.';
// Positive control 4: the same frozen facts with the claim negated. Stating the limit is the correct reading. 74 words.
const NEGATED=ANSWER.replace('would isolate the policy effect','would not isolate the policy effect');
// Adverse controls: an unrelated uncertainty sentence, a hedge joined into the claim, a design word the notes do not
// supply, that same text behind a condition about something else, and the design answer with its design removed.
const UNCERTAINTY_ADDED=`${ANSWER} Treat the figure as provisional.`;
const UNCERTAINTY_JOINED=ANSWER.replace('later ones - the direction is unknown from these facts alone. Comparing','later ones. Even so, comparing').replace('would isolate the policy effect from day-of-week variation.','would isolate the policy effect from day-of-week variation; the estimate is provisional.');
const DESIGN_NOT_SUPPLIED=ANSWER.replace('would isolate the policy effect from day-of-week variation.','would isolate the policy effect from day-of-week variation, since assignment was by lottery.');
const CONDITION_PREFIXED=DESIGN_NOT_SUPPLIED.replace('Comparing last week','If these notes are accurate, comparing last week');
// The same condition in front of the original frozen answer, which names no design anywhere: 78 words.
const NO_DESIGN_CONDITIONED=ANSWER.replace('Comparing last week','If these notes are accurate, comparing last week');
const DESIGN_DROPPED=DESIGN_ANSWER.replace('Assignment by lottery lets us attribute','The two groups differ only by chance, so we can attribute');
const GROUNDED_CALLING_IT=GROUNDED.replace('treating the change as a policy effect needs','matching the same two weekdays would isolate the policy effect, and treating the change as such needs');

// A design this matrix can read, and the words that name it. A comparison that matches a dimension ("same two
// weekdays", "like-for-like") is deliberately not one of these: it removes that dimension and nothing else.
const DESIGNS=[['randomisation',/\b(?:randomi[sz](?:ed|ation)|lottery|assigned at random)\b/iu],
 ['difference-in-differences',/\bdifference[- ]in[- ]differences\b/iu],
 ['parallel trends',/\bparallel trends?\b/iu],
 ['control group',/\bcontrol (?:group|site|clinic|period)\b/iu]];
// An identification claim asserts that the comparison settles the cause. A bare mention of the word, a statement of what
// a design would need, and a negated verb are not such claims.
const SUFFICIENT=/\b(?:(?:would|will|can|could|does|do|is enough to|suffices to|lets? (?:us|you))\b[^.;]{0,40}?\b(?:isolat|identif|attribut)|(?:isolates|identifies|attributes)\b)/iu;
// The text before the verb is captured, so "would not isolate" yields "would not " and the negation binds to the verb.
// "not only" is excluded because it introduces the claim rather than denying it.
const VERB=/([^.;]{0,40}?)\b(?:isolat|identif|attribut)/iu;
const NEGATION=/\b(?:not(?!\s+only)|never|cannot|can't|won't|doesn't|don't|isn't|wouldn't|aren't)\b/iu;
const CLAUSE=/[^;:—]+/gu;
// A conditional's premise is what precedes its first comma: "if assignment were by lottery, ..." carries the design;
// "if these notes are accurate, ..." carries nothing but the notes' accuracy.
const OPENER=/\b(?:if|assuming|provided that|unless|suppose|supposing)\b[^,]*/iu;

/** Every identification claim, with its design, its conditional premise and the design that premise names. */
const identificationClaims=text=>{const out=[];
 for(const sentence of text.trim().split(/(?<=[.!?])\s+/u))
  for(const [clause] of sentence.matchAll(CLAUSE)){
   const frame=SUFFICIENT.exec(clause);
   if(frame===null)continue;
   const verb=VERB.exec(frame[0]);
   if(verb!==null&&NEGATION.test(verb[1]))continue;
   const premise=(OPENER.exec(clause)??[null])[0];
   out.push({clause,design:DESIGNS.find(([,pattern])=>pattern.test(clause))?.[0]??null,
    premise:premise===null?null:premise.trim(),
    premiseDesign:premise===null?null:DESIGNS.find(([,pattern])=>pattern.test(premise))?.[0]??null});}
 return out;};

/** @typedef {{claims:object[],unsupported:object[],observedDrop:boolean,notConfirmed:boolean,directionUnknown:boolean,comparison:boolean,words:number}} Reading */
/** @param {string} text @param {{supplies:string[]}} evidence @returns {Reading} */
const read=(text,evidence)=>{const claims=identificationClaims(text);
 // A claim is licensed when the notes supply the design it names, or when its own conditional premise names that same
 // design. A design that appears only in the conclusion, or a condition about something else, licenses nothing, and a
 // claim that names no design at all is never licensed: two absent designs are not a matching premise and conclusion.
 const unsupported=claims.flatMap(claim=>claim.design!==null&&(evidence.supplies.includes(claim.design)||
  (claim.premise!==null&&claim.premiseDesign===claim.design))?[]
  :[{...claim,reason:claim.design===null?'no-design':'design-not-supplied'}]);
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
 assert.equal(r.words,112,`${r.words} words, calibration-only against the 80-word cap`);
 assert.ok(r.observedDrop);assert.ok(r.notConfirmed);assert.ok(r.directionUnknown);assert.ok(r.comparison);
 // It proposes the comparison without claiming it settles causation, so it makes no identification claim at all.
 assert.equal(r.claims.length,0,r.claims.map(c=>c.clause).join(' | '));assert.deepEqual(r.unsupported,[]);
});
test('notes that supply an identifying design support a causal estimate, with its uncertainty left unquantified',()=>{
 assert.match(DESIGN_EVIDENCE,/assigned by lottery/u);
 const r=read(DESIGN_ANSWER,RANDOMISED);
 assert.equal(r.unsupported.length,0);
 assert.equal(r.claims.length,1);assert.equal(r.claims[0].design,'randomisation');
 assert.match(r.claims[0].clause,/attribute an estimated 8-minute reduction/iu);
 // Counts and means alone carry no outcome variation: the point estimate stands, precision and confidence do not.
 assert.match(DESIGN_ANSWER,/sampling uncertainty is not quantified/iu);
 assert.match(DESIGN_ANSWER,/direction is an estimate/iu);
 assert.doesNotMatch(DESIGN_ANSWER,/\b(?:imprecise|precise)\b/iu);
 assert.doesNotMatch(DESIGN_ANSWER,/direction is supported/iu);
 // The same words are not a licence from notes that do not supply the design.
 assert.equal(read(DESIGN_ANSWER,NO_DESIGN).unsupported.length,1);
});
test('a conditional hypothesis is useful when its own premise carries the design',()=>{
 const r=read(CONDITIONAL_HYPOTHESIS,NO_DESIGN);
 assert.equal(r.unsupported.length,0);
 assert.equal(r.claims.length,1);
 assert.equal(r.claims[0].premise,'If assignment were by lottery');
 assert.equal(r.claims[0].premiseDesign,'randomisation');
});
test('stating the limit is not a claim: the same answer with "would not isolate" is accepted',()=>{
 const r=read(NEGATED,NO_DESIGN);
 assert.equal(r.words,74,`${r.words} words, calibration-only against the 80-word cap`);
 assert.ok(r.observedDrop);assert.ok(r.notConfirmed);assert.ok(r.directionUnknown);assert.ok(r.comparison);
 assert.equal(r.claims.length,0,r.claims.map(c=>c.clause).join(' | '));assert.deepEqual(r.unsupported,[]);
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
test('adverse 4: a condition about something else does not carry the invented design',()=>{
 const r=read(CONDITION_PREFIXED,NO_DESIGN);
 assert.equal(r.words,83,`${r.words} words, claim boundary only`);
 assert.equal(r.claims.length,1);
 // The condition is about whether the notes are accurate, and it names no design, so the lottery stays unsupported.
 assert.equal(r.claims[0].premise,'If these notes are accurate');
 assert.equal(r.claims[0].premiseDesign,null);assert.equal(r.claims[0].design,'randomisation');
 assert.equal(r.unsupported.length,1);assert.equal(r.unsupported[0].reason,'design-not-supplied');
});
test('a condition about the notes does not license a claim that names no design',()=>{
 // The reviewed counterexample: the original frozen answer, condition prefixed, with no design anywhere in it. Two
 // absent designs are not a matching premise and conclusion, so the equality must not fire.
 const r=read(NO_DESIGN_CONDITIONED,NO_DESIGN);
 assert.equal(r.words,78,`${r.words} words`);
 assert.equal(r.claims.length,1);
 assert.equal(r.claims[0].design,null);assert.equal(r.claims[0].premiseDesign,null);
 assert.equal(r.claims[0].premise,'If these notes are accurate');
 assert.equal(r.unsupported.length,1,r.unsupported.map(u=>u.clause).join(' | '));
 assert.equal(r.unsupported[0].reason,'no-design');
});
test('adverse 5: the supported design answer loses its licence when the design is removed',()=>{
 const r=read(DESIGN_DROPPED,RANDOMISED);
 assert.equal(r.claims.length,1);assert.equal(r.claims[0].design,null);
 assert.equal(r.unsupported.length,1);assert.equal(r.unsupported[0].reason,'no-design');
});
test('adverse 6: a descriptive comparison cannot be relabelled as an identifying one',()=>{
 const r=read(GROUNDED_CALLING_IT,NO_DESIGN);
 assert.equal(r.unsupported.length,1,r.unsupported.map(u=>u.clause).join(' | '));
 assert.equal(r.unsupported[0].reason,'no-design');
 assert.match(r.unsupported[0].clause,/would isolate the policy effect/iu);
});
test('the calibration rule reaches the append inside its unchanged policy footprint (composition only)',()=>{
 const runtime={binding,versions,cwd:`/workspace/conversations/${binding.conversationId}`,model:BEDROCK_MODEL,region:'us-east-1',maxOutputTokens:4096,providerEnvironment:{},sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+1000,maxTurns:20,maxCostMicroUSD:2000000,maxOutputBytes:1024};
 const append=buildConversationOptions(runtime,new AbortController()).systemPrompt.append;
 const rule='A matched comparison is not a causal design: it removes only what it matches, so a causal claim needs a design or assumptions.';
 assert.ok(RESPONSE_VOICE.includes(rule));assert.ok(append.includes(rule));
 // The earlier calibration wording is consolidated here, not dropped: observation, evidence, the unresolved gap, and a
 // supported direction or labelled hypothesis all survive in the same sentence.
 assert.ok(RESPONSE_VOICE.includes('Say what is observed, what the evidence supports and what is unresolved'));
 assert.ok(RESPONSE_VOICE.includes('give a supported direction, size or mechanism or a labelled hypothesis'));
 assert.ok(RESPONSE_STYLE.length<2000,`${RESPONSE_STYLE.length} characters`);
 assert.ok(!RESPONSE_STYLE.includes(rule),'the guarded string is not inflated to make room');
 // The original footprint, measured at the served source: VOICE 1146, VOICE plus STYLE 3135.
 assert.ok(RESPONSE_VOICE.length<=1146,`${RESPONSE_VOICE.length} characters`);
 assert.ok(RESPONSE_STYLE.length+RESPONSE_VOICE.length<=3135,`${RESPONSE_STYLE.length+RESPONSE_VOICE.length}`);
});
