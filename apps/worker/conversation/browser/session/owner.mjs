/** One host-owned execution point: S1 admission, pinned current-page S2 output, S3 disposal.
 * Borrowed ports carry current Core/workflow authority and canonical lifecycle holds.
 * This owner cannot activate the browser or mint a viewer/control credential. */
import {createControlFence} from './fence.mjs';
import {createStateDestruction} from './destruction.mjs';
import {createPinnedSnapshot} from './snapshot.mjs';
import {createOperationLifetime} from '../../../../../packages/runtime/operation-lifetime.mjs';
import {prepareNativeBrowserInput} from './native-input.mjs';
import {createInputLimiter} from './input.mjs';
import {createViewerFrameOwner} from './viewer-frame.mjs';
import {own} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
export function createBrowserSessionOwner({context,invoke,policy,manifest=null,current,hold,ports,now=Date.now,deadlineMs}){
 if(typeof invoke!=='function'||typeof current!=='function'||typeof hold!=='function'||!context||
  !Number.isSafeInteger(deadlineMs)||deadlineMs<=now())fail('BROWSER_CONFIGURATION');
 const fence=createControlFence({now}),snapshot=createPinnedSnapshot({context,manifest}),viewer=createViewerFrameOwner(context);
 const pending=new Set();let closed=false,timer,busy=false,taking=false,inputLimiter,preparedResume;
 const drain=async({signal})=>{while(pending.size){signal.throwIfAborted();await Promise.race(pending);}return fence.state();};
 const destruction=createStateDestruction({fence,now,manifest,ports:{...ports,waitForDrain:drain,
  async closeContext(){try{await context.close();return {closed:true};}finally{snapshot.clear();}}}});
 const destroy=async trigger=>{closed=true;preparedResume=undefined;viewer.clear();clearTimeout(timer);return destruction.destroy({trigger});};
 async function assertCurrent(signal){
  if(closed)fail('BROWSER_SESSION_ENDING');
  try{await current(signal);signal?.throwIfAborted();}
  catch{void destroy('revocation').catch(()=>{});fail('BROWSER_AUTHORITY_REFUSED');}
  if(closed)fail('BROWSER_SESSION_ENDING');
 }
 async function prepareTakeover({signal}={}){
  const life=createOperationLifetime({deadlineMs:Math.min(deadlineMs,now()+130000),now,signal,errorFactory:code=>Object.assign(Error(code),{code})});
  try{await life.run(assertCurrent);const state=fence.state();
   if(!(['drained','fencing'].includes(state.state)&&state.reason==='takeover'))fence.fence({reason:'takeover'});
   await life.run(signal=>drain({signal}));await life.run(assertCurrent);
   const drained=fence.state();if(drained.state!=='drained'||drained.reason!=='takeover')fail('TAKEOVER_DRAIN_UNKNOWN');return drained;
  }finally{life.close();}
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
 return Object.freeze({call,state:()=>fence.state(),prepareTakeover,destroy:({trigger})=>destroy(trigger),
  async readState({signal}={}){
   const life=createOperationLifetime({deadlineMs:Math.min(deadlineMs,now()+10000),now,signal,errorFactory:code=>Object.assign(Error(code),{code})});
   try{await life.run(assertCurrent);const state=fence.state();return {...state,leaseExpiresAtMs:state.leaseExpiresAtMs===null?null:Math.min(state.leaseExpiresAtMs,deadlineMs)};}finally{life.close();}
  },
  async takeover({signal}={}){
   if(closed)fail('BROWSER_SESSION_ENDING');if(taking)fail('BROWSER_SESSION_BUSY');
   const life=createOperationLifetime({deadlineMs:Math.min(deadlineMs,now()+130000),now,signal,errorFactory:code=>Object.assign(Error(code),{code})});
   taking=true;
   try{await life.run(signal=>prepareTakeover({signal}));
    // The canonical hold port resolves/reuses this binding's existing hold; it
    // must not allocate a new lifecycle command when the first answer was lost.
    const held=await life.run(hold);await life.run(assertCurrent);
    const lease=fence.grant({holdApplied:held?.outcome==='APPLIED'});
    viewer.clear();inputLimiter=createInputLimiter({now});return lease;}finally{life.close();taking=false;}
  },
  async view(raw){
   const {leaseEpoch,page,signal}=own(raw,['leaseEpoch','page'],['signal']);
   if(closed)fail('BROWSER_SESSION_ENDING');if(busy)fail('BROWSER_SESSION_BUSY');
   const assertLease=()=>{const state=fence.state();if(state.state!=='user'||state.leaseEpoch!==leaseEpoch)fail('BROWSER_STALE_LEASE');};
   assertLease();
   const until=Math.min(deadlineMs,now()+10000),life=createOperationLifetime({deadlineMs:until,now,signal,errorFactory:code=>Object.assign(Error(code),{code})});busy=true;
   const operation=(async()=>{
    await life.run(assertCurrent);assertLease();
    const result=await life.run(signal=>viewer.capture({page,leaseEpoch,signal,timeoutMs:Math.max(1,until-now()),assertLease}));
    await life.run(assertCurrent);assertLease();viewer.assert({page,leaseEpoch,frameId:result.frameId});return result;
   })();
   const tracked=operation.then(()=>undefined,()=>undefined);pending.add(tracked);
   try{return await operation;}catch{viewer.clear();fail('BROWSER_VIEWER_FRAME_REFUSED');}
   finally{pending.delete(tracked);life.close();busy=false;}
  },
  async userInput(raw){
   const {leaseEpoch,page,frameId,input,signal}=own(raw,['leaseEpoch','page','frameId','input'],['signal']);
   if(closed)fail('BROWSER_SESSION_ENDING');if(busy)fail('BROWSER_SESSION_BUSY');
   const lease=fence.state();
   if(lease.state!=='user'||lease.leaseEpoch!==leaseEpoch){fence.input({leaseEpoch});fail('BROWSER_STALE_LEASE');}
   const assertDisplayed=()=>viewer.assert({page,leaseEpoch,frameId});assertDisplayed();
   const life=createOperationLifetime({deadlineMs:Math.min(deadlineMs,now()+130000),now,signal,errorFactory:code=>Object.assign(Error(code),{code})});
   let prepared;try{prepared=prepareNativeBrowserInput(context,page,input,{leaseEpoch,limiter:inputLimiter});}
   catch(error){life.close();throw error;}busy=true;
   // Remember confidential text before page handlers can erase its field and
   // reflect the value. Keep it only in the existing session-local filter.
   const operation=(async()=>{await life.run(assertCurrent);
    await life.run(()=>snapshot.capture({fenceState:'agent',postLease:true}));
    await life.run(assertCurrent);
    snapshot.rememberInput(prepared.text);await life.run(()=>prepared.perform({assertLease:()=>{
     life.check();assertDisplayed();if(!fence.input({leaseEpoch}).accepted)fail('BROWSER_STALE_LEASE');
    }}));
    await life.run(()=>snapshot.capture({fenceState:'agent',postLease:true}));await life.run(assertCurrent);})();
   const tracked=operation.then(()=>undefined,()=>undefined);pending.add(tracked);
   try{await operation;}catch{void destroy('disconnect').catch(()=>{});fail('BROWSER_USER_INPUT_UNKNOWN');}
   finally{prepared.dispose();pending.delete(tracked);life.close();busy=false;}
  },
  handBack:()=>{preparedResume=undefined;viewer.clear();return fence.handBack();},
  endLease:reason=>{preparedResume=undefined;viewer.clear();return fence.endLease({reason});},
  async prepareResume({explicit,signal}){
   preparedResume=undefined;if(closed||busy||explicit!==true||fence.state().state!=='returning')fail('TAKEOVER_RESUME_REFUSED');
   const life=createOperationLifetime({deadlineMs:Math.min(deadlineMs,now()+130000),now,signal,errorFactory:code=>Object.assign(Error(code),{code})});busy=true;
   const operation=(async()=>{
    await life.run(assertCurrent);const result=await life.run(()=>snapshot.capture({fenceState:'agent',postLease:true}));
    await life.run(assertCurrent);return result;
   })();
   const tracked=operation.then(()=>undefined,()=>undefined);pending.add(tracked);
   try{const result=await operation;preparedResume={snapshot:result,leaseEpoch:fence.state().leaseEpoch};return result;}finally{pending.delete(tracked);life.close();busy=false;}
  },
  async completeResume({snapshot,signal}={}){
   const prepared=preparedResume,check=()=>{if(closed||busy||!prepared||prepared!==preparedResume||snapshot!==prepared.snapshot||fence.state().leaseEpoch!==prepared.leaseEpoch)fail('TAKEOVER_RESUME_REFUSED');};check();
   const life=createOperationLifetime({deadlineMs:Math.min(deadlineMs,now()+10000),now,signal,errorFactory:code=>Object.assign(Error(code),{code})});
   try{await life.run(assertCurrent);check();preparedResume=undefined;return fence.resume({explicit:true,snapshotCaptured:true});}finally{life.close();}
  },
 });
}
