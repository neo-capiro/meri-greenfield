/** Canonical schedule-role settings. Common HTTP/Temporal/version configuration remains owned by runtime/config.mjs. */
import {isAbsolute} from 'node:path';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
const refuse=()=>{throw Object.assign(Error('SCHEDULE_SERVICE_CONFIGURATION'),{code:'SCHEDULE_SERVICE_CONFIGURATION'});};
export function compileScheduleServiceConfiguration(configuration){
 try{
  const c=data(configuration),s=own(c.scheduledDispatch,['enabled','conversationTaskQueue','maxConcurrentActivities']);
  if(c.sourceEnabled!==false||s.enabled!==true||typeof s.conversationTaskQueue!=='string'||!/^[a-zA-Z0-9._\-]{1,128}$/u.test(s.conversationTaskQueue)||s.conversationTaskQueue===c.temporal?.taskQueue||
   !Number.isSafeInteger(s.maxConcurrentActivities)||s.maxConcurrentActivities<1||s.maxConcurrentActivities>10||typeof c.temporal?.taskQueue!=='string'||
   !Number.isSafeInteger(c.limits?.requestMs)||c.limits.requestMs<10||c.limits.requestMs>3000||!Number.isSafeInteger(c.limits.startupMs)||c.limits.startupMs<100||c.limits.startupMs>30000||!Number.isSafeInteger(c.limits.shutdownMs)||c.limits.shutdownMs<100||c.limits.shutdownMs>30000)refuse();
  let connectionFile;
  if(c.database!==undefined){
   const d=own(c.database,['connectionFile']);connectionFile=d.connectionFile;
   if(typeof connectionFile!=='string'||!isAbsolute(connectionFile)||connectionFile.length>4096||connectionFile.split(/[\\/]/u).includes('..'))refuse();
  }
  return data({scheduledDispatch:s,...(connectionFile===undefined?{}:{connectionFile})});
 }catch{refuse();}
}
