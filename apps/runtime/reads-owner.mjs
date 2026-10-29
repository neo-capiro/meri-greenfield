/** Control's typed read boundary. Execution identity is local; Core owns data access. */
import catalog from '../../packages/contracts/retrieval-0.3/catalog.json' with {type:'json'};
import {resolveOperationContract} from '../../packages/contracts/retrieval-0.2/validate.mjs';
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../packages/contracts/validate.mjs';
import {NATIVE_READS_SCHEMA_VERSION as schemaVersion,assertNativeReadConfiguration,assertNativeReadRequest,assertNativeReadResponse,assertNativeReadSnapshot,nativeReadFault,nativeReadFailureCode} from '../../packages/contracts/runtime-0.2/reads.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {assertExecutionIdentity} from '../control/conversations/execution-boundary.mjs';
import {productFailure} from '../control/product-access/errors.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {safeFailure} from '../gateway/dispatch/operation-result.mjs';
import {READ_FAMILIES} from '../worker/conversation/reads/families.mjs';

const same=(a,b)=>hash(a)===hash(b),deny=code=>{throw nativeReadFault(code);};
const stableSnapshot=s=>({installation:{...s.installation,checkedAtMs:0,expiresAtMs:0},discovery:{...s.discovery,checkedAtMs:0,expiresAtMs:0}});
const deferred=new Set(catalog.originals.filter(o=>o.disposition==='deferred').map(o=>o.id));
const unavailable=new Set(['STORE_UNAVAILABLE','STORE_COMMIT_UNKNOWN','STORE_RELEASE_UNKNOWN','EXECUTION_STORE_UNAVAILABLE','EXECUTION_STORE_COMMIT_UNKNOWN']);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(value);

export function createReadsOwner(configuration){
 const c=own(configuration,['binding','execution','createGateway'],['approvedReads','now','captureSource','assertReadArguments']);
 const binding=data(c.binding),config=c.approvedReads===undefined?undefined:assertNativeReadConfiguration(c.approvedReads),now=c.now??Date.now;
 validateShape('RunBinding',binding);
 if(typeof now!=='function'||typeof c.createGateway!=='function'||c.captureSource!==undefined&&typeof c.captureSource!=='function'||c.assertReadArguments!==undefined&&typeof c.assertReadArguments!=='function')deny('CONFIGURATION');
 const authenticate=storageMethod(c.execution,'authenticate');
 async function handle(operation,raw,credential,signal,operationDeadlineMs,onPublicationStart){let life,publicationStarted=false,publicationSettled=false;try{
  if(!config?.enabled)deny('UNAVAILABLE');nativeSignal(signal);
  const op='runner/reads/'+operation,request=assertNativeReadRequest(op,raw),inputSha256=hash(request),started=now();
  if(!same(request.binding,binding))deny('ACCESS_DENIED');
  if(Buffer.byteLength(JSON.stringify(request),'utf8')>config.maxRequestBytes)deny('RESOURCE_LIMIT');
  if(operationDeadlineMs!==undefined&&!Number.isSafeInteger(operationDeadlineMs))deny('INVALID_ARGUMENTS');
  const deadlineMs=Math.min(operationDeadlineMs??Infinity,started+(operation==='execute'?config.maxExecuteMs:3000));
  life=createOperationLifetime({now,deadlineMs,signal,errorFactory:nativeReadFault});
  let pinned;
  async function current(){
   let observation;
   try{observation=await life.run(signal=>authenticate({credential,binding,signal}));}
   catch(error){life.check();const code=productFailure(error)?.code??error?.code;deny(unavailable.has(code)?'UNAVAILABLE':'ACCESS_DENIED');}
   let value;
   try{
    const v=data(observation),identity=assertExecutionIdentity(v.execution);
    if(!same(identity.binding,binding)||!['queued','starting','running'].includes(v.state)||
     typeof v.policyRevision!=='string'||!v.policyRevision||!Array.isArray(v.scopes)||!v.scopes.length||
     v.selectedClientId!==null&&!uuid(v.selectedClientId))deny('ACCESS_DENIED');
    for(const scope of v.scopes){validateShape('Scope',scope);if(scope.tenantId!==binding.tenantId||scope.policyRevision!==v.policyRevision)deny('ACCESS_DENIED');}
    if(v.selectedClientId!==null&&!v.scopes.some(scope=>scope.kind==='client'&&scope.resourceId===v.selectedClientId))deny('ACCESS_DENIED');
    value={execution:identity,executionSha256:hash(identity),scopes:v.scopes,policyRevision:v.policyRevision,selectedClientId:v.selectedClientId};
   }catch{deny('ACCESS_DENIED');}
   if(pinned&&!same(value,pinned))deny('ACCESS_DENIED');
   pinned??=value;life.limitDeadline(value.execution.expiresAtMs);life.check();return value;
  }
  await current();
  const gateway=await life.run(signal=>c.createGateway({binding,credential,current,approvedReads:config,signal,deadlineMs:Math.min(deadlineMs,pinned.execution.expiresAtMs)}));
  const availability=storageMethod(gateway,'readAvailability'),execute=storageMethod(gateway,'execute');
  async function snapshot(){
   const s=assertNativeReadSnapshot(await life.run(signal=>availability({signal})),{binding,policyRevision:pinned.policyRevision,now});
   if(s.installation.baseCatalogSha256!==hash(catalog))deny('UNAVAILABLE');
   life.limitDeadline(Math.min(s.installation.expiresAtMs,s.discovery.expiresAtMs));return s;
  }
  function eligible(s){
   const installed=new Set(s.installation.operations.map(hash)),discovered=new Set(s.discovery.operations.map(hash));
   return config.operations.filter(op=>{const {descriptor,binding:contract}=resolveOperationContract(op),family=READ_FAMILIES[contract?.group];
    return family&&(!family.operationIds||family.operationIds.includes(op.id))&&descriptor.sideEffect==='none'&&descriptor.approvalBoundary==='none'&&
     !deferred.has(op.id)&&!deferred.has(op.id.replaceAll('.','_'))&&installed.has(hash(op))&&discovered.has(hash(op))&&
     (pinned.selectedClientId!==null||family.clientScope!=='required'&&!family.requiredClientOperations?.includes(op.id));});
  }
  const before=await snapshot();let result;
  if(operation==='execute'){
   if(request.installationId!==before.installation.installationId||request.executionCatalogSha256!==before.installation.executionCatalogSha256||!eligible(before).some(op=>same(op,request.operation)))deny('UNAVAILABLE');
   await current();if(c.assertReadArguments)await life.run(signal=>c.assertReadArguments({request,current:pinned,signal,check:life.check}));
   result=await life.run(signal=>execute({operation:request.operation,arguments:request.arguments,deliveryId:request.deliveryId,signal}));
   if(typeof result!=='string'||Buffer.byteLength(result,'utf8')>config.maxResponseBytes)deny('INVALID_RESULT');
  }
  await current();const after=await snapshot();
  if(!same(stableSnapshot(before),stableSnapshot(after)))deny('UNAVAILABLE');
  await current();life.check();
  const common={schemaVersion,binding,inputSha256,policyRevision:pinned.policyRevision,executionSha256:pinned.executionSha256,checkedAtMs:now(),
   expiresAtMs:Math.min(pinned.execution.expiresAtMs,after.installation.expiresAtMs,after.discovery.expiresAtMs)};
  const response=operation==='execute'?{...common,operation:request.operation,deliveryId:request.deliveryId,installationId:request.installationId,
   executionCatalogSha256:request.executionCatalogSha256,resultJson:result,resultSha256:hash(data(JSON.parse(result))),outputBytes:Buffer.byteLength(result,'utf8')}:
   {...common,installation:{...after.installation,operations:eligible(after)},discovery:{...after.discovery,operations:eligible(after)}};
  const validated=assertNativeReadResponse(op,response,{request,started,now,policyRevision:pinned.policyRevision,executionSha256:pinned.executionSha256,maxResponseBytes:config.maxResponseBytes});
  if(operation==='execute'&&c.captureSource){await life.run(signal=>c.captureSource({request,response:validated,scopes:pinned.scopes,signal,check:life.check,onPublicationStart:()=>{publicationStarted=true;onPublicationStart?.();}}));publicationSettled=true;if(publicationStarted)await current();life.check();}
  return validated;
 }catch(error){const code=nativeReadFailureCode(error);
  // A deadline cannot turn a potentially committed reference into a definite failure.
  if(code==='SOURCE_PUBLICATION_UNKNOWN'||publicationStarted&&!publicationSettled&&life?.signal.aborted)throw nativeReadFault('SOURCE_PUBLICATION_UNKNOWN');
  life?.check();const gateway=safeFailure(error).message;throw nativeReadFault(code??(gateway!=='INTERNAL_ERROR'?gateway:'UNAVAILABLE'));}finally{life?.close();}}
 return Object.freeze({handle});
}
