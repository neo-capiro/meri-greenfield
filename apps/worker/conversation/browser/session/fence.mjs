/** S1 control fence and drain for the conversation browser (design FABLE-FIRST-SHIPMENT-FEATURES-DESIGN-20261015.md
 * section 1.1 S1; owner answers Q-T1 exclusive lease, Q-T5 10-minute idle lease with no auto-resume, Q-T7 drain bounds,
 * all accepted 15 October 2026 per FABLE-OWNER-DECISIONS-20261015.md decision 7).
 *
 * PREPARATION ONLY. This is the pure state machine the browser session owner will run at its single execution point. It
 * performs no I/O, holds no page, process or credential, and is not composed anywhere: takeover stays held
 * (`activation.mjs`), and the session-owner placement on the D005 host (Q-X2) is still awaiting the owner.
 *
 * States: `agent` (agent calls admitted, user input refused) -> `fencing` (new agent calls refused before they touch the
 * page; admitted calls settle) -> `drained` (nothing in flight) -> `user` (lease granted only for reason `takeover` and
 * only once the lifecycle hold is APPLIED) -> `returning` (input closed; the run stays paused until the user explicitly
 * resumes with a fresh filtered snapshot). A drain that does not finish within the bound ends in `drain-unknown`: no lease
 * is ever granted and only a browser reset (S3) leaves it. Every call settled by timeout or transport error after dispatch
 * is BROWSER_ACTION_OUTCOME_UNKNOWN and is never re-admitted under the same request id. */
export const FENCE_STATES=Object.freeze(['agent','fencing','drained','user','returning','drain-unknown','ended']);
export const FENCE_REASONS=Object.freeze(['takeover','revocation','disconnect','session-end']);
export const LEASE_END_REASONS=Object.freeze(['idle','viewer-disconnect','stream-lost','relay-failure','revocation']);
/** Q-T7: settle bound = largest in-flight action/navigation timeout + 5 s, capped by the 130 s hard bound. Q-T5: 10 minutes. */
export const TAKEOVER_LIMITS=Object.freeze({settleMarginMs:5000,hardBoundMs:130000,leaseIdleMs:600000});
const REFUSAL=Object.freeze({takeover:'BROWSER_USER_IN_CONTROL',revocation:'BROWSER_REVOKED',disconnect:'BROWSER_SESSION_ENDING','session-end':'BROWSER_SESSION_ENDING'});
const REQUEST=/^[A-Za-z0-9_.:-]{1,128}$/u;
const fault=code=>Object.assign(new Error(code),{code});
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;

/** The drain deadline offset for the calls in flight at the fence: max(timeoutMs) + margin, never above the hard bound. */
export function drainBoundMs(inflight,limits=TAKEOVER_LIMITS){
 let longest=0;for(const call of inflight)longest=Math.max(longest,call.timeoutMs);
 return Math.min(longest+limits.settleMarginMs,limits.hardBoundMs);
}

/** @param {{now:()=>number}} options */
export function createControlFence({now}={}){
 if(typeof now!=='function')throw fault('FENCE_CONFIGURATION');
 const inflight=new Map(),unknown=new Map(),late=new Set();
 let state='agent',reason=null,controlEpoch=1,leaseEpoch=0,deadlineMs=null,lastInputMs=null,dropped=0,pausedBy=null;
 const unsettled=id=>{const c=inflight.get(id);inflight.delete(id);return c;};
 const markUnknown=(id,call)=>unknown.set(id,Object.freeze({requestId:id,tool:call.tool,approvalId:call.approvalId??null,epoch:call.epoch}));
 function evaluate(){
  const t=now();
  if(state==='fencing'){
   if(!inflight.size)state='drained';
   else if(t>=deadlineMs){for(const [id,call] of inflight){markUnknown(id,call);late.add(id);}inflight.clear();state='drain-unknown';}
  }
  if(state==='user'&&t-lastInputMs>=TAKEOVER_LIMITS.leaseIdleMs){leaseEpoch++;state='returning';pausedBy='idle';}
 }
 const snapshot=()=>Object.freeze({state,reason,controlEpoch,leaseEpoch,deadlineMs,inflight:inflight.size,droppedInputs:dropped,pausedBy,
  unknownCalls:Object.freeze([...unknown.values()]),resetRequired:state==='drain-unknown'});
 return Object.freeze({
  state(){evaluate();return snapshot();},
  /** Admits one agent call at the execution point. Only in `agent`; a fenced browser refuses with the fence's reason code
   * before the call reaches the page, whatever the worker hook decided. An UNKNOWN request id is never re-admitted. */
  admit({requestId,tool,timeoutMs,approvalId=null}={}){
   evaluate();
   if(typeof requestId!=='string'||!REQUEST.test(requestId)||typeof tool!=='string'||!tool||!int(timeoutMs,1,TAKEOVER_LIMITS.hardBoundMs)||approvalId!==null&&typeof approvalId!=='string')throw fault('FENCE_INVALID_CALL');
   if(unknown.has(requestId))throw fault('BROWSER_ACTION_OUTCOME_UNKNOWN');
   if(inflight.has(requestId))throw fault('FENCE_DUPLICATE_CALL');
   if(state!=='agent')throw fault(state==='drain-unknown'?'TAKEOVER_DRAIN_UNKNOWN':REFUSAL[reason]??'BROWSER_USER_IN_CONTROL');
   inflight.set(requestId,Object.freeze({tool,timeoutMs,approvalId,epoch:controlEpoch,startedAtMs:now()}));
   return Object.freeze({epoch:controlEpoch});
  },
  /** Settles an admitted call. A definite result is delivered (through the S2 filter); a timeout or transport error after
   * dispatch is UNKNOWN; a call the fence no longer tracks (drained as UNKNOWN, or from before a resume) is rejected. */
  settle(requestId,{outcome}={}){
   const call=unsettled(requestId);
   if(!call){if(late.has(requestId)||unknown.has(requestId))return Object.freeze({deliver:'reject',code:'BROWSER_STALE_RESULT'});throw fault('FENCE_UNKNOWN_CALL');}
   if(outcome==='result'){evaluate();return Object.freeze({deliver:'result',epoch:call.epoch});}
   if(outcome!=='timeout'&&outcome!=='transport-error'){inflight.set(requestId,call);throw fault('FENCE_INVALID_OUTCOME');}
   markUnknown(requestId,call);evaluate();
   return Object.freeze({deliver:'unknown',code:'BROWSER_ACTION_OUTCOME_UNKNOWN',epoch:call.epoch});
  },
  /** Closes admission at once and starts the bounded drain. A takeover fence needs the agent state (or repeats an
   * identical takeover fence). A revocation, disconnect or session end applies in any state: it ends a lease (the run
   * stays paused), replaces a takeover reason so the lease can no longer be granted, and forbids resume; the teardown
   * (S3, then `end`) follows. */
  fence({reason:why}={}){
   evaluate();
   if(!FENCE_REASONS.includes(why))throw fault('FENCE_INVALID_REASON');
   if(state==='agent'){state='fencing';reason=why;controlEpoch++;deadlineMs=now()+drainBoundMs(inflight.values());}
   else if(why==='takeover'){if(state!=='fencing'||reason!=='takeover')throw fault('FENCE_STATE_REFUSED');}
   else if(state!=='ended'){
    if(state==='user'){leaseEpoch++;pausedBy=why;}
    if(state==='user'||state==='returning')state='drained';
    reason=why;
   }
   evaluate();return snapshot();
  },
  /** Grants the exclusive lease: reason takeover, nothing in flight, and the lifecycle hold recorded APPLIED. */
  grant({holdApplied}={}){
   evaluate();
   if(state==='drain-unknown')throw fault('TAKEOVER_DRAIN_UNKNOWN');
   if(state!=='drained'||reason!=='takeover')throw fault('TAKEOVER_NOT_DRAINED');
   if(holdApplied!==true)throw fault('TAKEOVER_HOLD_NOT_APPLIED');
   state='user';leaseEpoch++;lastInputMs=now();pausedBy=null;
   return Object.freeze({leaseEpoch});
  },
  /** One user input batch: admitted only in `user` with the current lease epoch; anything else is dropped and counted. */
  input({leaseEpoch:epoch}={}){
   evaluate();
   if(state!=='user'||epoch!==leaseEpoch){dropped++;return Object.freeze({accepted:false});}
   lastInputMs=now();return Object.freeze({accepted:true});
  },
  /** Explicit hand-back: input closes (the lease epoch advances); the run stays paused. */
  handBack(){evaluate();if(state!=='user')throw fault('TAKEOVER_NO_LEASE');leaseEpoch++;state='returning';pausedBy='hand-back';return snapshot();},
  /** Lease end without hand-back (idle, viewer disconnect, lost stream, relay failure, revocation): the run stays paused. */
  endLease({reason:why}={}){
   evaluate();if(!LEASE_END_REASONS.includes(why))throw fault('FENCE_INVALID_REASON');
   if(state==='user'){leaseEpoch++;state='returning';pausedBy=why;}
   if(why==='revocation')reason='revocation';
   return snapshot();
  },
  /** Explicit resume only: from `returning`, after the session owner captured the post-lease filtered snapshot. The control
   * epoch advances, so nothing admitted before the lease can be delivered afterwards. Never automatic. */
  resume({explicit,snapshotCaptured}={}){
   evaluate();
   if(state!=='returning'||reason==='revocation'||reason==='session-end'||reason==='disconnect')throw fault('TAKEOVER_RESUME_REFUSED');
   if(explicit!==true)throw fault('TAKEOVER_RESUME_NOT_EXPLICIT');
   if(snapshotCaptured!==true)throw fault('TAKEOVER_SNAPSHOT_REQUIRED');
   controlEpoch++;state='agent';reason=null;deadlineMs=null;pausedBy=null;
   return snapshot();
  },
  /** After S3 destruction of the profile (the only exit from `drain-unknown`), or at conversation end. */
  end(){inflight.forEach((call,id)=>{markUnknown(id,call);late.add(id);});inflight.clear();state='ended';return snapshot();},
 });
}
