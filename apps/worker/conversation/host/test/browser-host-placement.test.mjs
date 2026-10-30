import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {binding} from '../../browser/test/fixtures.mjs';
import {assertHostAllocation,assertBrowserHostCurrent} from '../binding.mjs';

const allocation={schema:'meri-conversation-host-allocation/1',tenantId:binding.tenantId,conversationId:binding.conversationId,generation:1,
 hostId:'00000000-0000-4000-8000-000000000007',imageDigest:'sha256:'+'a'.repeat(64),leaseDeadlineMs:Date.now()+60000};

test('browser-only placement is an exact immutable allocation field; legacy shape and digest stay unchanged',()=>{
 const legacy=assertHostAllocation(allocation),browser=assertHostAllocation({...allocation,hostMode:'browser-only'});
 assert.deepEqual(legacy,allocation);assert.equal(Object.hasOwn(legacy,'hostMode'),false);
 assert.equal(browser.hostMode,'browser-only');assert.notEqual(canonicalSha256(legacy),canonicalSha256(browser));
 assert.throws(()=>{browser.hostMode='conversation';},TypeError);
 for(const hostMode of ['conversation','sdk','browser',false,null,{},'browser-only '])assert.throws(()=>assertHostAllocation({...allocation,hostMode}),/HOST_BINDING_REFUSED/);
 assert.throws(()=>assertHostAllocation({...allocation,hostMode:'browser-only',sdkAbsent:true}),/HOST_BINDING_REFUSED/);
});

test('currentness cannot relabel a saved legacy allocation as browser-only or strip the pinned placement',()=>{
 const browser={...allocation,hostMode:'browser-only'},nowMs=Date.now(),policySha256='b'.repeat(64);
 const current={allocation:browser,binding,policySha256,phase:'active',checkedAtMs:nowMs,currentUntilMs:nowMs+1000};
 const input={allocation:browser,binding,policySha256,current,nowMs,maxFreshMs:1000};
 assert.equal(assertBrowserHostCurrent(input).currentUntilMs,nowMs+1000);
 assert.throws(()=>assertBrowserHostCurrent({...input,current:{...current,allocation}}),/HOST_CURRENTNESS_REFUSED/);
 assert.throws(()=>assertBrowserHostCurrent({...input,allocation}),/HOST_CURRENTNESS_REFUSED/);
});
