/** Existing selected preparation -> Core decision -> ordinary immutable document
 * delivery. Request-local composition only; no output run, grant or receipt store. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertDocumentDraftProposal} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {artifactValidators as artifacts} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {borrowedRunSession,assertActionSessionReceipt} from '../../control/action-host/session/owner.mjs';
import {createSelectedOutputRetention} from '../../control/conversations/skills/retention.mjs';
import {createSelectedOutputBridge} from '../../control/document-application/selected-output/bridge.mjs';
import {sourcePreparation} from '../../control/document-application/selected-output/preparation.mjs';
import {projectOutput,selectedDeliveryId,selectedInvocationId} from '../../control/document-application/selected-output/projection.mjs';
import {selectedApprovalDecision} from '../../control/document-application/selected-output/receipts.mjs';
import {readDocumentInvocation} from '../../artifacts/postgres-service.mjs';
import {createArtifactService} from '../../artifacts/service.mjs';
const same=(a,b)=>hash(a)===hash(b),fail=code=>{throw Object.assign(Error(code),{code});};

/** History supplies a canonical selector, not authority. The exact live original
 * action session and Core still authorize every operation; no relay is relaxed. */
export async function currentDocumentSession({store,sessions,now,proposal,signal,check=()=>{}}){
 assertDocumentDraftProposal(proposal,{binding:proposal.command.binding,scopes:proposal.command.scopes});const source=proposal.command.binding,scopes=proposal.command.scopes,clients=scopes.filter(s=>s.kind==='client');
 if(clients.length!==1)fail('ACCESS_DENIED');const selectedClientId=clients[0].resourceId;
 const history=await store.history.transcript({principal:{tenantId:source.tenantId,actorId:source.actorId,clientIds:[selectedClientId]},conversationId:source.conversationId,after:0,limit:1},check);check();
 const run=history.latestRun,binding=run.binding;
 if(['tenantId','actorId','conversationId'].some(k=>binding[k]!==source[k])||binding.writerFence<source.writerFence||!same(run.scopes,scopes)||run.state==='cancelled'||history.pendingTurn!==null)fail('ACCESS_DENIED');
 const borrow=borrowedRunSession(sessions);if(!borrow)fail('UNAVAILABLE');
 const session=assertActionSessionReceipt(await borrow({binding,selectedClientId,signal}),now());check();
 if(['tenantId','actorId','conversationId','runId'].some(k=>session.context[k]!==binding[k])||session.context.selectedClientId!==selectedClientId)fail('ACCESS_DENIED');
 return {run,binding,selectedClientId,session};
}

export function createSelectedDocumentExecution({bound,pool,optionsOwner,readDecision,now,maxRequestMs,maxOutputBytes}){
 if(typeof pool?.connect!=='function'||typeof bound!=='function'||typeof optionsOwner?.resolve!=='function'||typeof readDecision!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||!Number.isSafeInteger(maxOutputBytes)||maxOutputBytes<1||maxOutputBytes>1048576)fail('PRODUCT_PORTS_CONFIGURATION');
 async function perform(value,observe){
  const call=own(value,['proposal','principal','deliveryId'],['decision','signal','deadlineMs']),proposal=data(call.proposal);assertDocumentDraftProposal(proposal,{binding:proposal.command.binding,scopes:proposal.command.scopes});
  const b=proposal.command.binding,args=proposal.command.arguments,scopes=proposal.command.scopes;
  if(call.principal.tenantId!==b.tenantId||call.principal.actorId!==b.actorId||scopes.some(s=>s.kind==='client'&&!call.principal.clientIds?.includes(s.resourceId)))fail('ACCESS_DENIED');
  const owned=bound();if(!owned?.store||!owned.sessions||!owned.retention)fail('UNAVAILABLE');
  const life=createOperationLifetime({deadlineMs:Math.min(call.deadlineMs??Infinity,now()+maxRequestMs,Date.parse(proposal.expiresAt)),now,signal:call.signal,errorFactory:code=>Object.assign(Error(code),{code})});
  try{
   let decision;
   const currentDecision=async()=>{const d=await life.run(signal=>readDecision({proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,binding:b,signal}));
    selectedApprovalDecision(d,{binding:b,policyRevision:scopes[0].policyRevision,now});
    if(d.proposalId!==proposal.proposalId||d.commandSha256!==proposal.commandSha256||decision&&!same(d,decision)||call.decision&&!same(d,call.decision))fail('ACCESS_DENIED');decision??=data(d);life.limitDeadline(Date.parse(d.expiresAt));};
   await currentDecision();const output=await life.run(signal=>currentDocumentSession({...owned,now,proposal,signal,check:life.check}));life.limitDeadline(output.session.expiresAtMs);
   const serving=()=>life.run(()=>owned.retention.assertServable({tenantId:b.tenantId,kind:'conversation',subjectId:b.conversationId}));await serving();
   const retention=createSelectedOutputRetention({journal:owned.store.selectedOutputs,now,maxRequestMs,
    async currentOutputAccess(input){await serving();const saved=await owned.store.read(output.binding,{limit:1},life.check);
     if(saved.run.state==='cancelled'||!same(saved.run.binding,output.binding)||!same(saved.run.scopes,scopes))fail('ACCESS_DENIED');
     const context={...input.sourceContext,binding:output.binding,deadlineMs:life.deadline(),maxBytes:Math.min(input.sourceContext.maxBytes,maxOutputBytes)};
     return {...input.pins,outputBinding:output.binding,outputContextSha256:hash(context),outputScopes:scopes,policyRevision:scopes[0].policyRevision,approvalDecision:decision,checkedAtMs:now(),expiresAtMs:life.deadline()};}});
   const loaded=await life.run(signal=>retention.load({sourceBinding:b,preparationSha256:args.preparationSha256,signal}));
   if(hash(loaded.prepared.request)!==args.artifactRequestSha256||hash(loaded.prepared.context)!==args.sourceContextSha256||loaded.prepared.baseVersionId!==args.baseVersionId||loaded.prepared.request.title!==args.title||loaded.prepared.request.format!==args.format||!same(loaded.prepared.context.scopes,scopes))fail('ACCESS_DENIED');
   const source=sourcePreparation({...retention.sourceCall(loaded.prepared),signal:life.signal},retention);
   const invocationId=selectedInvocationId(source,decision),prior=await life.run(signal=>readDocumentInvocation({pool,binding:b,invocationId,signal}));
   if(prior!==null){
    const {entry,versionId}=prior;
    if(!['PENDING','UNKNOWN','PREPARED'].includes(entry.state)||!same(entry.record.operation,{id:source.request.operation,version:'0.2.0'}))fail('ARTIFACT_REPLAY_EVIDENCE');
    // A later turn changes current authority, never the prior output's binding.
    // Inspect through the ordinary owner; a missing publication stays unknown.
    const body={versionId},requestSha256=hash({intent:'inspect',body});
    const resolved=await life.run(signal=>optionsOwner.resolve({credential:output.session.credential,intent:'inspect',body,requestSha256,deadlineMs:life.deadline(),signal}));
    if(!resolved)fail('UNAVAILABLE');const options={...resolved.documentOptions.artifactOptions,retention:owned.retention},context=options.context;
    if(!same(context.binding,output.binding)||!same(context.scopes,scopes))fail('ACCESS_DENIED');life.limitDeadline(context.deadlineMs);
    let authorization;
    const service=createArtifactService({...options,authorize:async call=>{authorization=await options.authorize(call);return authorization;}});
    await currentDecision();await life.run(signal=>resolved.recheck({phase:'admission',intent:'inspect',requestSha256,resource:null,deadlineMs:life.deadline(),signal}));
    let inspected,record;
    try{inspected=await life.run(signal=>service.inspect(versionId,context,{signal}));record=await life.run(signal=>options.versions.read(versionId,signal));}
    catch(error){if(error?.code==='ENOENT')return observe?{state:'UNKNOWN'}:{status:'indeterminate'};throw error;}
    const projection=projectOutput(source,{outputBinding:record.version.binding,approvalDecision:decision,deadlineMs:life.deadline(),maxBytes:context.maxBytes});
    if(!same(record.version,inspected.version)||record.version.binding.writerFence<b.writerFence||record.version.binding.writerFence>output.binding.writerFence||record.requestSha256!==entry.record.argumentsSha256||record.requestSha256!==artifacts.nativeRequestSha256(projection.request,projection.context,args.baseVersionId)||record.specSha256!==hash(projection.request)||!same(record.spec,projection.request)||!same(record.version.evidence,source.context.evidence)||record.version.parentVersionId!==args.baseVersionId)fail('ARTIFACT_REPLAY_EVIDENCE');
    const {currentBytesVerified,...inspection}=inspected.inspection;if(currentBytesVerified!==true||!same(record.inspection,inspection))fail('ARTIFACT_REPLAY_EVIDENCE');
    const outcome={version:record.version,inspection,execution:{kind:'native-document',invocationId,requestSha256:record.requestSha256,authorizationReceiptId:authorization.receiptId,objectCommitted:true,versionCommitted:true,nativeQualified:false}};
    const retained=entry.outcome?.result;if(retained&&(!same(retained.version,outcome.version)||!same(retained.inspection,outcome.inspection)||retained.execution?.invocationId!==invocationId||retained.execution?.requestSha256!==record.requestSha256))fail('ARTIFACT_REPLAY_EVIDENCE');
    await currentDecision();await life.run(signal=>resolved.recheck({phase:'release',intent:'inspect',requestSha256,resource:{versionId},deadlineMs:life.deadline(),signal}));await serving();
    return observe?{state:'OUTCOME',outcome}:{status:'observed',outcome};
   }
   if(observe)return null;
   let resolved,receipt,body,intent,requestSha256,admitted=false;
   const approvedOutput={async read({sourcePins}){
    life.check();if(!same(sourcePins,source.sourcePins))fail('ACCESS_DENIED');await serving();
    if(!resolved){receipt={sourcePinsSha256:hash(sourcePins),outputBinding:output.binding,scopes,policyRevision:scopes[0].policyRevision,approvalDecision:decision,projectionRecipe:'original-selected-docx/1',deadlineMs:life.deadline(),maxBytes:Math.min(source.context.maxBytes,maxOutputBytes),checkedAtMs:now(),expiresAtMs:life.deadline()};
     const projection=projectOutput(source,receipt),deliveryId=selectedDeliveryId(source,receipt,projection);intent=args.baseVersionId===null?'create':'revise';
     body={deliveryId,request:projection.request,...(intent==='revise'?{baseVersionId:args.baseVersionId}:{})};requestSha256=hash({intent,body});
     resolved=await life.run(signal=>optionsOwner.resolve({credential:output.session.credential,intent,body,requestSha256,deadlineMs:life.deadline(),signal}));
     if(!resolved)fail('UNAVAILABLE');const context=resolved.documentOptions.artifactOptions.context;
     if(!same(context.binding,output.binding)||!same(context.scopes,scopes))fail('ACCESS_DENIED');
     life.limitDeadline(context.deadlineMs);receipt.deadlineMs=life.deadline();receipt.expiresAtMs=life.deadline();receipt.maxBytes=Math.min(receipt.maxBytes,context.maxBytes);
    }
    return {receipt:{...receipt,checkedAtMs:now()},documentOptions:{...resolved.documentOptions,artifactOptions:{...resolved.documentOptions.artifactOptions,retention:owned.retention}},sessionCredential:output.session.credential};
   }};
   const sourceAccess={async check({phase,sourcePins,outputBinding,evidence}){
    life.check();await serving();if(!same(sourcePins,source.sourcePins)||!same(outputBinding,output.binding)||!same(evidence,source.context.evidence))fail('ACCESS_DENIED');
    if(phase==='approval'&&!admitted||phase==='release'){
     await currentDecision();await life.run(signal=>resolved.recheck({phase:phase==='release'?'release':'admission',intent,requestSha256,resource:null,deadlineMs:life.deadline(),signal}));admitted=true;
    }
    return {sourceBinding:b,outputBinding,sourcePinsSha256:hash(sourcePins),evidenceSha256:hash(evidence),scopes,policyRevision:scopes[0].policyRevision,checkedAtMs:now(),expiresAtMs:life.deadline()};
   }};
   const bridge=createSelectedOutputBridge({retainedSource:retention,approvedOutput,sourceAccess,now,maxRequestMs}),delivery={...retention.sourceCall(loaded.prepared),signal:life.signal};
   const result=await bridge.deliver(delivery);life.check();return {status:'observed',outcome:result.artifact};
  }catch(error){if(['ARTIFACT_REPLAY_UNRESOLVED','ARTIFACT_EFFECT_UNKNOWN','SELECTED_OUTPUT_DOCUMENT_REFUSED'].includes(error?.code))return observe?{state:'UNKNOWN'}:{status:'indeterminate'};throw error;}
  finally{life.close();}
 }
 return Object.freeze({execute:value=>perform(value,false),read:value=>perform(value,true),async currentBinding({proposal,signal,deadlineMs}){
  const owned=bound();if(!owned?.store||!owned.sessions)fail('UNAVAILABLE');const check=()=>{signal?.throwIfAborted();if(now()>=deadlineMs)fail('DEADLINE');};
  const selected=await currentDocumentSession({...owned,now,proposal,signal,check});return {binding:selected.binding,selectedClientId:selected.selectedClientId};
 }});
}
