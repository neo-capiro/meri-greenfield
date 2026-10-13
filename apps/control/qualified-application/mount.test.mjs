import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {admittedFixture} from '../admitted-runs/test/fixture.mjs';
import {createQualificationActionHost} from './mount.mjs';
import {runLocalHostRecovery} from '../action-host/local/recovery.mjs';
import {receiveActionResponse} from '../../../packages/contracts/dist/action-application.mjs';
import {createPostgresToolBudget} from '../../gateway/budget/postgres-tool-budget.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';

function fixtureConfiguration(t){
 const {source:ignored,...command}=t.config.command;
 const write={origin:'https://qualified-action.invalid',getCredentials:t.p.source.getCredentials,async fetchImpl(url,init){
  assert.equal(url,'https://qualified-action.invalid/clio/tools/create_task');t.s.active(init.signal);const args=JSON.parse(init.body);t.s.state.taskEffects++;
  return new Response(JSON.stringify({tool:'create_task',generatedAt:new Date(t.now()).toISOString(),created:true,task:{id:randomUUID(),title:args.title,status:'todo',dueDate:args.dueDate??null,clientId:args.clientId,createdAt:new Date(t.now()).toISOString()}}),{headers:{'content-type':'application/json'}});
 }};
 return {hostConfiguration:{...t.config,command},source:{read:t.p.source,command:write}};
}

test('persisted qualification graph executes typed fixture and retained approval replay over three actual HTTP hosts',async()=>{
 const t=await admittedFixture(),configuration=fixtureConfiguration(t),hosts=[];
 try{
  const result=await runLocalHostRecovery({mode:'synthetic-local',deadlineMs:Date.now()+25000,receiveResponse:receiveActionResponse,
   approve:t.p.approve,revoke:()=>{t.h.state().grants.get(t.s.readFacts.grantId).state='REVOKED';},stats:()=>({taskEffects:t.s.state.taskEffects,sourceReads:t.s.state.sourceReads,hostsOpened:hosts.length}),
   async openHost(){const host=createQualificationActionHost(configuration);hosts.push(host);
    const response=await host.app.handle(new Request('https://qualification.invalid/api/action-followthrough/session',{method:'POST',headers:{authorization:`Bearer ${t.s.credential}`,'content-type':'application/json'},body:'{}'}));
    assert.equal(response.status,200);const session=await response.json();return {app:host.app,credential:session.credential,closeGraph:()=>host.close()};}
  });
  assert.equal(result.status,'PASS');assert.equal(result.outcomes.unapprovedStatus,409);assert.equal(result.outcomes.revokedStatus,401);assert.equal(result.outcomes.replayIdentical,true);
  assert.equal(t.h.state().reservations.size,2);assert.equal(t.h.state().bindings.size,2);assert.equal(t.h.state().budget.consumed_micro_usd,'20');
  assert.equal(t.s.state.sourceReads,1);assert.equal(t.s.state.taskEffects,1);assert.equal(hosts.every(h=>h.status().closed),true);
 }finally{hosts.forEach(h=>h.close());t.close();}
});

test('both read and command accidental live origins and opaque command source overrides are refused before I/O',async()=>{
 const t=await admittedFixture();try{const c=fixtureConfiguration(t);for(const k of ['read','command'])assert.throws(()=>createQualificationActionHost({...c,source:{...c.source,[k]:{...c.source[k],origin:'https://real.example.com'}}}));
  assert.throws(()=>createQualificationActionHost({...c,hostConfiguration:{...c.hostConfiguration,command:{...c.hostConfiguration.command,source:t.p.commandSource}}}));
  assert.equal(t.s.state.sourceReads,0);assert.equal(t.s.state.taskEffects,0);
 }finally{t.close();}
});

test('canonical trusted grant binding stops after a parked SQL response crosses original cutoff',async()=>{
 const t=await admittedFixture();let release,entered;const gate=new Promise(r=>release=r),seen=new Promise(r=>entered=r),queries=[];
 const pool={async connect(){const client=await t.h.pool.connect();return {async query(sql,args){queries.push(sql);if(sql==='SELECT * FROM meri_qualification.runs WHERE run_id=$1'){entered();await gate;}return client.query(sql,args);},release:e=>client.release(e)};}};
 const life=createOperationLifetime({deadlineMs:Date.now()+100,now:Date.now,errorFactory:c=>Error(c)});
 try{const budget=createPostgresToolBudget({pool,allocationJson:t.config.admission.allocationJson,now:t.now});
  const work=life.run(()=>budget.bindTrustedGrant(JSON.stringify({...t.s.readFacts,invocationId:'qualified-expiry-control'}),life.check));await seen;
  await assert.rejects(work,/DEADLINE/);release();await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));
  assert.equal(queries.some(q=>q.startsWith('INSERT')||q==='COMMIT'),false);assert.equal(queries.includes('ROLLBACK'),true);
 }finally{release();life.close();t.close();}
});
