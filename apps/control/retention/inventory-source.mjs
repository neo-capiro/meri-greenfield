/** Planner-ready inventory from the existing complete snapshot owner and the
 * conversation store's exact proposal-continuation rows. This is a fail-closed
 * composition port; it does not supply absent product/retention authorities or
 * enable the purge executor. */
import {data,own,fail,same,subject,subjectKey,digest} from './boundary.mjs';
import {enumerateReferences} from './inventory.mjs';

const REQUIRED=['subject','runs','checkpoints','completionCheckpoints','nextRuns',
 'sdkSessionEntries','selectedOutputs','artifactVersions','nativeJournalRows','uploads',
 'schedules','receipts','memoryProposals','budgetRuns'];
const OPTIONAL=['editorDrafts'];
const unavailable=()=>fail('RETENTION_AUTHORITY_UNAVAILABLE');

/** `snapshotFor` belongs to the trusted existing data owners and must supply
 * every non-continuation class, including truthful empty lists. `journal` is
 * the recovered, watermarked retention journal, not its raw PostgreSQL store.
 * Holding one suppression generation around both reads prevents a release and
 * new suppression from laundering a mixed inventory into a current plan. */
export function createRetentionInventoryFor({snapshotFor,memoryProposalContexts,journal}={}){
 if(typeof snapshotFor!=='function'||typeof memoryProposalContexts?.inventoryForConversation!=='function'||
    typeof journal?.get!=='function')fail('RETENTION_CONFIGURATION');
 async function current(key){let value;try{value=await journal.get(key);}catch{unavailable();}
  if(value?.state!=='SUPPRESSED'||!Number.isSafeInteger(value.ledgerSequence)||value.ledgerSequence<1)
   unavailable();
  try{digest(value.entrySha256);}catch{unavailable();}
  return {ledgerSequence:value.ledgerSequence,entrySha256:value.entrySha256};
 }
 return async function inventoryFor(raw){
  const s=subject(raw),key=subjectKey(s),generation=await current(key);
  let base,continuations;
  try{
   base=own(data(await snapshotFor(s)),REQUIRED,OPTIONAL);
   if(!same(base.subject,s)||Object.hasOwn(base,'memoryContinuations'))unavailable();
   continuations=s.kind==='conversation'?await memoryProposalContexts.inventoryForConversation({
    tenantId:s.tenantId,conversationId:s.subjectId}):[];
  }catch{unavailable();}
  let inventory;try{inventory=enumerateReferences({...base,memoryContinuations:continuations});}
  catch{unavailable();}
  if(!same(await current(key),generation))unavailable();
  return inventory;
 };
}
