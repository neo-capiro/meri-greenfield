/** SYNTHETIC metadata SQL/policy boundaries; actual metadata, intent journal and preparation. Native execution is covered by native-task tests. */
import test from 'node:test';import assert from 'node:assert/strict';
import {commandComposition,mount,delivery,id} from './fixture.mjs';
const operation={id:'update_task',version:'0.2.0'},args={taskId:id(21),title:' Updated ',status:'open'};
function setup(){const c=commandComposition({action:'task.update'}),m=mount({binding:c.binding,preparers:[c.preparer()],now:()=>c.f.state.now});
 return {...c,...m,prepare:(argumentsValue=args)=>m.mount.prepare({operation,arguments:argumentsValue,deliveryId:delivery(1)})};}
test('task update prepares an immutable normalized proposal and replay returns the exact pending proposal',async()=>{
 const c=setup(),prepared=await c.prepare(),{proposal}=prepared;
 assert.equal(proposal.command.contractVersion,'0.2.0');assert.equal(proposal.command.action,'task.update');
 assert.deepEqual(proposal.command.arguments,{taskId:id(21),mode:'unconditional_patch',patch:{title:'Updated',status:'todo'}});
 assert.equal(c.sql.rows.size,1);
 assert.deepEqual(await c.prepare(),prepared);assert.equal(c.metadataCalls.prepare,1);
 await assert.rejects(c.prepare({...args,title:'Other'}),{code:'CONFLICT'});

});
test('task update validates raw patch and rejects argument-borne authority before metadata or native work',async()=>{
 for(const argumentsValue of [{taskId:id(21)},{...args,binding:{}},{...args,clientId:id(4)},{...args,status:'unknown'},{...args,dueDate:'2030-03-17T01:00:00.000Z'}]){
  const c=setup();await assert.rejects(c.prepare(argumentsValue),{code:'INVALID_ARGUMENTS'});assert.equal(c.sql.rows.size,0);
 }
});
test('lost metadata acknowledgements retain uncertainty and never repeat the effect',async()=>{
 const c=setup();c.hooks.prepare=async(value,owner)=>{await owner.prepare(value);throw Error('lost metadata ACK');};
 await assert.rejects(c.prepare(),{code:'UNKNOWN'});await assert.rejects(c.prepare(),{code:'UNKNOWN'});assert.equal(c.sql.rows.size,1);assert.equal(c.metadataCalls.prepare,1);
});
