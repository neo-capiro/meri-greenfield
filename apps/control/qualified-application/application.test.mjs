import test from 'node:test';
import assert from 'node:assert/strict';
import {createApplicationFixture} from './application.fixture.mjs';
import {runLocalHostRecovery} from '../action-host/local/recovery.mjs';
import {receiveActionResponse} from '../../../packages/contracts/dist/action-application.mjs';

test('complete source assembly installs, activates through actual Python Grants, binds one ledger and reconstructs HTTP hosts',async()=>{
 const f=await createApplicationFixture(),owners=[];let installed,initial;
 try{
  initial=f.make();owners.push(initial);assert.equal((await initial.app.handle(new Request('https://fixture.invalid/'))).status,503);assert.equal(f.statements.length,0);await assert.rejects(f.child.readState(),{code:'ENOENT'});
  installed=await initial.initialize({prepareSchema:true});assert.equal(installed.worker.status,'ACTIVE');assert.equal(installed.worker.evidenceKind,'trusted-read-port-observation');assert.equal(installed.schema.runtimeQualified,false);assert.equal(installed.schema.relationCount,13);assert.equal(f.sql.h.state().bindings.size,2);
  assert.equal(Object.values((await f.child.readState()).grants).every(g=>g.state==='ACTIVE'),true);assert.equal(f.statements.some(q=>/^INSERT INTO meri_qualification\.(runs|grants)/u.test(q)),false);
  let opened=0,current=initial;const result=await runLocalHostRecovery({mode:'synthetic-local',deadlineMs:Math.min(Date.now()+25000,f.s.deadlineMs),receiveResponse:receiveActionResponse,approve:f.ports.approve,revoke:()=>current.revoke(),stats:f.stats,
   async openHost(){if(opened++){current=f.make({fixture:installed.fixture});owners.push(current);const receipt=await current.reconstruct();assert.equal(receipt.reconstruction,true);assert.equal(receipt.schema.initialStateVerified,false);}const credential=await f.issue(current);const host=current;return {app:host.app,credential,closeGraph:()=>host.close()};}
  });
  assert.equal(result.status,'PASS');assert.equal(result.outcomes.unapprovedStatus,409);assert.equal(result.outcomes.revokedStatus,401);assert.equal(f.stats().taskEffects,1);assert.equal(f.stats().sourceReads,1);assert.equal(f.sql.h.state().reservations.size,2);assert.equal(f.sql.h.state().budget.consumed_micro_usd,'20');
  assert.equal(f.schema.log.filter(r=>/^-- Qualification-only/u.test(r.text)).length<=3,true);assert.equal(f.schema.state.commits,3);assert.equal(owners.every(o=>o.status().lifecycle.ownedChildren===0),true);
 }finally{owners.forEach(o=>o.close());await f.close();}
});

test('worker refusal leaves pending grants, no JS allocation or source, and terminal application state',async()=>{
 const f=await createApplicationFixture(),app=f.make();f.worker.task.LastStatus='STOPPED';
 try{await assert.rejects(app.initialize({prepareSchema:true}));assert.equal(app.status().state,'UNKNOWN');assert.equal(f.sql.h.state().bindings.size,0);assert.equal(f.sql.h.state().allocation,null);assert.equal(f.stats().taskEffects,0);assert.equal(Object.values((await f.child.readState()).grants).every(g=>g.state==='PENDING'),true);await assert.rejects(app.initialize({prepareSchema:true}));assert.equal(app.status().lifecycle.ownedChildren,0);}finally{app.close();await f.close();}
});
