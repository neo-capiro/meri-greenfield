import test from 'node:test';import assert from 'node:assert/strict';
import {receiveUsageOverviewRequest as admit,receiveUsageOverviewResponse as receive,receiveConversationUsageRequest as admitRun,receiveConversationUsageResponse as receiveRun} from '@capiro/meri-contracts/conversation-usage';
import {request,response} from '../../../apps/control/conversations/usage-overview/test/fixture.mjs';
import {request as runRequest} from '../../../apps/control/conversations/usage-read/test/fixture.mjs';
const bytes=value=>new TextEncoder().encode(JSON.stringify(value));
test('independent named overview receiver preserves closed ordinary run receiver and brands neither execution nor run authority',()=>{
 const q=admit(bytes(request)),body=response(),value=receive(200,bytes(body),q);assert.deepEqual(value,body);assert(Object.isFrozen(q)&&Object.isFrozen(value.periods[0]));
 assert.throws(()=>receive(200,bytes(body),structuredClone(q)),/UNADMITTED_REQUEST/);
 assert.throws(()=>admitRun(bytes(request)));assert.throws(()=>admit(bytes(runRequest)));
 assert.throws(()=>receiveRun(200,bytes(body),admitRun(bytes(runRequest))));
 assert.throws(()=>admit(bytes({...request,tenantId:'forged'})));assert.throws(()=>admit(bytes({...request,limit:20})));
});
test('periods, denominators and cost/capacity uncertainty cannot be promoted into complete-job or physical capacity facts',()=>{
 const q=admit(bytes(request));for(const change of [v=>v.periods.reverse(),v=>v.periods[1].startInclusive=v.periods[0].startInclusive,
  v=>v.periods[0].attempts++,v=>v.periods[0].recording.unavailable++,v=>v.periods[0].completedAttemptsWithRecordedUsage++,
  v=>v.periods[0].completedAttemptKnownChargeMicroUsd=41,v=>v.periods[0].recording.recorded=0,
  v=>v.monthlyAdmission.remainingKnownMicroUsd=100,v=>v.monthlyAdmission.reached=true,v=>v.queue.states.completed=1,
  v=>v.queue.availableCapacity=10,v=>v.queue.physicalConcurrency=3,v=>v.coverage.providerBilledMicroUsd=0,
  v=>v.coverage.completeJobCost='complete',v=>v.periods[0].knownChargeMicroUsd=Number.MAX_SAFE_INTEGER+1,
  v=>v.policy.monthlyCapMicroUsd=0,v=>v.privateDiagnostics='secret']){
  const value=structuredClone(response());change(value);assert.throws(()=>receive(200,bytes(value),q));
 }
});
test('strict failures preserve read uncertainty only for its owner and reject raw diagnostics/status mismatch/hostile bytes',()=>{
 const q=admit(bytes(request));assert.deepEqual(receive(503,bytes({error:{code:'USAGE_OVERVIEW_UNAVAILABLE',outcome:'UNKNOWN'}}),q),{error:{code:'USAGE_OVERVIEW_UNAVAILABLE',outcome:'UNKNOWN'}});
 for(const [status,value]of [[403,{error:{code:'MEMBERSHIP_REVOKED',outcome:'UNKNOWN'}}],[400,{error:{code:'USAGE_OVERVIEW_UNAVAILABLE'}}],[503,{error:{code:'USAGE_OVERVIEW_UNAVAILABLE',outcome:'ACK'}}],[503,{error:{code:'USAGE_OVERVIEW_UNAVAILABLE',detail:'database-private'}}]])assert.throws(()=>receive(status,bytes(value),q));
 assert.throws(()=>admit(new Uint8Array(1025)));assert.throws(()=>receive(200,new Uint8Array(16385),q));assert.throws(()=>admit(new TextEncoder().encode('{"schemaVersion":"meri.usage-overview/1","schemaVersion":"x"}')));
});
