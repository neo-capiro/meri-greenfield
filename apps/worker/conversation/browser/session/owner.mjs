/** One host-owned execution point: S1 admission, pinned current-page S2 output, S3 disposal.
 * Borrowed ports carry current Core/workflow authority and canonical lifecycle holds.
 * This owner cannot activate the browser or mint a viewer/control credential. */
import {createControlFence} from './fence.mjs';
import {createStateDestruction} from './destruction.mjs';
import {createPinnedSnapshot} from './snapshot.mjs';
import {createOperationLifetime} from '../../../../../packages/runtime/operation-lifetime.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
export function createBrowserSessionOwner({context,invoke,policy,manifest=null,current,hold,ports,now=Date.now,deadlineMs}){
 if(typeof invoke!=='function'||typeof current!=='function'||typeof hold!=='function'||!context||
  !Number.isSafeInteger(deadlineMs)||deadlineMs<=now())fail('BROWSER_CONFIGURATION');
 const fence=createControlFence({now}),snapshot=createPinnedSnapshot({context,manifest});
 const pending=new Set();let closed=false,timer,busy=false,taking=false;
 const drain=async({signal})=>{while(pending.size){signal.throwIfAborted();await Promise.race(pending);}return fence.state();};
 const destruction=createStateDestruction({fence,now,manifest,ports:{...ports,waitForDrain:drain,
  async closeContext(){try{await context.close();return {closed:true};}finally{snapshot.clear();}}}});
 const destroy=async trigger=>{closed=true;clearTimeout(timer);return destruction.destroy({trigger});};
 async function assertCurrent(signal){
  if(closed)fail('BROWSER_SESSION_ENDING');
  try{await current(signal);signal?.throwIfAborted();}
  catch{void destroy('revocation').catch(()=>{});fail('BROWSER_AUTHORITY_REFUSED');}
  if(closed)fail('BROWSER_SESSION_ENDING');
 }
 timer=setTimeout(()=>{void destroy('ttl-expiry').catch(()=>{});},Math.max(1,Math.min(deadlineMs,now()+(manifest?.sessionTtlMs??deadlineMs-now()))-now()));timer.unref?.();
 async function call({requestId,tool,args,signal}){
  if(closed)fail('BROWSER_SESSION_ENDING');if(!policy.tools.includes(tool))fail('BROWSER_TOOL_REFUSED');
  if(tool==='browser_take_screenshot')fail('BROWSER_IMAGES_WITHHELD');
  // Serialize page effects with capture: no second call can change the page while a result is being filtered.
  if(busy)fail('BROWSER_SESSION_BUSY');
  const timeoutMs=Math.min(policy.timeouts.actionMs+policy.timeouts.navigationMs,130000);
  const life=createOperationLifetime({deadlineMs:Math.min(deadlineMs,now()+timeoutMs),now,signal,errorFactory:code=>Object.assign(Error(code),{code})});
  let admitted=false,settled=false,dispatched=false;busy=true;
  const operation=(async()=>{try{
   await life.run(assertCurrent);fence.admit({requestId,tool,timeoutMs});admitted=true;
   // Read before dispatch too: values removed by navigation remain confidential.
   await life.run(()=>snapshot.capture());
   await life.run(assertCurrent);
   dispatched=true;await life.run(signal=>invoke({tool,args,signal})); // discard all upstream prose, dialogs, error text, metadata and images
   if(fence.state().state!=='agent'){fence.settle(requestId,{outcome:'result'});settled=true;fail('BROWSER_STALE_RESULT');}
   const result=await life.run(()=>snapshot.capture({fenceState:fence.state().state,tool}));
   await life.run(assertCurrent);const receipt=fence.settle(requestId,{outcome:'result'});settled=true;
   if(receipt.deliver!=='result'||fence.state().state!=='agent')fail('BROWSER_STALE_RESULT');
   return result;
  }catch(error){
   if(admitted&&!settled){fence.settle(requestId,{outcome:dispatched?(life.signal.aborted?'timeout':'transport-error'):'result'});
    if(dispatched){void destroy('disconnect').catch(()=>{});fail('BROWSER_ACTION_OUTCOME_UNKNOWN');}}
   throw Object.assign(Error('BROWSER_CALL_REFUSED'),{code:'BROWSER_CALL_REFUSED'});
  }finally{life.close();busy=false;}})();
  const tracked=operation.then(()=>undefined,()=>undefined);pending.add(tracked);try{return await operation;}finally{pending.delete(tracked);}
 }
 return Object.freeze({call,state:()=>fence.state(),destroy:({trigger})=>destroy(trigger),
  async takeover({signal}={}){
   if(closed)fail('BROWSER_SESSION_ENDING');if(taking)fail('BROWSER_SESSION_BUSY');taking=true;
   const life=createOperationLifetime({deadlineMs:Math.min(deadlineMs,now()+130000),now,signal,errorFactory:code=>Object.assign(Error(code),{code})});
   try{await life.run(assertCurrent);const state=fence.state();
    if(state.state!=='drained'||state.reason!=='takeover')fence.fence({reason:'takeover'});
    await life.run(signal=>drain({signal}));
    // The canonical hold port resolves/reuses this binding's existing hold; it
    // must not allocate a new lifecycle command when the first answer was lost.
    const held=await life.run(hold);await life.run(assertCurrent);
    return fence.grant({holdApplied:held?.outcome==='APPLIED'});}finally{life.close();taking=false;}
  },
  async userInput({leaseEpoch,perform,signal}){
   if(closed||typeof perform!=='function')fail('BROWSER_SESSION_ENDING');if(busy)fail('BROWSER_SESSION_BUSY');
   if(!fence.input({leaseEpoch}).accepted)fail('BROWSER_STALE_LEASE');busy=true;
   const life=createOperationLifetime({deadlineMs:Math.min(deadlineMs,now()+130000),now,signal,errorFactory:code=>Object.assign(Error(code),{code})});
   // Native relay owns actual input. Sample values while fenced; no model output.
   const operation=(async()=>{await life.run(assertCurrent);await life.run(perform);
    await life.run(()=>snapshot.capture({fenceState:'agent',postLease:true}));await life.run(assertCurrent);})();
   const tracked=operation.then(()=>undefined,()=>undefined);pending.add(tracked);
   try{await operation;}catch{void destroy('disconnect').catch(()=>{});fail('BROWSER_USER_INPUT_UNKNOWN');}
   finally{pending.delete(tracked);life.close();busy=false;}
  },
  handBack:()=>fence.handBack(),
  endLease:reason=>fence.endLease({reason}),
  async resume({explicit,signal}){
   if(closed||busy||explicit!==true||fence.state().state!=='returning')fail('TAKEOVER_RESUME_REFUSED');
   const life=createOperationLifetime({deadlineMs:Math.min(deadlineMs,now()+130000),now,signal,errorFactory:code=>Object.assign(Error(code),{code})});busy=true;
   const operation=(async()=>{
    await life.run(assertCurrent);const result=await life.run(()=>snapshot.capture({fenceState:'agent',postLease:true}));
    await life.run(assertCurrent);fence.resume({explicit:true,snapshotCaptured:true});return result;
   })();
   const tracked=operation.then(()=>undefined,()=>undefined);pending.add(tracked);
   try{return await operation;}finally{pending.delete(tracked);life.close();busy=false;}
  },
 });
}
