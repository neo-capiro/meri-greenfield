/** Core-only readback of the actual accepted job and native SDK result. Core owns current access and effect consent. */
import {own,data,hash,assertTypedResult,assertTypedSelection,typedCheckpointObject,assertTypedResultBytes,typedFault} from '../../../packages/runtime/objective-generation-custody.mjs';
import {nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {assertObjectiveRunStartRecord,objectiveAcceptedRequest} from '../objective-source/run-starts.mjs';

const refuse=()=>{throw typedFault();},same=(a,b)=>hash(a)===hash(b);
export const MAX_OBJECTIVE_READBACK_BYTES=8*1024*1024;

export function createObjectiveGenerationReadback(configuration){
 const c=own(configuration,['runStarts','store','objects','retention'],['now','maxRequestMs']),now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000;
 const readStart=storageMethod(c.runStarts,'readByJob'),readRun=storageMethod(c.store,'read'),readCompletion=storageMethod(c.store.completions,'read'),
  readSession=storageMethod(c.store.lifecycle,'readSessionCapture'),get=storageMethod(c.objects,'get'),servable=storageMethod(c.retention,'assertServable');
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)refuse();
 function input(value,completion){
  const v=own(value,['schemaVersion','generationJobId','sourceAdmissionSha256',...(completion?['binding']:[])],['signal']);nativeSignal(v.signal);
  if(v.schemaVersion!==1||typeof v.generationJobId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(v.generationJobId)||
   typeof v.sourceAdmissionSha256!=='string'||!/^[a-f0-9]{64}$/u.test(v.sourceAdmissionSha256))refuse();
  if(completion)validateShape('RunBinding',v.binding);return v;
 }
 async function accepted(v,life){
  const saved=data(await life.run(signal=>readStart({generationJobId:v.generationJobId,signal})));own(saved,['state','record']);
  if(saved.state!=='STARTED')refuse();const record=assertObjectiveRunStartRecord(saved.record),binding=record.binding;
  if(record.generationJobId!==v.generationJobId||record.sourceAdmissionSha256!==v.sourceAdmissionSha256||v.binding!==undefined&&!same(v.binding,binding))refuse();
  await life.run(()=>servable({tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId}));life.check();
  const current=await life.run(()=>readRun(binding,{},life.check)),run=data(current.run),request=data(current.request);validateShape('Run',run);
  if(!same(run.binding,binding)||!same(request,objectiveAcceptedRequest(record.selection))||hash(request)!==record.sourceRequestSha256)refuse();
  assertNativeConversationScope({binding,scopes:run.scopes,selectedClientId:record.selection.sourceAdmission.canonical.clientId});life.check();
  return data({schemaVersion:1,record,request,run});
 }
 async function acceptance(value){
  const v=input(value,false),life=createOperationLifetime({now,signal:v.signal,deadlineMs:now()+maxRequestMs,errorFactory:typedFault});
  try{return await accepted(v,life);}finally{life.close();}
 }
 async function completion(value){
  const v=input(value,true),life=createOperationLifetime({now,signal:v.signal,deadlineMs:now()+maxRequestMs,errorFactory:typedFault});
  try{
   const a=await accepted(v,life),{record,run,request}=a,binding=record.binding,selectedClientId=record.selection.sourceAdmission.canonical.clientId;
   const query={binding,scopes:run.scopes,selectedClientId};
   const p=data(await life.run(()=>readCompletion(query,life.check)));life.check();
   if(run.state!=='completed'||p.state!=='PUBLISHED'||p.kind!=='native-session'||p.proof?.kind!=='native-session'||
    p.completionId!==binding.runId||p.checkpointId!==binding.runId||!same(p.binding,binding)||!same(p.scopes,run.scopes)||
    !same(p.versions,run.versions)||!same(p.sourceRequest,request)||p.sourceRequestSha256!==record.sourceRequestSha256)refuse();
   const d=assertTypedResult(p.typedResult,{binding,sourceRequestSha256:record.sourceRequestSha256}),s=assertTypedSelection(p.typedSelection,d,{binding,acceptedRequest:request});
   if(d.sourceAdmissionSha256!==record.sourceAdmissionSha256||d.typedRequestSha256!==record.typedRequestSha256||d.resultRef!==binding.runId||
    d.execution.receiptRef!==binding.runId||!same(s.strategy.request,record.selection.request)||!same(s.strategy.executionContext,record.selection.executionContext)||
    s.strategy.queuedType!==record.selection.queuedType)refuse();
   // The journal owns settled execution and committed capture. A worker-selected locator is never accepted.
   const capture=data(await life.run(()=>readSession({...query,checkpointId:binding.runId},life.check)));life.check();
   if(!same(capture.proof,p.proof))refuse();const object=typedCheckpointObject(p.proof,d);
   const bytes=assertTypedResultBytes(await life.run(signal=>get(object,signal)),d);life.check();
   const again=await accepted(v,life),latest=data(await life.run(()=>readCompletion(query,life.check)));
   if(!same(again,a)||!same(latest,p))refuse();
   const out=data({...a,completion:p,file:{path:d.path,object,base64:bytes.toString('base64')}});
   if(Buffer.byteLength(JSON.stringify(out))>MAX_OBJECTIVE_READBACK_BYTES)refuse();life.check();return out;
  }finally{life.close();}
 }
 return Object.freeze({acceptance,completion});
}
