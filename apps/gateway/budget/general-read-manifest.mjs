/** P3: the base general-read manifest, the allocation `manifest` of an ordinary conversation run that has no selected skill.
 * Proposal-local closed shape pending dot (SkillManifest's `skillId` is an enum of the 14 skills, so a base profile cannot be a
 * SkillManifest). It carries only operations, budgets and the Core-configuration evidence its tariffs rely on; it is never
 * spending authority by itself — the Meri budget owner (postgres-tool-budget.mjs) reserves and settles every call against it,
 * and a selected skill may only narrow it. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {validateShape as privateShape,resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {refuse} from './postgres-budget-store.mjs';
import {GENERAL_READ_TARIFFS,GENERAL_READ_TARIFF_ASSUMPTION_KEYS,GENERAL_READ_DOCUMENT_BOUNDS} from './general-read-tariffs.mjs';

export const GENERAL_READ_PROFILE='meri.general_reads',GENERAL_READ_PROFILE_VERSION='1.0.0';
const MiB=1048576;
/** Structural bounds of any base general-read allocation: the gateway's own response cap per result (16 MiB, the dispatch
 * `maxResponseBytes` limit) and a run aggregate of at most 16 results' worth. Tool calls and spend are not among them: the
 * run's configured `maxToolCalls` and `maxCostMicroUSD` apply (D016-A 3), with per-call reservation and the typed
 * budget-exhausted stop (D016 3). */
export const GENERAL_READ_CEILINGS=Object.freeze({maxOutputBytes:16*MiB,maxAggregateOutputBytes:256*MiB,maxRecoveryAttempts:0,maxOperations:128});
/** The default read-bytes profile (1 MiB per result, 2 MiB per run): validated and configurable, not a universal ceiling. */
export const GENERAL_READ_DEFAULT_READ_BYTES=Object.freeze({maxOutputBytes:MiB,maxAggregateOutputBytes:2*MiB});
/** D016 3 / D016-A 3: the default integration run profile (20 turns, 20 tool calls, 900 s, $2). Per-tenant and per-run values come
 * from the existing budget owners; this is the default, not a ceiling. */
export const GENERAL_READ_DEFAULT_RUN_BUDGETS=Object.freeze({maxTurns:20,maxToolCalls:20,maxRuntimeSeconds:900,maxCostMicroUSD:2000000});
const KEYS=['contractVersion','profile','profileVersion','allowedOperations','budgets','maxAggregateOutputBytes'],OPTIONAL=['tariffAssumptions','documentPricing'];
export const DOCUMENT_READ='read_client_documents@0.2.0';
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const EVIDENCE_KEYS=['id','configKey','configValue','coreSourceCommit','coreImageDigest','configurationSha256'];

/** D016 3: one worst-case hold fits the run cap. Spend beyond that is governed per call by the reservation and the typed
 * budget-exhausted stop, never by requiring every allowed call to fit up front. */
export function assertOneHoldFits(budgets,charges){if(!charges.length||Math.max(...charges)>budgets.maxCostMicroUSD)refuse('BUDGET_EXHAUSTED');}

/** Evidence that a tariff's Core-configuration assumption holds in the measured Core: the exact setting, bound to the reviewed
 * Core source commit, the image digest and the digest of the configuration the render read. Format and key/value are checked
 * here; the render owns the measurement. */
export function assertTariffAssumptionEvidence(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length!==EVIDENCE_KEYS.length||EVIDENCE_KEYS.some(key=>!Object.hasOwn(raw,key)))refuse('INVALID_TARIFF_ASSUMPTION');
 const expected=GENERAL_READ_TARIFF_ASSUMPTION_KEYS[raw.id];
 if(!expected||raw.configKey!==expected.configKey||raw.configValue!==expected.configValue||typeof raw.coreSourceCommit!=='string'||!/^[a-f0-9]{40}$/u.test(raw.coreSourceCommit)||
  typeof raw.coreImageDigest!=='string'||!/^sha256:[a-f0-9]{64}$/u.test(raw.coreImageDigest)||typeof raw.configurationSha256!=='string'||!/^[a-f0-9]{64}$/u.test(raw.configurationSha256))refuse('INVALID_TARIFF_ASSUMPTION');
 return raw;
}

const PROVENANCE=['coreSourceCommit','coreImageDigest','configurationSha256'];
const provenance=v=>typeof v.coreSourceCommit==='string'&&/^[a-f0-9]{40}$/u.test(v.coreSourceCommit)&&typeof v.coreImageDigest==='string'&&/^sha256:[a-f0-9]{64}$/u.test(v.coreImageDigest)&&
 typeof v.configurationSha256==='string'&&/^[a-f0-9]{64}$/u.test(v.configurationSha256);
const closed=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(key=>Object.hasOwn(v,key));
/** Evidence for pricing read_client_documents: the vision model's prices and a one-page input-token bound, and Core's
 * transcription duration cap with whisper-1's price. Each is bound to the measured Core. Prices are µUSD per million tokens or
 * per audio minute. Returns the per-call charge: 1 + max(vision, transcription), rounded up. */
export function documentReadCharge(raw){
 if(!closed(raw,['vision','transcription']))refuse('INVALID_DOCUMENT_PRICING');
 const v=raw.vision,t=raw.transcription,b=GENERAL_READ_DOCUMENT_BOUNDS;
 if(!closed(v,['model','inputMicrousdPerMillionTokens','outputMicrousdPerMillionTokens','maxInputTokens',...PROVENANCE])||typeof v.model!=='string'||!/^[A-Za-z0-9._-]{1,64}$/u.test(v.model)||!provenance(v)||
  !Number.isSafeInteger(v.inputMicrousdPerMillionTokens)||v.inputMicrousdPerMillionTokens<0||!Number.isSafeInteger(v.outputMicrousdPerMillionTokens)||v.outputMicrousdPerMillionTokens<0||
  !Number.isSafeInteger(v.maxInputTokens)||v.maxInputTokens<1||v.maxInputTokens>2000000)refuse('INVALID_DOCUMENT_PRICING');
 if(!closed(t,['model','microusdPerMinute','maxAudioSeconds',...PROVENANCE])||t.model!==b.transcription.model||!provenance(t)||
  !Number.isSafeInteger(t.microusdPerMinute)||t.microusdPerMinute<0||!Number.isSafeInteger(t.maxAudioSeconds)||t.maxAudioSeconds<1||t.maxAudioSeconds>86400)refuse('INVALID_DOCUMENT_PRICING');
 const vision=Math.ceil((v.maxInputTokens*v.inputMicrousdPerMillionTokens+b.vision.maxOutputTokens*v.outputMicrousdPerMillionTokens)/1e6);
 const transcription=Math.ceil(t.maxAudioSeconds*t.microusdPerMinute/60);
 const charge=b.textChargeMicrousd+Math.max(vision,transcription);if(!Number.isSafeInteger(charge))refuse('INVALID_DOCUMENT_PRICING');return charge;
}

export const isGeneralReadManifest=manifest=>Boolean(manifest&&typeof manifest==='object'&&!Array.isArray(manifest)&&Object.hasOwn(manifest,'profile'));

export function assertGeneralReadManifest(manifest){
 if(!isGeneralReadManifest(manifest)||KEYS.some(key=>!Object.hasOwn(manifest,key))||Object.keys(manifest).some(key=>!KEYS.includes(key)&&!OPTIONAL.includes(key))||manifest.contractVersion!=='0.2.0'||
  manifest.profile!==GENERAL_READ_PROFILE||manifest.profileVersion!==GENERAL_READ_PROFILE_VERSION)refuse('INVALID_GENERAL_READ_MANIFEST');
 const ops=manifest.allowedOperations,b=manifest.budgets;
 if(!Array.isArray(ops)||!ops.length||ops.length>GENERAL_READ_CEILINGS.maxOperations)refuse('INVALID_GENERAL_READ_MANIFEST');
 // The assumptions an allocated tariff relies on travel with the allocation (and its sha256); none may be dropped or invented.
 const evidence=manifest.tariffAssumptions??[];
 if(!Array.isArray(evidence)||Object.hasOwn(manifest,'tariffAssumptions')&&!evidence.length)refuse('INVALID_GENERAL_READ_MANIFEST');
 const held=new Set();for(const item of evidence){assertTariffAssumptionEvidence(item);if(held.has(item.id))refuse('INVALID_GENERAL_READ_MANIFEST');held.add(item.id);}
 if(evidence.some((item,i)=>i>0&&evidence[i-1].id.localeCompare(item.id)>=0))refuse('INVALID_GENERAL_READ_MANIFEST');
 const needed=new Set(),seen=new Set();
 for(const op of ops){privateShape('OperationRef',op);const d=resolveOperationContract(op).descriptor,key=canonicalSha256(op);
  if(seen.has(key)||d.sideEffect!=='none'||d.approvalBoundary!=='none')refuse('INVALID_GENERAL_READ_MANIFEST');seen.add(key);
  for(const id of GENERAL_READ_TARIFFS[`${op.id}@${op.version}`]?.assumptions??[])needed.add(id);}
 if([...needed].some(id=>!held.has(id))||[...held].some(id=>!needed.has(id)))refuse('INVALID_GENERAL_READ_MANIFEST');
 // The document read is allocated only with its pricing evidence, and that evidence only with the document read.
 const documents=ops.some(op=>`${op.id}@${op.version}`===DOCUMENT_READ);
 if(documents!==Object.hasOwn(manifest,'documentPricing'))refuse('INVALID_GENERAL_READ_MANIFEST');if(documents)documentReadCharge(manifest.documentPricing);
 privateShape('Budgets',b);
 if(b.maxRecoveryAttempts!==GENERAL_READ_CEILINGS.maxRecoveryAttempts||!integer(b.maxToolCalls,1,Number.MAX_SAFE_INTEGER)||
  !integer(b.maxOutputBytes,1,GENERAL_READ_CEILINGS.maxOutputBytes)||
  !integer(manifest.maxAggregateOutputBytes,b.maxOutputBytes,GENERAL_READ_CEILINGS.maxAggregateOutputBytes))refuse('INVALID_GENERAL_READ_MANIFEST');
 return manifest;
}
