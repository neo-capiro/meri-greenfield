/** Legacy inventory composition over injected snapshot and continuation ports.
 * It is source-incomplete for production: the PR176 conversation producer already
 * includes continuations in one repeatable-read snapshot and its digest cannot be
 * carried through this separate-read composition. No purge authority is supplied. */
import {data,own,fail,same,subject,subjectKey,digest} from './boundary.mjs';
import {enumerateReferences} from './inventory.mjs';

const REQUIRED=['subject','runs','checkpoints','completionCheckpoints','nextRuns',
 'sdkSessionEntries','selectedOutputs','artifactVersions','nativeJournalRows','uploads',
 'schedules','receipts','memoryProposals','budgetRuns'];
const OPTIONAL=['editorDrafts','conversation','eventRows','controls'];
const unavailable=()=>fail('RETENTION_AUTHORITY_UNAVAILABLE');

/** `snapshotFor` belongs to the trusted existing data owners and must supply
 * every non-continuation class, including truthful empty lists. A producer
 * inventorySha256 is intentionally refused here: its memory rows were read in
 * the producer's transaction, while this legacy port reads them separately.
 * `journal` is
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
