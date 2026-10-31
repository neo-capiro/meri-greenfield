/** Control-only Core context and source credentials. Execution currentness is borrowed from the existing run owner. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {resolveOperationContract,assertSubject,validateShape as readShape,validateCapiroData3Shape,validateCapiroData4Shape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertNativeReadConfiguration,nativeReadFault,nativeReadFailureCode} from '../../../packages/contracts/runtime-0.2/reads.mjs';
import {retainedOrigin} from '../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {retainedCall,credentialProof} from '../../gateway/sources/retained-reads/call-context.mjs';
import {GatewayDenied,safeFailure} from '../../gateway/dispatch/operation-result.mjs';
import {acceptsInvocationId} from '../../gateway/dispatch/native-read-context.mjs';
import {assertNativeToolAuthority} from './core-client.mjs';
import {nativeReadOperationAllowed} from '../../gateway/sources/retained-reads/native-families.mjs';
import {captureBusinessDevelopmentResource} from '../../gateway/sources/business-development/request-context.mjs';
import {assertNativeConversationAuthority} from './conversation-authority.mjs';
import {assertNativeClientReferenceObservation,CLIENT_REFERENCE_MAX_REQUEST_MS} from './client-reference.mjs';
import {assertNativeReadModeObservation} from './read-mode-observation.mjs';
import {assertChatAttachmentSource} from './chat-attachment-source.mjs';
import {attachmentSelection} from '../../gateway/sources/client-knowledge-attachments/request-context.mjs';
import {MODE_READ_OPERATIONS} from '../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {createSourceReadContext,assertNativeVisibleClients,assertNativeResultClientIds,assertSourceReadRequest,sourceReadClientReference,assertSourceReadReferenceSubject} from './source-read-context.mjs';
const same=(a,b)=>hash(a)===hash(b),refuse=code=>{throw nativeReadFault(code);};
const executionSelection=({operation,inputSha256,checkedAtMs,expiresAtMs,...rest})=>rest;
const nativeSelection=({checkedAtMs,expiresAtMs,...rest})=>rest;
const failure=error=>{const code=nativeReadFailureCode(error)??safeFailure(error).message;return new GatewayDenied(code==='CONFIGURATION'?'GATEWAY_CONFIGURATION':code==='INTERNAL_ERROR'?'UNAVAILABLE':code);};
const token=v=>typeof v==='string'&&/^[\x21-\x7e]{1,8192}$/u.test(v);
/** A native bearer is a token string, or `{credential, expiresAtMs}` when it carries its own authority expiry (the live action
 * session, RC1 option A). That expiry then bounds every later Core call and the source transport; it is never extended. */
const nativeBearer=issued=>{if(typeof issued==='string')return token(issued)?{credential:issued}:refuse('UNAVAILABLE');
 let v;try{v=data(own(issued,['credential','expiresAtMs']));}catch{refuse('UNAVAILABLE');}
 if(!token(v.credential)||!Number.isSafeInteger(v.expiresAtMs))refuse('UNAVAILABLE');return v;};
export function createReadContextOwner(configuration){
 const c=own(configuration,['binding','expiresAtMs'],['current','executionSha256','approvedReads','coreAuthority','getNativeCredential','getServiceSecret','getReadModeServiceSecret','defaultCongress','now','enabled']),binding=data(c.binding),now=c.now??Date.now,enabled=c.enabled??false;
 validateShape('RunBinding',binding);if(typeof now!=='function'||typeof enabled!=='boolean'||!Number.isSafeInteger(c.expiresAtMs)||c.defaultCongress!==undefined&&(!Number.isSafeInteger(c.defaultCongress)||c.defaultCongress<1||c.defaultCongress>2147483647))refuse('CONFIGURATION');
 for(const name of ['getNativeCredential','getServiceSecret','getReadModeServiceSecret'])if(c[name]!==undefined&&(typeof c[name]!=='function'||types.isProxy(c[name])))refuse('CONFIGURATION');
 const core=c.coreAuthority===undefined?undefined:own(c.coreAuthority,['available','origin','readCurrent'],['readConversation','readClientReference','readModeObservation','readChatAttachmentSource','readMailboxes']),origin=core?.origin===undefined?undefined:retainedOrigin(core.origin);
 const approved=c.approvedReads===undefined?undefined:assertNativeReadConfiguration(c.approvedReads);
 const available=Boolean(enabled&&typeof c.current==='function'&&typeof c.executionSha256==='string'&&approved?.enabled&&core?.available===true&&origin&&c.getNativeCredential&&c.getServiceSecret);
 const currentCore=available?storageMethod(c.coreAuthority,'readCurrent'):null,
  readConversation=available&&typeof core.readConversation==='function'?storageMethod(c.coreAuthority,'readConversation'):null,
  readClientReference=available&&typeof core.readClientReference==='function'?storageMethod(c.coreAuthority,'readClientReference'):null,
  readChatAttachmentSource=available&&typeof core.readChatAttachmentSource==='function'?storageMethod(c.coreAuthority,'readChatAttachmentSource'):null,
  readModeObservation=available&&typeof core.readModeObservation==='function'?storageMethod(c.coreAuthority,'readModeObservation'):null,pins=new WeakMap();
 function observation(raw){const v=data(own(raw,['binding','subject','operation','request','requestSha256','policyRevision','sourceIds','deadlineMs']));validateShape('RunBinding',v.binding);assertSubject(v.subject,v.binding);readShape('OperationRef',v.operation);
  const contract=resolveOperationContract(v.operation);if(!nativeReadOperationAllowed(contract.binding.group,v.operation.id)||contract.descriptor.sideEffect!=='none'||contract.descriptor.approvalBoundary!=='none')refuse('ACCESS_DENIED');if(['bill-text','federal-legislation'].includes(contract.binding.group)&&c.defaultCongress===undefined)refuse('UNAVAILABLE');
  // Data-search's canonical raw-selector normalizer also validates its selector combination.
  if(contract.binding.group==='data-search')contract.normalizeInput(v.request,{});
  else if(contract.binding.group==='capiro-data-v4')validateCapiroData4Shape(contract.binding.input,v.request);
  else if(contract.binding.group==='capiro-data-v3')validateCapiroData3Shape(contract.binding.input,v.request);
  else if(contract.binding.group!=='state-status-votes')readShape(contract.binding.input,v.request);
  assertSourceReadRequest(contract,v.request,v.subject);
  if(sourceReadClientReference(contract,v.request)!==null&&!readClientReference)refuse('UNAVAILABLE');
  if(MODE_READ_OPERATIONS.includes(v.operation.id)&&(!readModeObservation||!c.getReadModeServiceSecret))refuse('UNAVAILABLE');
  if(contract.binding.group==='client-knowledge-attachments'){attachmentSelection(v.request,v.subject,v.binding);if(!readChatAttachmentSource)refuse('UNAVAILABLE');}
  if(contract.binding.group==='business-development'&&!readConversation&&captureBusinessDevelopmentResource(v.operation,v.request,v.subject).clientId!==null)refuse('UNAVAILABLE');
  if(!same(v.binding,binding)||v.subject.policyRevision!==v.policyRevision||v.requestSha256!==hash(v.request)||!same([...v.sourceIds].sort(),[...new Set(contract.descriptor.sourceRequirements.map(s=>s.sourceId))].sort())||!Number.isSafeInteger(v.deadlineMs))refuse('ACCESS_DENIED');
  if(!approved.operations.some(op=>same(op,v.operation)))refuse('ACCESS_DENIED');return v;}
 async function observe(proof,scopeSignal,signal,invocationId,finalRelease){
  if(!available)refuse('UNAVAILABLE');nativeSignal(scopeSignal);nativeSignal(signal);if(!scopeSignal)refuse('ACCESS_DENIED');if(scopeSignal.aborted||signal?.aborted)refuse('CANCELLED');
  const selected={...proof};delete selected.deadlineMs;const prior=pins.get(scopeSignal);if(prior&&!same(prior.selected,selected))refuse('ACCESS_DENIED');
  // Correlation stays fixed for this one bounded invocation; it is not an access grant.
  if(invocationId!==undefined&&(typeof invocationId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/u.test(invocationId)||prior&&prior.callKey!==invocationId))refuse('ACCESS_DENIED');
  const callKey=prior?prior.callKey:invocationId;
  let cutoff=Math.min(c.expiresAtMs,proof.deadlineMs,prior?.expiresAtMs??now()+approved.maxExecuteMs),life=createOperationLifetime({now,signal:signal?AbortSignal.any([scopeSignal,signal]):scopeSignal,deadlineMs:cutoff,errorFactory:nativeReadFault});
  const limit=expiry=>{cutoff=Math.min(cutoff,expiry);life.limitDeadline(cutoff);};
  async function admission(){
   const current=await life.run(()=>c.current());
   if(current.executionSha256!==c.executionSha256||current.policyRevision!==proof.policyRevision||
    !same(current.execution.binding,binding)||proof.subject.scopes.some(scope=>!current.scopes.some(parent=>same(scope,parent))))refuse('ACCESS_DENIED');
   limit(current.execution.expiresAtMs);return current;
  }
  async function observeAttachmentSource(credential){
   const selection=attachmentSelection(proof.request,proof.subject,binding);
   const serviceSecret=await life.run(signal=>c.getServiceSecret({binding,operation:proof.operation,origin,requestSha256:proof.requestSha256,signal,deadlineMs:cutoff}));
   if(!token(serviceSecret))refuse('UNAVAILABLE');await admission();const started=now();
   const observed=assertChatAttachmentSource(await life.run(signal=>readChatAttachmentSource({credential,serviceSecret,sourceConversationId:selection.sourceConversationId,signal,deadlineMs:cutoff})),{binding,...selection,started,now,deadlineMs:cutoff});
   limit(observed.expiresAtMs);return observed;
  }
  /** Final result release re-observes the canonical current Core context: a client selection lost
   * after the source value was produced withholds that value. The original expiry still bounds the call. */
  async function observeRelease(proof,prior){
   const started=now(),fresh=assertNativeToolAuthority(await life.run(signal=>currentCore({credential:prior.credential,signal,deadlineMs:cutoff})),{started,now});
   // Graph paths can include client-attributed notes behind non-client nodes.
   // Reuse the canonical current roster for release, including General reads.
   if(proof.operation.id==='find_path_to'&&(!Array.isArray(prior.native.clientIds)||!Array.isArray(fresh.clientIds)||
    prior.native.clientIds.some(id=>!fresh.clientIds.includes(id))))refuse('ACCESS_DENIED');
   const {modeObservation,clientReference}=prior.vector;
   const attachmentObservation=proof.operation.id==='read_chat_attachments'?await observeAttachmentSource(prior.credential):null;
   const context=createSourceReadContext({contract:resolveOperationContract(proof.operation),proof,native:fresh,defaultCongress:c.defaultCongress,now,priorContext:prior.context,
    ...(modeObservation?{modeObservation}:{}),
    ...(attachmentObservation?{attachmentObservation}:{}),
    ...(clientReference?{clientReferenceObservation:{reference:clientReference.reference,clientId:clientReference.clientId}}:{})});
   if(!same(context,prior.context))refuse('ACCESS_DENIED');
   limit(fresh.expiresAtMs);
  }
  try{
   const before=await admission();
   // Retain only this operation's input interpretation between observations. Resource access still
   // belongs to the actual Core handler; only the final result release re-observes Core /current.
   if(prior){if(!same(prior.vector.execution,executionSelection(before)))refuse('ACCESS_DENIED');
    if(finalRelease)await observeRelease(proof,prior);
    life.check();return {...prior,expiresAtMs:cutoff};}
   const bearer=nativeBearer(await life.run(signal=>c.getNativeCredential({binding,operation:proof.operation,requestSha256:proof.requestSha256,...(callKey===undefined?{}:{callKey}),signal,deadlineMs:cutoff}))),credential=bearer.credential;
   if(bearer.expiresAtMs!==undefined)limit(bearer.expiresAtMs);
   const began=now(),native=assertNativeToolAuthority(await life.run(signal=>currentCore({credential,signal,deadlineMs:cutoff})),{started:began,now});limit(native.expiresAtMs);
   // Equality is permitted only for the canonical Core UUID principal already captured by native startup. No conversion/mapping.
   if(native.principal.tenantId!==binding.tenantId||native.principal.actorId!==binding.actorId)refuse('UNAVAILABLE');
   const contract=resolveOperationContract(proof.operation);let conversation=null,clientReferenceObservation=null,modeObservation=null,attachmentObservation=null;
   if(contract.binding.group==='client-knowledge-attachments')attachmentObservation=await observeAttachmentSource(credential);
   if(contract.binding.group==='business-development'){
    const resource=captureBusinessDevelopmentResource(proof.operation,proof.request,proof.subject);
    // Client tasks retain their exact private resource upper bound. Personal tasks use the native
    // tool's existing owned-conversation/prospect authorization before its domain content read.
    if(resource.clientId!==null){
     assertNativeVisibleClients(native,[resource.clientId]);
     const started=now();conversation=assertNativeConversationAuthority(await life.run(signal=>readConversation({credential,...resource,signal,deadlineMs:cutoff})),{started,now,...resource});
     if(!same(conversation.principal,native.principal)||conversation.identityRevision!==native.identityRevision)refuse('ACCESS_DENIED');limit(conversation.expiresAtMs);
    }
   }
   const reference=sourceReadClientReference(contract,proof.request);
   if(reference!==null){
    const selectedClientId=assertSourceReadReferenceSubject(contract,proof,native);
    if(!readClientReference)refuse('UNAVAILABLE');
    const started=now(),referenceDeadline=Math.min(cutoff,started+CLIENT_REFERENCE_MAX_REQUEST_MS);
    clientReferenceObservation=assertNativeClientReferenceObservation(await life.run(signal=>readClientReference({credential,reference,signal,deadlineMs:referenceDeadline})),{started,now,reference});
    if(!same(clientReferenceObservation.principal,native.principal)||clientReferenceObservation.identityRevision!==native.identityRevision||selectedClientId!==null&&clientReferenceObservation.clientId!==selectedClientId)refuse('ACCESS_DENIED');
    assertNativeVisibleClients(native,[clientReferenceObservation.clientId]);
    limit(clientReferenceObservation.expiresAtMs);

   }
   if(MODE_READ_OPERATIONS.includes(proof.operation.id)){
    await admission();
    const serviceSecret=await life.run(signal=>c.getReadModeServiceSecret({binding,operation:proof.operation,origin,requestSha256:proof.requestSha256,signal,deadlineMs:cutoff}));
    if(!token(serviceSecret))refuse('UNAVAILABLE');
    await admission();
    const started=now(),deadlineMs=cutoff;
    modeObservation=assertNativeReadModeObservation(await life.run(signal=>readModeObservation({credential,serviceSecret,operation:proof.operation,requestSha256:proof.requestSha256,deadlineMs,signal})),{started,now,operation:proof.operation,requestSha256:proof.requestSha256,deadlineMs});
    if(!same(modeObservation.principal,native.principal)||modeObservation.identityRevision!==native.identityRevision)refuse('ACCESS_DENIED');
    limit(modeObservation.expiresAtMs);

   }
   const context=createSourceReadContext({contract,proof,native,defaultCongress:c.defaultCongress,now,priorContext:pins.get(scopeSignal)?.context,
    ...(modeObservation?{modeObservation}:{}),
    ...(attachmentObservation?{attachmentObservation}:{}),
    ...(clientReferenceObservation?{clientReferenceObservation:{reference:clientReferenceObservation.reference,clientId:clientReferenceObservation.clientId}}:{})});
   contract.normalizeInput(proof.request,context);
   const after=await admission();if(!same(executionSelection(before),executionSelection(after)))refuse('ACCESS_DENIED');
   const vector={execution:executionSelection(after),native:nativeSelection(native),...(conversation?{conversation:nativeSelection(conversation)}:{}),...(clientReferenceObservation?{clientReference:nativeSelection(clientReferenceObservation)}:{}),...(modeObservation?{modeObservation:nativeSelection(modeObservation)}:{}),credentialSha256:hash(credential),context},latest=pins.get(scopeSignal);if(latest&&(!same(latest.selected,selected)||!same(latest.vector,vector)))refuse('ACCESS_DENIED');if(latest)limit(latest.expiresAtMs);life.check();
   const held={selected,vector,credential,context,native,callKey,expiresAtMs:cutoff};pins.set(scopeSignal,held);return held;
  }finally{life.close();}
 }
 // This stamps the local admission observation, not a renewed Core authority.
 // observe() validates admission on every call and preserves the original expiry.
 async function readCurrent(raw,{finalRelease}={}){try{if(!available)refuse('UNAVAILABLE');const {signal,invocationId,...fields}=own(raw,['binding','subject','operation','request','requestSha256','policyRevision','sourceIds','deadlineMs'],['signal','invocationId']),proof=observation(fields),result=await observe(proof,signal,undefined,invocationId,finalRelease);const {request,deadlineMs,...echo}=proof;return JSON.stringify({...echo,context:result.context,checkedAtMs:now(),expiresAtMs:result.expiresAtMs});}catch(error){throw failure(error);}}
 async function getCredentials(raw){let life;try{
  if(!available)refuse('UNAVAILABLE');const {signal,scopeSignal,target,...fields}=own(raw,['binding','subject','operation','policyRevision','sourceIds','argumentsSha256','requestSha256','normalizationContext','origin','request','input','scopeSignal','deadlineMs'],['signal','target']);nativeSignal(signal);nativeSignal(scopeSignal);const v=data(fields),pinned=pins.get(scopeSignal);
  if(!pinned||v.origin!==origin)refuse('ACCESS_DENIED');const proof=observation(Object.fromEntries(['binding','subject','operation','request','requestSha256','policyRevision','sourceIds','deadlineMs'].map(key=>[key,v[key]]))),normalized=resolveOperationContract(v.operation).normalizeInput(v.request,v.normalizationContext);
  if(!same(normalized.input,v.input)||normalized.argumentsSha256!==v.argumentsSha256)refuse('ACCESS_DENIED');const before=await observe(proof,scopeSignal,signal);if(!same(before.context,v.normalizationContext))refuse('ACCESS_DENIED');
  const cutoff=Math.min(v.deadlineMs,before.expiresAtMs);life=createOperationLifetime({now,signal:signal?AbortSignal.any([scopeSignal,signal]):scopeSignal,deadlineMs:cutoff,errorFactory:nativeReadFault});const secret=await life.run(signal=>c.getServiceSecret({binding,operation:v.operation,origin,requestSha256:v.requestSha256,argumentsSha256:v.argumentsSha256,normalizationContext:v.normalizationContext,signal,deadlineMs:cutoff}));if(!token(secret))refuse('UNAVAILABLE');
  const after=await observe({...proof,deadlineMs:cutoff},scopeSignal,signal);life.check();
  // Use the current bearer only at dispatch, bounded by its original expiry.
  const final=nativeBearer(await life.run(signal=>c.getNativeCredential({binding,operation:v.operation,requestSha256:v.requestSha256,...(after.callKey===undefined?{}:{callKey:after.callKey}),signal,deadlineMs:Math.min(cutoff,after.expiresAtMs)})));
  if(final.credential!==before.credential)refuse('ACCESS_DENIED');life.check();
  let expiresAtMs=Math.min(cutoff,after.expiresAtMs,final.expiresAtMs??Infinity);if(expiresAtMs<=now())refuse('UNAVAILABLE');
  const {request,input,deadlineMs,...echo}=v;return data({...echo,bearerToken:before.credential,serviceSecret:secret,expiresAtMs});
 }catch(error){throw failure(error);}finally{life?.close();}}
 // Trusted per-invocation composition binds the original request and gateway lifetime; the existing source callback stays unchanged.
 function credentialsForCall(operation,call){if(!available)throw failure(nativeReadFault('UNAVAILABLE'));const current=retainedCall(operation,call,now),expected=credentialProof(current,origin),scopeSignal=call.signal;
  return async raw=>{const {signal,deadlineMs,target,...fields}=own(raw,[...Object.keys(expected),'input','deadlineMs'],['signal','target']);if(!same(fields,{...expected,input:current.input}))throw failure(nativeReadFault('ACCESS_DENIED'));return getCredentials({...fields,request:current.request,scopeSignal,deadlineMs,signal,...(target===undefined?{}:{target})});};}
 /** Private response-identity gate. It emits no roster, receipt or credential. */
 function authorizeResultForCall(operation,call){try{
  if(!available)refuse('UNAVAILABLE');const current=retainedCall(operation,call,now),scopeSignal=call.signal;
  nativeSignal(scopeSignal);if(!scopeSignal||!pins.has(scopeSignal)||current.contract.binding.group!=='client-registry')refuse('ACCESS_DENIED');
  const a=current.authority,proof=observation({binding:a.binding,subject:a.subject,operation,request:current.request,requestSha256:hash(current.request),policyRevision:a.policyRevision,sourceIds:a.sourceIds,deadlineMs:current.deadlineMs});
  return async raw=>{try{
   const {clientIds}=data(own(raw,['clientIds']));
   assertNativeResultClientIds(clientIds);
   const held=await observe(proof,scopeSignal),deadlineMs=Math.min(proof.deadlineMs,held.expiresAtMs);
   const life=createOperationLifetime({now,signal:scopeSignal,deadlineMs,errorFactory:nativeReadFault});
   try{
    const started=now(),latest=assertNativeToolAuthority(await life.run(signal=>currentCore({credential:held.credential,signal,deadlineMs})),{started,now});
    life.limitDeadline(latest.expiresAtMs);
    if(!same(latest.principal,held.native.principal))refuse('ACCESS_DENIED');
    assertNativeVisibleClients(latest,clientIds);await observe(proof,scopeSignal);life.check();
   }finally{life.close();}
  }catch(error){throw failure(error);}};
 }catch(error){throw failure(error);}}
 return Object.freeze({available,nativeReadContextPorts:acceptsInvocationId(Object.freeze({readCurrent})),getCredentials,credentialsForCall,authorizeResultForCall});
}
