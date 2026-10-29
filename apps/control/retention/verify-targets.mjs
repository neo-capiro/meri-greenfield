/** Current absence checks shared by recovery and content-free deletion status.
 * Historical acknowledgements never substitute for these reads. No effects. */
import {fail} from './boundary.mjs';
export async function verifyPurgeTargets({facts,key,storage,keyFor,rows}){
 const verified=[],verifiedRows=[];let revived=false,pending=false;
 const observe=state=>{if(state==='REVIVED')revived=true;if(state==='UNKNOWN')pending=true;return state;};
 for(const f of facts.steps??[]){
  if(!['EXECUTED','UNKNOWN','PENDING'].includes(f.state))fail('RETENTION_LEDGER_CORRUPT');
  const target={workflowId:f.workflowId,classes:f.classes,objectId:f.objectId,versionId:f.versionId,sha256:f.sha256,...(f.scopesSha256?{scopesSha256:f.scopesSha256}:{}),artifactVersionIds:f.artifactVersionIds??[]};
  let readback;try{readback=storage?await storage.headVersion({key:keyFor(target),versionId:target.versionId}):null;}catch{}
  readback??={outcome:'UNKNOWN',reason:'STORAGE_UNAVAILABLE'};
  const state=observe(readback.outcome==='ABSENT'?'EXECUTED':readback.outcome==='PRESENT'?'REVIVED':'UNKNOWN');
  verified.push({...target,readback,state});
 }
 for(const f of facts.rowSteps??[]){
  if(!['EXECUTED','UNKNOWN','PENDING'].includes(f.state))fail('RETENTION_LEDGER_CORRUPT');
  const target={workflowId:f.workflowId,className:f.className,target:f.target};let present;
  try{present=rows?await rows.present(key,target):null;}catch{}
  verifiedRows.push({...target,state:observe(present===false?'EXECUTED':present===true?'REVIVED':'UNKNOWN')});
 }
 return {verified,verifiedRows,revived,pending};
}
