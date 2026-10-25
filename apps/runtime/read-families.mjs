/** Existing typed read families and bounded dispatch; no allocation, grants or runtime source measurement. */
import catalog from '../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {resolveOperationContract,publicDomainDatasetRegistry,assertSubject} from '../../packages/contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {nativeReadFault,nativeReadFailureCode} from '../../packages/contracts/runtime-0.2/reads.mjs';
import {prepareGeneralReadFamilyHandlers,GENERAL_READ_ADAPTER_FAMILIES} from '../gateway/general-reads/integration.mjs';
import {familyOperations} from '../gateway/general-reads/registration.mjs';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {NATIVE_READ_FAMILIES} from '../gateway/sources/retained-reads/native-families.mjs';
import {createToolDispatch} from '../gateway/dispatch/tool-dispatch.mjs';
import {GatewayDenied} from '../gateway/dispatch/operation-result.mjs';
import {createReadContextOwner} from './read-context/owner.mjs';
import {createNativeToolAuthorityClient} from './read-context/core-client.mjs';
import {createObjectiveReadSource,createRoutineReadSource} from './objective-generation/read-source.mjs';
import {createObjectiveReadContext,createRoutineReadContext} from './objective-generation/read-context.mjs';

export {GENERAL_READ_ADAPTER_FAMILIES};
const key=op=>`${op.id}@${op.version}`,deny=code=>{throw nativeReadFault(code);};
const ORDINARY_FAMILIES=new Set(['action-items-complete','memory-proposals','client-knowledge-memory','client-knowledge-monday','client-documents','client-knowledge-profile','tenant-contacts','entity-candidates','meeting-source','operational-reads','mail','research-portfolio','research-portfolio-evidence','florida-budget']);
const uuid=digest=>`${digest.slice(0,8)}-${digest.slice(8,12)}-5${digest.slice(13,16)}-a${digest.slice(17,20)}-${digest.slice(20,32)}`;

export function prepareReadFamilies({familyIds,coreOrigin,fetchImpl,now,newId,capabilityPolicy,defaultCongress,getNativeCredential,getServiceSecret,getReadModeServiceSecret,memoryContexts}){
 const prepared=prepareGeneralReadFamilyHandlers({familyIds});
 async function createGateway({binding,current,approvedReads,signal,deadlineMs,objectiveCore,routineCore}){
  const initial=await current(),objective=objectiveCore?await objectiveCore.forBinding({binding,signal}):null,routine=routineCore?await routineCore.forBinding({binding,signal,deadlineMs}):null,job=objective??routine;
  if(objective&&routine||job&&((objective?job.current.clientId:job.record.selectedClientId)!==initial.selectedClientId||hash(job.record.binding)!==hash(binding)))deny('ACCESS_DENIED');
  const readSource=job?(routine?createRoutineReadSource:createObjectiveReadSource)({record:job.record,policyRevision:initial.policyRevision,origin:routine?routineCore.origin:coreOrigin,getServiceSecret:routine?routineCore.getServiceSecret:getServiceSecret,fetchImpl,now,maxRequestMs:approvedReads.maxExecuteMs,maxResponseBytes:approvedReads.maxResponseBytes}):undefined;
  const coreAuthority=job?null:createNativeToolAuthorityClient({origin:coreOrigin,fetchImpl,now,enabled:true,binding,selectedClientId:initial.selectedClientId});
  const nativeCredential=request=>getNativeCredential({...request,binding,selectedClientId:initial.selectedClientId});
  const credentials=job?(routine?createRoutineReadContext:createObjectiveReadContext)({record:job.record,current:job.current,readSource,policyRevision:initial.policyRevision,approvedReads,defaultCongress,now}):createReadContextOwner({binding,expiresAtMs:initial.execution.expiresAtMs,executionSha256:initial.executionSha256,current,
   approvedReads,coreAuthority,getNativeCredential:nativeCredential,getServiceSecret,...(getReadModeServiceSecret?{getReadModeServiceSecret}:{}),
   ...(defaultCongress===undefined?{}:{defaultCongress}),now,enabled:true});
  async function ordinaryCredentials(request){
   const {signal,input,deadlineMs,...echo}=own(request,['binding','subject','deadlineMs'],
    ['signal','input','operation','metadata','normalizationContext','argumentsSha256','requestSha256','sourceIds','policyRevision','invocationId','target','correlationSha256','sourceIdentity','origin']);
   const pins=data(echo);assertSubject(pins.subject,binding);
   if(hash(pins.binding)!==hash(binding)||!Number.isSafeInteger(deadlineMs)||
    pins.policyRevision!==initial.policyRevision||!approvedReads.operations.some(op=>hash(op)===hash(pins.operation)))deny('ACCESS_DENIED');
   const life=createOperationLifetime({now,signal,deadlineMs:Math.min(deadlineMs,initial.execution.expiresAtMs),errorFactory:nativeReadFault});
   try{
    await life.run(()=>current());
    const bearer=await life.run(signal=>nativeCredential({binding,operation:pins.operation,signal,deadlineMs}));
    life.limitDeadline(bearer.expiresAtMs);
    const secret=await life.run(signal=>getServiceSecret({binding,operation:pins.operation,signal,deadlineMs}));
    await life.run(()=>current());life.check();
    return {...pins,authorizationScheme:'Bearer',bearerToken:bearer.credential,serviceSecret:secret,
     expiresAtMs:Math.min(deadlineMs,initial.execution.expiresAtMs,bearer.expiresAtMs)};
   }catch(error){throw new GatewayDenied(nativeReadFailureCode(error)??'UNAVAILABLE');}finally{life.close();}
  }
  const families={};
  for(const family of familyIds){
   if(NATIVE_READ_FAMILIES.includes(family))families[family]={origin:coreOrigin,fetchImpl,maxRequestMs:approvedReads.maxExecuteMs,maxResponseBytes:approvedReads.maxResponseBytes,
    ...(readSource?{readSource}:{credentialsForCall:credentials.credentialsForCall}),...(family==='client-registry'?{authorizeResultForCall:credentials.authorizeResultForCall}:{})};
   else if(ORDINARY_FAMILIES.has(family)){
    const transport={fetchImpl,maxRequestMs:approvedReads.maxExecuteMs,maxResponseBytes:approvedReads.maxResponseBytes,...(readSource?{readSource}:{getCredentials:ordinaryCredentials})};
    if(!readSource&&['research-portfolio','research-portfolio-evidence'].includes(family))transport.getCredentials=async request=>{
     const full=await ordinaryCredentials({...request,operation:request.operation??{id:'get_research_evidence',version:'0.2.0'},policyRevision:initial.policyRevision});
     if(family==='research-portfolio-evidence')return {binding:full.binding,bearerToken:full.bearerToken,expiresAtMs:full.expiresAtMs};
     const {serviceSecret,...credentials}=full;return credentials;
    };
    families[family]=['action-items-complete','memory-proposals','operational-reads','research-portfolio','research-portfolio-evidence','florida-budget'].includes(family)?{...transport,origin:coreOrigin}:
     {...transport,endpoints:Object.fromEntries(familyOperations(family).map(op=>[op.id,new URL(`/api/clio/tools/${op.id}`,coreOrigin).href]))};
   }
   else if(family==='dataset-metadata')families[family]={registry:publicDomainDatasetRegistry};
  }
  // Each source keeps its existing typed handler. Uncomposed families remain explicit in the startup report.
  const handlers=prepared.create({families,now,newId}),approved=new Set(approvedReads.operations.map(key));
  const entries=new Map();
  for(const [id,handler] of handlers){
   const operation=approvedReads.operations.find(op=>key(op)===id);if(!operation)continue;
   const contract=resolveOperationContract(operation),descriptor=contract.descriptor;
   if(descriptor.sideEffect!=='none'||descriptor.approvalBoundary!=='none')deny('CONFIGURATION');
   entries.set(id,Object.freeze({descriptor,contract,execute:handler.execute}));
  }
  const operations=[...entries.values()].map(entry=>entry.descriptor.operation),baseCatalogSha256=hash(catalog);
  const executionCatalogSha256=hash({baseCatalogSha256,operations}),installationId=uuid(executionCatalogSha256);
  async function contextFor({entry,current:observed,deadlineMs:cutoff,signal:requestSignal}){
   const selected=observed.selectedClientId;
   const subject={kind:selected===null?'personal':'client',entityType:selected===null?'user':'client',entityIds:[selected??binding.actorId],
    tenantId:binding.tenantId,actorId:binding.actorId,policyRevision:observed.policyRevision,scopes:observed.scopes,rosterVersionId:null};
   if(entry.contract.binding.group==='mail'){try{
    let mailboxes;
    if(readSource){
     const rows=await readSource({operation:'job.readMailboxes',input:{},context:{binding,subject,policyRevision:observed.policyRevision,normalizationContext:null},deadlineMs:cutoff,signal:requestSignal});
     if(!Array.isArray(rows)||rows.length>4096||rows.some(row=>!row||row.tenantId!==binding.tenantId||row.createdByUserId!==binding.actorId||typeof row.id!=='string'))deny('ACCESS_DENIED');
     mailboxes=rows.filter(row=>['microsoft_365','google_workspace'].includes(row.provider));
    }else{
     const bearer=await nativeCredential({binding,operation:entry.descriptor.operation,signal:requestSignal,deadlineMs:cutoff});
     mailboxes=await coreAuthority.readMailboxes({credential:bearer.credential,signal:requestSignal,deadlineMs:Math.min(cutoff,bearer.expiresAtMs)});
    }
    if(mailboxes.length===0)throw new GatewayDenied('UNAVAILABLE');
    subject.scopes=[...observed.scopes,...mailboxes.map(({id})=>({tenantId:binding.tenantId,kind:'mailbox',resourceId:id,policyRevision:observed.policyRevision}))];
   }catch(error){if(error instanceof GatewayDenied)throw error;throw new GatewayDenied(nativeReadFailureCode(error)??'UNAVAILABLE');}}
   return {binding,subject,executionSha256:observed.executionSha256,policyRevision:observed.policyRevision,scopes:observed.scopes,
    sourceIds:[...new Set(entry.descriptor.sourceRequirements.map(source=>source.sourceId))],deadlineMs:Math.min(cutoff,observed.execution.expiresAtMs),maxOutputBytes:approvedReads.maxResponseBytes};
  }
  async function readAvailability({signal:requestSignal}={}){
   const observed=await current();
   const policy=await capabilityPolicy.forRun({tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,signal:requestSignal??signal});
   const visible=policy?.generalReads===true&&Array.isArray(policy.readFamilies)?operations.filter(op=>policy.readFamilies.includes(resolveOperationContract(op).binding.group)):[];
   const at=now(),expiresAtMs=observed.execution.expiresAtMs;
   return {installation:{installationId,baseCatalogSha256,executionCatalogSha256,operations,checkedAtMs:at,expiresAtMs},
    discovery:{binding,policyRevision:observed.policyRevision,operations:visible,checkedAtMs:at,expiresAtMs}};
  }
  const dispatchCurrent=async()=>{try{return await current();}catch(error){throw new GatewayDenied(nativeReadFailureCode(error)??'UNAVAILABLE');}};
  const memoryContextPorts=familyIds.includes('memory-proposals')?memoryContexts?.forTask({binding,clientId:initial.selectedClientId,policyRevision:initial.policyRevision,expiresAtMs:initial.execution.expiresAtMs,signal}):undefined;
  const mailContextPorts=familyIds.includes('mail')?memoryContexts?.forMail({binding,clientId:initial.selectedClientId,policyRevision:initial.policyRevision,expiresAtMs:initial.execution.expiresAtMs,signal}):undefined;
  const dispatch=createToolDispatch({catalog:{entry:op=>entries.get(key(op))??null},current:dispatchCurrent,contextFor,
   limits:{maxRequestMs:Math.min(approvedReads.maxExecuteMs,Math.max(1,deadlineMs-now())),maxRequestBytes:approvedReads.maxRequestBytes,maxResponseBytes:approvedReads.maxResponseBytes},
   now,newId,sourceEnabled:true,nativeReadContextPorts:credentials.nativeReadContextPorts,...(memoryContextPorts?{memoryContextPorts}:{}),...(mailContextPorts?{mailContextPorts}:{}),...(defaultCongress===undefined?{}:{defaultCongress})});
  return Object.freeze({readAvailability,execute:({operation,arguments:args,signal:requestSignal})=>{
   if(!approved.has(key(operation)))deny('UNAVAILABLE');
   return dispatch.execute(JSON.stringify({operation,arguments:args}),requestSignal);
  }});
 }
 return Object.freeze({createGateway,missing:familyIds.filter(id=>!NATIVE_READ_FAMILIES.includes(id)&&!ORDINARY_FAMILIES.has(id)&&id!=='dataset-metadata')});
}
