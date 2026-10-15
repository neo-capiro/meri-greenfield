/** Shared retention test composition: synthetic subjects, snapshots, policy, clock and ports. No store, bucket or credential. */
import {randomUUID} from 'node:crypto';
import {createRetentionLedger,createMemoryLedgerSink} from '../ledger.mjs';
import {createMemoryRetentionJournal} from '../memory-journal.mjs';
import {createSuppressionOwner} from '../suppression.mjs';
import {createVersionStorage} from '../storage-port.mjs';
import {createServingGate} from '../reconciliation.mjs';
export const tenant='tenant-a',owner='actor-owner';
export const policy=()=>({policyId:'policy-synthetic',version:3,coolingPeriodMs:86400000,classes:Object.fromEntries(['conversation','events','lifecycle','completionCheckpoints','nextRuns','sdkSession','selectedOutputs','nativeJournals','artifactVersions','uploads','logs'].map(c=>[c,{retentionMs:7*86400000,purgeable:c!=='logs'}]))});
export const object=()=>({objectId:randomUUID(),versionId:'v-'+randomUUID().slice(0,8),sha256:'1'.repeat(64)});
/** Trusted application ownership for tests: subjects are registered here when created; the suppression owner reads it, never the caller's claim. */
export const owners=new Map();
export const ownership={async ownerOf({tenantId,kind,subjectId}){return owners.get(`${tenantId}:${kind}:${subjectId}`)??null;}};
export const subjectOf=(kind='conversation',ownerActorId=owner)=>{const s={tenantId:tenant,kind,subjectId:randomUUID()};owners.set(`${tenant}:${kind}:${s.subjectId}`,ownerActorId);return {...s,ownerActorId};};
export function snapshot(subject,{checkpoints=1,outputs=1,shared=[]}={}){
 const checkpoint=()=>{const opaque=object(),entry=object();return {checkpointId:randomUUID(),checkpoint:{opaqueSession:opaque,workspace:{entries:[{object:entry}]}}};};
 const cps=Array.from({length:checkpoints},checkpoint);if(shared.length)cps[0].checkpoint.workspace.entries.push(...shared.map(o=>({object:o})));
 return {subject,runs:[{runId:randomUUID(),continuation:null}],checkpoints:cps,completionCheckpoints:[checkpoint()],nextRuns:[],sdkSessionEntries:[{entryId:randomUUID()}],selectedOutputs:Array.from({length:outputs},()=>({outputId:randomUUID(),object:object()})),artifactVersions:[],nativeJournalRows:[{runId:randomUUID()}],uploads:[]};
}
export function clock(start=1_800_000_000_000){let t=start;return {now:()=>t,advance(ms){t+=ms;return t;}};}
/** Injected storage handler: an in-memory versioned bucket whose responses mimic S3 status codes; `fault` switches ambiguity on. */
export function bucket(){
 const versions=new Map(),fault={mode:null};const key=(k,v)=>k+'@'+v;
 const send=async({operation,input})=>{if(fault.mode==='forbidden')throw Object.assign(new Error('AccessDenied'),{name:'AccessDenied',$metadata:{httpStatusCode:403}});if(fault.mode==='timeout')await new Promise(()=>{});
  const k=key(input.Key,input.VersionId);
  if(operation==='HeadObject'){if(fault.mode==='marker')throw Object.assign(new Error('MethodNotAllowed'),{name:'MethodNotAllowed',$metadata:{httpStatusCode:405,httpHeaders:{'x-amz-delete-marker':'true'}}});if(!versions.has(k))throw Object.assign(new Error('NotFound'),{name:'NotFound',$metadata:{httpStatusCode:404}});return {VersionId:input.VersionId,DeleteMarker:false,$metadata:{httpStatusCode:200}};}
  if(operation==='DeleteObject'){if(fault.mode==='marker-on-delete')return {DeleteMarker:true,VersionId:'marker',$metadata:{httpStatusCode:204}};versions.delete(k);return {VersionId:input.VersionId,$metadata:{httpStatusCode:204,requestId:'req-'+randomUUID().slice(0,8)}};}
  throw Object.assign(new Error('unsupported'),{name:'Unsupported',$metadata:{httpStatusCode:400}});};
 return {versions,fault,send,put(k,v){versions.set(key(k,v),true);},has(k,v){return versions.has(key(k,v));}};
}
export function compose({ownerMediated,permissions={getObjectVersion:true,listBucketVersions:true,deleteObjectVersion:true},maxRequestMs=200}={}){
 const c=clock(),sink=createMemoryLedgerSink(),ledger=createRetentionLedger({sink,now:c.now}),journal=createMemoryRetentionJournal(),serving=createServingGate(),store=bucket();
 const authorization=ownerMediated?{ownerMediated}:undefined;
 const suppression=createSuppressionOwner({ledger,journal,ownership,authorization,serving,now:c.now});
 const storage=createVersionStorage({send:store.send,bucket:'synthetic-bucket',expectedBucketOwner:'967807252336',permissions,now:c.now,maxRequestMs});
 const keyFor=st=>`${tenant}/${st.objectId}/${st.sha256}`;
 return {clock:c,sink,ledger,journal,serving,store,suppression,storage,keyFor,principal:{tenantId:tenant,actorId:owner}};
}
