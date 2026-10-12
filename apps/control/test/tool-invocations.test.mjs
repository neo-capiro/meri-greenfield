import test from 'node:test';
import assert from 'node:assert/strict';
import { bindToolInvocationControl, createToolInvocationControl } from '../tool-invocations.mjs';

test('control construction rejects effectful options before any capability access',()=>{
 let touched=0;
 const getter=Object.defineProperty({},'gateway',{get(){touched++;throw Error();},enumerable:true});
 const proxy=new Proxy({}, {getPrototypeOf(){touched++;throw Error();}});
 for(const value of [getter,proxy])for(const make of [bindToolInvocationControl,createToolInvocationControl])assert.throws(()=>make(value));
 assert.equal(touched,0);
});
test('delivery correlation rejects objects without invoking serialization hooks',()=>{
 let touched=0,called=0;const c=bindToolInvocationControl({gateway:{bindTrustedGrant(){},executeOwned(){called++;},reconcileInvocation(){called++;}},
  contextJson:JSON.stringify({grantId:'fixture',binding:{},qualificationBinding:{},capabilitySha256:'fixture',allocationSha256:'fixture'}),
  producerJson:JSON.stringify({namespace:'fixture',executionId:'fixture'})});
 const delivery={toJSON(){touched++;return 'foreign';}};
 assert.throws(()=>c.execute('{}','fixture',delivery));assert.throws(()=>c.reconcile('{}',delivery));assert.equal(touched,0);assert.equal(called,0);
 assert.deepEqual(Object.keys(c),['bindTrustedGrant','execute','reconcile']);
});
