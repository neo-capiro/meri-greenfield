/** P3: the base general-read manifest, the allocation `manifest` of an ordinary conversation run that has no selected skill.
 * Proposal-local closed shape pending dot (SkillManifest's `skillId` is an enum of the 14 skills, so a base profile cannot be a
 * SkillManifest). It carries only operations and budgets; it is never spending authority by itself — the Meri budget owner
 * (postgres-tool-budget.mjs) reserves and settles every call against it, and a selected skill may only narrow it. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {validateShape as privateShape,resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {refuse} from './postgres-budget-store.mjs';

export const GENERAL_READ_PROFILE='meri.general_reads',GENERAL_READ_PROFILE_VERSION='1.0.0';
/** Upper bounds of any base general-read allocation (proposal §2.7; unqualified until approved). */
export const GENERAL_READ_CEILINGS=Object.freeze({maxToolCalls:24,maxOutputBytes:1048576,maxAggregateOutputBytes:2097152,maxRecoveryAttempts:0,maxOperations:128});
const KEYS=['contractVersion','profile','profileVersion','allowedOperations','budgets','maxAggregateOutputBytes'];
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;

export const isGeneralReadManifest=manifest=>Boolean(manifest&&typeof manifest==='object'&&!Array.isArray(manifest)&&Object.hasOwn(manifest,'profile'));

export function assertGeneralReadManifest(manifest){
 if(!isGeneralReadManifest(manifest)||Object.keys(manifest).length!==KEYS.length||KEYS.some(key=>!Object.hasOwn(manifest,key))||manifest.contractVersion!=='0.2.0'||
  manifest.profile!==GENERAL_READ_PROFILE||manifest.profileVersion!==GENERAL_READ_PROFILE_VERSION)refuse('INVALID_GENERAL_READ_MANIFEST');
 const ops=manifest.allowedOperations,b=manifest.budgets;
 if(!Array.isArray(ops)||!ops.length||ops.length>GENERAL_READ_CEILINGS.maxOperations)refuse('INVALID_GENERAL_READ_MANIFEST');
 const seen=new Set();
 for(const op of ops){privateShape('OperationRef',op);const d=resolveOperationContract(op).descriptor,key=canonicalSha256(op);
  if(seen.has(key)||d.sideEffect!=='none'||d.approvalBoundary!=='none')refuse('INVALID_GENERAL_READ_MANIFEST');seen.add(key);}
 privateShape('Budgets',b);
 if(b.maxRecoveryAttempts!==GENERAL_READ_CEILINGS.maxRecoveryAttempts||!integer(b.maxToolCalls,1,GENERAL_READ_CEILINGS.maxToolCalls)||
  !integer(b.maxOutputBytes,1,GENERAL_READ_CEILINGS.maxOutputBytes)||
  !integer(manifest.maxAggregateOutputBytes,b.maxOutputBytes,GENERAL_READ_CEILINGS.maxAggregateOutputBytes))refuse('INVALID_GENERAL_READ_MANIFEST');
 return manifest;
}
