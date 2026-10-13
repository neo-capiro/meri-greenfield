import {createTaskLookupDelivery} from '../../../apps/control/task-lookup/index.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {admit,prepared,options,method,safeCode,snapshot,hash,freeze,error,operation} from './admission.mjs';
const size=value=>Buffer.byteLength(JSON.stringify(value));
const failure=(code,outcome)=>({code,outcome});
const exception=code=>Object.assign(new Error(code),{code});
/** Fixed typed lookup replay. Ports are supplied by the trusted host, never input data. */
export function createTaskLookupExecution(configuration){
 const {gateway,store,authorize,prepareCase,clock,maxCaptureBytes=16*1024*1024}=options(configuration,['gateway','store','authorize','prepareCase','clock'],['maxCaptureBytes']);
 if(typeof authorize!=='function'||typeof prepareCase!=='function'||typeof clock!=='function'||!Number.isSafeInteger(maxCaptureBytes)||maxCaptureBytes<16384||maxCaptureBytes>64*1024*1024)error('EXEC_CONFIGURATION');
 const executeOwned=method(gateway,'executeOwned'),storeMethods=Object.fromEntries(['claim','markDispatching','complete','recordError','read'].map(k=>[k,method(store,k)]));
 async function execute(value){
  const {data,signal}=admit(value);let last;
  const now=()=>{const n=clock();if(!Number.isSafeInteger(n)||(last!==undefined&&n<last))error('EXEC_CLOCK');last=n;return n;};
  const start=now();if(data.deadlineMs<=start||data.deadlineMs-start>240000)error('EXEC_DEADLINE');
  const at=()=>new Date(now()).toISOString(),stamp=()=>new Date(last).toISOString();
  const run={runId:data.runId,corpusSha256:data.corpusSha256,configSha256:data.configSha256,sourceSetSha256:data.sourceSetSha256,startedAt:stamp(),completedAt:stamp(),bindings:snapshot(data.runBindings)};
  const traces=data.cases.map(c=>({caseId:c.caseId,traceSha256:null,trace:{caseId:c.caseId,mode:c.mode,runnerSha256:c.runnerSha256,startedAt:stamp(),completedAt:stamp(),stages:[],authorization:[],lookup:null,read:null,unsettledCalls:[],physicalStopProven:false}}));
  const observations=data.cases.map((c,i)=>({caseId:c.caseId,caseSha256:c.caseSha256,attemptId:data.runBindings.find(b=>b.caseId===c.caseId).binding.attemptId,runId:data.runId,configSha256:data.configSha256,sourceSetSha256:c.sourceSetSha256,status:'ineligible',reason:'NOT_STARTED',route:null,authorization:[],delivery:null,read:null,claims:{absence:false,exhaustive:false,acceptedTasks:false},traceSha256:hash(traces[i].trace),startedAt:stamp(),completedAt:stamp(),failure:null}));
  for(const [i,t]of traces.entries())t.traceSha256=observations[i].traceSha256;
  let retainedBytes=size({capture:{run,observations},traces})+4096;
  // Reserve every remaining case's bounded failure/omission record before effects.
  const reserves=data.cases.map(c=>size(c.request)+4*Buffer.byteLength(JSON.stringify(c.caseId))+2048);let remainingReserve=reserves.reduce((a,b)=>a+b,0);
  if(retainedBytes+remainingReserve>maxCaptureBytes)error('EXEC_CAPTURE_CAPACITY');
  const l=createOperationLifetime({deadlineMs:data.deadlineMs,now,signal:signal?.aborted?undefined:signal,errorFactory:exception});let captureExhausted=false,unsettledPredecessor=false;let callSequence=0;const pending=new Map();let lifecycle;
  try{
   for(const [index,c]of data.cases.entries()){
    remainingReserve-=reserves[index];
    const oldSize=size({observation:observations[index],trace:traces[index]});const o=snapshot(observations[index]),t=snapshot(traces[index].trace),binding=data.runBindings.find(b=>b.caseId===c.caseId).binding;
    let active=true,stage='prepare',lookupStarted=false;
    const track=async(name,fn,args)=>{const key=++callSequence;pending.set(key,{port:name,caseId:c.caseId,callId:key});try{return await fn(...args);}finally{pending.delete(key);}};
    try{
     o.startedAt=t.startedAt=at();
     if(c.mode!=='correct-tool'){o.reason='UNSUPPORTED_EXECUTION_MODE';t.stages.push({stage:'execution',outcome:'ineligible',resultSha256:null,error:null});}
     else if(unsettledPredecessor){o.status='failed';o.reason='EXEC_UNSETTLED_PREDECESSOR';o.failure=failure(o.reason,'NOT_DISPATCHED');}
     else if(captureExhausted){o.status='failed';o.reason='EXEC_CAPTURE_EXHAUSTED';o.failure=failure(o.reason,'NOT_DISPATCHED');}
     else{
      if(signal?.aborted)throw exception('CANCELLED');l.check();
      const {split,runnerSha256,...caseData}=c;
      const supplied=await l.run(childSignal=>track('prepareCase',prepareCase,[Object.freeze({case:freeze(snapshot(caseData)),runId:data.runId,binding:freeze(snapshot(binding)),signal:childSignal,deadlineMs:data.deadlineMs})]));
      const p=prepared(supplied,c,binding,now(),data.deadlineMs);
      t.stages.push({stage:'prepare',outcome:'returned',resultSha256:hash({context:p.context,readContext:p.readContext}),error:null});
      let caseDeadline=Math.min(p.context.deadlineMs,p.readContext.deadlineMs);
      const authorizeCaptured=async q=>{
       q.limitDeadline(caseDeadline);
       const limited={...q,limitDeadline:next=>{if(!Number.isSafeInteger(next))throw exception('DEADLINE');caseDeadline=Math.min(caseDeadline,next);q.limitDeadline(next);}};
       const row={phase:q.phase,binding:snapshot(q.binding),receipt:null,error:null,observedAtMs:now()};
       try{
        const receipt=await track('authorize',authorize,[limited]);const detached=snapshot(receipt);row.receipt=detached;if(detached?.authorized===true&&Number.isSafeInteger(detached.expiresAtMs))caseDeadline=Math.min(caseDeadline,detached.expiresAtMs);row.observedAtMs=now();if(active)t.authorization.push(row);return detached;
       }catch(e){row.error={code:safeCode(e)};try{row.observedAtMs=now();}catch{}if(active)t.authorization.push(row);throw e;}
      };
      const controlled=createTaskLookupDelivery({gateway:{executeOwned:(...args)=>track('gateway.executeOwned',executeOwned,args)},store:Object.fromEntries(Object.entries(storeMethods).map(([name,fn])=>[name,(...args)=>track('store.'+name,fn,args)])),authorize:authorizeCaptured,clock:now});
      stage='lookup';lookupStarted=true;
      const request=Object.fromEntries(Object.entries(c.request).filter(([k])=>k!=='clientId'));
      const lookup=await l.run(childSignal=>controlled.lookup({request,context:p.context,credential:p.credential,signal:childSignal}));
      t.lookup=snapshot(lookup);t.stages.push({stage,outcome:'returned',resultSha256:hash(lookup),error:null});
      stage='read';
      const read=await l.run(childSignal=>controlled.read({resultReference:lookup.resultReference,context:{...p.readContext,deadlineMs:caseDeadline},signal:childSignal}));
      t.read=snapshot(read);t.stages.push({stage,outcome:'returned',resultSha256:hash(read),error:null});
      o.status='returned';o.reason=null;o.route={operation,request:snapshot(c.request)};o.delivery=snapshot(lookup);o.read=snapshot(read);o.failure=null;
     }
    }catch(e){
     const code=safeCode(e);const d=e&&typeof e==='object'?Object.getOwnPropertyDescriptor(e,'outcome'):null;
     const outcome=d&&Object.hasOwn(d,'value')&&['NOT_DISPATCHED','UNKNOWN','RESULT_NOT_RELEASED'].includes(d.value)?d.value:stage==='lookup'&&lookupStarted?'UNKNOWN':'NOT_DISPATCHED';
     o.status=stage==='read'&&code==='ACCESS_DENIED'&&t.authorization.some(a=>['before_read','before_release'].includes(a.phase)&&(a.receipt?.authorized===false||a.error?.code==='ACCESS_DENIED'))?'denied':'failed';
     o.reason=code;o.failure=failure(code,outcome);o.delivery=null;o.read=null;
     t.stages.push({stage,outcome:'failed',resultSha256:null,error:o.failure});
    }finally{active=false;try{o.completedAt=t.completedAt=at();}catch{o.completedAt=t.completedAt=stamp();}t.unsettledCalls=[...pending.values()].filter(v=>v.caseId===c.caseId);if(t.unsettledCalls.length)unsettledPredecessor=true;}
    // Only read callbacks belong to the existing scoring contract; lookup callbacks remain raw trace evidence.
    // Lookup's before_release precedes the read: isolate by the read's first callback.
    const readStart=t.authorization.findIndex(a=>a.phase==='before_read');o.authorization=readStart<0?[]:snapshot(t.authorization.slice(readStart));
    let trace={caseId:c.caseId,traceSha256:hash(t),trace:t};o.traceSha256=trace.traceSha256;
    let nextSize=size({observation:o,trace});
    if(retainedBytes-oldSize+nextSize+remainingReserve>maxCaptureBytes){
     const fullHash=trace.traceSha256,observedBytes=nextSize;captureExhausted=true;
     o.status='failed';o.reason='EXEC_CAPTURE_LIMIT';o.failure=failure(o.reason,t.read||t.lookup?'RESULT_NOT_RELEASED':lookupStarted?'UNKNOWN':'NOT_DISPATCHED');o.authorization=[];o.delivery=null;o.read=null;
     trace={caseId:c.caseId,traceSha256:null,trace:{caseId:c.caseId,mode:c.mode,runnerSha256:c.runnerSha256,startedAt:o.startedAt,completedAt:o.completedAt,omittedTraceSha256:fullHash,observedPairBytes:observedBytes,reason:'EXEC_CAPTURE_LIMIT',unsettledCalls:t.unsettledCalls,physicalStopProven:false}};
     trace.traceSha256=hash(trace.trace);o.traceSha256=trace.traceSha256;nextSize=size({observation:o,trace});
    }
    retainedBytes+=nextSize-oldSize;observations[index]=o;traces[index]=trace;
   }
  }finally{lifecycle=l.close();try{run.completedAt=at();}catch{run.completedAt=stamp();}}
  return freeze({capture:{run,observations},traces,execution:{kind:'typed-preselected-tool-replay',supportedMode:'correct-tool',qualifiedRealRequests:0,runtimeQualified:false,emptyCorpus:data.cases.length===0,captureExhausted,maxCaptureBytes,unsettledCalls:[...pending.values()],lifetimeUnsettledOperations:lifecycle.unsettledOperations,physicalStopProven:false,borrowedPortsDisposed:false}});
 }
 return Object.freeze({execute});
}
