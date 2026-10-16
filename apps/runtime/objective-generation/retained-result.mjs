/** Fresh control authority reads ONE original PUBLISHED typed result, independent of expired task/model leases. No capture, issue or apply port. */
import {own,data,hash,assertTypedResult,assertTypedSelection,typedCheckpointObject,assertTypedResultBytes,typedFault} from '../../../packages/runtime/objective-generation-custody.mjs';
import {nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createNativeIdentityContext} from '../native-authority/identity-context.mjs';
import {loadObjectiveStrategyCodec} from '../../worker/conversation/objective-generation/typed-result.mjs';
const refuse=()=>{throw typedFault();};
export function createObjectiveGenerationResultReader(configuration){
 const c=own(configuration,['store','objects','identity','source'],['enabled','now','maxRequestMs','maxFactBytes','codec']),now=c.now??Date.now,enabled=c.enabled??false,maxRequestMs=c.maxRequestMs??3000,maxFactBytes=c.maxFactBytes??131072,codec=c.codec??loadObjectiveStrategyCodec;
 const source=data(own(c.source,['generationJobId','binding','sourceAdmissionSha256'])),identity=own(c.identity,['origin','credential','commandContext','fetchImpl']),context=data(own(identity.commandContext,['binding','clientResolution']));
 const readRun=storageMethod(c.store,'read'),readCompletion=storageMethod(c.store.completions,'read'),get=storageMethod(c.objects,'get');
 if(typeof now!=='function'||typeof enabled!=='boolean'||typeof codec!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||!Number.isSafeInteger(maxFactBytes)||maxFactBytes<1||maxFactBytes>131072||hash(context.binding)!==hash(source.binding))refuse();
 async function read(value){
  const v=own(value,['generationJobId'],['signal']);nativeSignal(v.signal);if(!enabled||v.generationJobId!==source.generationJobId)refuse();
  let deadlineMs=now()+maxRequestMs,pinned,originalStamp;const life=createOperationLifetime({now,signal:v.signal,deadlineMs,errorFactory:typedFault});
  async function row(){const saved=await life.run(()=>readRun(source.binding,{},life.check));life.check();if(hash(saved.run.binding)!==hash(source.binding))refuse();return saved;}
  const currentOwner={async currentRun(binding,{signal}){if(hash(binding)!==hash(source.binding))refuse();const saved=await row();signal.throwIfAborted();return JSON.stringify({binding:source.binding,policyRevision:saved.run.policyRevision,deadlineMs,checkedAtMs:now()});}};
  let authority;try{authority=createNativeIdentityContext({origin:identity.origin,commandContext:context,fetchImpl:identity.fetchImpl,currentOwner,now,limits:{maxRequestMs,maxFactBytes},enabled});}catch(error){life.close();throw error;}
  async function fresh(){
   const principal=await life.run(signal=>authority.verifyIdentity({credential:identity.credential,signal,deadlineMs}));deadlineMs=Math.min(deadlineMs,principal.expiresAtMs);life.limitDeadline(deadlineMs);
   const resolved=await life.run(signal=>authority.resolveContext({identityCredential:identity.credential,identity:principal,identitySha256:hash(principal),hints:{conversationId:source.binding.conversationId,runId:source.binding.runId,clientId:context.clientResolution.clientId},signal,deadlineMs}));
   const p=data({principal:principal.principal,identityRevision:principal.identityRevision,binding:resolved.binding,scopes:resolved.scopes,selectedClientId:resolved.selectedClientId,contextRevision:resolved.contextRevision}),saved=await row();
   if(hash(p.binding)!==hash(source.binding)||hash(p.scopes)!==hash(saved.run.scopes)||p.selectedClientId!==context.clientResolution.clientId||pinned&&hash(pinned)!==hash(p))refuse();pinned??=p;deadlineMs=Math.min(deadlineMs,resolved.expiresAtMs);life.limitDeadline(deadlineMs);life.check();
  }
  async function retained(){
   await fresh();const saved=await row(),p=data(await life.run(()=>readCompletion({binding:source.binding,scopes:pinned.scopes,selectedClientId:pinned.selectedClientId},life.check)));life.check();
   if(p.state!=='PUBLISHED'||!p.proof||!p.typedResult||!p.typedSelection||p.sourceRequestSha256!==hash(saved.request)||hash(p.sourceRequest)!==hash(saved.request)||hash(p.versions)!==hash(saved.run.versions)||hash(p.scopes)!==hash(pinned.scopes)||saved.run.state!=='completed')refuse();
   const d=assertTypedResult(p.typedResult,{binding:source.binding,sourceRequestSha256:p.sourceRequestSha256}),selection=assertTypedSelection(p.typedSelection,d,{binding:source.binding,acceptedRequest:saved.request});
   if(selection.strategy.request.jobId!==source.generationJobId||d.sourceAdmissionSha256!==source.sourceAdmissionSha256||selection.strategy.request.principal.clientId!==pinned.selectedClientId||d.resultRef!==p.completionId||d.execution.receiptRef!==p.completionId)refuse();
   const object=typedCheckpointObject(p.proof,d),stamp=hash({completionId:p.completionId,typedResult:d,typedSelection:selection,proof:p.proof});if(originalStamp&&originalStamp!==stamp)refuse();originalStamp??=stamp;return {p,d,selection,object};
  }
  try{
   const original=await retained();await fresh();const raw=await life.run(signal=>get(original.object,signal));life.check();const bytes=assertTypedResultBytes(raw,original.d),contract=await life.run(()=>codec(original.selection.strategy.request)),result=contract.decode(bytes,original.d,original.selection);
   await retained();await fresh();life.check();
   return data({schemaVersion:1,generationJobId:source.generationJobId,binding:source.binding,sourceAdmissionSha256:original.d.sourceAdmissionSha256,sourceRequestSha256:original.d.sourceRequestSha256,typedRequestSha256:original.d.typedRequestSha256,
    completionId:original.p.completionId,checkpointId:original.p.proof.checkpoint.checkpointId,checkpointSha256:original.p.proof.checkpointSha256,resultRef:original.d.resultRef,resultSha256:original.d.resultSha256,file:{path:original.d.path,object:original.object},rawFileSha256:original.d.fileSha256,execution:original.d.execution,result,checkedAtMs:now(),expiresAtMs:deadlineMs});
  }finally{life.close();}
 }
 return Object.freeze({available:()=>enabled,read});
}
