/** Background settlement of runs nothing can progress any more. The hourly retention pass starts one bounded pass per control
 * process; each candidate goes through the existing run reconciler (fence failed ATTEMPT_LOST under the run lock, then the
 * provider Stop for a claimed invocation), so a later kickoff, runner callback or replayed submit cannot revive it. */
import {validateShape} from './boundary.mjs';
import {RUN_ACTIVITY_START_TO_CLOSE_MS} from '../../../packages/contracts/run-limits.mjs';
import {settlementUnknownReason} from './run-reconciler.mjs';
/** A nonterminal run that never claimed an invocation, created longer ago than one Temporal run activity may live plus margin:
 * no broker can still hold it, so only a delayed or replayed dispatch could start it, and that is refused once it is fenced. */
export const UNCLAIMED_RUN_AGE_MS=RUN_ACTIVITY_START_TO_CLOSE_MS+15*60*1000;
/** A claimed invocation past its execution lease: the runner's authentication and the broker's lease both end at `expiresAtMs`,
 * and the workflow's own reconcile budget (240 s) has elapsed inside this grace. */
export const EXPIRED_CLAIM_GRACE_MS=15*60*1000;
export const UNPROGRESSED_RUNS_PER_PASS=10;
const UNPROGRESSED_SQL=`SELECT r.projection->'binding' AS binding
 FROM meri_conversations.runs r
 LEFT JOIN meri_conversations.native_executions x ON x.tenant_id=r.tenant_id AND x.conversation_id=r.conversation_id AND x.run_id=r.run_id
 WHERE r.sequence_end IS NULL AND (
  (r.projection->>'state' IN ('queued','starting','running') AND (
   (x.run_id IS NULL AND (r.projection->>'createdAt')::timestamptz < to_timestamp($1::double precision/1000))
   OR (x.run_id IS NOT NULL AND (x.record->>'expiresAtMs')::bigint < $2::bigint)))
  OR (r.projection->>'state' IN ('completed','failed','cancelled') AND x.record->>'phase'<>'settled' AND (x.record->>'expiresAtMs')::bigint < $2::bigint))
 ORDER BY random() LIMIT $3`;
/** One read-only cross-tenant selection. Random order keeps a run whose settlement keeps failing from starving the others. */
export async function listUnprogressedRuns(pool,{nowMs,limit=UNPROGRESSED_RUNS_PER_PASS}){
 if(!Number.isSafeInteger(nowMs)||!Number.isSafeInteger(limit)||limit<1||limit>100)throw Object.assign(Error('SETTLEMENT_CONFIGURATION'),{code:'SETTLEMENT_CONFIGURATION'});
 const c=await pool.connect();let reusable=false;
 try{
  await c.query('BEGIN READ ONLY');await c.query("SET LOCAL statement_timeout = '10s'");
  const rows=(await c.query(UNPROGRESSED_SQL,[String(nowMs-UNCLAIMED_RUN_AGE_MS),String(nowMs-EXPIRED_CLAIM_GRACE_MS),limit])).rows;
  await c.query('COMMIT');reusable=true;
  const bindings=[];for(const row of rows){try{validateShape('RunBinding',row.binding);bindings.push(row.binding);}catch{}}
  return bindings;
 }finally{if(!reusable)try{await c.query('ROLLBACK');}catch{}c.release(reusable?undefined:true);}
}
const stderr=line=>process.stderr.write(line+'\n');
/** Single-flight per process: `start` returns the pass (settled once its line is written), or null while one is in progress;
 * `close` aborts a pass in progress and waits for it. One counts-only line per pass, including bounded unknown-reason counts. */
export function createUnprogressedRunSettlement({list,reconciler,now=Date.now,write=stderr}){
 if(typeof list!=='function'||typeof reconciler?.reconcile!=='function'||typeof now!=='function')throw Object.assign(Error('SETTLEMENT_CONFIGURATION'),{code:'SETTLEMENT_CONFIGURATION'});
 let running=null,controller=null;
 const report=value=>{try{write(JSON.stringify({event:'MERI_RUN_SETTLEMENT',...value}));}catch{/* Observability cannot change settlement. */}};
 async function pass(signal){
  const counts={candidates:0,reconciled:0,settled:0,unknown:0};
  const unknownReasons={};
  const unknown=reason=>{counts.unknown++;const code=settlementUnknownReason(reason);unknownReasons[code]=(unknownReasons[code]??0)+1;};
  const bindings=await list({nowMs:now()});
  for(const binding of bindings){
   signal.throwIfAborted();counts.candidates++;
   try{const result=await reconciler.reconcile({binding,signal});if(result.outcome==='unknown')unknown(result.reasonCode);else counts[result.outcome==='reconciled'?'reconciled':'settled']++;}
   catch{signal.throwIfAborted();unknown('RECONCILE_ERROR');}
  }
  return {...counts,...(counts.unknown?{unknownReasons}:{})};
 }
 return Object.freeze({
  start(){
   if(running)return null;controller=new AbortController();
   running=pass(controller.signal).then(counts=>report({outcome:'completed',...counts}),()=>report({outcome:controller.signal.aborted?'cancelled':'unavailable'}))
    .finally(()=>{running=null;});
   return running;
  },
  async close(){controller?.abort();await running;},
 });
}
