/** Next-run selection composes canonical allocation retirement and budget revocation. */
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {createNextRunOwner} from '../control/conversations/next-run.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
const fail=()=>{throw Error('PREPARED_NEXT_RUN_REFUSED');};
/** The admission view of a durable allocation journal record (native-preparation-journal.mjs carries binding/expiresAtMs too): exactly the
 * keys admissionForBinding (prepared-run-bindings.mjs) admits, as runner-poststart-authority.mjs and task-router-authority.mjs pass it. */
export const ADMISSION_RECORD_KEYS=Object.freeze(['state','original','grantIntents','resource','qualification','allocationSha256','taskRequestSha256','allocationKey']);
export const admissionRecordOf=record=>Object.fromEntries(ADMISSION_RECORD_KEYS.filter(k=>record[k]!==undefined).map(k=>[k,record[k]]));
export function createPreparedNextRunOwner(configuration){
 const c=own(configuration,['store','versions','admissionForBinding'],['now']),read=storageMethod(c.store.allocations,'read');if(typeof c.admissionForBinding!=='function')fail();
 async function retired(binding,signal){const check=()=>{if(signal?.aborted)fail();},saved=await read({binding,allocationKey:hash(binding)},check);check();const record=saved.record;
  if(!record||record.state!=='RETIRED'||record.resource?.physicalStopProven!==true||hash(record.original.binding)!==hash(binding)||record.original.executionKey!==hash(binding)||!Array.isArray(record.grantIntents)||!record.grantIntents.length)fail();return record;}
 const retirement={async verifyRetired({binding,signal}){await retired(binding,signal);return {physicalStopProven:true};}},revocation={async verifyRevoked({binding,signal}){
  const record=await retired(binding,signal),admission=await c.admissionForBinding({binding,record:admissionRecordOf(record),signal}),revoke=storageMethod(admission,'revoke'),receipt=data(own(await revoke({taskArn:record.resource.taskArn,signal}),['state','taskArn','grantIds','revocationProven'],['authorityAbsent']));
  if(signal?.aborted||receipt.state!=='REVOKED'||receipt.revocationProven!==true||receipt.taskArn!==record.resource.taskArn||hash([...receipt.grantIds].sort())!==hash(record.grantIntents.map(g=>g.grantId).sort()))fail();return {receiptSha256:hash({binding,receipt}),grantIds:receipt.grantIds};
 }};
 return createNextRunOwner({store:c.store,retirement,revocation,versions:c.versions,...(c.now?{now:c.now}:{})});
}
