/** Control-side accepted-run owner for the Objective generation activities (`runs.start` / `runs.read`, lifecycle-activities.mjs).
 * The Temporal worker holds no database pool, so it reaches this owner only through the control native operations in
 * ../native-authority/objective-runs-http.mjs. Order for one generation job (every step idempotent for that identity):
 *   1. validate Core's decoded selection against the binding derived from (tenant, actor, job)  -> nothing written on refusal
 *   2. run start (D7-4): the immutable selection row, BEFORE any run exists                   -> postgres-run-starts.mjs
 *   3. Objective-origin original admission with Core's current authority                       -> objective-admission.mjs
 *   4. dispatch the existing conversation workflow (Temporal workflow-ID deduplication)
 * `start` answers `not-started` only when this call wrote nothing (owner disabled, selection refused, or the run-start store
 * committed nothing); every other failure throws, which the activity reports as unconfirmed, so the workflow only reads back.
 * Every step is idempotent, so a later repeated effect after `not-started` completes the same single run.
 * `read` returns the accepted run projection only for a binding that has a STARTED run-start row with the same request. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape,canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createObjectiveRunStartRecord,objectiveAcceptedRequest} from '../objective-source/run-starts.mjs';

const fault=code=>Object.assign(Error('OBJECTIVE_RUNS_'+code),{code:'OBJECTIVE_RUNS_'+code});
const fail=code=>{throw fault(code);};
const same=(a,b)=>hash(a)===hash(b);

export function createObjectiveRunOwner(configuration={}){
 let enabled=false,putOnce,readStart,admit,dispatch,readOptional,now=Date.now,maxRequestMs=10000;
 try{
  const flag=configuration&&typeof configuration==='object'&&!types.isProxy(configuration)?Object.getOwnPropertyDescriptor(configuration,'enabled'):null;
  if(flag&&'value'in flag&&flag.value===true){
   const c=own(configuration,['enabled','runStarts','admission','dispatcher','store'],['now','maxRequestMs']);
   putOnce=storageMethod(c.runStarts,'putOnce');readStart=storageMethod(c.runStarts,'read');admit=storageMethod(c.admission,'admit');
   dispatch=storageMethod(c.dispatcher,'start');readOptional=storageMethod(c.store,'readOptional');
   now=c.now??now;maxRequestMs=c.maxRequestMs??maxRequestMs;
   if(typeof now!=='function'||types.isProxy(now)||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('CONFIGURATION');
   enabled=true;
  }
 }catch{enabled=false;}
 function lifetime(signal){nativeSignal(signal);return createOperationLifetime({now,signal,deadlineMs:now()+maxRequestMs,errorFactory:()=>fault('UNKNOWN')});}
 async function start(value){
  const v=own(value,['binding','generationJobId','acceptedRequest','selection'],['signal']);nativeSignal(v.signal);
  if(!enabled)return data({kind:'not-started'});
  // Pure validation before any write: a refused selection is a definite no-op.
  let record;
  try{
   validateShape('RunBinding',v.binding);record=createObjectiveRunStartRecord({binding:v.binding,generationJobId:v.generationJobId,selection:v.selection,nowMs:now()});
   const accepted=objectiveAcceptedRequest(record.selection),claimed=own(v.acceptedRequest,['requestId','prompt']);
   if(claimed.requestId!==accepted.requestId||claimed.prompt!==accepted.prompt)fail('REFUSED');
  }catch{return data({kind:'not-started'});}
  const life=lifetime(v.signal);
  try{
   let saved;
   // The store reports UNAVAILABLE only when this call committed nothing (no COMMIT sent, or it settled as a rollback):
   // that is still a definite no-op, so the workflow may repeat the (idempotent) effect. ACK_UNKNOWN and conflicts throw.
   try{saved=data(await life.run(signal=>putOnce({record,signal})));}
   catch(error){if(error?.code==='OBJECTIVE_RUN_START_UNAVAILABLE')return data({kind:'not-started'});throw error;}
   if(saved.state!=='STARTED'||!same(saved.record,record))fail('UNKNOWN');life.check();
   const admitted=data(await life.run(signal=>admit({record,signal})));
   if(!same(admitted.binding,record.binding)||admitted.requestSha256!==record.sourceRequestSha256)fail('UNKNOWN');life.check();
   await life.run(signal=>dispatch({binding:record.binding,signal}));life.check();
   return data({kind:'started'});
  }catch{throw fault('UNKNOWN');}finally{life.close();}
 }
 async function read(value){
  const v=own(value,['binding'],['signal']);nativeSignal(v.signal);validateShape('RunBinding',v.binding);
  if(!enabled)fail('UNAVAILABLE');
  const life=lifetime(v.signal);
  try{
   const started=data(await life.run(signal=>readStart({binding:v.binding,signal})));life.check();
   if(started.state==='ABSENT')return data({run:null});
   if(started.state!=='STARTED'||!same(started.record.binding,v.binding))fail('UNKNOWN');
   const saved=await life.run(()=>readOptional(v.binding,{after:0,limit:1},life.check));life.check();
   if(saved===null)return data({run:null});
   const run=data(saved.run);validateShape('Run',run);
   if(!same(run.binding,v.binding)||hash(saved.request)!==started.record.sourceRequestSha256)fail('UNKNOWN');
   return data({run});
  }catch{throw fault('UNKNOWN');}finally{life.close();}
 }
 return Object.freeze({available:()=>enabled,start,read});
}
