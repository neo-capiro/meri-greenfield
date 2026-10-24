/** One bounded existing-worker activity call considers one canonical subject.
 * Cursor order comes from the retained ledger; callers cannot nominate a target. */
import {fail,subjectKey} from './boundary.mjs';
export function createConversationRetentionSweep({startup,now=Date.now}){
 if(typeof startup?.ensureServing!=='function'||typeof startup?.ledger?.latest!=='function'||
    typeof startup?.purge?.sweepSubject!=='function'||typeof now!=='function')fail('RETENTION_CONFIGURATION');
 return async function sweep({after=null,signal}={}){
  if(after!==null&&(typeof after!=='string'||after.length>512))fail('RETENTION_INVALID_REQUEST');
  signal?.throwIfAborted();await startup.ensureServing();signal?.throwIfAborted();
  const latest=await startup.ledger.latest();signal?.throwIfAborted();
  const candidates=[...latest.values()].filter(e=>e.subject.kind==='conversation'&&e.state!=='RELEASED'&&
   !(e.state==='PURGE_EXECUTED'&&e.facts.coreFinalized===true)&&
   (e.reason?.startsWith('conversation-trash:')||e.facts?.trash)).sort((a,b)=>subjectKey(a.subject)<subjectKey(b.subject)?-1:subjectKey(a.subject)>subjectKey(b.subject)?1:0);
  const remaining=candidates.filter(e=>after===null||subjectKey(e.subject)>after),entry=remaining[0];
  if(!entry)return {after:null,more:false,outcome:'empty'};
  let outcome;
  try{const result=await startup.purge.sweepSubject(entry.subject,{signal,deadlineMs:now()+18000});
   outcome=result.coreFinalized?'executed':result.state==='BLOCKED'?'blocked':'unknown';
  }catch(error){signal?.throwIfAborted();outcome='unknown';}
  return {after:subjectKey(entry.subject),more:remaining.length>1,outcome};
 };
}
