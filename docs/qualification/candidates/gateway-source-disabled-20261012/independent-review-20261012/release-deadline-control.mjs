import assert from 'node:assert/strict';
import {fixture,NOW,limits,requestJson} from '../../../../../apps/gateway/test/fixtures.mjs';
const f=fixture();let deadline=NOW+10000,lastObservedDeadline;const originalRun=f.ports.currentRun;
f.ports.currentRun=async call=>{const row=JSON.parse(await originalRun(call));row.deadlineMs=deadline;lastObservedDeadline=deadline;return JSON.stringify(row);};
const originalHandler=f.entry.execute;f.entry.execute=async call=>{const result=await originalHandler(call);deadline=NOW+20;return result;};
let releaseSettlement;f.budget.settle=()=>{f.calls.push('settle-pending');return new Promise(resolve=>{releaseSettlement=resolve;});};
const controller=new AbortController();let completed=false,failureCode;
const operation=f.create({limits:{...limits,maxRequestMs:2000,maxCleanupMs:20}}).execute(requestJson,'synthetic-opaque',controller.signal).catch(error=>{failureCode=error.message;}).finally(()=>{completed=true;});
let observed;
try{
 await new Promise(resolve=>setTimeout(resolve,100));
 observed={freshReleaseRunDeadlineMs:lastObservedDeadline,expectedShrunkDeadlineMs:NOW+20,settlementEntered:f.calls.includes('settle-pending'),completedWithin100ms:completed,failureCode:failureCode??null};
 console.log(JSON.stringify(observed),flush=>flush);
}finally{
 controller.abort();await operation;
 if(releaseSettlement)releaseSettlement(JSON.stringify({reservationId:'77777777-7777-4777-8777-777777777777',decision:'settled'}));
 await new Promise(resolve=>setImmediate(resolve));
 console.log(JSON.stringify({cleanupFailureCode:failureCode,uncertaintyCalls:f.calls.filter(x=>x==='uncertain').length,fixturePendingSettlementReleased:true}));
}
assert.equal(observed.freshReleaseRunDeadlineMs,NOW+20);
assert.equal(observed.settlementEntered,true);
assert.equal(observed.completedWithin100ms,true,'fresh release deadline must shrink lifetime before parked settlement');
