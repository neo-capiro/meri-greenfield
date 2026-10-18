/** Core-proof run control: the production `runControl` of the routines feature (R0 meri-greenfield #121 6247017061 item 3).
 * It stops ONE owner run inside an attended, owner-approved `cancel_scheduled_task` with `running: 'request_cancel'`, with no
 * user session and no service privilege beyond Core's proof:
 *  1. verify the EdDSA compact JWS against the pinned key/issuer/kid (routines-cancellation-proof.mjs), ≤ 30 s and unexpired;
 *  2. require the proof to be for exactly the approval being executed (intent, digest, schedule, decision, runs, targets) and
 *     the binding to be one of its owner targets whose Temporal execution is among its runs;
 *  3. require the current fence: the canonical run row still names this exact writer (store `readOptional`, STALE_WRITER);
 *  4. consume the jti once, durably (meri_schedules.run_cancel_proofs), before any effect;
 *  5. run the existing lifecycle Stop order (conversations/lifecycle/service.mjs `cancel`): the terminal journal fence
 *     `run.status: cancelled / USER_CANCELLED` first, through the same allow-held-cancel journal append, then the Temporal
 *     dispatcher cancel; a refused append is re-read and a run that turned terminal on its own is reported as that state.
 * The two effect owners are the existing in-process ones: `store.lifecycle.cancel` (Postgres conversation store) and
 * `dispatcher.cancel` (Temporal conversation dispatcher). A call without a proof (an unattended caller such as the schedule
 * worker) refuses before any read. */
import {randomUUID} from 'node:crypto';
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {sdkMethod} from '../../control/schedules/temporal-schedule-mutations.mjs';
import {verifyRoutineCancellationProof,cancellationCoversRun} from './routines-cancellation-proof.mjs';

const same=(a,b)=>hash(a)===hash(b),terminal=state=>['completed','failed','cancelled'].includes(state);
const fault=code=>Object.assign(Error('ROUTINE_RUN_CONTROL_'+code),{code:'ROUTINE_RUN_CONTROL_'+code,outcome:'UNKNOWN'});
const refuse=code=>{throw fault(code);};
export function createRoutinesRunControl(configuration){
 let c,consume,readRun,journalCancel,dispatchCancel;
 try{
  c=own(configuration,['trust','ledger','store','dispatcher','now','maxRequestMs'],['newId']);
  consume=sdkMethod(c.ledger,'consume');readRun=sdkMethod(c.store,'readOptional');
  const facet=Object.getOwnPropertyDescriptor(c.store,'lifecycle');if(!facet||!Object.hasOwn(facet,'value'))throw Error();
  journalCancel=sdkMethod(facet.value,'cancel');dispatchCancel=sdkMethod(c.dispatcher,'cancel');
  if(typeof c.now!=='function'||types.isProxy(c.now)||c.newId!==undefined&&typeof c.newId!=='function'||!Number.isSafeInteger(c.maxRequestMs)||c.maxRequestMs<1||c.maxRequestMs>30000||!c.trust)throw Error();
 }catch{throw Object.assign(Error('ROUTINES_CONFIGURATION'),{code:'ROUTINES_CONFIGURATION'});}
 const now=c.now,newId=c.newId??randomUUID;
 async function cancel(value){
  let v,binding,expected;
  try{
   v=own(value,['binding','proof','expected','deadlineMs'],['signal']);nativeSignal(v.signal);binding=data(v.binding);validateShape('RunBinding',binding);
   expected=data(own(v.expected,['intentId','intentSha256','scheduleId','decisionSha256','runs','targets']));
  }catch{refuse('REQUEST');}
  if(!Number.isSafeInteger(v.deadlineMs)||typeof v.proof!=='string')refuse('REQUEST');
  const began=now(),verified=verifyRoutineCancellationProof(v.proof,{trust:c.trust,nowMs:began}),k=verified.claims;
  if(k.intentId!==expected.intentId||k.intentSha256!==expected.intentSha256||k.scheduleId!==expected.scheduleId||k.decisionSha256!==expected.decisionSha256||
   !same(k.runs,expected.runs)||!same(k.targets,expected.targets)||!cancellationCoversRun(k,binding))refuse('PROOF');
  const cutoff=Math.min(v.deadlineMs,began+c.maxRequestMs,verified.exp*1000);
  const life=createOperationLifetime({now,signal:v.signal,deadlineMs:cutoff,errorFactory:code=>fault(code)});
  try{
   const read=async()=>{const saved=await life.run(()=>readRun(binding,{after:0,limit:1},life.check));if(saved===null||!same(saved.run?.binding,binding))refuse('FENCE');return saved;};
   const saved=await read();
   await life.run(()=>consume({issuer:verified.issuer,keyId:verified.kid,tokenId:verified.jti,tenantId:k.tenantId,ownerActorId:k.ownerActorId,scheduleId:k.scheduleId,intentId:k.intentId,
    intentSha256:k.intentSha256,decisionSha256:k.decisionSha256,claimsSha256:hash(k),proofSha256:verified.proofSha256,binding,issuedAtS:verified.iat,expiresAtS:verified.exp},life.check));
   let state=saved.run.state;
   if(!terminal(state)){
    const event={contractVersion:'0.1.0',eventId:newId(),createdAt:new Date(now()).toISOString(),type:'run.status',data:{state:'cancelled',reasonCode:'USER_CANCELLED'}};
    try{await life.run(()=>journalCancel(binding,event,life.check,saved.run.scopes));state='cancelled';}
    catch(error){life.check();const current=await read();if(!terminal(current.run.state))throw error;state=current.run.state;}
   }
   const stopped=data(await life.run(signal=>dispatchCancel({binding,signal,deadlineMs:cutoff})));
   if(!stopped||!['CANCEL_REQUESTED','NOT_FOUND'].includes(stopped.workflow))refuse('DISPATCH');life.check();
   return data({state,workflow:stopped.workflow});
  }finally{life.close();}
 }
 return Object.freeze({cancel});
}
