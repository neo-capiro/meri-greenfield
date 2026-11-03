/** A claimed Core outreach unit whose run dies before it can publish any draft. Synthetic ports only: no database,
 * network, model or Core call. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createOutreachTerminalSettlement} from '../outreach-generation/terminal.mjs';
import {binding as baseBinding,id} from '../../control/conversations/test/store-fixture.mjs';
const binding={...baseBinding,conversationId:id(1)};
const marker='[Capiro Outreach recipient unit v1]\nSynthetic resolved evidence and recipient directives';
const selection={generationJobId:id(80),itemId:baseBinding.conversationId,conversationId:binding.conversationId,clientId:id(5),
 requestId:id(6),prompt:marker,outputSchema:{type:'object'},generationKey:'recipient:synthetic',revision:1};
const saved=(overrides={})=>({run:{binding,scopes:[],state:'failed',versions:{},createdAt:new Date(0).toISOString(),policyRevision:'p1',...overrides.run},
 request:{requestId:selection.requestId,prompt:marker,...overrides.request}});

function fixture({run=()=>saved(),read=async()=>selection}={}){
 const calls={load:0,read:0,settle:[]};
 const settleTerminalOutreach=createOutreachTerminalSettlement({
  load:async input=>{assert.deepEqual(input.binding,binding);calls.load++;return run();},
  read:async input=>{assert.equal(input.run.state,'failed');assert.equal(input.request.requestId,selection.requestId);calls.read++;return read(input);},
  settle:async input=>{calls.settle.push(input);return {status:'unknown',result:null};}});
 return {calls,settleTerminalOutreach};
}

test('a failed run whose request is a Core outreach unit settles that unit as UNKNOWN',async()=>{
 const f=fixture(),result=await f.settleTerminalOutreach({binding,state:'failed'});
 assert.deepEqual(result,{status:'unknown',result:null});
 assert.equal(f.calls.load,1);assert.equal(f.calls.read,1);assert.equal(f.calls.settle.length,1);
 const [{selection:settled,errorCode,run}]=f.calls.settle;
 assert.deepEqual(settled,selection);assert.equal(errorCode,'generation_unknown');assert.equal(run.binding,binding);
});

test('a completed or cancelled run never reaches the unit owner',async()=>{
 for(const state of ['completed','cancelled','starting','running']){
  const f=fixture();assert.equal(await f.settleTerminalOutreach({binding,state}),null);
  assert.deepEqual(f.calls,{load:0,read:0,settle:[]},state);
 }
});

test('an ordinary run and a stored non-terminal run are left alone',async()=>{
 const ordinary=fixture({run:()=>saved({request:{prompt:'An ordinary question'}})});
 assert.equal(await ordinary.settleTerminalOutreach({binding,state:'failed'}),null);
 assert.deepEqual(ordinary.calls,{load:1,read:0,settle:[]});
 // A successor turn already advanced the stored run: this attempt no longer owns a terminal proof.
 const advanced=fixture({run:()=>saved({run:{state:'running'}})});
 assert.equal(await advanced.settleTerminalOutreach({binding,state:'failed'}),null);
 assert.deepEqual(advanced.calls,{load:1,read:0,settle:[]});
});

test('a conversation with no bound unit settles nothing',async()=>{
 const f=fixture({read:async()=>null});
 assert.equal(await f.settleTerminalOutreach({binding,state:'failed'}),null);
 assert.deepEqual(f.calls,{load:1,read:1,settle:[]});
});

test('a duplicate or late settlement is replayed by the owner and never fails this call',async()=>{
 const owner=async input=>({status:'unknown',result:null,replayed:input.errorCode==='generation_unknown'});
 const calls=[];const settleTerminalOutreach=createOutreachTerminalSettlement({load:async()=>saved(),read:async()=>selection,
  settle:async input=>{calls.push(input);return owner(input);}});
 for(const at of [1,2]){const result=await settleTerminalOutreach({binding,state:'failed'});
  assert.deepEqual(result,{status:'unknown',result:null,replayed:true},`settlement ${at}`);}
 assert.equal(calls.length,2);assert.ok(calls.every(call=>call.errorCode==='generation_unknown'));
});

test('an owner refusal surfaces and is never converted into a settlement',async()=>{
 const refused=Object.assign(Error('OUTREACH_GENERATION_REFUSED'),{code:'OUTREACH_GENERATION_REFUSED'});
 const settleTerminalOutreach=createOutreachTerminalSettlement({load:async()=>saved(),read:async()=>selection,settle:async()=>{throw refused;}});
 await assert.rejects(settleTerminalOutreach({binding,state:'failed'}),error=>error===refused);
 // A read that cannot resolve the unit also refuses rather than guessing.
 const unreadable=createOutreachTerminalSettlement({load:async()=>saved(),read:async()=>{throw refused;},settle:async()=>assert.fail('never settles')});
 await assert.rejects(unreadable({binding,state:'failed'}),error=>error===refused);
});

test('an incomplete composition refuses instead of settling nothing silently',()=>{
 for(const missing of [{load:null,read:async()=>selection,settle:async()=>null},{load:async()=>saved(),read:null,settle:async()=>null},
  {load:async()=>saved(),read:async()=>selection,settle:null}])
  assert.throws(()=>createOutreachTerminalSettlement(missing),/OUTREACH_TERMINAL_CONFIGURATION/u);
});
