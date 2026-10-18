/** Prepared-run splice reader for D7-4 (SHARED-SPLICE-PROPOSAL.md items 1-3). It is the trusted `facts.decorateObjective`
 * owner: given the canonical accepted run, its genuinely ISSUED original receipt and the existing compiler's nonsecret base
 * facts, it reads the run-start row for that exact binding from meri_objective_source.run_starts and
 *   - ABSENT  -> null: ordinary chat, today's facts and hash unchanged (a run-start row always precedes its run, so absence is
 *                definite; the store's sticky uncertainty answers UNKNOWN, never ABSENT, after an ambiguous write),
 *   - STARTED -> the protected pair compiled over the stored Core selection plus the run's issued execution selection, and the
 *                decorated bindFacts input (protected-facts.mjs), for the issuer's existing immutable bindFacts CAS,
 *   - anything else, or any mismatch between the row and the accepted run/issuance -> refused (never downgraded to ordinary).
 * `executionSelection` is the run's issued provider/model pair (the same pair query-selection-reader.mjs later compares with
 * the proxy attestation); it is supplied by the composing caller from issued facts, never by Core or the browser. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {compileObjectiveProtectedFacts,decorateObjectiveBindFactsInput} from './protected-facts.mjs';
import {assertObjectiveRunStartRecord} from './run-starts.mjs';

const fault=()=>Object.assign(Error('OBJECTIVE_RUN_START_FACTS_REFUSED'),{code:'OBJECTIVE_RUN_START_FACTS_REFUSED'});
const refuse=()=>{throw fault();};
const same=(a,b)=>hash(a)===hash(b);

export function createObjectiveRunStartFacts({runStarts}={}){
 let read;try{read=storageMethod(runStarts,'read');}catch{refuse();}
 /** The stored record for this exact binding, or null for ordinary chat. */
 async function selectionFor({binding,signal}){
  nativeSignal(signal);validateShape('RunBinding',binding);
  let answer;try{answer=data(await read({binding,signal}));}catch{refuse();}
  if(answer?.state==='ABSENT')return null;
  if(answer?.state!=='STARTED')refuse();
  try{const record=assertObjectiveRunStartRecord(answer.record);if(!same(record.binding,binding))refuse();return record;}catch{refuse();}
 }
 /** {facts,bindFactsInput} for an Objective run, null for ordinary chat. Pure after the single row read. */
 async function decorate(value){
  const v=own(value,['accepted','issuance','preparedFacts','executionSelection','nowMs'],['signal']);
  const binding=v.accepted?.run?.binding,record=await selectionFor({binding,signal:v.signal});
  if(record===null)return null;
  try{
   if(record.sourceRequestSha256!==hash(v.accepted.request)||record.effectExpiresAtMs<v.issuance.expiresAtMs)refuse();
   const pair=compileObjectiveProtectedFacts({...record.selection,executionSelection:v.executionSelection},{accepted:v.accepted,issuance:v.issuance,nowMs:v.nowMs});
   if(pair.objectiveGeneration.sourceAdmissionSha256!==record.sourceAdmissionSha256||pair.objectiveStrategy.requestSha256!==record.typedRequestSha256)refuse();
   return decorateObjectiveBindFactsInput({preparedFacts:v.preparedFacts,pair},{accepted:v.accepted,issuance:v.issuance,nowMs:v.nowMs});
  }catch{refuse();}
 }
 return Object.freeze({selectionFor,decorate});
}
