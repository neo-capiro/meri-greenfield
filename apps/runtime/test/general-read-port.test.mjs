/** Borrowed current read port; SDK native execution is exercised by native-files-runner. */
import {test,mock} from 'node:test';import assert from 'node:assert/strict';
import {captureGeneralReadPort} from '../general-read-port.mjs';
import {binding,versions} from '../../control/conversations/test/store-fixture.mjs';
let activityOptions;
mock.module('../../worker/conversation/activity.mjs',{namedExports:{createConversationActivity(options){activityOptions=options;return async()=> 'synthetic-no-query';}}});
const {assembleConversationRunner}=await import('../conversation-runner.mjs');
function port(){const owners=new WeakSet();let calls=0;const value={async readAvailability(input){assert.equal(owners.has(this),true);calls++;return input;},async execute(input){assert.equal(owners.has(this),true);calls++;return input;}};owners.add(value);return {value,calls:()=>calls};}
test('capturing the trusted mount is inert, receiver-preserving and rejects getters even while disabled',async()=>{
 const p=port(),captured=captureGeneralReadPort(p.value,true);assert.equal(p.calls(),0);p.value.execute=()=>{throw Error('replaced');};const input={operation:'synthetic'};assert.equal(await captured.execute(input),input);assert.equal(p.calls(),1);assert.ok(Object.isFrozen(captured));
 assert.equal(captureGeneralReadPort(port().value,false),undefined);let getters=0;const hostile={get readAvailability(){getters++;return ()=>{};},async execute(){}};
 assert.throws(()=>captureGeneralReadPort(hostile,false));assert.equal(getters,0);
});
for(const enabled of [false,true])test(`ordinary runner passes only an explicitly enabled borrowed read port (${enabled}) to existing activity`,async()=>{
 const p=port(),execute=assembleConversationRunner({configuration:{binding:binding,versions:versions,sourceEnabled:enabled},native:{async call(){throw Error('No effect');}},generalReads:p.value});
 assert.equal(await execute({binding:binding}),'synthetic-no-query');assert.equal(Object.hasOwn(activityOptions,'generalReads'),enabled);assert.equal(p.calls(),0);
 if(enabled){assert.equal(await activityOptions.generalReads.readAvailability('synthetic'), 'synthetic');assert.equal(p.calls(),1);}
});
