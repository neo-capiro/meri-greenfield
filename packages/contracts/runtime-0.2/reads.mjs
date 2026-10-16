/** Additive private native READS wire. Data and validation only; no authority issuance. */
import {own,data} from '../commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../validate.mjs';
import {validateShape as readShape,resolveOperationContract} from '../retrieval-0.2/validate.mjs';
export const NATIVE_READS_SCHEMA_VERSION='meri-native-general-reads/1';
export const nativeReadOperations=Object.freeze(['runner/reads/availability','runner/reads/execute']);
const DIGEST=/^[a-f0-9]{64}$/u,UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const codes=new Set(['CONFIGURATION','INVALID_ARGUMENTS','ACCESS_DENIED','UNAVAILABLE','DEADLINE','CANCELLED','INVALID_RESULT','RESOURCE_LIMIT','BUDGET_UNCERTAIN']);
const failures=new WeakMap();
export function nativeReadFault(code){const safe=codes.has(code)?code:'UNAVAILABLE',error=Object.assign(Error(safe),{code:safe});failures.set(error,safe);return error;}
export const nativeReadFailureCode=error=>error!==null&&typeof error==='object'?failures.get(error):undefined;
const fail=code=>{throw nativeReadFault(code);};
const digest=v=>typeof v==='string'&&DIGEST.test(v),uuid=v=>typeof v==='string'&&UUID.test(v);
const same=(a,b)=>hash(a)===hash(b),integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
function operations(value){if(!Array.isArray(value)||value.length>128)fail('INVALID_ARGUMENTS');const seen=new Set();for(const op of value){readShape('OperationRef',op);const key=hash(op);if(seen.has(key))fail('INVALID_ARGUMENTS');seen.add(key);}return value;}
function scopes(value,binding,policy){if(!Array.isArray(value)||!value.length||value.length>100)fail('ACCESS_DENIED');const seen=new Set();for(const s of value){validateShape('Scope',s);if(s.tenantId!==binding.tenantId||s.policyRevision!==policy||seen.has(hash(s)))fail('ACCESS_DENIED');seen.add(hash(s));}}
function clocks(v,{started=0,now}){const at=now();if(!integer(v.checkedAtMs,started,at)||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=at||v.expiresAtMs<=v.checkedAtMs)fail('ACCESS_DENIED');}
function version(v){if(v.schemaVersion!==NATIVE_READS_SCHEMA_VERSION)fail('INVALID_ARGUMENTS');}
export function assertNativeReadConfiguration(raw){try{const v=data(raw);own(v,['schemaVersion','enabled','operations','maxExecuteMs','maxRequestBytes','maxResponseBytes']);version(v);operations(v.operations);
 for(const op of v.operations){const {descriptor}=resolveOperationContract(op);if(!descriptor||descriptor.sideEffect!=='none'||descriptor.approvalBoundary!=='none')fail('CONFIGURATION');}
 if(typeof v.enabled!=='boolean'||v.enabled&&v.operations.length===0||!integer(v.maxExecuteMs,1,30000)||!integer(v.maxRequestBytes,1,2097152)||!integer(v.maxResponseBytes,1,16777216))fail('CONFIGURATION');return v;
 }catch{throw nativeReadFault('CONFIGURATION');}}
export const nativeReadConfigurationSha256=raw=>hash(assertNativeReadConfiguration(raw));
export function assertNativeReadRequest(operation,raw){try{const v=data(raw);if(!nativeReadOperations.includes(operation))fail('INVALID_ARGUMENTS');
 own(v,['schemaVersion','binding',...(operation.endsWith('/execute')?['operation','arguments','deliveryId','installationId','executionCatalogSha256']:[])]);version(v);validateShape('RunBinding',v.binding);
 if(operation.endsWith('/execute')){readShape('OperationRef',v.operation);own(v.arguments,Object.keys(v.arguments??{}));if(typeof v.deliveryId!=='string'||!/^[-A-Za-z0-9_.:@/]{1,255}$/u.test(v.deliveryId)||!uuid(v.installationId)||!digest(v.executionCatalogSha256))fail('INVALID_ARGUMENTS');}
 if(Buffer.byteLength(JSON.stringify(v),'utf8')>2097152)fail('RESOURCE_LIMIT');return v;
 }catch(error){throw nativeReadFault(nativeReadFailureCode(error)??'INVALID_ARGUMENTS');}}
export function assertNativeReadTaskAssertion(raw,{binding,operation,inputSha256,started,now}){try{const v=data(raw);own(v,['schemaVersion','binding','operation','inputSha256','runRequestSha256','grantId','taskArn','issuanceFactsSha256','allocationSha256','scopes','policyRevision','authorizationDecisionId','checkedAtMs','expiresAtMs']);version(v);validateShape('RunBinding',v.binding);
 if(!same(v.binding,binding)||!nativeReadOperations.includes(operation)||v.operation!==operation||v.inputSha256!==inputSha256||![v.inputSha256,v.runRequestSha256,v.issuanceFactsSha256,v.allocationSha256,v.authorizationDecisionId].every(digest)||!uuid(v.grantId)||typeof v.taskArn!=='string'||!/^arn:aws:ecs:[a-z0-9-]+:[0-9]{12}:task\/[A-Za-z0-9_/-]{1,256}$/u.test(v.taskArn)||typeof v.policyRevision!=='string'||!v.policyRevision||v.policyRevision.length>255)fail('ACCESS_DENIED');scopes(v.scopes,binding,v.policyRevision);clocks(v,{started,now});return v;
 }catch{throw nativeReadFault('ACCESS_DENIED');}}
export function assertNativeReadSnapshot(raw,{binding,policyRevision,now}){try{const v=data(raw);own(v,['installation','discovery']);const i=own(v.installation,['installationId','baseCatalogSha256','executionCatalogSha256','operations','checkedAtMs','expiresAtMs']),d=own(v.discovery,['binding','policyRevision','operations','checkedAtMs','expiresAtMs']);
 validateShape('RunBinding',d.binding);if(!uuid(i.installationId)||!digest(i.baseCatalogSha256)||!digest(i.executionCatalogSha256)||!same(d.binding,binding)||d.policyRevision!==policyRevision)fail('UNAVAILABLE');operations(i.operations);operations(d.operations);clocks(i,{now});clocks(d,{now});return v;
 }catch{throw nativeReadFault('UNAVAILABLE');}}
export function assertNativeReadResponse(operation,raw,{request,started,now,policyRevision,allocationSha256,maxResponseBytes=16777216}){try{const v=data(raw),execute=operation==='runner/reads/execute';if(!nativeReadOperations.includes(operation))fail('INVALID_RESULT');
 own(v,['schemaVersion','binding','inputSha256','policyRevision','allocationSha256','checkedAtMs','expiresAtMs',...(execute?['operation','deliveryId','installationId','executionCatalogSha256','resultJson','resultSha256','outputBytes']:['installation','discovery'])]);version(v);validateShape('RunBinding',v.binding);
 if(!same(v.binding,request.binding)||v.inputSha256!==hash(request)||!digest(v.allocationSha256)||typeof v.policyRevision!=='string'||!v.policyRevision||v.policyRevision.length>255||policyRevision!==undefined&&v.policyRevision!==policyRevision||allocationSha256!==undefined&&v.allocationSha256!==allocationSha256||Buffer.byteLength(JSON.stringify(v),'utf8')>maxResponseBytes)fail('INVALID_RESULT');clocks(v,{started,now});
 if(execute){if(!same(v.operation,request.operation)||v.deliveryId!==request.deliveryId||v.installationId!==request.installationId||v.executionCatalogSha256!==request.executionCatalogSha256||typeof v.resultJson!=='string'||!integer(v.outputBytes,0,maxResponseBytes)||Buffer.byteLength(v.resultJson,'utf8')!==v.outputBytes||!digest(v.resultSha256)||hash(data(JSON.parse(v.resultJson)))!==v.resultSha256)fail('INVALID_RESULT');}
 else{const s=assertNativeReadSnapshot({installation:v.installation,discovery:v.discovery},{binding:request.binding,policyRevision:v.policyRevision,now});if(v.expiresAtMs>Math.min(s.installation.expiresAtMs,s.discovery.expiresAtMs))fail('INVALID_RESULT');}return v;
 }catch(error){throw nativeReadFault(nativeReadFailureCode(error)==='RESOURCE_LIMIT'?'RESOURCE_LIMIT':'INVALID_RESULT');}}
