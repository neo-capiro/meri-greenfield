/** Preparation metadata uses canonical conversation transactions/run ownership. */
import {own,data,hash,same,validateShape,fail,uuid} from './boundary.mjs';
const denied=()=>fail('NATIVE_PREPARATION_REFUSED');
const digest=v=>{if(typeof v!=='string'||!/^[a-f0-9]{64}$/u.test(v))denied();};
const positive=v=>{if(!Number.isSafeInteger(v)||v<1)denied();};
const allocationFields=['original','allocationSha256','qualification','grantIntents','taskRequestSha256'];
const restoreFields=['checkpointSha256','contextSha256','sourceRequestSha256','workspaceSha256','opaqueSessionSha256'];
const launchFields=['preparationId','descriptorSha256','configTreeSha256'];
const launchTransitions={PREPARED:['CLAIMED'],CLAIMED:['STARTED','UNKNOWN'],STARTED:['STARTED'],UNKNOWN:['UNKNOWN']};
function launchPins(value){const v=own(value,launchFields);uuid(v.preparationId);digest(v.descriptorSha256);digest(v.configTreeSha256);return v;}
function launchBinding(value){const v=own(value,[...launchFields,'state']);launchPins(Object.fromEntries(launchFields.map(k=>[k,v[k]])));if(!Object.hasOwn(launchTransitions,v.state))denied();return v;}
function allocationIntent(i){
 const o=own(i.original,['binding','executionKey','executionId','planSha256','expiresAtMs','versions']);
 validateShape('RuntimeVersions',o.versions);digest(o.planSha256);
 if(!same(o.binding,i.binding)||o.executionKey!==hash(i.binding)||o.executionId!==o.executionKey||i.allocationKey!==o.executionKey||o.expiresAtMs!==i.expiresAtMs)denied();
 digest(i.allocationSha256);digest(i.taskRequestSha256);const q=own(i.qualification,['attempt','policyRevision']);positive(q.attempt);digest(q.policyRevision);
 if(q.attempt>2147483647||i.binding.writerFence>2147483647||!Array.isArray(i.grantIntents)||!i.grantIntents.length||i.grantIntents.length>16)denied();
 const ids=new Set(),caps=new Set();for(const g of i.grantIntents){own(g,['grantId','capabilitySha256','expiresAtMs']);uuid(g.grantId);digest(g.capabilitySha256);positive(g.expiresAtMs);
  if(ids.has(g.grantId)||caps.has(g.capabilitySha256)||g.expiresAtMs<i.expiresAtMs)denied();ids.add(g.grantId);caps.add(g.capabilitySha256);}
}
function resource(value,i,state){
 if(value===null){if(['ALLOCATED','ADMITTED','RETIRED'].includes(state))denied();return;}
 const v=own(value,['taskArn','createdAtMs','clusterArn','taskDefinitionArn','containerName'],['grantFactsJsons','physicalStopProven','launchBinding']);
 const prefix='arn:aws:ecs:us-east-1:967807252336:',cluster=typeof v.clusterArn==='string'&&v.clusterArn.slice((prefix+'cluster/').length);
 if(typeof cluster!=='string'||!v.clusterArn.startsWith(prefix+'cluster/')||!/^[A-Za-z0-9_-]{1,255}$/u.test(cluster)||typeof v.taskArn!=='string'||!v.taskArn.startsWith(prefix+'task/'+cluster+'/')||!/^[a-f0-9]{32}$/u.test(v.taskArn.slice((prefix+'task/'+cluster+'/').length))||typeof v.taskDefinitionArn!=='string'||!v.taskDefinitionArn.startsWith(prefix+'task-definition/')||!/^[A-Za-z0-9_-]+:[1-9][0-9]*$/u.test(v.taskDefinitionArn.slice((prefix+'task-definition/').length))||typeof v.containerName!=='string'||!/^[A-Za-z0-9_-]{1,255}$/u.test(v.containerName))denied();
 positive(v.createdAtMs);if(v.createdAtMs>=i.expiresAtMs||state==='CLAIMED'||state==='RETIRED'&&v.physicalStopProven!==true||state!=='RETIRED'&&v.physicalStopProven!==undefined)denied();
 if(state==='ADMITTED'&&v.grantFactsJsons===undefined)denied();
 if(v.launchBinding!==undefined){launchBinding(v.launchBinding);if(!['ADMITTED','UNKNOWN','RETIRED'].includes(state))denied();}
 if(v.grantFactsJsons!==undefined){
  if(!Array.isArray(v.grantFactsJsons)||v.grantFactsJsons.length!==i.grantIntents.length)denied();
  const seen=new Set();for(const raw of v.grantFactsJsons){if(typeof raw!=='string'||Buffer.byteLength(raw)>65536)denied();let fact;try{fact=JSON.parse(raw);}catch{denied();}
   const intent=i.grantIntents.find(g=>g.grantId===fact?.grantId);if(!intent||seen.has(intent.grantId))denied();seen.add(intent.grantId);
   const expected={grantId:intent.grantId,binding:i.binding,qualificationBinding:{runId:i.binding.runId,attempt:i.qualification.attempt,workerArn:v.taskArn,fence:i.binding.writerFence,policyRevision:i.qualification.policyRevision},capabilitySha256:intent.capabilitySha256,allocationSha256:i.allocationSha256};
   if(!same(fact,expected))denied();}
 }
}
function restorationReceipt(value,i,state){
 if(value===null){if(state==='RESTORED')denied();return;}
 if(state!=='RESTORED')denied();const v=own(value,['workspaceSha256','opaqueSessionSha256']);
 if(v.workspaceSha256!==i.workspaceSha256||v.opaqueSessionSha256!==i.opaqueSessionSha256)denied();
}
/** No-authority evidence for an attempt that never acquired native authority: the run turned failed or cancelled while still queued
 * and no allocation was claimed. The store writes it in the same transaction (under the conversation lock) as that terminal transition,
 * into the run's own allocation row, so the primary key and the claim's queued-state check both refuse any later claim: no task,
 * admission or budget grant can exist for that attempt. No transition leaves it (the database trigger refuses any update of it).
 * A missing row is never this evidence. */
export const FORECLOSED='FORECLOSED';
export function foreclosureRecord(value,b){const r=data(value);own(r,['binding','allocationKey','state','foreclosure']);validateShape('RunBinding',r.binding);const f=own(r.foreclosure,['eventId','eventSha256','state']);uuid(f.eventId);digest(f.eventSha256);
 if(r.state!==FORECLOSED||r.allocationKey!==hash(r.binding)||!['failed','cancelled'].includes(f.state)||b!==undefined&&!same(r.binding,b))denied();return r;}
export function foreclosed(value,b){try{foreclosureRecord(value,b);return true;}catch{return false;}}
const allocationTransitions={CLAIMED:['ALLOCATED','UNKNOWN','RETIRED'],ALLOCATED:['ALLOCATED','ADMITTED','UNKNOWN','RETIRED'],UNKNOWN:['UNKNOWN','ALLOCATED','ADMITTED','RETIRED'],ADMITTED:['ADMITTED','UNKNOWN','RETIRED'],RETIRED:['RETIRED']};
const restorationTransitions={CLAIMED:['UNKNOWN','RESTORED'],UNKNOWN:['UNKNOWN'],RESTORED:['RESTORED']};
export function createNativePreparationJournals({tx,rowRun}){
 const tuple=b=>[b.tenantId,b.conversationId,b.runId];
 function slot({table,key,fields,validateIntent,validateProof,transitions,proofKey,completed}){
  function intent(value){const i=data(value);own(i,['binding',key,...fields,'expiresAtMs']);validateShape('RunBinding',i.binding);digest(i[key]);positive(i.expiresAtMs);validateIntent(i);return i;}
  function recordValue(value){const r=data(value);own(r,['binding',key,...fields,'expiresAtMs','state',proofKey]);const {state,[proofKey]:proof,...original}=r;intent(original);if(!Object.hasOwn(transitions,state))denied();validateProof(proof,original,state);return r;}
  function decode(row,b,k){try{if(!row||row.record_sha256!==hash(row.record))denied();const r=proofKey==='resource'&&row.record?.state===FORECLOSED?foreclosureRecord(row.record):recordValue(row.record);
   if(!same(r.binding,b)||row.tenant_id!==b.tenantId||row.conversation_id!==b.conversationId||row.run_id!==b.runId||row.intent_key!==r[key]||r[key]!==k)denied();return r;
  }catch{fail('NATIVE_PREPARATION_CORRUPT');}}
  function lookup(value){const v=data(value);own(v,['binding',key]);validateShape('RunBinding',v.binding);digest(v[key]);return v;}
  async function load(c,b,k,check){
   const runs=(await c.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',tuple(b))).rows;check();if(runs.length!==1)fail('STALE_WRITER');
   const run=rowRun(runs[0]);if(!same(run.projection.binding,b))fail('STALE_WRITER');
   const rows=(await c.query('SELECT * FROM '+table+' WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',tuple(b))).rows;check();if(rows.length>1)fail('NATIVE_PREPARATION_CORRUPT');
   return {run:run.projection,record:rows.length?decode(rows[0],b,k):null};
  }
  async function launch(value,check,operation){
   const v=data(value);own(v,['binding',key,...launchFields],operation==='record'?['state']:[]);lookup({binding:v.binding,[key]:v[key]});const pins=launchPins(Object.fromEntries(launchFields.map(k=>[k,v[k]])));
   if(operation==='record'&&!['STARTED','UNKNOWN'].includes(v.state))denied();
   return tx(v.binding,check,async c=>{
    const saved=await load(c,v.binding,v[key],check),old=saved.record;
    if(!old||old.state!=='ADMITTED'||operation!=='record'&&!['queued','starting','running'].includes(saved.run.state))denied();
    const previous=old.resource.launchBinding;
    if(previous&&!same(Object.fromEntries(launchFields.map(k=>[k,previous[k]])),pins))fail('NATIVE_PREPARATION_REPLAY_REFUSED');
    let state;
    if(operation==='prepare'){
     if(previous)return saved;state='PREPARED';
    }else{
     if(!previous)denied();
     if(operation==='consume'){
      if(previous.state!=='PREPARED')return {...saved,dispatch:false};state='CLAIMED';
     }else{
      if(!launchTransitions[previous.state].includes(v.state))denied();if(previous.state===v.state)return saved;state=v.state;
     }
    }
    const record=recordValue({...old,resource:{...old.resource,launchBinding:{...pins,state}}});
    await c.query('UPDATE '+table+' SET record=$4,record_sha256=$5 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[...tuple(v.binding),record,hash(record)]);check();return {...saved,record,...(operation==='consume'?{dispatch:true}:{})};
   });
  }
  return Object.freeze({
   ...(proofKey==='resource'?{
    /** In the caller's terminal-transition transaction: records the no-authority evidence when no allocation row exists. An existing
     * claim is left untouched and still needs retirement and revocation. */
    async foreclose(c,b,event,check){const rows=(await c.query('SELECT * FROM '+table+' WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',tuple(b))).rows;check();if(rows.length)return null;
     const record=foreclosureRecord({binding:b,allocationKey:hash(b),state:FORECLOSED,foreclosure:{eventId:event.eventId,eventSha256:hash(event),state:event.data.state}});
     await c.query('INSERT INTO '+table+'(tenant_id,conversation_id,run_id,intent_key,record,record_sha256) VALUES($1,$2,$3,$4,$5,$6)',[...tuple(b),record.allocationKey,record,hash(record)]);check();return record;},
    async verifyExecutionClaim(c,original,versions,check){const saved=await load(c,original.binding,original.executionKey,check),r=saved.record;if(!r||r.state!=='ADMITTED'||r.resource.launchBinding?.state!=='CLAIMED'||!same(r.original,{...original,versions}))denied();return true;},prepareLaunch:(value,check)=>launch(value,check,'prepare'),consumeLaunch:(value,check)=>launch(value,check,'consume'),recordLaunch:(value,check)=>launch(value,check,'record')}:{}),
   async claim(value,check){const i=intent(value);return tx(i.binding,check,async c=>{
    const saved=await load(c,i.binding,i[key],check);if(saved.record?.state===FORECLOSED)fail('NATIVE_PREPARATION_STATE_REFUSED');if(saved.record){const {state,[proofKey]:proof,...old}=saved.record;if(!same(old,i))fail('NATIVE_PREPARATION_REPLAY_REFUSED');return {...saved,dispatch:false};}
    if(saved.run.state!=='queued')fail('NATIVE_PREPARATION_STATE_REFUSED');
    // Conversation exclusion: a replacement allocation is refused while any other allocation of the same tenant and conversation is live
    // or unresolved (not RETIRED with its physical stop proven). Exact replay of an existing claim returns above without redispatch; a fork
    // into another conversation is unaffected. Grant revocation is verified separately by the next-run and issuance owners.
    if(proofKey==='resource'){const others=(await c.query('SELECT * FROM '+table+' WHERE tenant_id=$1 AND conversation_id=$2 AND run_id<>$3 FOR UPDATE',tuple(i.binding))).rows;check();
     // A foreclosed attempt never held authority, so it does not keep the conversation busy.
     for(const row of others){if(row.record_sha256!==hash(row.record))fail('NATIVE_PREPARATION_CORRUPT');if(row.record.state===FORECLOSED){if(!foreclosed(row.record))fail('NATIVE_PREPARATION_CORRUPT');continue;}if(row.record.state!=='RETIRED'||row.record.resource?.physicalStopProven!==true)fail('NATIVE_PREPARATION_CONVERSATION_BUSY');}}
    const record=recordValue({...i,state:'CLAIMED',[proofKey]:null});
    await c.query('INSERT INTO '+table+'(tenant_id,conversation_id,run_id,intent_key,record,record_sha256) VALUES($1,$2,$3,$4,$5,$6)',[...tuple(i.binding),i[key],record,hash(record)]);check();return {...saved,record,dispatch:true};
   });},
   async read(value,check){const v=lookup(value);return tx(v.binding,check,c=>load(c,v.binding,v[key],check));},
   async record(value,check){const v=data(value);own(v,['binding',key,'state',proofKey]);lookup({binding:v.binding,[key]:v[key]});
    if(!Object.hasOwn(transitions,v.state))denied();return tx(v.binding,check,async c=>{
     const saved=await load(c,v.binding,v[key],check),old=saved.record;if(!old||!Object.hasOwn(transitions,old.state)||!transitions[old.state].includes(v.state))denied();
     const proof=v[proofKey]??(v.state==='UNKNOWN'?old[proofKey]:null),record=recordValue({...old,state:v.state,[proofKey]:proof});
     if(proofKey==='resource'&&(old.resource?.launchBinding!==undefined||proof?.launchBinding!==undefined)&&!same(old.resource?.launchBinding??null,proof?.launchBinding??null))denied();
     if(old.state===completed&&!same(old,record))denied();
     if(proofKey==='resource'&&old.resource!==null){
      const metadata=x=>Object.fromEntries(Object.entries(x).filter(([k])=>!['grantFactsJsons','physicalStopProven'].includes(k)));
      if(proof===null||!same(metadata(old.resource),metadata(proof))||old.resource.grantFactsJsons!==undefined&&proof.grantFactsJsons!==undefined&&!same(old.resource.grantFactsJsons,proof.grantFactsJsons))denied();
     }
     await c.query('UPDATE '+table+' SET record=$4,record_sha256=$5 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[...tuple(v.binding),record,hash(record)]);check();return {...saved,record};
    });}
  });
 }
 return Object.freeze({allocations:slot({table:'meri_conversations.native_allocations',key:'allocationKey',fields:allocationFields,validateIntent:allocationIntent,validateProof:resource,transitions:allocationTransitions,proofKey:'resource',completed:'RETIRED'}),restorations:slot({table:'meri_conversations.native_restorations',key:'restoreKey',fields:restoreFields,validateIntent:i=>restoreFields.forEach(k=>digest(i[k])),validateProof:restorationReceipt,transitions:restorationTransitions,proofKey:'receipt',completed:'RESTORED'})});
}
