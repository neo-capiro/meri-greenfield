/** 030 explanatory inference: an explanation may add a direction or a size of an effect only when the supplied evidence
 * carries it. The frozen case is the visible-QA observation B011-NEW-01 over a synthetic note (no client, tenant,
 * conversation or run data; the prompt and the answer are reproduced in full because they are the whole evidence).
 * The rubric reads a few claims out of an answer against what the supplied notes establish, so any wording that keeps
 * the claims passes: it is not an exact-string oracle and it bans no phrase. Two positive controls keep a direction the
 * notes support and a correctly labelled hypothetical useful, so an answer that refuses all inference fails them.
 * The last test proves only that the canonical instruction reaches the SDK, never that the model obeys it; generated
 * text needs a separately allocated visible-QA run. */
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
const HYPOTHESIS='Note A gives 40% (8 of 20, Team North, April) and Note B 30% (9 of 30, Team South, May): one more request delayed but a rate 10 percentage points lower. The notes do not establish that the policy improved performance, because the teams, months and selection methods all differ. If complex requests were delayed more often than simple ones, the 30% would overstate the full May rate; if they were delayed less often, it would understate it. Which way that goes is unknown from these notes, so the comparison needed is the same team, the same sampling method, and a window before and after the policy.';

// A hedge or a condition makes a directional sentence a hypothesis or an explicitly open question rather than an
// assertion. `may` is matched case-sensitively: in these notes "May" is a month, not a modal.
const HEDGE=/\b(?:might|could|would|if|unless|whether|likely|possibly|perhaps|probably|suggest(?:s|ed|ing)?|assum(?:e|es|ing|ption)|depending|hypothes\w*|unknown|unclear|not (?:clear|known|established|supported|shown)|(?:do|does|did)(?:n't| not) (?:establish|show|tell|say|support|mean)|no (?:evidence|basis|way (?:to know|of knowing)))\b/iu;
const MODAL=/\bmay\b/;
// A verb that puts an effect on the observed rate, and a closed set of verbs that carry their own direction. A plain
// comparative ("10 percentage points lower") is not an effect claim: it reports the difference the two notes already give.
const EFFECT=/\b(?:bias(?:es|ed|ing)?|skew(?:s|ed)?|push(?:es|ed)?|pull(?:s|ed)?|driv(?:e|es|ing)|distort(?:s|ed)?|depress(?:es|ed)?|elevat(?:es|ed)?|overstate[sd]?|understate[sd]?|inflate[sd]?|deflate[sd]?|reduce[sd]?|suppress(?:es|ed)?|lift(?:s|ed)?)\b/iu;
const INHERENT=/\b(?:overstate[sd]?|understate[sd]?|inflate[sd]?|deflate[sd]?|reduce[sd]?|suppress(?:es|ed)?|distort(?:s|ed)?|depress(?:es|ed)?|elevat(?:es|ed)?)\b/iu;
const DIRECTION=/\b(?:downward|upward|down|up|higher|lower|more often|less often|negative|positive)\b/iu;
const NOCAUSAL=/\b(?:do|does|did)(?:n't| not) (?:establish|show|prove|support|tell)|not establish|\bno evidence\b/iu;
/** @typedef {{rateA:boolean,rateB:boolean,countVsRate:boolean,notCausal:boolean,comparable:boolean,direction:number,unlicensed:string[],words:number,sentences:number}} Claims */
/** @param {string} text @param {'unresolved'|'supported'} establishes @returns {Claims} */
const claims=(text,establishes)=>{const sentences=text.trim().split(/(?<=[.!?])\s+/u);
 const directional=sentences.filter(s=>EFFECT.test(s)&&(DIRECTION.test(s)||INHERENT.test(s)));
 // A directional sentence is licensed when the supplied notes establish the direction, or when the answer hedges it.
 const unlicensed=directional.filter(s=>establishes!=='supported'&&!HEDGE.test(s)&&!MODAL.test(s));
 return {words:text.trim().split(/\s+/u).length,sentences:sentences.length,
  rateA:/\b40\s*%/u.test(text)&&/team north/iu.test(text),rateB:/\b30\s*%/u.test(text)&&/team south/iu.test(text),
  // The count moved by one while the rate moved ten points: two different quantities, never one "fall".
  countVsRate:/\b(?:by (?:1|one)|one more|1 more|8 to 9|from 8 to 9)\b/iu.test(text)&&/\b(?:10|ten)\s*(?:percentage[\s-]*)?points?\b/iu.test(text),
  notCausal:NOCAUSAL.test(text),comparable:/same team/iu.test(text)&&/(?:same (?:sampling|sample)|sampling method|before|after)/iu.test(text),
  direction:directional.length,unlicensed};};

test('the frozen 030 answer keeps every arithmetic and the noncausal conclusion and still asserts an unsupported direction',()=>{
 const c=claims(OBSERVED,'unresolved');
 assert.ok(c.words<=100,`${c.words} words`);assert.ok(c.rateA);assert.ok(c.rateB);assert.ok(c.countVsRate);assert.ok(c.notCausal);assert.ok(c.comparable);
 // The defect is exactly the extra clause: "biasing its rate downward regardless of policy" is stated as fact.
 assert.equal(c.direction>=1,true);assert.equal(c.unlicensed.length,1,c.unlicensed.join(' | '));
 assert.match(c.unlicensed[0],/biasing its rate downward/iu);
});
test('the rubric accepts materially different wording that leaves the effect open and states no direction as fact',()=>{
 const c=claims(OPEN,'unresolved');
 assert.ok(c.words<=100,`${c.words} words`);assert.ok(c.rateA);assert.ok(c.rateB);assert.ok(c.countVsRate);assert.ok(c.notCausal);assert.ok(c.comparable);
 assert.deepEqual(c.unlicensed,[]);
});
test('an evidential direction is still stated when the notes carry it, so a blanket ban on inference fails here',()=>{
 // The notes fix the direction: the complex subset was selected and the rest of the same month had no delays.
 assert.match(SUPPORTED_EVIDENCE,/audit of the same May window found the other 45 Team South requests were not delayed/u);
 const c=claims(SUPPORTED,'supported');
 assert.ok(c.rateA);assert.ok(c.rateB);assert.ok(c.countVsRate);assert.ok(c.notCausal);assert.ok(c.comparable);
 assert.equal(c.direction>=1,true,'the supported direction is stated');assert.deepEqual(c.unlicensed,[]);
 // The same words against notes that do not carry the direction would be the 030 defect, so the licence is the evidence.
 assert.equal(claims(SUPPORTED,'unresolved').unlicensed.length>=1,true);
});
test('a conditional, correctly labelled hypothesis stays useful, in both directions and with the gap named',()=>{
 const c=claims(HYPOTHESIS,'unresolved');
 assert.ok(c.rateA);assert.ok(c.rateB);assert.ok(c.countVsRate);assert.ok(c.notCausal);assert.ok(c.comparable);
 assert.equal(c.direction>=1,true,'both conditional branches are spelled out');assert.deepEqual(c.unlicensed,[]);
 assert.match(HYPOTHESIS,/unknown/iu);
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
