/** One bounded existing-worker activity call considers one canonical subject.
 * Cursor order comes from the retained ledger; callers cannot nominate a target. */
import {fail,subjectKey} from './boundary.mjs';
import {RETENTION_SWEEP_BUDGET} from '../../../packages/runtime/retention-sweep-budget.mjs';
export function createConversationRetentionSweep({startup,now=Date.now}){
 if(typeof startup?.ensureServing!=='function'||typeof startup?.ledger?.latest!=='function'||
    typeof startup?.purge?.sweepSubject!=='function'||typeof now!=='function')fail('RETENTION_CONFIGURATION');
 return async function sweep({after=null,signal}={}){
  const deadlineMs=now()+RETENTION_SWEEP_BUDGET.workMs;
  const check=()=>{signal?.throwIfAborted();if(now()>=deadlineMs)fail('RETENTION_DEADLINE');};
  if(after!==null&&(typeof after!=='string'||after.length>512))fail('RETENTION_INVALID_REQUEST');
  check();await startup.ensureServing();check();
  const latest=await startup.ledger.latest();check();
  const candidates=[...latest.values()].filter(e=>e.subject.kind==='conversation'&&e.state!=='RELEASED'&&
   !(e.state==='PURGE_EXECUTED'&&e.facts.coreFinalized===true)&&
   (e.reason?.startsWith('conversation-trash:')||e.facts?.trash)).sort((a,b)=>subjectKey(a.subject)<subjectKey(b.subject)?-1:subjectKey(a.subject)>subjectKey(b.subject)?1:0);
  const remaining=candidates.filter(e=>after===null||subjectKey(e.subject)>after),entry=remaining[0];
  if(!entry)return {after:null,more:false,outcome:'empty'};
  let outcome;
  try{const result=await startup.purge.sweepSubject(entry.subject,{signal,deadlineMs});
   outcome=result.coreFinalized?'executed':result.state==='BLOCKED'?'blocked':'unknown';
  }catch(error){signal?.throwIfAborted();outcome='unknown';}
  return {after:subjectKey(entry.subject),more:remaining.length>1,outcome};
 };
}
