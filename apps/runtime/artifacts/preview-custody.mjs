/** Request-local selection of the existing tenant/artifact preview custody owner. The preview service performs current
 * Core authorization before its first read. Neither a deployment tenant nor a browser-selected artifact is a store key.
 * Recovery uses the canonical journal exclusion; it restores facts and never grants a new claim or repeats an effect. */
import {own,v,storageMethod,configuration,fail} from '../../artifacts/storage/boundary.mjs';
import {createPostgresS3PreviewCustody} from '../../artifacts/preview/postgres-composition.mjs';

export function createRuntimePreviewCustody(options){
 const c=own(options,['journal','retention','versionsPool','evidenceS3','versions','now','maxRequestMs']);
 configuration(c.now,c.maxRequestMs);const read=storageMethod(c.versions,'read'),exclusive=storageMethod(c.journal,'exclusive');
 return contextValue=>{
  const context=v.context(contextValue),owners=new Map(),selected=new Map();
  const check=signal=>{if(signal?.aborted)fail('ARTIFACT_CANCELLED');if(c.now()>=context.deadlineMs)fail('ARTIFACT_DEADLINE');};
  async function select(versionId,signal){
   check(signal);if(selected.has(versionId))return selected.get(versionId);
   const stored=await read(versionId,signal),version=v.version(stored?.version);
   if(version.versionId!==versionId||['tenantId','actorId','conversationId'].some(key=>version.binding[key]!==context.binding[key])||
    v.hash(version.scopes)!==v.hash(context.scopes))fail('ARTIFACT_PREVIEW_CLAIM');
   let owner=owners.get(version.artifactId);
   if(!owner){owner=createPostgresS3PreviewCustody({journal:c.journal,retention:c.retention,versionsPool:c.versionsPool,evidenceS3:c.evidenceS3,
     tenantId:context.binding.tenantId,artifactId:version.artifactId,now:c.now,maxRequestMs:c.maxRequestMs,enabled:true});
    await exclusive(()=>owner.recovery.reconcileExclusive(signal));check(signal);owners.set(version.artifactId,owner);}
   selected.set(versionId,owner);return owner;
  }
  // These continuations are selected only by a prior source-authorized read. In particular recordObject must still retain an
  // already completed physical write after revocation/suppression; a fresh source read here would lose that exact receipt.
  const held=value=>{const owner=selected.get(value?.versionId);
   if(!owner||value.tenantId!==context.binding.tenantId||value.conversationId!==context.binding.conversationId||
    !owners.has(value.artifactId)||owners.get(value.artifactId)!==owner)fail('ARTIFACT_PREVIEW_CLAIM');return owner.previews;};
  return Object.freeze({
   async read(versionId,signal){return (await select(versionId,signal)).previews.read(versionId,signal);},
   claim:(claim,signal)=>held(claim).claim(claim,signal),
   assertCurrent:(claim,signal)=>held(claim).assertCurrent(claim,signal),
   recordObject:(claim,object,signal)=>held(claim).recordObject(claim,object,signal),
   commit:(record,signal)=>held(record).commit(record,signal),
  });
 };
}
