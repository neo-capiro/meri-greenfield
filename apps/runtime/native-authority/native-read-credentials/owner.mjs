/** Task-bound CONTROL credential/context join over existing owners; no credential issuance, persistence or native fallback. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../../packages/contracts/validate.mjs';
import {resolveOperationContract,assertSubject,validateShape as readShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertNativeReadConfiguration,nativeReadConfigurationSha256,assertNativeReadTaskAssertion,nativeReadFault,nativeReadFailureCode} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {retainedOrigin} from '../../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../../artifacts/storage/boundary.mjs';
import {allocation} from '../../../gateway/budget/tool-budget-binding.mjs';
import {retainedCall,credentialProof} from '../../../gateway/sources/retained-reads/call-context.mjs';
import {GatewayDenied,safeFailure} from '../../../gateway/dispatch/operation-result.mjs';
import {assertNativeToolAuthority} from './core-client.mjs';
import {nativeReadOperationAllowed} from '../../../gateway/sources/retained-reads/native-families.mjs';
import {captureBusinessDevelopmentResource} from '../../../gateway/sources/business-development/request-context.mjs';
import {assertNativeConversationAuthority} from './conversation-authority.mjs';
import {assertNativeClientReferenceObservation,CLIENT_REFERENCE_MAX_REQUEST_MS} from './client-reference.mjs';
import {assertNativeReadModeObservation} from './read-mode-observation.mjs';
import {MODE_READ_OPERATIONS} from '../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {createSourceReadContext,sourceReadContextSelection,assertNativeVisibleClients,assertNativeResultClientIds,assertSourceReadRequest,sourceReadClientReference,assertSourceReadReferenceSubject} from './source-read-context.mjs';
const same=(a,b)=>hash(a)===hash(b),refuse=code=>{throw nativeReadFault(code);};
const selection=({authorizationDecisionId,...rest})=>rest;
const taskSelection=({operation,inputSha256,authorizationDecisionId,checkedAtMs,expiresAtMs,...rest})=>rest;
const nativeSelection=({checkedAtMs,expiresAtMs,...rest})=>rest;
const failure=error=>{const code=nativeReadFailureCode(error)??safeFailure(error).message;return new GatewayDenied(code==='CONFIGURATION'?'GATEWAY_CONFIGURATION':code==='INTERNAL_ERROR'?'UNAVAILABLE':code);};
const token=v=>typeof v==='string'&&/^[\x21-\x7e]{1,8192}$/u.test(v);
export function createNativeReadCredentialOwner(configuration){
 const c=own(configuration,['binding','expiresAtMs'],['store','taskVerifier','readCurrentEntry','taskCapability','allocationJson','approvedReads','coreAuthority','getNativeCredential','getServiceSecret','getReadModeServiceSecret','defaultCongress','now','enabled']),binding=data(c.binding),now=c.now??Date.now,enabled=c.enabled??false;
 validateShape('RunBinding',binding);if(typeof now!=='function'||typeof enabled!=='boolean'||!Number.isSafeInteger(c.expiresAtMs)||c.defaultCongress!==undefined&&(!Number.isSafeInteger(c.defaultCongress)||c.defaultCongress<1||c.defaultCongress>2147483647))refuse('CONFIGURATION');
 for(const name of ['getNativeCredential','getServiceSecret','getReadModeServiceSecret','readCurrentEntry'])if(c[name]!==undefined&&(typeof c[name]!=='function'||types.isProxy(c[name])))refuse('CONFIGURATION');
 const core=c.coreAuthority===undefined?undefined:own(c.coreAuthority,['available','origin','readCurrent'],['readConversation','readClientReference','readModeObservation']),origin=core?.origin===undefined?undefined:retainedOrigin(core.origin);
 const approved=c.approvedReads===undefined?undefined:assertNativeReadConfiguration(c.approvedReads),allocated=c.allocationJson===undefined?undefined:allocation(c.allocationJson);
 const available=Boolean(enabled&&c.store&&c.taskVerifier&&c.readCurrentEntry&&token(c.taskCapability)&&approved?.enabled&&allocated&&core?.available===true&&origin&&c.getNativeCredential&&c.getServiceSecret);
 const read=available?storageMethod(c.store,'read'):null,verify=available?storageMethod(c.taskVerifier,'verify'):null,currentCore=available?storageMethod(c.coreAuthority,'readCurrent'):null,
  readConversation=available&&typeof core.readConversation==='function'?storageMethod(c.coreAuthority,'readConversation'):null,
  readClientReference=available&&typeof core.readClientReference==='function'?storageMethod(c.coreAuthority,'readClientReference'):null,
  readModeObservation=available&&typeof core.readModeObservation==='function'?storageMethod(c.coreAuthority,'readModeObservation'):null,pins=new WeakMap();
 function observation(raw){const v=data(own(raw,['binding','subject','operation','request','requestSha256','policyRevision','sourceIds','deadlineMs']));validateShape('RunBinding',v.binding);assertSubject(v.subject,v.binding);readShape('OperationRef',v.operation);
  const contract=resolveOperationContract(v.operation);if(!nativeReadOperationAllowed(contract.binding.group,v.operation.id)||contract.descriptor.sideEffect!=='none'||contract.descriptor.approvalBoundary!=='none')refuse('ACCESS_DENIED');if(['bill-text','federal-legislation'].includes(contract.binding.group)&&c.defaultCongress===undefined)refuse('UNAVAILABLE');
  // Data-search's canonical raw-selector normalizer also validates its selector combination.
  if(contract.binding.group==='data-search')contract.normalizeInput(v.request,{});else if(contract.binding.group!=='state-status-votes')readShape(contract.binding.input,v.request);
  assertSourceReadRequest(contract,v.request,v.subject);
  if(sourceReadClientReference(contract,v.request)!==null&&!readClientReference)refuse('UNAVAILABLE');
  if(MODE_READ_OPERATIONS.includes(v.operation.id)&&(!readModeObservation||!c.getReadModeServiceSecret))refuse('UNAVAILABLE');
  if(contract.binding.group==='business-development'&&!readConversation&&captureBusinessDevelopmentResource(v.operation,v.request,v.subject).clientId!==null)refuse('UNAVAILABLE');
  if(!same(v.binding,binding)||v.subject.policyRevision!==v.policyRevision||v.requestSha256!==hash(v.request)||!same([...v.sourceIds].sort(),[...new Set(contract.descriptor.sourceRequirements.map(s=>s.sourceId))].sort())||!Number.isSafeInteger(v.deadlineMs))refuse('ACCESS_DENIED');
  if(!approved.operations.some(op=>same(op,v.operation))||!allocated.manifest.allowedOperations.some(op=>same(op,v.operation)))refuse('ACCESS_DENIED');return v;}
 async function observe(proof,scopeSignal,signal){
  if(!available)refuse('UNAVAILABLE');nativeSignal(scopeSignal);nativeSignal(signal);if(!scopeSignal)refuse('ACCESS_DENIED');if(scopeSignal.aborted||signal?.aborted)refuse('CANCELLED');
  const selected={...proof,subject:selection(proof.subject)};delete selected.deadlineMs;const prior=pins.get(scopeSignal);if(prior&&!same(prior.selected,selected))refuse('ACCESS_DENIED');
  let cutoff=Math.min(c.expiresAtMs,proof.deadlineMs,prior?.expiresAtMs??now()+approved.maxExecuteMs),life=createOperationLifetime({now,signal:signal?AbortSignal.any([scopeSignal,signal]):scopeSignal,deadlineMs:cutoff,errorFactory:nativeReadFault});
  const limit=expiry=>{cutoff=Math.min(cutoff,expiry);life.limitDeadline(cutoff);};
  async function admission(){const started=now(),operation='runner/reads/execute',inputSha256=hash(proof),r=assertNativeReadTaskAssertion(await life.run(signal=>verify({capability:c.taskCapability,binding,operation,inputSha256,deadlineMs:cutoff,signal})),{binding,operation,inputSha256,started,now});
   if(r.policyRevision!==proof.policyRevision||r.allocationSha256!==hash(allocated)||proof.subject.scopes.some(scope=>!r.scopes.some(parent=>same(scope,parent))))refuse('ACCESS_DENIED');limit(r.expiresAtMs);
   const began=now(),entry=data(await life.run(signal=>c.readCurrentEntry({binding,signal,deadlineMs:cutoff})));own(entry,['binding','runRequestSha256','grantId','taskArn','issuanceFactsSha256','allocationSha256','scopes','policyRevision','readConfigurationSha256','checkedAtMs','expiresAtMs']);
   for(const key of ['binding','runRequestSha256','grantId','taskArn','issuanceFactsSha256','allocationSha256','scopes','policyRevision'])if(!same(entry[key],r[key]))refuse('ACCESS_DENIED');
   if(entry.readConfigurationSha256!==nativeReadConfigurationSha256(approved)||!Number.isSafeInteger(entry.checkedAtMs)||entry.checkedAtMs<began||entry.checkedAtMs>now())refuse('ACCESS_DENIED');limit(entry.expiresAtMs);return r;}
  try{
   const before=await admission(),row=data(await life.run(()=>read(binding,{},life.check)));validateShape('Run',row.run);
   if(!same(row.run.binding,binding)||!['queued','starting','running'].includes(row.run.state)||row.run.policyRevision!==proof.policyRevision||!same(row.run.scopes,before.scopes)||hash(row.request)!==before.runRequestSha256)refuse('ACCESS_DENIED');
   const credential=await life.run(signal=>c.getNativeCredential({binding,operation:proof.operation,requestSha256:proof.requestSha256,signal,deadlineMs:cutoff}));if(!token(credential))refuse('UNAVAILABLE');
   const began=now(),native=assertNativeToolAuthority(await life.run(signal=>currentCore({credential,signal,deadlineMs:cutoff})),{started:began,now});limit(native.expiresAtMs);
   // Equality is permitted only for the canonical Core UUID principal already captured by native startup. No conversion/mapping.
   if(native.principal.tenantId!==binding.tenantId||native.principal.actorId!==binding.actorId)refuse('UNAVAILABLE');
   const contract=resolveOperationContract(proof.operation);let conversation=null,clientReferenceObservation=null,modeObservation=null;
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
    // Resolution itself is an await. Recheck the current client wall before any service secret/source use.
    const checked=now(),afterReference=assertNativeToolAuthority(await life.run(signal=>currentCore({credential,signal,deadlineMs:cutoff})),{started:checked,now});
    limit(afterReference.expiresAtMs);
    if(!same(nativeSelection(afterReference),nativeSelection(native)))refuse('ACCESS_DENIED');
    assertNativeVisibleClients(afterReference,[clientReferenceObservation.clientId]);
   }
   if(MODE_READ_OPERATIONS.includes(proof.operation.id)){
    // Native credential/authority acquisition can suspend. Refresh the current task before the private mode-secret getter.
    const prepared=await admission();if(!same(taskSelection(before),taskSelection(prepared)))refuse('ACCESS_DENIED');
    const serviceSecret=await life.run(signal=>c.getReadModeServiceSecret({binding,operation:proof.operation,origin,requestSha256:proof.requestSha256,signal,deadlineMs:cutoff}));
    if(!token(serviceSecret))refuse('UNAVAILABLE');
    // The private service credential is an await too; current task/native grants must still hold before the observation route.
    const resumed=await admission();if(!same(taskSelection(before),taskSelection(resumed)))refuse('ACCESS_DENIED');
    const checked=now(),resumedNative=assertNativeToolAuthority(await life.run(signal=>currentCore({credential,signal,deadlineMs:cutoff})),{started:checked,now});limit(resumedNative.expiresAtMs);
    if(!same(nativeSelection(native),nativeSelection(resumedNative)))refuse('ACCESS_DENIED');
    const started=now(),deadlineMs=cutoff;
    modeObservation=assertNativeReadModeObservation(await life.run(signal=>readModeObservation({credential,serviceSecret,operation:proof.operation,requestSha256:proof.requestSha256,deadlineMs,signal})),{started,now,operation:proof.operation,requestSha256:proof.requestSha256,deadlineMs});
    if(!same(modeObservation.principal,native.principal)||modeObservation.identityRevision!==native.identityRevision)refuse('ACCESS_DENIED');
    limit(modeObservation.expiresAtMs);
    const afterStarted=now(),afterMode=assertNativeToolAuthority(await life.run(signal=>currentCore({credential,signal,deadlineMs:cutoff})),{started:afterStarted,now});limit(afterMode.expiresAtMs);
    if(!same(nativeSelection(native),nativeSelection(afterMode)))refuse('ACCESS_DENIED');
   }
   const context=createSourceReadContext({contract,proof,native,defaultCongress:c.defaultCongress,now,priorContext:pins.get(scopeSignal)?.context,
    ...(modeObservation?{modeObservation}:{}),
    ...(clientReferenceObservation?{clientReferenceObservation:{reference:clientReferenceObservation.reference,clientId:clientReferenceObservation.clientId}}:{})});
   contract.normalizeInput(proof.request,context);
   const after=await admission();if(!same(taskSelection(before),taskSelection(after)))refuse('ACCESS_DENIED');
   const vector={task:taskSelection(after),native:nativeSelection(native),...(conversation?{conversation:nativeSelection(conversation)}:{}),...(clientReferenceObservation?{clientReference:nativeSelection(clientReferenceObservation)}:{}),...(modeObservation?{modeObservation:nativeSelection(modeObservation)}:{}),credentialSha256:hash(credential),context:sourceReadContextSelection(contract.binding.group,context)},latest=pins.get(scopeSignal);if(latest&&(!same(latest.selected,selected)||!same(latest.vector,vector)))refuse('ACCESS_DENIED');if(latest)limit(latest.expiresAtMs);life.check();
   pins.set(scopeSignal,{selected,vector,context,expiresAtMs:cutoff});return {credential,context,native,checkedAtMs:Math.min(before.checkedAtMs,native.checkedAtMs,after.checkedAtMs),expiresAtMs:cutoff};
  }finally{life.close();}
 }
 async function readCurrent(raw){try{if(!available)refuse('UNAVAILABLE');const {signal,...fields}=own(raw,['binding','subject','operation','request','requestSha256','policyRevision','sourceIds','deadlineMs'],['signal']),proof=observation(fields),result=await observe(proof,signal);const {request,deadlineMs,...echo}=proof;return JSON.stringify({...echo,context:result.context,checkedAtMs:result.checkedAtMs,expiresAtMs:result.expiresAtMs});}catch(error){throw failure(error);}}
 async function getCredentials(raw){let life;try{
  if(!available)refuse('UNAVAILABLE');const {signal,scopeSignal,...fields}=own(raw,['binding','subject','operation','policyRevision','sourceIds','argumentsSha256','requestSha256','normalizationContext','origin','request','input','scopeSignal','deadlineMs'],['signal']);nativeSignal(signal);nativeSignal(scopeSignal);const v=data(fields),pinned=pins.get(scopeSignal);
  if(!pinned||v.origin!==origin)refuse('ACCESS_DENIED');const proof=observation(Object.fromEntries(['binding','subject','operation','request','requestSha256','policyRevision','sourceIds','deadlineMs'].map(key=>[key,v[key]]))),normalized=resolveOperationContract(v.operation).normalizeInput(v.request,v.normalizationContext);
  if(!same(normalized.input,v.input)||normalized.argumentsSha256!==v.argumentsSha256)refuse('ACCESS_DENIED');const before=await observe(proof,scopeSignal,signal);if(!same(before.context,v.normalizationContext))refuse('ACCESS_DENIED');
  const cutoff=Math.min(v.deadlineMs,before.expiresAtMs);life=createOperationLifetime({now,signal:signal?AbortSignal.any([scopeSignal,signal]):scopeSignal,deadlineMs:cutoff,errorFactory:nativeReadFault});const secret=await life.run(signal=>c.getServiceSecret({binding,operation:v.operation,origin,requestSha256:v.requestSha256,argumentsSha256:v.argumentsSha256,normalizationContext:v.normalizationContext,signal,deadlineMs:cutoff}));if(!token(secret))refuse('UNAVAILABLE');
  const after=await observe({...proof,deadlineMs:cutoff},scopeSignal,signal);life.check();const {request,input,deadlineMs,...echo}=v;return data({...echo,bearerToken:before.credential,serviceSecret:secret,expiresAtMs:Math.min(cutoff,after.expiresAtMs)});
 }catch(error){throw failure(error);}finally{life?.close();}}
 // Trusted per-invocation composition binds the original request and gateway lifetime; the existing source callback stays unchanged.
 function credentialsForCall(operation,call){if(!available)throw failure(nativeReadFault('UNAVAILABLE'));const current=retainedCall(operation,call,now),expected=credentialProof(current,origin),scopeSignal=call.signal;
  return async raw=>{const {signal,deadlineMs,...fields}=own(raw,[...Object.keys(expected),'input','deadlineMs'],['signal']);if(!same(fields,{...expected,input:current.input}))throw failure(nativeReadFault('ACCESS_DENIED'));return getCredentials({...fields,request:current.request,scopeSignal,deadlineMs,signal});};}
 /** Private response-identity gate. It emits no roster, receipt or credential. */
 function authorizeResultForCall(operation,call){try{
  if(!available)refuse('UNAVAILABLE');const current=retainedCall(operation,call,now),scopeSignal=call.signal;
  nativeSignal(scopeSignal);if(!scopeSignal||!pins.has(scopeSignal)||current.contract.binding.group!=='client-registry')refuse('ACCESS_DENIED');
  const a=current.authority,proof=observation({binding:a.binding,subject:a.subject,operation,request:current.request,requestSha256:hash(current.request),policyRevision:a.policyRevision,sourceIds:a.sourceIds,deadlineMs:current.deadlineMs});
  return async raw=>{try{
   const {clientIds}=data(own(raw,['clientIds']));
   assertNativeResultClientIds(clientIds);
   const before=await observe(proof,scopeSignal);assertNativeVisibleClients(before.native,clientIds);
   const after=await observe({...proof,deadlineMs:Math.min(proof.deadlineMs,before.expiresAtMs)},scopeSignal);assertNativeVisibleClients(after.native,clientIds);
  }catch(error){throw failure(error);}};
 }catch(error){throw failure(error);}}
 return Object.freeze({available,nativeReadContextPorts:Object.freeze({readCurrent}),getCredentials,credentialsForCall,authorizeResultForCall});
}
