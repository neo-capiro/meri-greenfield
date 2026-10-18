/** CONTROL-only join. Per-dispatch resource pins are ephemeral correlation, never authority leases. */
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertRetainedObservation,assertCorePrincipal,retainedClocks,coreRetainedSelector,assertCoreRetainedReceipt,retainedOrigin,retainedRoutes} from '../../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {nativeReadFault,nativeReadFailureCode} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../../artifacts/storage/boundary.mjs';
import {GatewayDenied,safeFailure} from '../../../gateway/dispatch/operation-result.mjs';
const same=(a,b)=>hash(a)===hash(b),refuse=code=>{throw nativeReadFault(code);};
const subjectSelection=({authorizationDecisionId,...selection})=>selection;
const taskSelection=({operation,inputSha256,authorizationDecisionId,checkedAtMs,expiresAtMs,...facts})=>facts;
const failure=error=>{const code=nativeReadFailureCode(error)??safeFailure(error).message;return new GatewayDenied(code==='CONFIGURATION'?'GATEWAY_CONFIGURATION':code==='INTERNAL_ERROR'?'UNAVAILABLE':code);};
function assertFloridaSelectedClient(proof,receipt,admitted){
 if(proof.operation.id!=='get_florida_budget_project')return;
 const clients=[receipt.effectiveScope.clientId,receipt.clientResolution?.clientId].filter(id=>id!==null&&id!==undefined);
 if(clients.length===0)return;
 const subject=proof.subject,selected=subject.entityIds[0];
 if(subject.kind!=='client'||subject.entityType!=='client'||subject.entityIds.length!==1||clients.some(id=>id!==selected))refuse('ACCESS_DENIED');
 const scope=subject.scopes.find(s=>s.kind==='client'&&s.tenantId===proof.binding.tenantId&&s.resourceId===selected&&s.policyRevision===proof.policyRevision);
 if(!scope||!admitted.scopes.some(s=>same(s,scope)))refuse('ACCESS_DENIED');
}
export function createRetainedReadControlOwner(configuration){
 const c=own(configuration,[],['meri','core','broker','recipients','now','enabled']),now=c.now??Date.now,enabled=c.enabled??false;
 if(typeof now!=='function'||typeof enabled!=='boolean')refuse('CONFIGURATION');
 const meri=c.meri===undefined?undefined:own(c.meri,['available','readCurrent']),core=c.core===undefined?undefined:own(c.core,['available','readIdentity','readResource'],['issue']),broker=c.broker===undefined?undefined:own(c.broker,['available','getCredentials']);
 const available=Boolean(enabled&&meri?.available===true&&core?.available===true&&broker?.available===true&&c.recipients),pins=new WeakMap(),recipients=c.recipients===undefined?{}:data(own(c.recipients,[],Object.keys(retainedRoutes)));
 for(const origin of Object.values(recipients))retainedOrigin(origin);
 const current=available?storageMethod(c.meri,'readCurrent'):null,identity=available?storageMethod(c.core,'readIdentity'):null,resource=available?storageMethod(c.core,'readResource'):null,credentials=available?storageMethod(c.broker,'getCredentials'):null;
 async function observe(proof,scopeSignal){if(!available)refuse('UNAVAILABLE');nativeSignal(scopeSignal);if(scopeSignal===undefined||scopeSignal.aborted)refuse('ACCESS_DENIED');
  const selected={binding:proof.binding,operation:proof.operation,requestSha256:proof.requestSha256,policyRevision:proof.policyRevision,sourceIds:proof.sourceIds,subject:subjectSelection(proof.subject),observationAt:proof.observationAt},previous=pins.get(scopeSignal);
  if(previous&&!same(previous.selected,selected))refuse('ACCESS_DENIED');let cutoff=Math.min(proof.deadlineMs,previous?.expiresAtMs??Infinity);const life=createOperationLifetime({now,signal:scopeSignal,deadlineMs:cutoff,errorFactory:nativeReadFault});
  const limit=expiry=>{cutoff=Math.min(cutoff,expiry);life.limitDeadline(cutoff);};
  try{const before=data(await life.run(signal=>current({...proof,signal,deadlineMs:cutoff})));limit(before.expiresAtMs);
   const began=now(),native=data(await life.run(signal=>identity({signal,deadlineMs:cutoff})));own(native,['principal','identityRevision','checkedAtMs','expiresAtMs']);assertCorePrincipal(native.principal);retainedClocks(native,{started:began,now});
   // Supported only for canonical startup's Core-native principal provenance. Different namespaces need a genuine mapping owner.
   if(native.principal.tenantId!==proof.binding.tenantId||native.principal.actorId!==proof.binding.actorId)refuse('UNAVAILABLE');limit(native.expiresAtMs);
   const selector=coreRetainedSelector(proof.operation,proof.request,proof.subject),resourceBegan=now(),receipt=assertCoreRetainedReceipt(proof.operation,await life.run(signal=>resource({operation:proof.operation,selector,signal,deadlineMs:cutoff})),{selector,principal:native.principal,identityRevision:native.identityRevision,started:resourceBegan,now});limit(receipt.expiresAtMs);
   const after=data(await life.run(signal=>current({...proof,signal,deadlineMs:cutoff})));limit(after.expiresAtMs);if(!same(taskSelection(before.assertion),taskSelection(after.assertion)))refuse('ACCESS_DENIED');
   assertFloridaSelectedClient(proof,receipt,after.assertion);
   const vector={identityRevision:native.identityRevision,resourceRevision:receipt.resourceRevision,principal:native.principal,selectorSha256:receipt.selectorSha256,task:taskSelection(after.assertion)};
   if(previous&&!same(previous.vector,vector))refuse('ACCESS_DENIED');
   const context=proof.operation.id==='get_florida_budget_project'?data({asOf:proof.observationAt,effectiveScope:receipt.effectiveScope,clientResolution:receipt.clientResolution}):data({binding:proof.binding,subject:proof.subject});
   resolveOperationContract(proof.operation).normalizeInput(proof.request,context);life.check();pins.set(scopeSignal,{selected,vector,expiresAtMs:cutoff});return {identity:native,resource:receipt,context,expiresAtMs:cutoff};
  }finally{life.close();}
 }
 async function readCurrent(raw){try{const {signal,...fields}=own(raw,['binding','subject','operation','requestSha256','policyRevision','sourceIds','request','observationAt','deadlineMs'],['signal']),proof=assertRetainedObservation(fields),result=await observe(proof,signal);
  const {request,observationAt,deadlineMs,...echo}=proof;return JSON.stringify({...echo,context:result.context,checkedAtMs:now(),expiresAtMs:result.expiresAtMs});
 }catch(error){throw failure(error);}}
 async function getCredentials(raw){let life;try{if(!available)refuse('UNAVAILABLE');const {signal,scopeSignal,...fields}=own(raw,['binding','subject','operation','policyRevision','sourceIds','argumentsSha256','requestSha256','normalizationContext','origin','request','input','scopeSignal','deadlineMs'],['signal']);nativeSignal(signal);nativeSignal(scopeSignal);const v=data(fields),pinned=pins.get(scopeSignal);
  if(!pinned||recipients[v.operation.id]!==v.origin)refuse('ACCESS_DENIED');const proof=assertRetainedObservation({binding:v.binding,subject:v.subject,operation:v.operation,requestSha256:v.requestSha256,policyRevision:v.policyRevision,sourceIds:v.sourceIds,request:v.request,observationAt:pinned.selected.observationAt,deadlineMs:Math.min(v.deadlineMs,pinned.expiresAtMs)}),normalized=resolveOperationContract(v.operation).normalizeInput(v.request,v.normalizationContext);
  if(!same(normalized.input,v.input)||normalized.argumentsSha256!==v.argumentsSha256)refuse('ACCESS_DENIED');const before=await observe(proof,scopeSignal);if(!same(before.context,v.normalizationContext))refuse('ACCESS_DENIED');
  life=createOperationLifetime({now,signal,deadlineMs:Math.min(v.deadlineMs,before.expiresAtMs),errorFactory:nativeReadFault});const issued=data(await life.run(signal=>credentials({operation:v.operation,request:v.request,context:v.normalizationContext,input:v.input,identity:before.identity,resource:before.resource,originalExpiresAtMs:pinned.expiresAtMs,signal,deadlineMs:Math.min(v.deadlineMs,before.expiresAtMs)})));own(issued,['assertionJson','expiresAtMs']);life.limitDeadline(issued.expiresAtMs);
  const after=await observe({...proof,deadlineMs:Math.min(proof.deadlineMs,issued.expiresAtMs)},scopeSignal);life.check();const {request,input,deadlineMs,...echo}=v;return data({...echo,...issued,expiresAtMs:Math.min(issued.expiresAtMs,after.expiresAtMs)});
 }catch(error){throw failure(error);}finally{life?.close();}}
 return Object.freeze({available,retainedContextPorts:Object.freeze({readCurrent}),getCredentials});
}
