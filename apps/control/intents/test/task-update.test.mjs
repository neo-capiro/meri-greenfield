/** SYNTHETIC SQL/credential/policy/Fetch boundaries; actual metadata, intent, approval, journal, executor and source. */
import test from 'node:test';import assert from 'node:assert/strict';
import {commandComposition,mount,delivery,id} from './fixture.mjs';
const operation={id:'update_task',version:'0.2.0'},args={taskId:id(21),title:' Updated ',status:'open'};
function setup(){const c=commandComposition({action:'task.update'}),m=mount({binding:c.binding,preparers:[c.preparer()],now:()=>c.f.state.now});
 return {...c,...m,prepare:(argumentsValue=args)=>m.mount.prepare({operation,arguments:argumentsValue,deliveryId:delivery(1)})};}
test('task update prepares an immutable normalized proposal and approved execution uses the exact fixed native API once',async()=>{
 const c=setup(),prepared=await c.prepare(),{proposal}=prepared;
 assert.equal(proposal.command.contractVersion,'0.2.0');assert.equal(proposal.command.action,'task.update');
 assert.deepEqual(proposal.command.arguments,{taskId:id(21),mode:'unconditional_patch',patch:{title:'Updated',status:'todo'}});
 assert.equal(c.f.state.fetches,0);assert.equal(c.f.pg.rows.size,0);assert.equal(c.f.state.reserves??0,0);assert.equal(c.sql.rows.size,1);
 assert.deepEqual(await c.prepare(),prepared);assert.equal(c.metadataCalls.prepare,1);
 await assert.rejects(c.prepare({...args,title:'Other'}),{code:'CONFLICT'});
 await assert.rejects(c.executeApproved(proposal));assert.equal(c.f.state.fetches,0);
 c.approve(proposal);const result=await c.executeApproved(proposal);assert.equal(result.status,'observed');assert.equal(c.f.state.fetches,1);
 assert.equal(c.f.state.http.url,'https://source.invalid/clio/tools/update_task');
 assert.deepEqual(JSON.parse(c.f.state.http.options.body),{taskId:id(21),title:'Updated',status:'todo'});
 assert.deepEqual(await c.executeApproved(proposal),result);assert.equal(c.f.state.fetches,1);
});
test('task update validates raw patch and rejects argument-borne authority before metadata or native work',async()=>{
 for(const argumentsValue of [{taskId:id(21)},{...args,binding:{}},{...args,clientId:id(4)},{...args,status:'unknown'},{...args,dueDate:'2030-03-17T01:00:00.000Z'}]){
  const c=setup();await assert.rejects(c.prepare(argumentsValue),{code:'INVALID_ARGUMENTS'});assert.equal(c.sql.rows.size,0);assert.equal(c.f.state.fetches,0);
 }
});
test('changed task, patch, binding or approval cannot execute the stored task update',async()=>{
 for(const change of [p=>p.command.arguments.taskId=id(22),p=>p.command.arguments.patch.title='Other',p=>p.command.binding.tenantId='other',p=>p.command.binding.writerFence=2]){
  const c=setup(),{proposal}=await c.prepare();c.approve(proposal);const other=structuredClone(proposal);change(other);
  await assert.rejects(c.executeApproved(other));assert.equal(c.f.state.fetches,0);
 }
 for(const kind of ['wrong_hash','revoked','expired','authority','writer']){
  const c=setup(),{proposal}=await c.prepare();c.approve(kind==='wrong_hash'?{...proposal,commandSha256:'f'.repeat(64)}:proposal);
  if(kind==='revoked')c.f.state.approvalRevoked=true;if(kind==='expired')c.f.state.now+=45000;
  if(kind==='authority')c.f.state.revoked=true;if(kind==='writer')c.f.state.fence=2;
  await assert.rejects(c.executeApproved(proposal));assert.equal(c.f.state.fetches,0);
 }
});
test('lost metadata and native acknowledgements retain uncertainty and never repeat the effect',async()=>{
 const c=setup();c.hooks.prepare=async(value,owner)=>{await owner.prepare(value);throw Error('lost metadata ACK');};
 await assert.rejects(c.prepare(),{code:'UNKNOWN'});await assert.rejects(c.prepare(),{code:'UNKNOWN'});assert.equal(c.sql.rows.size,1);assert.equal(c.metadataCalls.prepare,1);
 const d=setup(),{proposal}=await d.prepare();d.approve(proposal);d.f.state.fetchHook=()=>{throw Error('lost native ACK');};
 await assert.rejects(d.executeApproved(proposal),{message:'COMMAND_OUTCOME_UNKNOWN'});assert.equal(d.f.state.fetches,1);
 assert.equal((await d.executeApproved(proposal)).status,'indeterminate');assert.equal(d.f.state.fetches,1);
});
