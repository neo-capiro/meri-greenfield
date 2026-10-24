/** Existing Temporal worker/control channel. Schedule creation is a separate
 * release action using its existing namespace and credentials, never startup. */
import {Context} from '@temporalio/activity';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {fault} from './config.mjs';

/** @param {{taskQueue:string}} input @returns {import('@temporalio/client').ScheduleOptions} */
export function conversationRetentionSchedule({taskQueue}){
 if(typeof taskQueue!=='string'||!taskQueue||taskQueue.length>256)throw fault('RETENTION_CONFIGURATION');
 return {scheduleId:'meri-conversation-trash-expiry',spec:{intervals:[{every:'1 hour'}]},
  policies:{overlap:'SKIP',catchupWindow:'1 hour'},
  action:{type:'startWorkflow',workflowType:'meriConversationRetentionWorkflow',taskQueue,args:[]}};
}
export function createRetentionSweepActivity({native,context=()=>Context.current(),now=Date.now}){
 if(typeof native?.call!=='function')throw fault('RETENTION_CONFIGURATION');
 return async function sweepConversationRetention(input){
  own(input,['after']);if(input.after!==null&&(typeof input.after!=='string'||input.after.length>512))throw fault('RETENTION_INVALID_REQUEST');
  const activity=context(),signal=activity.cancellationSignal;signal.throwIfAborted();activity.heartbeat();
  const result=own(await native.call('retention/sweep',input,{signal,deadlineMs:now()+23000,maxRequestMs:23000}),['after','more','outcome']);
  if(result.after!==null&&(typeof result.after!=='string'||result.after.length>512)||typeof result.more!=='boolean'||
     !['empty','executed','blocked','unknown'].includes(result.outcome)||result.more&&result.after===null)throw fault('RETENTION_RECEIPT_REFUSED');
  signal.throwIfAborted();activity.heartbeat();return result;
 };
}
