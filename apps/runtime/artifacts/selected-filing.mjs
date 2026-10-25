/** Selected immutable attachments -> existing native approval -> Core filing.
 * The Core registration/execute/read extension is proposed and remains unmounted until its receiver is available.
 * No local claim, retry or outcome ledger. Production mounting must bind registration to an existing durable execution
 * owner: a bare Core-null after a lost upload acknowledgement cannot prove that registration had no effect. */
import {createHash} from 'node:crypto';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {artifactFileKind} from '../../control/commands/approval-metadata/artifact-file-kind.mjs';
import {selectedApprovalDecision} from '../../control/document-application/selected-output/receipts.mjs';
import {documentLimits} from '../../control/document-application/current.mjs';
import {intentFault} from '../../control/intents/faults.mjs';
import {nativeArtifactFileOutcome} from '../../control/intents/filing-outcome.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {currentNativeApprovalSession,nativeApprovalScope} from '../native-authority/approval-session.mjs';
import {createRuntimeFilingCustody} from './filing-custody.mjs';

const same=(a,b)=>hash(a)===hash(b),fail=code=>{throw intentFault(code,'none');},kind=artifactFileKind('artifact.file');
const MAX_FILE_BYTES=10485760,MAX_TOTAL_BYTES=10*MAX_FILE_BYTES,UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
function selectedProposal(value){
 const proposal=data(value),command=proposal.command,context={binding:command.binding,destination:{clientId:command.arguments.clientId,conversationId:command.binding.conversationId}};
 kind.assertProposal(proposal,context);const {selectedClientId}=nativeApprovalScope(proposal);
 if(selectedClientId===null||command.scopes.length!==1||selectedClientId!==command.arguments.clientId||command.attachments.some(object=>!same(object.scopes,command.scopes)))fail('ACCESS_DENIED');
 return {proposal,selectedClientId};
}

export function createSelectedAttachmentFilingExecution(configuration){
 const c=own(configuration,['bound','optionsOwner','source','readDecision','resolveVersion','now','maxRequestMs','limits']),limits=documentLimits(c.limits);
 const source=Object.fromEntries(['register','execute','read'].map(name=>[name,storageMethod(c.source,name)]));
 if(![c.bound,c.readDecision,c.resolveVersion,c.now].every(f=>typeof f==='function')||typeof c.optionsOwner?.resolve!=='function'||
  !Number.isSafeInteger(c.maxRequestMs)||c.maxRequestMs<1||c.maxRequestMs>30000)fail('PRODUCT_PORTS_CONFIGURATION');
 async function perform(value,observe){
  let life,registrationStarted=false;
  const unknown=()=>observe?{state:'UNKNOWN'}:{status:'indeterminate'};
  try{
   const raw=own(value,['proposal','principal','deliveryId'],['decision','signal','deadlineMs']);nativeSignal(raw.signal);
   const {signal,...rest}=raw,call=data(rest),{proposal,selectedClientId}=selectedProposal(call.proposal),b=proposal.command.binding,scopes=proposal.command.scopes,objects=proposal.command.attachments;
   if(call.principal.tenantId!==b.tenantId||call.principal.actorId!==b.actorId||!call.principal.clientIds?.includes(selectedClientId)||
    typeof call.deliveryId!=='string'||call.deliveryId.length<1||call.deliveryId.length>256||call.deadlineMs!==undefined&&!Number.isSafeInteger(call.deadlineMs))fail('ACCESS_DENIED');
   // Ten canonical references, each at most10 MiB; aggregate custody is explicitly capped at100 MiB.
   if(objects.some(o=>o.bytes>MAX_FILE_BYTES||o.bytes>limits.maxResponseBytes)||objects.reduce((sum,o)=>sum+o.bytes,0)>MAX_TOTAL_BYTES)fail('INVALID_ARGUMENTS');
   const owned=c.bound();if(!owned?.store||!owned.sessions||!owned.retention)fail('UNAVAILABLE');
   life=createOperationLifetime({deadlineMs:Math.min(call.deadlineMs??Infinity,c.now()+c.maxRequestMs),now:c.now,signal,errorFactory:code=>intentFault(code,'none')});
   let current,decision,effectPermission=false;
   async function session(){
    const next=await life.run(signal=>currentNativeApprovalSession({...owned,now:c.now,proposal,signal,check:life.check}));
    if(next.selectedClientId!==selectedClientId||current&&(!same(next.binding,current.binding)||next.session.credential!==current.session.credential))fail('ACCESS_DENIED');
    current??=next;life.limitDeadline(next.session.expiresAtMs);
   }
   async function fresh(){
    await session();
    if(!effectPermission)return;
    const d=data(await life.run(signal=>c.readDecision({proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,binding:b,signal})));
    await session();selectedApprovalDecision(d,{binding:b,policyRevision:scopes[0].policyRevision,now:c.now});
    if(d.proposalId!==proposal.proposalId||d.commandSha256!==proposal.commandSha256||decision&&!same(d,decision)||call.decision&&!same(d,call.decision))fail('ACCESS_DENIED');
    decision??=d;life.limitDeadline(Date.parse(d.expiresAt));life.check();
   }
   // Live access always applies. Approval expiry/revocation gates new effects, never recovery of Core's canonical outcome.
   // Pin the borrowed session for this request only, rechecking both owners around each new-effect custody/Core await.
   async function guarded(operation){await fresh();const result=await life.run(operation);await fresh();return result;}
   await fresh();
   const custody=createRuntimeFilingCustody({sessions:owned.sessions,optionsOwner:c.optionsOwner,now:c.now,limits,retention:owned.retention,resolveVersion:c.resolveVersion});
   const common=()=>({proposal,binding:current.binding,signal:life.signal,deadlineMs:life.deadline()});
   const custodyCall=object=>({object,credential:current.session.credential,binding:current.binding,scopes,signal:life.signal,deadlineMs:life.deadline()});
   const prior=data(await guarded(()=>source.read(common())));
   if(prior!==null){
    if(prior.state==='UNKNOWN'){own(prior,['state']);return unknown();}
    own(prior,['state','outcome']);if(prior.state!=='OUTCOME')fail('REFUSED');nativeArtifactFileOutcome(prior.outcome,proposal);
   }else if(observe)return null;
   if(prior===null){effectPermission=true;life.limitDeadline(Date.parse(proposal.expiresAt));await fresh();}
   const selected=[];
   // Complete ALL downloads before registering any file. These bytes never become model input or an approval field.
   for(const object of objects)selected.push(await guarded(()=>custody.read(custodyCall(object))));
   async function recheckItem(item){
    const latest=await guarded(()=>custody.recheck({...custodyCall(item.object),versionId:item.versionId}));
    const {bytes,...metadata}=item;if(!same(latest,metadata))fail('ACCESS_DENIED');
   }
   async function recheck(){for(const item of selected)await recheckItem(item);}
   if(prior!==null){await recheck();return observe?{state:'OUTCOME',outcome:prior.outcome}:{status:'observed',outcome:prior.outcome};}
   const attachments=[],ids=new Set();
   for(const item of selected){
    // An earlier upload awaited: the next object may now be suppressed even though its preflight bytes were valid.
    await recheckItem(item);
    // Copy only after canonical hash/size verification. The upload port gets no model credential or mutable selection.
    if(!Buffer.isBuffer(item.bytes)||item.bytes.length!==item.object.bytes||createHash('sha256').update(item.bytes).digest('hex')!==item.object.sha256)fail('ACCESS_DENIED');
    const receipt=data(await guarded(()=>{registrationStarted=true;return source.register({...common(),object:item.object,filename:item.filename,mimeType:item.mimeType,bytes:Buffer.from(item.bytes)});}));
    own(receipt,['attachmentId','sha256','bytes','expiresAtMs']);
    if(!UUID.test(receipt.attachmentId??'')||ids.has(receipt.attachmentId)||receipt.sha256!==item.object.sha256||receipt.bytes!==item.object.bytes||!Number.isSafeInteger(receipt.expiresAtMs))fail('REFUSED');
    life.limitDeadline(receipt.expiresAtMs);ids.add(receipt.attachmentId);attachments.push({object:item.object,attachmentId:receipt.attachmentId});
   }
   await recheck();
   const result=data(await guarded(()=>source.execute({...common(),attachments:data(attachments)})));
   if(result?.status==='indeterminate'){own(result,['status']);return unknown();}
   own(result,['status','outcome']);if(result.status!=='observed')fail('REFUSED');nativeArtifactFileOutcome(result.outcome,proposal,decision);
   await recheck();life.check();return {status:'observed',outcome:result.outcome};
  }catch(error){
   if(registrationStarted)return unknown();
   throw intentFault(['ACCESS_DENIED','INVALID_ARGUMENTS','UNAVAILABLE','DEADLINE','CANCELLED'].includes(error?.code)?error.code:'REFUSED','none');
  }finally{life?.close();}
 }
 return Object.freeze({execute:value=>perform(value,false),read:value=>perform(value,true),async currentBinding({proposal:raw,signal,deadlineMs}){
  const {proposal,selectedClientId}=selectedProposal(raw),owned=c.bound();nativeSignal(signal);
  const life=createOperationLifetime({deadlineMs:Math.min(deadlineMs??Infinity,c.now()+c.maxRequestMs),now:c.now,signal,errorFactory:code=>intentFault(code,'none')});
  try{const current=await life.run(signal=>currentNativeApprovalSession({...owned,now:c.now,proposal,signal,check:life.check}));
   if(current.selectedClientId!==selectedClientId)fail('ACCESS_DENIED');life.limitDeadline(current.session.expiresAtMs);return {binding:current.binding,selectedClientId};
  }finally{life.close();}
 }});
}
