/** Deterministic orchestration only. Activities authenticate/decode the actual Core fixed contract; no model, transport or policy here. */
export async function drivePlannerContinuation(input,{inspect,prepare,wait,publish,stopped}){
 let attempted=false;
 const state=(phase,ack=null)=>{const value={phase,prepareAttempted:attempted,stopRequested:stopped(),ack};publish(value);return value;};
 for(;;){
  state(attempted?'reconciling':'reading');
  let found;try{found=await inspect(input);}catch{found={kind:'unavailable'};}
  if(found?.kind==='ack')return state('applied',found.ack);
  // Initial write authority comes ONLY from the server/prepare admission owner, never from a missing lookup.
  // Only this admitted original activity may prepare. After uncertainty every lookup is read-only.
  if(!attempted&&!stopped()&&found?.kind!=='refused'){
   attempted=true;state('preparing');
   let result;try{result=await prepare(input);}catch{result={kind:'unavailable'};}
   if(result?.kind==='ack')return state('applied',result.ack);
   if(result?.kind==='refused')return state('refused');
  }else if(!attempted&&stopped())return state('stopped');
  else if(!attempted&&found?.kind==='refused')return state('refused');
  state(stopped()?'stopped_unconfirmed':'unconfirmed');
  await wait();
 }
}
