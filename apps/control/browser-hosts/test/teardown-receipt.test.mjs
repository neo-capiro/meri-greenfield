import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {verifiedTeardownReceipt} from '../teardown-receipt.mjs';
const record=mode=>({allocation:{schema:'synthetic-allocation',...(mode===undefined?{}:{hostMode:mode})},originalBinding:{synthetic:'binding'},hostIdentity:{synthetic:'host'}});
function receipt(saved){return {schema:'meri-d005-host-teardown/1',allocationSha256:hash(saved.allocation),bindingSha256:hash(saved.originalBinding),hostIdentitySha256:hash(saved.hostIdentity),reason:'conversation-end',startedAtMs:1000,browserEgress:'closed',bashEgress:'closed',processes:'exited',browserState:'disposed',hostDestroy:'requested',hostAbsence:'confirmed',status:'VERIFIED'};}
test('browser-only cleanup is accepted only for that immutable allocated placement',()=>{
 const saved=record('browser-only'),result={...receipt(saved),bashEgress:'not-applicable',processScope:'browser-host-descendants'};
 assert.deepEqual(verifiedTeardownReceipt(result,saved,1001),result);
 for(const change of [{processScope:'browser-bash-sdk-descendants'},{bashEgress:'closed'},{processes:'unknown'},{hostAbsence:'unknown'},{browserState:'unknown'},{allocationSha256:hash(record().allocation)}])assert.throws(()=>verifiedTeardownReceipt({...result,...change},saved,1001));
 const {processScope,...missing}=result;assert.throws(()=>verifiedTeardownReceipt(missing,saved,1001));
});
test('legacy placement cannot self-label a narrower process scope or skip its Bash cleanup',()=>{
 const saved=record(),result=receipt(saved);assert.deepEqual(verifiedTeardownReceipt(result,saved,1001),result);
 assert.throws(()=>verifiedTeardownReceipt({...result,bashEgress:'not-applicable',processScope:'browser-host-descendants'},saved,1001));
 assert.throws(()=>verifiedTeardownReceipt({...result,processScope:'browser-host-descendants'},saved,1001));
 assert.throws(()=>verifiedTeardownReceipt({...result,bashEgress:'not-applicable'},saved,1001));
 const unknown=record('other');assert.throws(()=>verifiedTeardownReceipt(receipt(unknown),unknown,1001));
});
