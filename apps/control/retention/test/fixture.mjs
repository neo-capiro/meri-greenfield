/** Shared retention test composition: synthetic subjects, snapshots, policy, clock and ports. No store, bucket or credential. */
import {randomUUID} from 'node:crypto';
import {createRetentionLedger,createMemoryLedgerSink} from '../ledger.mjs';
import {createMemoryRetentionJournal} from '../memory-journal.mjs';
import {createSuppressionOwner} from '../suppression.mjs';
import {createVersionStorage} from '../storage-port.mjs';
import {createServingGate,createRecoveryReconciler} from '../reconciliation.mjs';
import {createPurgeExecutor,planPurge} from '../purge.mjs';
import {subjectKey} from '../boundary.mjs';
import {rowClassSubjectKind} from '../inventory.mjs';
export const tenant='tenant-a',owner='actor-owner';
export const policy=()=>({policyId:'policy-synthetic',version:3,coolingPeriodMs:86400000,classes:Object.fromEntries(['conversation','events','lifecycle','completionCheckpoints','nextRuns','sdkSession','selectedOutputs','nativeJournals','artifactVersions','uploads','logs'].map(c=>[c,{retentionMs:7*86400000,purgeable:c!=='logs'}]))});
export const object=()=>({objectId:randomUUID(),versionId:'v-'+randomUUID().slice(0,8),sha256:'1'.repeat(64)});
/** Trusted application ownership for tests: subjects are registered here when created; the suppression owner reads it, never the caller's claim. */
export const owners=new Map();
export const ownership={async ownerOf({tenantId,kind,subjectId}){return owners.get(`${tenantId}:${kind}:${subjectId}`)??null;}};
export const subjectOf=(kind='conversation',ownerActorId=owner)=>{const s={tenantId:tenant,kind,subjectId:randomUUID()};owners.set(`${tenant}:${kind}:${s.subjectId}`,ownerActorId);return {...s,ownerActorId};};
export const sdkEntry=({runId=randomUUID(),sessionId=randomUUID(),subpath='main',sequence=1}={})=>({entryId:randomUUID(),runId,sessionId,subpath,sequence});
export function snapshot(subject,{checkpoints=1,outputs=1,shared=[],sdkEntries=[sdkEntry()],artifactVersions=[]}={}){
 const checkpoint=()=>{const opaque=object(),entry=object();return {checkpointId:randomUUID(),checkpoint:{opaqueSession:opaque,workspace:{entries:[{object:entry}]}}};};
 const cps=Array.from({length:checkpoints},checkpoint);if(shared.length)cps[0].checkpoint.workspace.entries.push(...shared.map(o=>({object:{objectId:o.objectId,versionId:o.versionId,sha256:o.sha256}})));
 return {subject,runs:[{runId:randomUUID(),continuation:null}],checkpoints:cps,completionCheckpoints:[checkpoint()],nextRuns:[],sdkSessionEntries:sdkEntries,selectedOutputs:Array.from({length:outputs},()=>({outputId:randomUUID(),object:object()})),artifactVersions,nativeJournalRows:[{runId:randomUUID()}],uploads:[]};
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
/** Authoritative current facts for tests: a mutable registry per subject (inventory, shared holders, holds, liabilities, last activity) and one
 * policy; `unavailable` names ports that fail. Shared by the in-process and the PostgreSQL suites. */
export function currentFacts(c){
 const current={policy:policy(),inventories:new Map(),shared:new Map(),holds:new Map(),liabilities:new Map(),lastActivity:new Map(),unavailable:new Set()};
 const facts={policy:async()=>{if(current.unavailable.has('policy'))throw new Error('unavailable');return current.policy;},
  inventoryFor:async s=>{if(current.unavailable.has('inventory'))throw new Error('unavailable');const v=current.inventories.get(subjectKey(s));if(!v)throw new Error('no inventory');return v;},
  sharedFor:async s=>{if(current.unavailable.has('shared'))throw new Error('unavailable');return current.shared.get(subjectKey(s))??[];},
  holds:o=>{if(current.unavailable.has('holds'))throw new Error('unavailable');return current.holds.get(o.objectId+'@'+o.versionId)??{objectLockRetainUntilMs:null,legalHold:false};},
  liabilities:async s=>{if(current.unavailable.has('liabilities'))throw new Error('unavailable');return current.liabilities.get(subjectKey(s))??[];},
  lastActivityFor:async s=>{if(current.unavailable.has('lastActivity'))throw new Error('unavailable');return current.lastActivity.get(subjectKey(s))??c.now()-30*86400000;}};
 return {current,facts};
}
/** In-process database-row purge port: the rows that exist per subject (seeded from the inventory's row targets) and their deletion.
 * Like the SQL row owner it routes each class to one subject kind and refuses any other, in preflight and inside purge. */
export function memoryRows(){
 const present=new Map();const id=t=>JSON.stringify(t);
 const route=(key,plan)=>{const kind=key.split(':').at(-2);for(const st of plan.rowSteps)if(rowClassSubjectKind[st.className]!==kind)throw Object.assign(new Error('RETENTION_INVALID_REQUEST'),{code:'RETENTION_INVALID_REQUEST'});};
 return {present,seed(key,inventory){present.set(key,new Set(inventory.rowTargets.map(id)));},
  async preflight(key,plan){route(key,plan);return true;},
  async purge(key,plan){route(key,plan);const rows=present.get(key)??new Set();return plan.rowSteps.map(st=>{const had=rows.delete(id(st.target));return {workflowId:st.workflowId,state:'EXECUTED',deleted:had?1:0};});},
  async present(key,fact){return (present.get(key)??new Set()).has(id(fact.target));},
  revive(key,target){present.get(key)?.add(id(target));}};
}
export function compose({ownerMediated,permissions={getObjectVersion:true,listBucketVersions:true,deleteObjectVersion:true},maxRequestMs=200}={}){
 const c=clock(),sink=createMemoryLedgerSink(),ledger=createRetentionLedger({sink,now:c.now}),journal=createMemoryRetentionJournal(),serving=createServingGate(),store=bucket();
 const authorization=ownerMediated?{ownerMediated}:undefined;
 const suppression=createSuppressionOwner({ledger,journal,ownership,authorization,serving,now:c.now});
 const storage=createVersionStorage({send:store.send,bucket:'synthetic-bucket',expectedBucketOwner:'967807252336',permissions,now:c.now,maxRequestMs});
 const keyFor=st=>`${tenant}/${st.objectId}/${st.sha256}`;
 const {current,facts}=currentFacts(c),rows=memoryRows();
 const executor=(enabled=true)=>createPurgeExecutor({storage,ledger,journal,keyFor,facts,serving,rows,enabled,now:c.now});
 const reconciler=()=>createRecoveryReconciler({ledger,journal,storage,serving,keyFor,facts,rows,now:c.now});
 return {clock:c,sink,ledger,journal,serving,store,suppression,storage,keyFor,facts,current,rows,executor,reconciler,principal:{tenantId:tenant,actorId:owner}};
}

/** Ordinary planning from the fixture's current facts for a subject; registers the inventory if given. */
export function planFrom(f,s,journalState,{inventory,policy:p=f.current.policy}={}){const key=subjectKey(s);if(inventory){f.current.inventories.set(key,inventory);if(typeof f.rows?.seed==='function')f.rows.seed(key,inventory);}const inv=f.current.inventories.get(key);
 return planPurge({subject:s,journalState,policy:p,inventory:inv,shared:f.current.shared.get(key)??[],holds:f.facts.holds,liabilities:f.current.liabilities.get(key)??[],lastActivityAtMs:f.current.lastActivity.get(key)??f.clock.now()-30*86400000,nowMs:f.clock.now()});}
