/** 030 explanatory inference: an explanation may add a direction, a size or a mechanism for an effect only when the
 * supplied evidence carries that particular claim. The frozen case is the visible-QA observation B011-NEW-01 over a
 * synthetic note (no client, tenant, conversation or run data; the prompt and the answer are reproduced in full because
 * they are the whole evidence).
 *
 * The rubric reads one claim at a time. An effect is a verb from a closed set that names which way it runs, and it is
 * supported only when the notes' own numbers give that same direction — and, when the claim also gives a size, that
 * size. A condition counts only in the same clause as the effect it governs, and only when it names what would make the
 * claim true; a hedge like "probably" is not evidence and licenses nothing. Reading the notes' arithmetic here means a
 * reversed direction or an invented size fails even in an example whose evidence does support some effect.
 *
 * What this is: a frozen, hand-written claim/evidence check over six fixed texts and their four adverse variants. It is
 * not production natural-language grading, it bans no phrase and requires no wording, and passing it is not evidence
 * that generated reasoning improved — that needs a separately allocated visible-QA run. The last test only shows that
 * the canonical instruction reaches the SDK. */
import test from 'node:test';import assert from 'node:assert/strict';
import {buildConversationOptions,RESPONSE_STYLE,RESPONSE_VOICE} from '../options.mjs';
import {binding,versions} from '../../../control/conversations/test/application-fixture.mjs';
import {BEDROCK_MODEL} from '../provider.mjs';

// B011-NEW-01, frozen: both observed rates and the count/rate difference are right and the policy conclusion is right,
// and the answer then adds a direction for the selection effect that no note supplies.
const OBSERVED=[
 'Note A (Team North, April): 8 of 20 randomly sampled requests delayed — a 40% rate.',
 'Note B (Team South, May): 9 of 30 requests delayed — a 30% rate. The count rose by 1; the rate fell by 10 points.',
 "These notes do not establish that the policy improved performance. The teams differ, the months differ, and Note B's sample was pre-selected for complexity — biasing its rate downward regardless of policy. A valid comparison would require the same team, the same sampling method, and a before/after window straddling the policy change."].join(' ');
// Illustration only: the same claims in other words, with the direction and size of that selection effect left open.
const OPEN='Team North (Note A, April): 8 of 20 requests delayed, a 40% rate. Team South (Note B, May): 9 of 30 delayed, a 30% rate. One more request was delayed even though the rate is 10 percentage points lower, so the count and the rate move differently. These notes do not establish that the policy improved performance: the teams, months and selection methods differ, and they say nothing about the size or direction of that selection effect. The comparison needed is the same team, the same sampling method, and a window before and after the policy.';
// Positive control 1: the same two notes plus one that does supply the direction, so stating it is right, not a breach.
const SUPPORTED_EVIDENCE='Note A: in April, 8 of 20 randomly sampled requests from Team North were delayed. Note B: in May, 9 of 30 requests from Team South were delayed; all 30 were selected because they were complex, and an audit of the same May window found the other 45 Team South requests were not delayed. No policy change occurred in May.';
const SUPPORTED='Team North\'s April rate was 40% (8 of 20); Team South\'s May rate was 30% (9 of 30). That is one more delayed request but a rate 10 percentage points lower. Because the 30 selected requests were complex and none of the other 45 Team South requests was delayed, the selection inflated the observed May rate: the full-month rate is lower than 30%. These notes do not establish that the policy improved performance, since no policy changed in May; the comparison still needed is the same team and sampling method across a policy change.';
// Positive control 2: a hypothesis the notes cannot settle, offered conditionally and labelled by what would move it.
// It runs past the prompt's 100-word cap because it spells both branches out; it illustrates how the rubric reads a
// conditional, it is not a candidate answer to the prompt.
const HYPOTHESIS='Note A gives 40% (8 of 20, Team North, April) and Note B 30% (9 of 30, Team South, May): one more request delayed but a rate 10 percentage points lower. The notes do not establish that the policy improved performance, because the teams, months and selection methods all differ. If complex requests were delayed more often than simple ones, the 30% would overstate the full May rate; if they were delayed less often, it would understate it. Which way that goes is unknown from these notes, so the comparison needed is the same team, the same sampling method, and a window before and after the policy.';

// The four adverse controls are one-line mutations of the frozen texts above: a bare hedge, an unrelated disclaimer in
// the same sentence, the supported direction reversed, and an invented size on the supported effect.
const HEDGED=OBSERVED.replace('biasing its rate','probably biasing its rate');
const DISCLAIMER_JOINED=OBSERVED.replace('improved performance. The teams','improved performance; the teams');
const REVERSED=SUPPORTED.replace('selection inflated','selection depressed').replace('rate is lower than 30%','rate is higher than 30%');
const OVERSTATED=SUPPORTED.replace('lower than 30%.','lower than 30% by 25 percentage points.');

// What the notes establish, taken from their own numbers. One selected cohort with nothing to compare it against fixes
// no direction and no size; the supported notes carry the other 45 requests and so do.
const UNRESOLVED={direction:null,magnitudePoints:null};
const SUPPORTED_FACTS={selectedDelayed:9,selectedTotal:30,otherDelayed:0,otherTotal:45};
/** The effect the notes themselves show, as the difference between the selected cohort and the whole month. */
const derived=({selectedDelayed,selectedTotal,otherDelayed,otherTotal})=>{const selected=selectedDelayed/selectedTotal,
 all=(selectedDelayed+otherDelayed)/(selectedTotal+otherTotal),delta=selected-all;
 return {direction:delta>0?'up':delta<0?'down':null,magnitudePoints:Math.round(Math.abs(delta)*100)};};
const SUPPORTED_EFFECT=derived(SUPPORTED_FACTS);

// One effect is one verb from a closed set that names the way it runs, plus a "bias" that takes its direction from an
// adverb. A plain comparative ("10 percentage points lower") and a report of the observed counts are not effects.
const EFFECTS=[[/\b(?:inflate(?:s|d)?|overstate(?:s|d)?|elevat(?:es|ed)?|lift(?:s|ed)?|raise[sd]?)\b/iu,'up'],
 [/\b(?:deflate(?:s|d)?|understate(?:s|d)?|depress(?:es|ed)?|reduc(?:e|es|ed))\b/iu,'down']],
 BIAS=/\bbias(?:es|ed|ing)?\b/iu,UPWARD=/\b(?:upward|up)\b/iu,DOWNWARD=/\b(?:downward|down)\b/iu;
// A clause is split where the notes' own prose separates propositions, so a condition or a disclaimer governs only the
// effect next to it. A condition licenses nothing unless it also names what would make the claim true.
const CLAUSE=/[^;:—]+/gu,
 CONDITIONAL=/\b(?:if|unless|whether|assuming|on the assumption|depends on|depending on|only if|provided that|contingent on)\b/iu,
 ASSUMPTION=/\b(?:more often|less often|higher|lower|related|associated|positively|negatively|greater|smaller|increases?|decreases?)\b/iu,
 MAGNITUDE=/\b(?:by\s+)?(\d+)\s*(?:percentage\s*)?points?\b/iu;
/** Every effect the answer states, with the clause it sits in, its direction, any size it gives and whether that same
 * clause carries a condition and names the assumption behind it. */
const effectsOf=text=>{const out=[];
 for(const sentence of text.trim().split(/(?<=[.!?])\s+/u)){
  const found=[];
  for(const [clause] of sentence.matchAll(CLAUSE)){
   for(const [pattern,direction] of EFFECTS)if(pattern.test(clause))found.push({clause,direction});
   if(BIAS.test(clause))found.push({clause,direction:DOWNWARD.test(clause)?'down':UPWARD.test(clause)?'up':null});
  }
  if(!found.length)continue;
  const size=MAGNITUDE.exec(sentence);
  for(const claim of found)out.push({...claim,magnitudePoints:size===null?null:Number(size[1]),
   // "If A, B would C" carries its own condition; "C, probably" is an assertion with a hedge in front of it.
   conditional:CONDITIONAL.test(claim.clause)&&ASSUMPTION.test(claim.clause)});}
 return out;};
const NOCAUSAL=/\b(?:do|does|did)(?:n't| not) (?:establish|show|prove|support|tell)|not establish|\bno evidence\b/iu;
/** @typedef {{claims:object[],unsupported:object[],direction:number,conditional:number,words:number,rateA:boolean,rateB:boolean,countVsRate:boolean,notCausal:boolean,comparable:boolean}} Claims */
/** @param {string} text @param {{direction:'up'|'down'|null,magnitudePoints:number|null}} evidence @returns {Claims} */
const claims=(text,evidence)=>{const found=effectsOf(text);
 // A claim is supported when the notes establish that very direction and, if the claim gives a size, that very size.
 // A conditional claim states the assumption it rests on instead, so it asserts nothing the notes must carry, and a
 // bare hedge is not a condition: it leaves the claim an assertion with nothing behind it.
 const unsupported=found.flatMap(claim=>{if(claim.conditional)return [];
  const reason=evidence.direction===null?'no-evidence-for-direction'
   :claim.direction===null?null
   :claim.direction!==evidence.direction?'wrong-direction'
   :claim.magnitudePoints!==null&&claim.magnitudePoints!==evidence.magnitudePoints?'wrong-magnitude':null;
  return reason===null?[]:[{...claim,reason}];});
 return {claims:found,unsupported,direction:found.length,conditional:found.filter(c=>c.conditional).length,
  words:text.trim().split(/\s+/u).length,
  rateA:/\b40\s*%/u.test(text)&&/team north/iu.test(text),rateB:/\b30\s*%/u.test(text)&&/team south/iu.test(text),
  // The count moved by one while the rate moved ten points: two different quantities, never one "fall".
  countVsRate:/\b(?:by (?:1|one)|one more|1 more|8 to 9|from 8 to 9)\b/iu.test(text)&&/\b(?:10|ten)\s*(?:percentage[\s-]*)?points?\b/iu.test(text),
  notCausal:NOCAUSAL.test(text),comparable:/same team/iu.test(text)&&/(?:same (?:sampling|sample)|sampling method|before|after)/iu.test(text)};};

test('the frozen 030 answer keeps every arithmetic and the noncausal conclusion and still asserts an unsupported direction',()=>{
 const c=claims(OBSERVED,UNRESOLVED);
 assert.equal(c.words,93,`${c.words} words`);
 assert.ok(c.rateA);assert.ok(c.rateB);assert.ok(c.countVsRate);assert.ok(c.notCausal);assert.ok(c.comparable);
 // The defect is exactly the extra clause: "biasing its rate downward regardless of policy" is stated as fact.
 assert.equal(c.direction,1);assert.equal(c.unsupported.length,1,c.unsupported.map(u=>u.clause).join(' | '));
 assert.equal(c.unsupported[0].direction,'down');assert.equal(c.unsupported[0].reason,'no-evidence-for-direction');
 assert.match(c.unsupported[0].clause,/biasing its rate downward/iu);
});
test('the rubric accepts materially different wording that leaves the effect open and states no direction as fact',()=>{
 const c=claims(OPEN,UNRESOLVED);
 assert.ok(c.words<=100,`${c.words} words`);
 assert.ok(c.rateA);assert.ok(c.rateB);assert.ok(c.countVsRate);assert.ok(c.notCausal);assert.ok(c.comparable);
 assert.deepEqual(c.unsupported,[]);
});
test('the notes\' own arithmetic fixes the supported direction and size',()=>{
 // 9 of 30 selected delayed, 0 of the other 45 delayed: the whole month is 9/75 = 12%, so the selection raised the
 // observed rate from 12% to 30%, an 18-point effect. This is the licence the supported control leans on.
 assert.equal(SUPPORTED_EFFECT.direction,'up');assert.equal(SUPPORTED_EFFECT.magnitudePoints,18);
 assert.equal(Math.round(((9+0)/(30+45))*100),12);
});
test('an evidential direction is still stated when the notes carry it, so a blanket ban on inference fails here',()=>{
 assert.match(SUPPORTED_EVIDENCE,/audit of the same May window found the other 45 Team South requests were not delayed/u);
 const c=claims(SUPPORTED,SUPPORTED_EFFECT);
 assert.equal(c.words,94,`${c.words} words`);
 assert.ok(c.rateA);assert.ok(c.rateB);assert.ok(c.countVsRate);assert.ok(c.notCausal);assert.ok(c.comparable);
 assert.deepEqual(c.unsupported,[]);
 // It states the effect outright rather than hedging it: refusing all inference would fail this test.
 assert.equal(c.direction,1);assert.equal(c.conditional,0);assert.equal(c.claims[0].direction,'up');
 // The same words against notes without that comparison are the 030 defect: the licence is the evidence.
 assert.equal(claims(SUPPORTED,UNRESOLVED).unsupported.length,1);
});
test('a conditional, correctly labelled hypothesis stays useful, in both directions and with the gap named',()=>{
 const c=claims(HYPOTHESIS,UNRESOLVED);
 assert.ok(c.rateA);assert.ok(c.rateB);assert.ok(c.countVsRate);assert.ok(c.notCausal);assert.ok(c.comparable);
 assert.equal(c.direction,2);assert.equal(c.conditional,2,'both branches carry their own condition');
 assert.deepEqual(c.unsupported,[]);
 assert.deepEqual(c.claims.map(x=>x.direction).sort(),['down','up']);
 assert.match(HYPOTHESIS,/unknown/iu);
});
test('adverse 1: a bare hedge in front of the retained unsupported direction still fails',()=>{
 const c=claims(HEDGED,UNRESOLVED);
 assert.equal(c.words,94,`${c.words} words`);
 assert.ok(c.rateA);assert.ok(c.rateB);assert.ok(c.countVsRate);assert.ok(c.notCausal);assert.ok(c.comparable);
 // "probably" is not evidence: no condition and no assumption, so the clause is still an assertion.
 assert.equal(c.unsupported.length,1,c.unsupported.map(u=>u.clause).join(' | '));
 assert.equal(c.unsupported[0].reason,'no-evidence-for-direction');assert.match(c.unsupported[0].clause,/probably biasing/iu);
});
test('adverse 2: an unrelated disclaimer in the same sentence licenses nothing',()=>{
 const c=claims(DISCLAIMER_JOINED,UNRESOLVED);
 assert.equal(c.words,93,`${c.words} words`);
 assert.ok(c.rateA);assert.ok(c.rateB);assert.ok(c.countVsRate);assert.ok(c.notCausal);assert.ok(c.comparable);
 // The policy disclaimer shares the sentence but not the claim's clause, which is unchanged.
 assert.equal(c.unsupported.length,1,c.unsupported.map(u=>u.clause).join(' | '));
 assert.equal(c.unsupported[0].reason,'no-evidence-for-direction');assert.match(c.unsupported[0].clause,/biasing its rate downward/iu);
});
test('adverse 3: the supported notes do not license the opposite direction',()=>{
 const c=claims(REVERSED,SUPPORTED_EFFECT);
 assert.equal(c.words,94,`${c.words} words`);
 assert.ok(c.rateA);assert.ok(c.rateB);assert.ok(c.countVsRate);assert.ok(c.notCausal);assert.ok(c.comparable);
 assert.equal(c.unsupported.length,1,c.unsupported.map(u=>u.clause).join(' | '));
 assert.equal(c.unsupported[0].direction,'down');assert.equal(c.unsupported[0].reason,'wrong-direction');
});
test('adverse 4: the supported notes do not license an invented effect size',()=>{
 const c=claims(OVERSTATED,SUPPORTED_EFFECT);
 assert.equal(c.words,98,`${c.words} words`);
 assert.ok(c.rateA);assert.ok(c.rateB);assert.ok(c.countVsRate);assert.ok(c.notCausal);assert.ok(c.comparable);
 // The direction is right and the size is not: 18 points, not 25.
 assert.equal(c.unsupported.length,1,c.unsupported.map(u=>u.clause).join(' | '));
 assert.equal(c.unsupported[0].direction,'up');assert.equal(c.unsupported[0].magnitudePoints,25);
 assert.equal(c.unsupported[0].reason,'wrong-magnitude');
});
test('the canonical append carries the explanatory-evidence guidance (composition only, not model behaviour)',()=>{
 const runtime={binding,versions,cwd:`/workspace/conversations/${binding.conversationId}`,model:BEDROCK_MODEL,region:'us-east-1',maxOutputTokens:4096,providerEnvironment:{},sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+1000,maxTurns:20,maxCostMicroUSD:2000000,maxOutputBytes:1024};
 const append=buildConversationOptions(runtime,new AbortController()).systemPrompt.append;
 const rule='In an explanation, a mechanism, causal effect, direction or magnitude needs evidence: state what is observed, what the evidence supports and what remains unresolved, and give a supported direction or a clearly labelled hypothesis.';
 assert.ok(RESPONSE_VOICE.includes(rule));assert.ok(append.includes(rule));
 // The rule refines the existing calibration sentence and costs RESPONSE_STYLE nothing; its guard is untouched.
 assert.ok(append.includes('Calibrate certainty, distinguish evidence from inference'));
 assert.ok(RESPONSE_STYLE.length<2000,`${RESPONSE_STYLE.length} characters`);
 assert.ok(!RESPONSE_STYLE.includes(rule),'the guarded string is not inflated to make room');
});
