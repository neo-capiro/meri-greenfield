/** SYNTHETIC: the three write-path families (intents, tasks, lifecycle) through the actual `assembleControl` composer seam
 * (`productPortsFactory`), with a fake pool, Temporal client and native client. No connection, Core or database. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleControl} from '../../control.mjs';
import {createProductPortsFactory} from '../index.mjs';
import {createIntentsFamily} from '../intents.mjs';
import {createTasksFamily} from '../tasks.mjs';
import {createLifecycleFamily} from '../lifecycle.mjs';
import {versions} from '../../../control/conversations/test/store-fixture.mjs';
const WRITE_FAMILIES=[['intents',createIntentsFamily],['tasks',createTasksFamily],['lifecycle',createLifecycleFamily]];
const base={sourceEnabled:false,versions,http:{hostname:'127.0.0.1',port:1001,frontendOrigin:'https://ui.synthetic.invalid'},
 limits:{requestMs:1000,requestBytes:131072,startupMs:1000,shutdownMs:1000},native:{maxResponseBytes:131072,capabilityFile:'cap'},database:{connectionFile:'db'},
 temporal:{taskQueue:'synthetic',namespace:'synthetic',address:'synthetic',tls:{caFile:'ca',certFile:'cert',keyFile:'key'}},sessions:{mode:'process-local',replicas:1,maxSessions:10,maxTtlMs:3000}};
function assemble(intents,{gate}={}){
 const touched=[];
 const pool={connect(){touched.push('pool');throw Error('no SQL in this test');},query(){touched.push('pool');throw Error('no SQL');}};
 const native={async call(operation){touched.push(operation);throw Error('no Core');},async readiness(){}};
 const client={workflow:{async start(){touched.push('temporal');},getHandle(){touched.push('temporal');}}};
 const assembly=assembleControl({configuration:{...base,...(intents?{intents}:{})},pool,client,native,now:Date.now,
  ...(gate?{canonicalProductPorts:{conversationMembership:gate}}:{}),productPortsFactory:createProductPortsFactory({families:WRITE_FAMILIES})});
 const owner=name=>assembly.productReadiness().owners.find(o=>o.name===name).state;
 return {assembly,touched,owner};
}
const post=(assembly,path,body)=>assembly.application.handle(new Request('https://meri.synthetic.invalid'+path,{method:'POST',headers:{authorization:'Bearer token','content-type':'application/json'},body:JSON.stringify(body)}));
test('production configuration: control assembles, every write-path gap is named, the intent routes answer INTENTS_UNAVAILABLE',async()=>{
 const {assembly,touched,owner}=assemble();
 try{
  assert.equal(owner('intents.application'),'unavailable');assert.equal(owner('tasks.commands'),'disabled');
  for(const name of ['lifecycle.currentAuthority','lifecycle.admissionRetirement','lifecycle.approvals'])assert.equal(owner(name),'unavailable');
  assert.ok(assembly.productReadiness().missingOwners.includes('intents.application'));
  const r=await post(assembly,'/api/conversations/intents/list',{conversationId:'00000000-0000-4000-8000-000000000001'});assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:{code:'INTENTS_UNAVAILABLE',outcome:'NOT_DISPATCHED'}});
  const t=await post(assembly,'/api/task-commands/prepare',{arguments:{}});assert.equal(t.status,503);assert.deepEqual(await t.json(),{error:{code:'TASK_COMMAND_UNAVAILABLE',outcome:'NOT_DISPATCHED'}});
  assert.deepEqual(touched,[]);
 }finally{await assembly.close();}
});
test('intents enabled with the canonical membership gate: the intent application is composed and mounted on its routes',async()=>{
 const admitted=[];const gate={async admit({credential}){admitted.push(credential);throw Object.assign(Error('synthetic membership refusal'),{code:'ACCESS_DENIED'});},async recheck(){throw Error('not reached');}};
 const {assembly,touched,owner}=assemble({enabled:true},{gate});
 try{
  // The lifecycle's approval wait now composes over Meri's own journal proposal reader and the shared Core decision adapter.
  assert.equal(owner('intents.application'),'composed');assert.equal(owner('tasks.commands'),'disabled');assert.equal(owner('lifecycle.approvals'),'composed');
  const r=await post(assembly,'/api/conversations/intents/list',{conversationId:'00000000-0000-4000-8000-000000000001'});
  assert.notEqual(r.status,503);assert.deepEqual(admitted,['token'],'the request reached the intent application\'s membership gate');assert.deepEqual(touched,[]);
 }finally{await assembly.close();}
});
test('malformed intents configuration stops assembly before any owner is used',()=>{
 assert.throws(()=>assemble({enabled:'yes'}),e=>e?.code==='INTENTS_CONFIGURATION');
});
