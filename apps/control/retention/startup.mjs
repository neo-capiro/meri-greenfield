/** Retention startup composition: the one owner trusted startup composes for retention serving. It builds the serving fence (closed from
 * construction), the acknowledged ledger, the watermarked journal every transition writes through, the canonical read gate, the
 * recovery reconciler and the purge owner, and it decides when serving may open: only after a reconciliation pass over the
 * authoritative ledger has settled and recorded a recovered watermark that reads back exactly. Purge is an explicit switch that must be
 * given; while it is `false` no deletion path is composed at all (the purge owner refuses before any read or effect), and neither
 * startup nor recovery deletes anything. A missing ledger sink or watermark store leaves the fence closed with its reason; nothing
 * serves on an unreconciled projection. Construction performs no IO. */
import {fail,clock} from './boundary.mjs';
import {createRetentionLedger} from './ledger.mjs';
import {createRetentionReadGate,createSuppressionOwner,refusingOwnerMediation} from './suppression.mjs';
import {createRecoveryReconciler} from './reconciliation.mjs';
import {createPurgeExecutor} from './purge.mjs';
import {createServingFence} from './serving-fence.mjs';
import {watermarkedJournal,acknowledgedLedger} from './recovery-watermark.mjs';
const disabledPurge=Object.freeze({enabled:false,async execute(){fail('RETENTION_PURGE_DISABLED');},async recordBlocked(){fail('RETENTION_PURGE_DISABLED');}});
/** `purge` is required: `{enabled:false}`, or `{enabled:true,storage,rows,facts,keyFor}` with every deletion owner bound. `ownership`
 * composes the suppression owner (trusted application ownership reader); without it only the read gate and recovery exist. */
export function createRetentionStartup({journal,watermark=null,ledgerSink=null,ownership=null,authorization=refusingOwnerMediation,cancellation=null,purge,now=Date.now}){
 if(typeof journal?.get!=='function'||typeof journal?.set!=='function'||typeof journal?.exclusive!=='function'||typeof purge?.enabled!=='boolean'||watermark!==null&&['read','readProjection','advanceProjection','record'].some(m=>typeof watermark?.[m]!=='function')||ledgerSink!==null&&(typeof ledgerSink?.append!=='function'||typeof ledgerSink?.read!=='function'))fail('RETENTION_CONFIGURATION');
 const owners=purge.enabled?purge:{storage:null,rows:null,facts:null,keyFor:null};
 if(purge.enabled&&(typeof owners.storage?.deleteVersion!=='function'||typeof owners.rows?.purge!=='function'||typeof owners.facts!=='object'||owners.facts===null||typeof owners.keyFor!=='function'))fail('RETENTION_CONFIGURATION');
 clock(now);const fence=createServingFence();
 const unavailable=ledgerSink===null?'RETENTION_LEDGER_UNAVAILABLE':watermark===null?'RETENTION_WATERMARK_UNAVAILABLE':null;
 const ledger=ledgerSink?acknowledgedLedger({ledger:createRetentionLedger({sink:ledgerSink,now}),fence,watermark}):null;
 const tracked=watermark&&ledger?watermarkedJournal({journal,watermark,fence,ledger}):journal;
 // Every ordinary tracked read requires one backing-store snapshot of the projection and its recovered watermark.
 const gate=createRetentionReadGate({journal:tracked,serving:fence});
 const reconciler=ledger&&watermark?createRecoveryReconciler({ledger,journal:tracked,serving:fence,watermark,storage:owners.storage,keyFor:owners.keyFor,facts:owners.facts,rows:owners.rows,now}):null;
 const suppression=ledger&&ownership?createSuppressionOwner({ledger,journal:tracked,ownership,authorization,cancellation,serving:fence,now}):null;
 const executor=purge.enabled&&ledger?createPurgeExecutor({storage:owners.storage,ledger,journal:tracked,keyFor:owners.keyFor,facts:owners.facts,serving:fence,rows:owners.rows,enabled:true,now}):disabledPurge;
 let recovering=null;
 /** One reconciliation at a time; the fence stays closed throughout and opens only with the read-back watermark. */
 function recover(){if(unavailable){fence.disable(unavailable);return Promise.reject(Object.assign(new Error(unavailable),{code:unavailable}));}
  return recovering??=reconciler.reconcile().finally(()=>{recovering=null;});}
 /** Every readiness proof compares against the current external ledger, including decisions this process never observed. */
 async function ensureServing(){if(fence.isEnabled()){try{return await fence.verify(()=>watermark.read(),()=>ledger.head());}catch{}}
  await recover();return fence.verify(()=>watermark.read(),()=>ledger.head());}
 return Object.freeze({serving:fence,journal:tracked,ledger,gate,suppression,purge:executor,reconciler,recover,ensureServing,start:ensureServing,state:()=>Object.freeze({...fence.state(),purgeEnabled:purge.enabled,unavailable})});
}
