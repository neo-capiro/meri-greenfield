import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;assert.ok(root);
const {assertLifecycleCommand:command,assertLifecycleReceipt:receipt,assertWorkerControl:worker}=await import(pathToFileURL(root+'/packages/contracts/conversation-lifecycle/validate.mjs'));
const id=n=>`${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`;
const b={tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:id('1'),runId:id('2'),attemptId:id('3'),workerId:id('4'),writerFence:7};
const clone=structuredClone;const digest='a'.repeat(64);
const base={controlId:id('5'),intent:'resume',sourceBinding:b,inputSha256:digest,state:'APPLIED',checkpointId:id('6'),targetBinding:{...b,runId:id('7'),attemptId:id('8'),workerId:id('9'),writerFence:8},admissionReceiptId:id('a'),retirementReceiptId:id('b'),replayed:false};
test('Closed command admits bounded intents and grants no caller binding/skill/window fields',()=>{
 for(const value of [{controlId:id('5'),intent:'steer',text:'Synthetic steering'},{controlId:id('5'),intent:'pause'},{controlId:id('5'),intent:'approval.wait',proposalId:id('6')},{controlId:id('5'),intent:'resume',checkpointId:id('6'),checkpointSha256:digest},{controlId:id('5'),intent:'fork',checkpointId:id('6'),checkpointSha256:digest}]){
  const saved=command(value);assert.deepEqual(saved,value);assert.ok(Object.isFrozen(saved));assert.notStrictEqual(saved,value);
  for(const key of ['binding','scope','window','skill','versions','targetBinding','proposalSha256','credential'])assert.throws(()=>command({...value,[key]:null}));
 }
});
test('Caller object getters, Proxy and nested hostile command data are inert',()=>{
 let effects=0;const good={controlId:id('5'),intent:'steer',text:'Synthetic'};
 Object.defineProperty(good,'text',{enumerable:true,get(){effects++;return 'Untrusted';}});
 assert.throws(()=>command(good));assert.throws(()=>command(new Proxy({},{get(){effects++;},ownKeys(){effects++;return []}})));
 assert.equal(effects,0);
});
test('Invalid Unicode, controls and oversized steering text refuse',()=>{
 for(const text of ['',' ','\ud83d','\ude00','text\u0000','🧪'.repeat(40000),'a'.repeat(100001)])assert.throws(()=>command({controlId:id('5'),intent:'steer',text}));
 assert.equal(command({controlId:id('5'),intent:'steer',text:'Well formed 😀\ntext'}).text,'Well formed 😀\ntext');
});
test('Applied resume receipt requires fresh complete binding and admission plus retirement correlation',()=>{
 assert.deepEqual(receipt(base),base);
 for(const mutate of [v=>v.targetBinding.tenantId='other',v=>v.targetBinding.actorId='other',v=>v.targetBinding.conversationId=id('f'),v=>v.targetBinding.runId=b.runId,v=>v.targetBinding.attemptId=b.attemptId,v=>v.targetBinding.workerId=b.workerId,v=>v.targetBinding.writerFence=7,v=>v.admissionReceiptId=null,v=>v.retirementReceiptId=null,v=>v.checkpointId=null,v=>v.targetBinding=null]){const v=clone(base);mutate(v);assert.throws(()=>receipt(v));}
});
test('Fork receipt preserves source and has distinct target conversation without claiming retirement',()=>{
 const value={...clone(base),intent:'fork',targetBinding:{...clone(base.targetBinding),conversationId:id('c')},retirementReceiptId:null};
 const result=receipt(value);assert.deepEqual(result.sourceBinding,b);assert.equal(result.retirementReceiptId,null);
 assert.throws(()=>receipt({...value,targetBinding:{...value.targetBinding,conversationId:b.conversationId}}));
});
test('UNKNOWN receipt does not fabricate a target or physical-stop proof',()=>{
 const value={...clone(base),state:'UNKNOWN',targetBinding:null,checkpointId:null,admissionReceiptId:null,retirementReceiptId:null};
 assert.deepEqual(receipt(value),value);assert.throws(()=>receipt({...value,physicalStopProven:true}));
});
test('Worker command snapshots full server context and admits no caller-selected source or runtime',()=>{
 const value={controlId:id('5'),action:'steer',binding:b,contextSha256:digest,prompt:'Synthetic',commandSha256:digest,controlSequence:1};const result=worker(value);
 assert.ok(Object.isFrozen(result.binding));assert.deepEqual(result,value);
 for(const field of ['scope','window','skill','sourceIds','versions','resumeSessionAt'])assert.throws(()=>worker({...value,[field]:null}));
 for(const controlSequence of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>worker({...value,controlSequence}));
});
test('Approval wait requires exact proposal identity/hash while pause and steer prohibit approval fields',()=>{
 const common={controlId:id('5'),binding:b,contextSha256:digest};
 assert.equal(worker({...common,action:'waitForApproval',proposalId:id('6'),proposalSha256:digest}).proposalSha256,digest);
 assert.throws(()=>worker({...common,action:'waitForApproval',proposalId:id('6')}));
 assert.throws(()=>worker({...common,action:'pause',proposalId:id('6')}));
 assert.throws(()=>worker({...common,action:'steer',prompt:'Synthetic',proposalSha256:digest}));
});
