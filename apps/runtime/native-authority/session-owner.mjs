/** Product SDK mirror. Canonical current admission owns the transaction/fence; native owners own authority. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertWorkerAuthorization,same} from '../../../packages/contracts/runtime-0.2/validate.mjs';
import {assertSdkSessionRequestHeaders} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {copySessionEntries,copySessionTranscript,scopedSessionKey} from '../../worker/qualification/checkpoint/bound-session-store.mjs';
import {copySessionJson,captureSessionMethods} from '../../worker/qualification/checkpoint/session-store-data.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {BudgetCommitUncertain} from '../../gateway/budget/postgres-budget-store.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});},integer=n=>{const v=typeof n==='string'&&/^(0|[1-9][0-9]*)$/u.test(n)?Number(n):n;if(!Number.isSafeInteger(v)||v<0)fail('SDK_SESSION_CORRUPT');return v;};
export function createDurableSdkSessionOwner(configuration){
 const {admission,authority,registration,enabled=false,now=Date.now,maxRequestMs=3000}=own(configuration,['admission'],['authority','registration','enabled','now','maxRequestMs']);
 if(typeof enabled!=='boolean'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('SDK_SESSION_CONFIGURATION');
 const transaction=storageMethod(admission,'withCurrentAllocation'),authorize=authority?captureSessionMethods(authority,['verify'],'SDK_SESSION_CONFIGURATION'):null,observe=registration?captureSessionMethods(registration,['read'],'SDK_SESSION_CONFIGURATION'):null;
 async function execute(operation,value){
  const raw=own(value,['credential','request'],['signal','deadlineMs']);if(!enabled||!authorize||!observe)fail('SDK_SESSION_UNAVAILABLE');
  if(typeof raw.credential!=='string'||!raw.credential||raw.credential.length>8192)fail('SDK_SESSION_REFUSED');
  const request=assertSdkSessionRequestHeaders(operation,raw.request);let entries;
  if(operation==='append'){entries=copySessionEntries(Object.getOwnPropertyDescriptor(raw.request,'entries').value);if(hash(entries)!==request.entriesSha256)fail('INVALID_SDK_SESSION_REQUEST');}
  const input={...request,...(entries===undefined?{}:{entries})},inputSha256=hash(input),started=now(),deadlineMs=Math.min(raw.deadlineMs??started+maxRequestMs,started+maxRequestMs);
  const life=createOperationLifetime({now,signal:raw.signal,deadlineMs,errorFactory:code=>Object.assign(Error('SDK_SESSION_'+code),{code:'SDK_SESSION_'+code})});let pinned,attempted=false;let cutoff=deadlineMs;const limit=next=>{cutoff=Math.min(cutoff,next);life.limitDeadline(cutoff);};
  async function fresh(){const at=now(),receipt=assertWorkerAuthorization(await life.run(signal=>authorize.verify({capability:raw.credential,binding:request.binding,operation:'runner/session/'+operation,inputSha256,signal,deadlineMs:cutoff})),{binding:request.binding,operation:'runner/session/'+operation,inputSha256,started:at,now});
   const facts=data({binding:receipt.binding,scopes:receipt.scopes,selectedClientId:receipt.selectedClientId,policyRevision:receipt.policyRevision});if(pinned&&!same(pinned,facts))fail('SDK_SESSION_REFUSED');pinned??=facts;limit(receipt.expiresAtMs);return receipt;}
  try{
   const auth=await fresh();let observation;
   if(operation==='register'){observation=data(await life.run(signal=>observe.read({binding:request.binding,key:request.key,signal,deadlineMs:cutoff})));
    own(observation,['binding','key','sdkVersion','cliVersion','observationId','sessionEventSha256','checkedAtMs','expiresAtMs']);
    if(!same(observation.binding,request.binding)||!same(observation.key,request.key)||observation.sdkVersion!=='0.3.295'||observation.cliVersion!=='2.1.295'||typeof observation.observationId!=='string'||!observation.observationId||observation.observationId.length>256||!/^[a-f0-9]{64}$/u.test(observation.sessionEventSha256)||!Number.isSafeInteger(observation.checkedAtMs)||observation.checkedAtMs<started||observation.checkedAtMs>now()||!Number.isSafeInteger(observation.expiresAtMs)||observation.expiresAtMs<=now())fail('SDK_SESSION_REFUSED');limit(observation.expiresAtMs);}
   await fresh();const result=await life.run(()=>transaction({binding:request.binding,signal:life.signal,deadlineMs:cutoff},async({client,current})=>{
    life.check();if(!same(current.binding,pinned.binding)||current.policyRevision!==pinned.policyRevision||current.deadlineMs<=now())fail('SDK_SESSION_REFUSED');limit(current.deadlineMs);
    const b=request.binding,ownerArgs=[b.tenantId,b.conversationId,b.runId,request.key.sessionId];
    const query=async(sql,args)=>{if(operation==='append'&&/^(INSERT|UPDATE)/u.test(sql))attempted=true;const out=await client.query(sql,args);life.check();return out;};
    let row=(await query('SELECT * FROM meri_conversations.sdk_sessions WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND session_id=$4 FOR UPDATE',ownerArgs)).rows[0];
    if(operation==='register'){
     const owner=data({...pinned,key:request.key,allocationSha256:current.allocationSha256,observationId:observation.observationId,sessionEventSha256:observation.sessionEventSha256,expiresAtMs:Math.min(auth.expiresAtMs,observation.expiresAtMs,current.deadlineMs)});
     if(row){if(row.owner_sha256!==hash(row.owner)||!same(row.owner,owner))fail('SDK_SESSION_REGISTRATION_CONFLICT');}
     else await query('INSERT INTO meri_conversations.sdk_sessions(tenant_id,conversation_id,run_id,session_id,project_key,owner,owner_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[...ownerArgs,request.key.projectKey,owner,hash(owner)]);
     await fresh();return {registered:true,key:request.key};
    }
    if(!row)fail('SDK_SESSION_NOT_REGISTERED');const owner=row.owner;own(owner,['binding','scopes','selectedClientId','policyRevision','key','allocationSha256','observationId','sessionEventSha256','expiresAtMs']);
    if(row.owner_sha256!==hash(owner)||row.tenant_id!==b.tenantId||row.conversation_id!==b.conversationId||row.run_id!==b.runId||row.session_id!==request.key.sessionId||row.project_key!==owner.key?.projectKey||!same(owner.binding,pinned.binding)||!same(owner.scopes,pinned.scopes)||owner.selectedClientId!==pinned.selectedClientId||owner.policyRevision!==pinned.policyRevision||owner.allocationSha256!==current.allocationSha256||owner.expiresAtMs<=now())fail('SDK_SESSION_CORRUPT');
    scopedSessionKey(request.key,owner.key);const subpath=request.key.subpath??'',args=[...ownerArgs,subpath];
    if(operation==='list-subkeys'){
     const rows=(await query('SELECT subpath FROM meri_conversations.sdk_session_streams WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND session_id=$4 ORDER BY subpath',ownerArgs)).rows;
     const names=rows.map(r=>r.subpath).filter(Boolean);if(names.length>255||new Set(names).size!==names.length)fail('SDK_SESSION_CORRUPT');for(const subpath of names)scopedSessionKey({...owner.key,subpath},owner.key);await fresh();return {subkeys:names};
    }
    let stream=(await query('SELECT * FROM meri_conversations.sdk_session_streams WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND session_id=$4 AND subpath=$5 FOR UPDATE',args)).rows[0],offset=stream?integer(stream.last_sequence):0;
    if(operation==='load'){
     if(!stream){await fresh();return {entries:null,offset:0};}
     const rows=(await query('SELECT * FROM meri_conversations.sdk_session_entries WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND session_id=$4 AND subpath=$5 ORDER BY sequence',args)).rows;
     let sequence=0;for(const entry of rows)if(integer(entry.sequence)!==++sequence||entry.entry_sha256!==hash(entry.entry)||entry.entry_uuid!==(entry.entry.uuid??null))fail('SDK_SESSION_CORRUPT');if(sequence!==offset)fail('SDK_SESSION_CORRUPT');const retained=copySessionTranscript(rows.map(r=>r.entry));await fresh();return {entries:retained,offset};
    }
    const prior=(await query('SELECT * FROM meri_conversations.sdk_session_batches WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND session_id=$4 AND append_id=$5',[...ownerArgs,request.appendId])).rows[0];
    if(prior){if(prior.request_sha256!==inputSha256||prior.receipt_sha256!==hash(prior.receipt))fail('SDK_SESSION_APPEND_CONFLICT');await fresh();return prior.receipt;}
    if(request.expectedOffset!==offset)fail('SDK_SESSION_STALE_OFFSET');if(!stream)await query('INSERT INTO meri_conversations.sdk_session_streams(tenant_id,conversation_id,run_id,session_id,subpath) VALUES($1,$2,$3,$4,$5)',args);
    let bytes=integer(row.bytes),count=integer(row.entries_count);const added=[];
    for(const entry of entries){const entrySha256=hash(entry),uuid=entry.uuid??null;if(uuid!==null&&(typeof uuid!=='string'||!uuid||uuid.length>256))fail('INVALID_SDK_SESSION_REQUEST');
     if(uuid!==null){const found=(await query('SELECT * FROM meri_conversations.sdk_session_entries WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND session_id=$4 AND subpath=$5 AND entry_uuid=$6',[...args,uuid])).rows[0];if(found){if(found.entry_sha256!==entrySha256||hash(found.entry)!==entrySha256)fail('SDK_SESSION_ENTRY_CONFLICT');continue;}}
     const size=Buffer.byteLength(JSON.stringify(entry));if(++count>100000||(bytes+=size)>33554432||++offset>100000)fail('SDK_SESSION_LIMIT');added.push(entry);
     await query('INSERT INTO meri_conversations.sdk_session_entries(tenant_id,conversation_id,run_id,session_id,subpath,sequence,entry_uuid,entry,entry_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[...args,offset,uuid,entry,entrySha256]);
    }
    const receipt=data({committed:true,appendId:request.appendId,key:request.key,entriesSha256:request.entriesSha256,offset,added:added.length});
    await query('UPDATE meri_conversations.sdk_session_streams SET last_sequence=$6 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND session_id=$4 AND subpath=$5',[...args,offset]);
    await query('UPDATE meri_conversations.sdk_sessions SET entries_count=$5,bytes=$6 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND session_id=$4',[...ownerArgs,count,bytes]);
    await query('INSERT INTO meri_conversations.sdk_session_batches(tenant_id,conversation_id,run_id,session_id,append_id,request_sha256,receipt,receipt_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[...ownerArgs,request.appendId,inputSha256,receipt,hash(receipt)]);await fresh();return receipt;
   }));await fresh();life.check();return operation==='load'?{...result,entries:result.entries===null?null:copySessionTranscript(result.entries)}:data(result);
  }catch(error){if(error instanceof BudgetCommitUncertain||attempted)fail('SDK_SESSION_COMMIT_UNKNOWN');throw error;}finally{life.close();}
 }
 return Object.freeze(Object.fromEntries(['register','load','append','list-subkeys'].map(operation=>[operation==='list-subkeys'?'listSubkeys':operation,value=>execute(operation,value)])));
}
