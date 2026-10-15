/** Suppression generation of a set of retention subjects: the highest acknowledged ledger sequence projected for any of them, 0 when
 * none has a row. The retention ledger sequence is global and strictly increasing, so any later suppression or release of one of
 * those subjects advances it. Reads the same journal rows as the canonical read gate (`createRetentionReadGate`), behind the same
 * recovery barrier, and keeps its refusal codes; a currently suppressed subject is RETENTION_SUPPRESSED. */
import {subject,subjectKey,fail} from '../../control/retention/boundary.mjs';
export function createSuppressionGeneration({journal,serving}){
 if(typeof journal?.get!=='function'||typeof serving?.isEnabled!=='function')fail('RETENTION_CONFIGURATION');
 const barrier=()=>{if(!serving.isEnabled())fail('RETENTION_RECOVERY_BARRIER');};
 return async function generation(subjects){
  barrier();if(!Array.isArray(subjects)||!subjects.length)fail('RETENTION_INVALID_REQUEST');let highest=0;
  for(const raw of subjects){let row;try{row=await journal.get(subjectKey(subject(raw)));}catch(error){if(error?.code==='RETENTION_INVALID_REQUEST')throw error;fail('RETENTION_READ_UNAVAILABLE');}
   if(!row)continue;if(row.state!=='RELEASED')fail('RETENTION_SUPPRESSED');if(!Number.isSafeInteger(row.ledgerSequence)||row.ledgerSequence<1)fail('RETENTION_READ_UNAVAILABLE');highest=Math.max(highest,row.ledgerSequence);}
  barrier();return highest;
 };
}
