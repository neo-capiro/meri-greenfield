/** The restore serving fence: the serving barrier every retention reader and writer consults, fenced from construction. It opens only
 * with a recovered watermark, the ledger position a completed reconciliation proved the database projection holds (recorded in the
 * database and read back), and it tracks the highest ledger position this process has since projected or observed. `verify` compares the
 * database's persisted watermark with that position and, for serving/readiness/append proofs, the current external ledger head:
 * another owner may have acknowledged a decision this process never observed. A restore rolls the persisted watermark back, so
 * the fence closes (`RETENTION_WATERMARK_STALE`) and stays closed until reconciliation runs again. Any closure keeps its first reason
 * until a proven reopening. Same `isEnabled`/`disable` surface as the plain serving gate, so every existing owner composes over it. */
import {fail} from './boundary.mjs';
const position=value=>{if(!value||!Number.isSafeInteger(value.sequence)||value.sequence<0||value.entrySha256!==null&&typeof value.entrySha256!=='string')fail('RETENTION_WATERMARK_UNVERIFIED');return Object.freeze({sequence:value.sequence,entrySha256:value.entrySha256});};
export function createServingFence(){
 let enabled=false,reason='RETENTION_STARTUP_FENCE',opened=null,highWater=-1;
 const fence=Object.freeze({
  isEnabled:()=>enabled,
  /** Closes the fence; the first reason since the last opening is the one reported. */
  disable(why='RETENTION_RECOVERY_BARRIER'){if(enabled)reason=typeof why==='string'&&why?why:'RETENTION_RECOVERY_BARRIER';enabled=false;},
  /** Only a recovered watermark at or beyond everything this process projected opens the fence; the plain gate's argument-less
   * enable is refused. */
  enable(proof){const p=position(proof?.watermark);if(p.sequence<highWater)fail('RETENTION_WATERMARK_STALE');opened=p;highWater=Math.max(highWater,p.sequence);reason=null;enabled=true;},
  /** A projection this process completed at this ledger position (after its watermark advance was acknowledged). */
  observe(sequence){if(Number.isSafeInteger(sequence)&&sequence>highWater)highWater=sequence;},
  /** A serving/readiness/append proof also reads the current durable ledger head: local observations alone cannot detect
   * another owner's acknowledged decision after both restorable stores roll back. The head is read after the DB observation. */
  async verify(read,readHead=null){if(!enabled)fail(reason??'RETENTION_RECOVERY_BARRIER');let persisted,current;try{persisted=position(await read());}catch{fence.disable('RETENTION_WATERMARK_UNVERIFIED');fail('RETENTION_WATERMARK_UNVERIFIED');}
   if(readHead!==null){try{current=position(await readHead());}catch{fence.disable('RETENTION_LEDGER_UNVERIFIED');fail('RETENTION_LEDGER_UNVERIFIED');}
    highWater=Math.max(highWater,current.sequence);
    if(persisted.sequence>current.sequence||persisted.sequence===current.sequence&&persisted.entrySha256!==null&&persisted.entrySha256!==current.entrySha256){fence.disable('RETENTION_WATERMARK_UNVERIFIED');fail('RETENTION_WATERMARK_UNVERIFIED');}}
   if(persisted.sequence<highWater){fence.disable('RETENTION_WATERMARK_STALE');fail('RETENTION_WATERMARK_STALE');}if(!enabled)fail(reason);highWater=Math.max(highWater,persisted.sequence);return persisted;},
  state:()=>Object.freeze({enabled,reason:enabled?null:reason,opened,highWater}),
 });
 return fence;
}
