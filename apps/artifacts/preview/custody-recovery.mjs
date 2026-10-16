/** Narrow continuation for the EXISTING recovery coordinator. Caller composes reconcileExclusive inside its existing exclusion,
 * after prerequisite source recovery and before readiness. This owner never opens a separate gate or enables purge. */
import {storageMethod,storageLifetime,configuration} from '../storage/boundary.mjs';
export function createPreviewCustodyRecovery({store,sourceRecovery,now,maxRequestMs=15000}){
 configuration(now,maxRequestMs);const replay=storageMethod(store,'replay'),ensure=storageMethod(store,'ensureServing');storageMethod(sourceRecovery,'recover');
 return Object.freeze({
  async reconcileExclusive(signal){const life=storageLifetime({now,maxRequestMs},signal);try{
   // One bounded continuation; the existing coordinator owns exclusion, settling/retry policy and opening its serving fence.
   const after=await life.run(signal=>replay(sourceRecovery,signal));return {positionSha256:after.positionSha256,subjects:after.rows.length};
  }finally{life.close();}},
  ensureServing:signal=>ensure(signal),
 });
}
