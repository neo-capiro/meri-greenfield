/** Durable control delivery for one existing activity/query, never a model or workflow loop. */
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertWorkerControl,assertLifecycleReceipt} from '../../../../packages/contracts/conversation-lifecycle/validate.mjs';
import {createSdkCommandAdapter} from './commands.mjs';
import {continuationContextSha256} from './options.mjs';
import {assertCaptureReceipt} from './native-receipts.mjs';
const fault=code=>Object.assign(new Error(code),{code}),same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
export function assertLifecycleConfiguration(config,runOwner) {
 const {captureCheckpoint,pollMs=100,captureOwnsClose=false}=own(config,['captureCheckpoint'],['pollMs','captureOwnsClose']);
 if(typeof captureOwnsClose!=='boolean'||typeof captureCheckpoint!=='function'||!Number.isSafeInteger(pollMs)||pollMs<5||pollMs>5000||
 ['nextControls','claimControl','ackControl','recordCheckpoint'].some(k=>typeof runOwner[k]!=='function'))throw fault('LIFECYCLE_CONFIGURATION');
 return {captureCheckpoint,pollMs,captureOwnsClose};
}
export function createActivityLifecycle({config,runOwner,binding,saved,runtime,input,query,life,now}) {
 const {captureCheckpoint,pollMs,captureOwnsClose}=assertLifecycleConfiguration(config,runOwner);
 const contextSha256=continuationContextSha256(saved.request,saved.run.scopes),abort=new AbortController();
 const poll=createOperationLifetime({deadlineMs:runtime.deadlineMs,now,signal:AbortSignal.any([life.signal,abort.signal]),errorFactory:fault});
 const adapter=createSdkCommandAdapter({binding,contextSha256,input,query,lifetime:poll,captureOwnsClose}),pending=new Map();
 let stopped=false,held=false,after=0,sessionId=null,error,wakeIdle;const failed=Promise.withResolvers(),heldResult=Promise.withResolvers(),initialized=Promise.withResolvers();
 const ack=(entry,outcome,sdkUserMessageId)=>runOwner.ackControl({binding,input:{controlId:entry.command.controlId,
 commandSha256:entry.commandSha256,outcome,...(sdkUserMessageId===undefined?{}:{sdkUserMessageId})},signal:poll.signal});
 function envelope(raw){const e=data(own(raw,['controlSequence','commandSha256','command'])),c=assertWorkerControl(e.command);
  if(!Number.isSafeInteger(e.controlSequence)||e.controlSequence<=after||e.commandSha256!==canonicalSha256(c)||
   !same(c.binding,binding)||c.contextSha256!==contextSha256)throw fault('CONTROL_ENVELOPE_REFUSED');return e;}
 async function pause(entry){held=true;await adapter.apply(entry.command);life.check();
  if(!sessionId)throw fault('SDK_SESSION_MISSING');const started=now();
  const captured=await poll.run(signal=>captureCheckpoint({binding,request:saved.request,versions:saved.run.versions,scopes:saved.run.scopes,
   controlId:entry.command.controlId,sessionId,contextSha256,signal}));
  const verified=assertCaptureReceipt(captured,{binding,versions:saved.run.versions,request:saved.request,scopes:saved.run.scopes,
   contextSha256,sessionId,started,now});life.limitDeadline(verified.expiresAtMs);poll.limitDeadline(verified.expiresAtMs);
  const cp=verified.receipt.checkpoint;
  const recorded=assertLifecycleReceipt(await poll.run(signal=>runOwner.recordCheckpoint({binding,input:{controlId:entry.command.controlId,
   checkpointId:cp.checkpointId,checkpointSha256:verified.receipt.checkpointSha256},signal})));
  if(recorded.controlId!==entry.command.controlId||recorded.checkpointId!==cp.checkpointId||!same(recorded.sourceBinding,binding)||
   recorded.state!=='APPLIED'||recorded.intent!==(entry.command.action==='pause'?'pause':'approval.wait'))throw fault('CHECKPOINT_RECORD_REFUSED');
  pending.delete(entry.command.controlId);heldResult.resolve({state:entry.command.action==='pause'?'paused':'waiting-for-approval'});
 }
 async function pump(){try{await poll.run(()=>initialized.promise);while(!stopped&&!held){const raw=await poll.run(signal=>runOwner.nextControls({binding,after,signal}));
  if(!Array.isArray(raw)||raw.length>32)throw fault('CONTROL_PAGE_REFUSED');
  for(const row of raw){const entry=envelope(row);if(stopped||held)break;if(pending.size>=32)throw fault('CONTROL_PENDING_LIMIT');
   const claim=data(await poll.run(signal=>runOwner.claimControl({binding,input:{controlId:entry.command.controlId,commandSha256:entry.commandSha256},signal})));
   if(claim.claimed===false){own(claim,['claimed','receipt']);after=entry.controlSequence;continue;}
   own(claim,['claimed','control']);if(claim.claimed!==true||!same(claim.control,entry))throw fault('CONTROL_CLAIM_REFUSED');
   pending.set(entry.command.controlId,entry);after=entry.controlSequence;
   if(entry.command.action==='steer')await adapter.apply(entry.command);else {await pause(entry);break;}
  }
  if(!stopped&&!held)await poll.run(signal=>new Promise((resolve,reject)=>{const timer=setTimeout(done,pollMs);wakeIdle=done;
   function done(){clearTimeout(timer);wakeIdle=undefined;signal.removeEventListener('abort',cancel);resolve();}function cancel(){clearTimeout(timer);wakeIdle=undefined;reject(fault('CANCELLED'));}
   signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();}));
 }}catch(e){if(!stopped){error=fault('LIFECYCLE_EXECUTION_UNKNOWN');failed.resolve(error);heldResult.reject(error);}}
 }
 const pumping=pump();heldResult.promise.catch(()=>{});
 async function observe(message){if(stopped)return;
  if(message?.type==='system'&&message.subtype==='init'){
   if(typeof message.session_id!=='string'||!uuid.test(message.session_id)||sessionId&&sessionId!==message.session_id)throw fault('SDK_SESSION_REFUSED');
   const expected=saved.continuation?(saved.continuation.mode==='resume'?saved.continuation.checkpoint.sessionId:saved.continuation.targetSessionId):null;
   if(expected!==null&&expected!==message.session_id)throw fault('SDK_SESSION_REFUSED');sessionId=message.session_id;initialized.resolve();
  }
  if(held)return;
  if(message?.type==='user'&&message.isReplay!==true&&message.parent_tool_use_id===null&&message.message?.role==='user'){
   if(message.session_id!==undefined&&message.session_id!==sessionId)throw fault('SDK_INPUT_ECHO_REFUSED');
   const entry=pending.get(message.uuid);if(!entry)return;
   const content=message.message.content,text=typeof content==='string'?content:Array.isArray(content)&&content.every(p=>p.type==='text')?content.map(p=>p.text).join(''):null;
   if(entry.command.action!=='steer'||text!==entry.command.prompt)throw fault('SDK_INPUT_ECHO_REFUSED');
   await poll.run(()=>ack(entry,'APPLIED',message.uuid));pending.delete(message.uuid);
  }
 }
 let finishing;
 function finish(){return finishing??=finishOnce();}
 async function finishOnce(){stopped=true;wakeIdle?.();if(!sessionId)abort.abort();
  // Stop new claims immediately, then drain the already bounded current-authority
  // read. Cancelling that read on a successful result can invalidate the opaque
  // session needed by the activity's final publication. Deadline/caller abort
  // still cancels the read and refuses completion through the existing owner.
  await pumping;abort.abort();
  // A dispatched but unacknowledged UUID remains UNKNOWN, never re-enqueued.
  for(const entry of pending.values()){const cleanup=createOperationLifetime({deadlineMs:now()+100,now,errorFactory:fault});
   try{await cleanup.run(signal=>runOwner.ackControl({binding,input:{controlId:entry.command.controlId,commandSha256:entry.commandSha256,outcome:'UNKNOWN'},signal}));}
   catch{}finally{cleanup.close();pending.delete(entry.command.controlId);}}
  poll.close();input.close();
 }
 return Object.freeze({observe,finish,isHeld:()=>held,heldResult:()=>heldResult.promise,
  failure:failed.promise,check(){if(error)throw error;},close(){stopped=true;abort.abort();poll.close();input.close();}});
}
