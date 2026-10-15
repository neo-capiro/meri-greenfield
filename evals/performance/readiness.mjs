/** Fresh-task readiness: accepted request to a new isolated worker being ready. Only a live probe can measure it.
 * Without an injected probe the measurement is reported UNRUN; a fixture never stands in for it. */
const fail=code=>{throw Object.assign(new Error(code),{code});};
export const READINESS_UNRUN='LIVE_FRESH_TASK_READINESS_PROBE_NOT_SUPPLIED';
export async function measureReadiness({probe=null,samples=10}={}){
 if(probe===null)return {state:'UNRUN',reason:READINESS_UNRUN,requested:samples,samples:[],failures:[]};
 if(typeof probe!=='function'||!Number.isSafeInteger(samples)||samples<1||samples>100)fail('READINESS_CONFIGURATION');
 const measured=[],failures=[];
 for(let index=0;index<samples;index++){
  let value;try{value=await probe({index});}catch(error){failures.push({index,code:typeof error?.code==='string'?error.code:'PROBE_FAILED'});continue;}
  if(typeof value!=='number'||!Number.isFinite(value)||value<0){failures.push({index,code:'PROBE_SAMPLE_INVALID'});continue;}
  measured.push(value);
 }
 return {state:'MEASURED',reason:null,requested:samples,samples:measured,failures};
}
