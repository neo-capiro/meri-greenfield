import test from 'node:test';import assert from 'node:assert/strict';
import {createControlFence,drainBoundMs,TAKEOVER_LIMITS} from '../fence.mjs';
/** Synthetic clock; nothing here touches a page, process or network. Each case maps to an S1 test in the design (1.1). */
const clock=(start=1_000_000)=>{let t=start;const now=()=>t;now.advance=ms=>{t+=ms;};return now;};
const code=c=>e=>e.code===c;
const ready=now=>{const f=createControlFence({now});return f;};

test('drain bound: largest in-flight timeout + 5 s, never above the 130 s hard bound (Q-T7)',()=>{
 assert.equal(drainBoundMs([]),TAKEOVER_LIMITS.settleMarginMs);
 assert.equal(drainBoundMs([{timeoutMs:5000},{timeoutMs:60000}]),65000);
 assert.equal(drainBoundMs([{timeoutMs:130000}]),TAKEOVER_LIMITS.hardBoundMs);
 assert.throws(()=>createControlFence({}),code('FENCE_CONFIGURATION'));
});

test('S1-1: a slow call admitted before the fence delays the lease; no input is accepted before the grant',()=>{
 const now=clock(),f=ready(now);
 f.admit({requestId:'r1',tool:'browser_click',timeoutMs:5000,approvalId:'p1'});
 assert.equal(f.fence({reason:'takeover'}).state,'fencing');
 assert.equal(f.input({leaseEpoch:0}).accepted,false);
 assert.throws(()=>f.grant({holdApplied:true}),code('TAKEOVER_NOT_DRAINED'));
 now.advance(2000);assert.equal(f.settle('r1',{outcome:'result'}).deliver,'result');
 assert.equal(f.state().state,'drained');
 assert.throws(()=>f.grant({}),code('TAKEOVER_HOLD_NOT_APPLIED'),'the lifecycle hold must be APPLIED');
 const {leaseEpoch}=f.grant({holdApplied:true});
 assert.equal(f.input({leaseEpoch}).accepted,true);
 assert.equal(f.state().droppedInputs,1);
});

test('S1-2: a call reaching the execution point after the fence is refused without executing, whatever the hook decided',()=>{
 const f=ready(clock());f.fence({reason:'takeover'});
 assert.throws(()=>f.admit({requestId:'late',tool:'browser_navigate',timeoutMs:60000}),code('BROWSER_USER_IN_CONTROL'));
 assert.equal(f.state().inflight,0);
 const r=ready(clock());r.fence({reason:'revocation'});
 assert.throws(()=>r.admit({requestId:'x',tool:'browser_snapshot',timeoutMs:5000}),code('BROWSER_REVOKED'));
 const d=ready(clock());d.fence({reason:'disconnect'});
 assert.throws(()=>d.admit({requestId:'x',tool:'browser_snapshot',timeoutMs:5000}),code('BROWSER_SESSION_ENDING'));
});

test('S1-3: a timeout after dispatch is UNKNOWN, keeps its consumed approval and is never re-admitted, even after resume',()=>{
 const now=clock(),f=ready(now);
 f.admit({requestId:'r1',tool:'browser_fill_form',timeoutMs:5000,approvalId:'proposal-7'});
 f.fence({reason:'takeover'});
 const s=f.settle('r1',{outcome:'timeout'});
 assert.deepEqual([s.deliver,s.code],['unknown','BROWSER_ACTION_OUTCOME_UNKNOWN']);
 assert.deepEqual(f.state().unknownCalls.map(c=>[c.requestId,c.approvalId]),[['r1','proposal-7']]);
 const {leaseEpoch}=f.grant({holdApplied:true});f.input({leaseEpoch});f.handBack();
 f.resume({explicit:true,snapshotCaptured:true});
 assert.throws(()=>f.admit({requestId:'r1',tool:'browser_fill_form',timeoutMs:5000,approvalId:'proposal-7'}),code('BROWSER_ACTION_OUTCOME_UNKNOWN'));
 assert.equal(f.state().unknownCalls.length,1,'UNKNOWN is a barrier, not cleared by resume');
 const t=ready(clock());t.admit({requestId:'a',tool:'browser_click',timeoutMs:5000});
 assert.equal(t.settle('a',{outcome:'transport-error'}).code,'BROWSER_ACTION_OUTCOME_UNKNOWN');
 assert.throws(()=>t.settle('nobody',{outcome:'result'}),code('FENCE_UNKNOWN_CALL'));
});

test('S1-4: a call still unsettled at the bound denies the lease, keeps the run paused and requires a reset',()=>{
 const now=clock(),f=ready(now);
 f.admit({requestId:'hung',tool:'browser_navigate',timeoutMs:120000});
 const fenced=f.fence({reason:'takeover'});
 assert.equal(fenced.deadlineMs-now(),125000);
 now.advance(124999);assert.equal(f.state().state,'fencing');
 now.advance(1);const s=f.state();
 assert.deepEqual([s.state,s.resetRequired,s.unknownCalls[0].requestId],['drain-unknown',true,'hung']);
 assert.throws(()=>f.grant({holdApplied:true}),code('TAKEOVER_DRAIN_UNKNOWN'));
 assert.throws(()=>f.admit({requestId:'n',tool:'browser_snapshot',timeoutMs:5000}),code('TAKEOVER_DRAIN_UNKNOWN'));
 assert.equal(f.settle('hung',{outcome:'result'}).deliver,'reject','a result arriving after the bound is never delivered');
 assert.throws(()=>f.resume({explicit:true,snapshotCaptured:true}),code('TAKEOVER_RESUME_REFUSED'));
 assert.equal(f.end().state,'ended');
});

test('S1-5: input carrying a stale lease epoch after hand-back is dropped and counted',()=>{
 const f=ready(clock());f.fence({reason:'takeover'});
 const {leaseEpoch}=f.grant({holdApplied:true});
 assert.equal(f.input({leaseEpoch}).accepted,true);
 f.handBack();
 assert.equal(f.input({leaseEpoch}).accepted,false);
 assert.equal(f.input({leaseEpoch:leaseEpoch+1}).accepted,false,'returning admits no input at any epoch');
 assert.equal(f.state().droppedInputs,2);
});

test('S1-6: hand-back never resumes on its own; resume needs an explicit request and the filtered snapshot; old results are rejected',()=>{
 const now=clock(),f=ready(now);
 f.admit({requestId:'old',tool:'browser_snapshot',timeoutMs:130000});
 f.fence({reason:'takeover'});
 now.advance(TAKEOVER_LIMITS.hardBoundMs);
 assert.equal(f.state().state,'drain-unknown');
 assert.equal(f.settle('old',{outcome:'result'}).code,'BROWSER_STALE_RESULT');
 const g=ready(now);g.fence({reason:'takeover'});g.grant({holdApplied:true});g.handBack();
 now.advance(60*60*1000);assert.equal(g.state().state,'returning','time alone never resumes');
 assert.throws(()=>g.resume({snapshotCaptured:true}),code('TAKEOVER_RESUME_NOT_EXPLICIT'));
 assert.throws(()=>g.resume({explicit:true}),code('TAKEOVER_SNAPSHOT_REQUIRED'));
 const before=g.state().controlEpoch,after=g.resume({explicit:true,snapshotCaptured:true});
 assert.deepEqual([after.state,after.controlEpoch>before],['agent',true]);
 assert.equal(g.admit({requestId:'fresh',tool:'browser_snapshot',timeoutMs:5000}).epoch,after.controlEpoch);
});

test('S1-7: lost stream and idle timeout end the lease and leave the run paused (Q-T5: 10 minutes, no auto-resume)',()=>{
 const now=clock(),f=ready(now);f.fence({reason:'takeover'});
 const {leaseEpoch}=f.grant({holdApplied:true});
 now.advance(TAKEOVER_LIMITS.leaseIdleMs-1);assert.equal(f.input({leaseEpoch}).accepted,true,'input renews the idle lease');
 now.advance(TAKEOVER_LIMITS.leaseIdleMs);const s=f.state();
 assert.deepEqual([s.state,s.pausedBy],['returning','idle']);
 assert.equal(f.input({leaseEpoch}).accepted,false);
 const l=ready(clock());l.fence({reason:'takeover'});l.grant({holdApplied:true});
 assert.deepEqual([l.endLease({reason:'stream-lost'}).state,l.state().pausedBy],['returning','stream-lost']);
 assert.throws(()=>l.endLease({reason:'whim'}),code('FENCE_INVALID_REASON'));
});

test('revocation during a lease ends it, forbids resume and leaves only teardown; a takeover fence cannot stack',()=>{
 const now=clock(),f=ready(now);f.admit({requestId:'a',tool:'t',timeoutMs:5000});f.fence({reason:'takeover'});
 assert.equal(f.fence({reason:'takeover'}).state,'fencing','a repeated takeover fence while draining is idempotent');
 f.settle('a',{outcome:'result'});
 assert.throws(()=>f.fence({reason:'takeover'}),code('FENCE_STATE_REFUSED'));
 const g=ready(clock());g.fence({reason:'takeover'});const {leaseEpoch}=g.grant({holdApplied:true});
 const r=g.fence({reason:'revocation'});
 assert.deepEqual([r.state,r.reason,r.pausedBy],['drained','revocation','revocation']);
 assert.equal(g.input({leaseEpoch}).accepted,false);
 assert.throws(()=>g.grant({holdApplied:true}),code('TAKEOVER_NOT_DRAINED'));
 assert.throws(()=>g.resume({explicit:true,snapshotCaptured:true}),code('TAKEOVER_RESUME_REFUSED'));
 const h=ready(clock());h.fence({reason:'takeover'});h.grant({holdApplied:true});h.endLease({reason:'revocation'});
 assert.throws(()=>h.resume({explicit:true,snapshotCaptured:true}),code('TAKEOVER_RESUME_REFUSED'));
 const u=ready(clock());u.fence({reason:'takeover'});u.grant({holdApplied:true});
 assert.throws(()=>u.fence({reason:'takeover'}),code('FENCE_STATE_REFUSED'));
});

test('malformed calls are refused before admission',()=>{
 const f=ready(clock());
 for(const bad of [{},{requestId:'a b',tool:'t',timeoutMs:1},{requestId:'a',tool:'',timeoutMs:1},{requestId:'a',tool:'t',timeoutMs:0},{requestId:'a',tool:'t',timeoutMs:130001},{requestId:'a',tool:'t',timeoutMs:1,approvalId:7}])
  assert.throws(()=>f.admit(bad),code('FENCE_INVALID_CALL'));
 f.admit({requestId:'a',tool:'t',timeoutMs:1});
 assert.throws(()=>f.admit({requestId:'a',tool:'t',timeoutMs:1}),code('FENCE_DUPLICATE_CALL'));
 assert.throws(()=>f.settle('a',{outcome:'maybe'}),code('FENCE_INVALID_OUTCOME'));
 assert.equal(f.state().inflight,1,'an invalid settlement leaves the call tracked');
 assert.throws(()=>f.fence({reason:'because'}),code('FENCE_INVALID_REASON'));
});
