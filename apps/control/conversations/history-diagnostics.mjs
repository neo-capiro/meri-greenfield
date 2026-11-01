import {randomBytes} from 'node:crypto';

// Optional, non-authoritative diagnostic header. FE overwrites browser input.
// Admission is syntax only: a matching trace is never proof of caller identity.
export const historyTraceHeader='x-meri-history-trace';
const stages=['request','session','retention','store','release_session','release_retention','response'];
export function reportHistoryStage(report,stage){try{if(stages.includes(stage))report?.(stage);}catch{/* Observability cannot affect the operation. */}}

/** One terminal line/read, capped at 20 + one suppression marker/minute/process. */
export function createHistoryDiagnostics({write=line=>process.stderr.write(line+'\n'),now=()=>performance.now(),newTrace=()=>`h1_${randomBytes(16).toString('hex')}`}={}){
 let windowStart=-Infinity,count=0;
 return receivedTrace=>{
  try{
   const admitted=typeof receivedTrace==='string'&&receivedTrace.length===35&&/^h1_[0-9a-f]{32}$/.test(receivedTrace);
   const trace=admitted?receivedTrace:newTrace();
   if(typeof trace!=='string'||trace.length!==35||!/^h1_[0-9a-f]{32}$/.test(trace))return undefined;
   let stage='request',finished=false;
   return {
    stage(value){if(!finished&&stages.includes(value))stage=value;},
    finish(status){
     if(finished)return;finished=true;
     try{
      if(!Number.isInteger(status)||status<100||status>599)return;
      const at=now();if(at-windowStart>=60000){windowStart=at;count=0;}
      if(count>20)return;
      if(count++===20){write('MERI_HISTORY_CONTROL_SUPPRESSED');return;}
      write(JSON.stringify({event:'MERI_HISTORY_CONTROL',trace,stage,outcome:status<400?'response':'refused',status}));
     }catch{/* Never log errors or change the public response. */}
    },
   };
  }catch{return undefined;}
 };
}
export const beginHistoryDiagnostic=createHistoryDiagnostics();
