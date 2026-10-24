import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationRetentionSchedule,createRetentionSweepActivity} from '../retention-sweep.mjs';
test('fixed schedule uses the existing queue and one workflow, without startup-side schedule writes',()=>{
 const schedule=conversationRetentionSchedule({taskQueue:'existing-meri-queue'});
 assert.deepEqual(schedule,{scheduleId:'meri-conversation-trash-expiry',spec:{intervals:[{every:'1 hour'}]},policies:{overlap:'SKIP',catchupWindow:'1 hour'},
  action:{type:'startWorkflow',workflowType:'meriConversationRetentionWorkflow',taskQueue:'existing-meri-queue',args:[]}});
});
test('activity forwards only its cursor on the existing control channel and bounds the call',async()=>{
 const signal=new AbortController().signal,calls=[];let beats=0;
 const activity=createRetentionSweepActivity({now:()=>1000,context:()=>({cancellationSignal:signal,heartbeat(){beats++;}}),native:{async call(...args){calls.push(args);return {after:'tenant:conversation:id',more:false,outcome:'unknown'};}}});
 assert.equal((await activity({after:null})).outcome,'unknown');assert.equal(beats,2);
 assert.deepEqual(calls,[['retention/sweep',{after:null},{signal,deadlineMs:24000,maxRequestMs:23000}]]);
 await assert.rejects(activity({after:null,tenantId:'injected'}));assert.equal(calls.length,1);
});
