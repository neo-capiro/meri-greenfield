/** Objective-only source custody owner. No mount, issuance, material or task write.
 * `store` is an owner-supplied durable immutable CAS port, NOT implemented here:
 * read/putOnce return {state:'ABSENT'|'UNKNOWN'} or {state:'COMMITTED',record}.
 * The global generationJobId key cannot be rebound. An uncertain claim must not
 * subsequently read ABSENT. Identical committed replay is the sole write retry.
 * Only a thrown OBJECTIVE_CUSTODY_ACK_UNKNOWN can enter readback recovery;
 * explicit answers and other failures deny the operation without recovery.
 * `freshAuthority.assertCurrent` must independently authenticate current native
 * actor/client membership and exact original scopes for the requested purpose;
 * an echoed Core publication or caller binding is not such an authority. It
 * returns only {binding,clientId,checkedAtMs,expiresAtMs}. Active preparedReader
 * returns {issued,checkedAtMs,expiresAtMs} only after the existing admitted-task/
 * facts reader succeeds, preserving its shortest fresh Core proof deadline.
 * All ports are trusted composition dependencies, never request-supplied code. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {assertObjectiveAcceptedRun,createObjectiveCustodyRecord,assertObjectiveCustodyRecord,assertObjectiveCustodyAccepted,
 projectObjectiveSourceObservation,objectiveActiveStates,objectiveHistoricalStates,objectiveSourceUnavailable} from './projection.mjs';

const refuse=()=>{throw objectiveSourceUnavailable();};
const same=(a,b)=>hash(a)===hash(b);
const purposes=['active-source','historical-source'];
const selectorOf=value=>{
 const v=data(own(value,['generationJobId','sourceAdmissionSha256']));
 if(typeof v.generationJobId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[a-f0-9]{12}$/u.test(v.generationJobId)||
    typeof v.sourceAdmissionSha256!=='string'||!/^[a-f0-9]{64}$/u.test(v.sourceAdmissionSha256))refuse();return v;
};

export function createObjectiveSourceCustody(configuration={}){
 let enabled=false,now=Date.now,maxRequestMs=3000,readStore,putOnce,readRun,readIssuance,readPrepared,assertCurrent;
 try{
  const c=own(configuration,[],['store','acceptedRuns','issuanceStore','preparedReader','freshAuthority','enabled','now','maxRequestMs']);
  if(c.enabled===true){
   now=c.now??Date.now;maxRequestMs=c.maxRequestMs??3000;
   if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3000)refuse();
   readStore=storageMethod(c.store,'read');putOnce=storageMethod(c.store,'putOnce');readRun=storageMethod(c.acceptedRuns,'read');
   readIssuance=storageMethod(c.issuanceStore,'read');assertCurrent=storageMethod(c.freshAuthority,'assertCurrent');
   readPrepared=c.preparedReader===undefined?null:storageMethod(c.preparedReader,'read');enabled=true;
  }
 }catch{enabled=false;}
 const uncertain=new Set();
 const available=(purpose='active-source')=>enabled&&purposes.includes(purpose)&&(purpose==='historical-source'||readPrepared!==null);
 const lifetime=signal=>{
  nativeSignal(signal);if(!enabled)refuse();let previous=now();
  if(!Number.isSafeInteger(previous)||previous<0)refuse();const startedAtMs=previous,deadlineMs=startedAtMs+maxRequestMs;
  const clock=()=>{const instant=now();if(!Number.isSafeInteger(instant)||instant<previous)refuse();previous=instant;return instant;};
  return Object.freeze({...createOperationLifetime({now:clock,signal,deadlineMs,errorFactory:objectiveSourceUnavailable}),now:clock,startedAtMs,deadlineMs});
 };
 const stateOf=value=>{
  const s=own(value,['state'],['record']);if(!['ABSENT','UNKNOWN','COMMITTED'].includes(s.state)||(s.state==='COMMITTED')!==Object.hasOwn(s,'record'))refuse();
  return s.state==='COMMITTED'?{state:s.state,record:assertObjectiveCustodyRecord(s.record)}:{state:s.state};
 };
 async function stored(jobId,life){const answer=stateOf(await life.run(signal=>readStore({generationJobId:jobId,signal})));life.check();return answer;}
 async function accepted(binding,life){const answer=await life.run(()=>readRun(binding,{},life.check));life.check();return assertObjectiveAcceptedRun({run:answer?.run,request:answer?.request});}
 async function issued(record,life){
  // Direct metadata read intentionally does not impose expired execution leases.
  // Only this closed receipt is compared; materialRef is never copied or exposed.
  const answer=await life.run(()=>readIssuance({issuanceKey:record.issued.issuance.issuanceKey}));life.check();
  const raw=own(answer,['state','issuanceKey','binding','requestSha256','expiresAtMs','grantId','capabilitySha256','factsSha256'],['materialRef','claimFence','version','claimedAt','issuedAt']);
  if(!raw||raw.state!=='ISSUED')refuse();
  const receipt=data(Object.fromEntries(['issuanceKey','binding','requestSha256','expiresAtMs','grantId','capabilitySha256','factsSha256'].map(key=>[key,raw[key]])));
  if(!same(receipt,record.issued.issuance))refuse();
 }
 async function fresh(record,purpose,life){
  const source={generationJobId:record.generationJobId,sourceAdmissionSha256:record.sourceAdmissionSha256,binding:record.binding};
  const began=life.now(),answer=data(own(await life.run(signal=>assertCurrent({purpose,source,signal})),['binding','clientId','checkedAtMs','expiresAtMs']));life.check();
  if(!same(answer.binding,record.binding)||answer.clientId!==record.issued.objectiveGeneration.sourceAdmission.canonical.clientId||
     !Number.isSafeInteger(answer.checkedAtMs)||answer.checkedAtMs<began||answer.checkedAtMs>life.now()||
     !Number.isSafeInteger(answer.expiresAtMs)||answer.expiresAtMs<=life.now())refuse();
  life.limitDeadline(answer.expiresAtMs);return answer.expiresAtMs;
 }
 const matches=(record,selector)=>{if(record.generationJobId!==selector.generationJobId||record.sourceAdmissionSha256!==selector.sourceAdmissionSha256)refuse();};

 async function publish(value){
  let life;
  try{
   const v=own(value,['issued'],['signal']);life=lifetime(v.signal);const candidate=data(v.issued);
   // This binding is only a lookup comparator. Canonical accepted.run owns the
   // binding that enters the immutable record; equality with ISSUED is required.
   const first=await accepted(candidate.original?.binding,life),record=createObjectiveCustodyRecord({accepted:first,issued:candidate});
   if(!objectiveActiveStates.includes(first.run.state))refuse();life.limitDeadline(record.issued.issuance.expiresAtMs);
   await fresh(record,'active-source',life);await issued(record,life);
   let saved=await stored(record.generationJobId,life);
   if(saved.state==='COMMITTED'){if(!same(saved.record,record))refuse();}
   else{
    if(saved.state!=='ABSENT'||uncertain.has(record.generationJobId))refuse();
    uncertain.add(record.generationJobId);
    // A lost acknowledgement is recoverable only by exact committed readback.
    let putAnswer,acknowledgementLost=false;
    try{putAnswer=await life.run(signal=>putOnce({generationJobId:record.generationJobId,record,signal}));}
    catch(error){if(error?.code!=='OBJECTIVE_CUSTODY_ACK_UNKNOWN')refuse();acknowledgementLost=true;}
    // Validation failures and explicit non-commit/conflict answers are not lost
    // transport acknowledgements and can never be recovered into success.
    if(!acknowledgementLost){const result=stateOf(putAnswer);if(result.state!=='COMMITTED'||!same(result.record,record))refuse();}
    saved=await stored(record.generationJobId,life);if(saved.state!=='COMMITTED'||!same(saved.record,record))refuse();
   }
   await fresh(record,'active-source',life);await issued(record,life);
   const last=assertObjectiveCustodyAccepted(record,await accepted(record.binding,life));if(!objectiveActiveStates.includes(last.run.state))refuse();
   saved=await stored(record.generationJobId,life);if(saved.state!=='COMMITTED'||!same(saved.record,record))refuse();
   life.check();uncertain.delete(record.generationJobId);
   return data({schemaVersion:2,generationJobId:record.generationJobId,sourceAdmissionSha256:record.sourceAdmissionSha256,custodySha256:hash(record)});
  }catch{refuse();}finally{life?.close();}
 }

 async function read(value){
  let life;
  try{
   const v=own(value,['generationJobId','sourceAdmissionSha256','purpose'],['signal']);nativeSignal(v.signal);
   if(!available(v.purpose))refuse();const selector=selectorOf({generationJobId:v.generationJobId,sourceAdmissionSha256:v.sourceAdmissionSha256});life=lifetime(v.signal);
   const initial=await stored(selector.generationJobId,life);if(initial.state!=='COMMITTED')refuse();const record=initial.record;matches(record,selector);
   if(v.purpose==='active-source')life.limitDeadline(record.issued.issuance.expiresAtMs);
   let expiry=Math.min(life.deadlineMs,await fresh(record,v.purpose,life));
   const before=assertObjectiveCustodyAccepted(record,await accepted(record.binding,life));
   if(!(v.purpose==='active-source'?objectiveActiveStates:objectiveHistoricalStates).includes(before.run.state))refuse();
   await issued(record,life);
   if(v.purpose==='active-source'){
    expiry=Math.min(expiry,record.issued.issuance.expiresAtMs);
    // Actual prepared reader owns fresh admitted allocation/task proof and Core
    // currentness. Hash equality alone cannot stand in for that owner read.
    const began=life.now(),prepared=data(own(await life.run(signal=>readPrepared({binding:record.binding,signal})),['issued','checkedAtMs','expiresAtMs']));life.check();
    if(!same(prepared.issued,record.issued)||!Number.isSafeInteger(prepared.checkedAtMs)||prepared.checkedAtMs<began||prepared.checkedAtMs>life.now()||
       !Number.isSafeInteger(prepared.expiresAtMs)||prepared.expiresAtMs<=life.now())refuse();
    expiry=Math.min(expiry,prepared.expiresAtMs);life.limitDeadline(prepared.expiresAtMs);
   }
   const after=assertObjectiveCustodyAccepted(record,await accepted(record.binding,life));await issued(record,life);
   if(!same(before,after))refuse();const final=await stored(selector.generationJobId,life);
   if(final.state!=='COMMITTED'||!same(final.record,record))refuse();expiry=Math.min(expiry,await fresh(record,v.purpose,life));life.check();
   const checkedAtMs=life.now();if(checkedAtMs<life.startedAtMs||expiry>life.deadlineMs||expiry<=checkedAtMs)refuse();
   return projectObjectiveSourceObservation({record,accepted:after,purpose:v.purpose,checkedAtMs,expiresAtMs:expiry});
  }catch{refuse();}finally{life?.close();}
 }
 return Object.freeze({available,publish,read});
}
