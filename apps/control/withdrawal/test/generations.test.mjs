import test from 'node:test';import assert from 'node:assert/strict';
import {checkWithdrawal,createWithdrawalGuard,pinGenerations,WITHDRAWAL_FEATURES,WITHDRAWAL_LIMITS,WITHDRAWAL_SCOPES} from '../generations.mjs';
const code=c=>e=>e.code===c;
const clock=()=>{let t=5_000_000;const now=()=>t;now.advance=ms=>{t+=ms;};return now;};
const all=(n=1)=>Object.fromEntries(WITHDRAWAL_SCOPES.map(s=>[s,n]));

test('every feature pins only its own scopes; unknown features and malformed generations are refused',()=>{
 for(const [name,f] of Object.entries(WITHDRAWAL_FEATURES))assert.deepEqual(Object.keys(pinGenerations(name,all())),[...f.scopes]);
 assert.throws(()=>pinGenerations('vault',all()),code('WITHDRAWAL_CONFIGURATION'));
 assert.throws(()=>pinGenerations('takeover',{...all(),membership:-1}),code('WITHDRAWAL_PIN_INVALID'));
 assert.throws(()=>pinGenerations('editor',{'platform-feature':1}),code('WITHDRAWAL_PIN_INVALID'));
});

test('a bump of any pinned scope during an active run refuses the next action with the feature code',()=>{
 const now=clock();
 for(const [name,f] of Object.entries(WITHDRAWAL_FEATURES)){
  const pinned=pinGenerations(name,all());
  assert.equal(checkWithdrawal(name,{pinned,observation:{generations:all(),observedAtMs:now()},now}).allowed,true);
  for(const scope of f.scopes){
   assert.throws(()=>checkWithdrawal(name,{pinned,observation:{generations:{...all(),[scope]:2},observedAtMs:now()},now}),e=>e.code===f.refusal&&e.scopes.includes(scope));
  }
  const outside=WITHDRAWAL_SCOPES.find(s=>!f.scopes.includes(s));
  if(outside)assert.equal(checkWithdrawal(name,{pinned,observation:{generations:{...all(),[outside]:9},observedAtMs:now()},now}).allowed,true,'other scopes do not affect this feature');
 }
});

test('fail closed: stale, future-dated, incomplete or regressed observations refuse (Q-X7: 30 s)',()=>{
 const now=clock(),pinned=pinGenerations('takeover',all());
 const at=now();now.advance(WITHDRAWAL_LIMITS.stalenessMs);
 assert.equal(checkWithdrawal('takeover',{pinned,observation:{generations:all(),observedAtMs:at},now}).allowed,true);
 now.advance(1);
 assert.throws(()=>checkWithdrawal('takeover',{pinned,observation:{generations:all(),observedAtMs:at},now}),code('WITHDRAWAL_STALE'));
 assert.throws(()=>checkWithdrawal('takeover',{pinned,observation:{generations:all(),observedAtMs:now()+1},now}),code('WITHDRAWAL_STALE'));
 assert.throws(()=>checkWithdrawal('takeover',{pinned,observation:{generations:{membership:1},observedAtMs:now()},now}),code('WITHDRAWAL_STALE'));
 assert.throws(()=>checkWithdrawal('takeover',{pinned,observation:null,now}),code('WITHDRAWAL_STALE'));
 assert.throws(()=>checkWithdrawal('takeover',{pinned:pinGenerations('takeover',all(3)),observation:{generations:all(2),observedAtMs:now()},now}),code('WITHDRAWAL_GENERATION_REGRESSED'));
});

test('guard: a silent source ages out and refuses after the bound; a push or a fresh read restores the decision',async()=>{
 const now=clock();let answer=all(),failing=false;
 const guard=createWithdrawalGuard({feature:'editor',source:{read:async()=>{if(failing)throw new Error('down');return {generations:answer};}},now});
 const pinned=pinGenerations('editor',all());
 assert.equal((await guard.check(pinned)).allowed,true);
 failing=true;now.advance(WITHDRAWAL_LIMITS.stalenessMs);
 assert.equal((await guard.check(pinned)).allowed,true,'still inside the bound');
 now.advance(1);await assert.rejects(guard.check(pinned),code('WITHDRAWAL_STALE'));
 guard.observe(all());assert.equal((await guard.check(pinned)).allowed,true,'a push confirms current generations');
 failing=false;answer={...all(),'artifact-suppression':2};
 await assert.rejects(guard.check(pinned),code('WOPI_REVOKED'));
 assert.throws(()=>createWithdrawalGuard({feature:'editor',source:{},now}),code('WITHDRAWAL_CONFIGURATION'));
});
