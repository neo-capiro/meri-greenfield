/** Retention startup composition: the one owner trusted startup composes for retention serving. It builds the serving fence (closed from
 * construction), the acknowledged ledger, the watermarked journal every transition writes through, the canonical read gate, the
 * recovery reconciler and the purge owner, and it decides when serving may open: only after a reconciliation pass over the
 * authoritative ledger has settled and recorded a recovered watermark that reads back exactly. Purge is an explicit switch that must be
 * given; while it is `false` no deletion path is composed at all (the purge owner refuses before any read or effect), and neither
 * startup nor recovery deletes anything. A missing ledger sink or watermark store leaves the fence closed with its reason; nothing
 * serves on an unreconciled projection. A gate read that meets a closed fence is refused and starts readiness in the background at
 * most once per window. Construction performs no IO. */
import {fail,clock,causeCode} from './boundary.mjs';
import {createRetentionLedger} from './ledger.mjs';
import {createRetentionReadGate,createSuppressionOwner,refusingOwnerMediation} from './suppression.mjs';
import {createRecoveryReconciler} from './reconciliation.mjs';
import {createPurgeExecutor} from './purge.mjs';
import {createServingFence} from './serving-fence.mjs';
import {watermarkedJournal,acknowledgedLedger} from './recovery-watermark.mjs';
import {createDeletionStatusReader} from './deletion-status.mjs';
const disabledPurge=Object.freeze({enabled:false,async execute(){fail('RETENTION_PURGE_DISABLED');},async recordBlocked(){fail('RETENTION_PURGE_DISABLED');}});
const REOPEN_WINDOW_MS=30000;
/** `purge` is required: `{enabled:false}`, or `{enabled:true,storage,rows,facts,keyFor}` with every deletion owner bound. `ownership`
 * composes the suppression owner (trusted application ownership reader); without it only the read gate and recovery exist. The optional
 * trusted recovery continuation runs inside the existing exclusion before the watermark is certified and serving opens. */
export function createRetentionStartup({journal,watermark=null,ledgerSink=null,ownership=null,authorization=refusingOwnerMediation,cancellation=null,purge,now=Date.now,recoverPrerequisitesExclusive=null,log=line=>process.stderr.write(line+'\n')}){
 if(typeof journal?.get!=='function'||typeof journal?.set!=='function'||typeof journal?.exclusive!=='function'||typeof purge?.enabled!=='boolean'||watermark!==null&&['read','readProjection','advanceProjection','record'].some(m=>typeof watermark?.[m]!=='function')||ledgerSink!==null&&(typeof ledgerSink?.append!=='function'||typeof ledgerSink?.read!=='function')||typeof log!=='function')fail('RETENTION_CONFIGURATION');
 if(recoverPrerequisitesExclusive!==null&&typeof recoverPrerequisitesExclusive!=='function')fail('RETENTION_CONFIGURATION');
 const owners=purge.enabled?purge:{storage:null,rows:null,facts:null,keyFor:null};
 if(purge.enabled&&(typeof owners.storage?.deleteVersion!=='function'||typeof owners.rows?.purge!=='function'||typeof owners.facts!=='object'||owners.facts===null||typeof owners.keyFor!=='function'))fail('RETENTION_CONFIGURATION');
 const tick=clock(now),fence=createServingFence();
 const unavailable=ledgerSink===null?'RETENTION_LEDGER_UNAVAILABLE':watermark===null?'RETENTION_WATERMARK_UNAVAILABLE':null;
 const ledger=ledgerSink?acknowledgedLedger({ledger:createRetentionLedger({sink:ledgerSink,now}),fence,watermark}):null;
 const tracked=watermark&&ledger?watermarkedJournal({journal,watermark,fence,ledger}):journal;
 // Every ordinary tracked read requires one backing-store snapshot of the projection and its recovered watermark.
 const reads=createRetentionReadGate({journal:tracked,serving:fence,log});
 const reconciler=ledger&&watermark?createRecoveryReconciler({ledger,journal:tracked,serving:fence,watermark,storage:owners.storage,keyFor:owners.keyFor,facts:owners.facts,rows:owners.rows,verifyCore:owners.verify??null,office:owners.office??null,now,recoverPrerequisitesExclusive}):null;
 const suppression=ledger&&ownership?createSuppressionOwner({ledger,journal:tracked,ownership,authorization,cancellation,serving:fence,now}):null;
 const executor=purge.enabled&&ledger?createPurgeExecutor({storage:owners.storage,ledger,journal:tracked,keyFor:owners.keyFor,facts:owners.facts,serving:fence,rows:owners.rows,finalize:owners.finalize??null,office:owners.office??null,enabled:true,now}):disabledPurge;
 let recovering=null,reopenAttemptedAtMs=-Infinity;
 /** One reconciliation at a time; the fence stays closed throughout and opens only with the read-back watermark. */
 function recover(){if(unavailable){fence.disable(unavailable);return Promise.reject(Object.assign(new Error(unavailable),{code:unavailable}));}
  return recovering??=reconciler.reconcile().finally(()=>{recovering=null;});}
 /** Every readiness proof compares against the current external ledger, including decisions this process never observed. A proof
  * whose read merely failed refuses this call without reconciling: nothing was proven and the fence stays as it was. */
 async function ensureServing(){if(fence.isEnabled()){try{return await fence.verify(()=>watermark.read(),()=>ledger.head());}catch(error){if(error?.code==='RETENTION_READ_UNAVAILABLE')throw error;}}
  await recover();return fence.verify(()=>watermark.read(),()=>ledger.head());}
 /** A serving read that meets a closed fence starts the canonical readiness path in the background at most once per window
  * (coalesced with readiness and the sweep through `recover`), so a store that has recovered reopens within seconds instead of at
  * the next scheduled sweep. The current request is still refused: it may hold a conversation lock, and reconciliation takes the
  * retention exclusion (lock order: retention, then conversation), so it never runs inside that request. A failed attempt is logged. */
 function reopenFenced(){if(fence.isEnabled()||unavailable)return;const at=tick();if(at-reopenAttemptedAtMs<REOPEN_WINDOW_MS)return;reopenAttemptedAtMs=at;
  ensureServing().then(()=>{},error=>{try{log(JSON.stringify({event:'MERI_RETENTION_REOPEN',stage:'retention',outcome:'refused',code:typeof error?.code==='string'?error.code:'unknown',cause:causeCode(error),reason:fence.state().reason}));}catch{/* Observability cannot affect serving. */}});}
 const gate=Object.freeze({isSuppressed:(...args)=>{reopenFenced();return reads.isSuppressed(...args);},assertServable:(...args)=>{reopenFenced();return reads.assertServable(...args);},withRelease:(...args)=>{reopenFenced();return reads.withRelease(...args);}});
 /** A fresh external position after the database observation. No cached proof,
  * recovery, projection mutation or content is returned to the Core caller. */
 async function readServingWitness(){let head;
  await fence.verify(()=>watermark.read(),async()=>{head=await ledger.head();return head;});
  return head;}
 const deletionStatus=createDeletionStatusReader({journal:tracked,ensureServing,owners,enabled:purge.enabled,now});
 return Object.freeze({serving:fence,journal:tracked,ledger,gate,suppression,deletionStatus,purge:executor,reconciler,recover,ensureServing,readServingWitness,start:ensureServing,state:()=>Object.freeze({...fence.state(),purgeEnabled:purge.enabled,unavailable})});
}
