/** Exact native document recovery. The existing delivery journal never grants generation twice. */
import {officeEditSource,officeEditRequestSha256,officeOriginalSource,officeOriginalRequestSha256} from '../../packages/contracts/office-edit.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
export const recoverArtifact=(owner,baseVersionId,request,context,options)=>recover(owner,baseVersionId,request,context,options,false);
export const recoverOfficeEdit=(owner,baseVersionId,request,context,options)=>recover(owner,baseVersionId,request,context,options,true);
export const recoverOfficeOriginal=(owner,request,context,options)=>recover(owner,null,request,context,options,false,true);
async function recover(owner,baseVersionId,requestValue,contextValue,{signal,evidence}={},office=false,original=false){
 const {v,operation,authority,scopeVersion,bytesFor,inspectBytes,versions,servable=async()=>{},recoverTenant=async()=>{}}=owner;
 const request=original?officeOriginalSource(requestValue):office?officeEditSource(requestValue):v.request(requestValue),context=v.context(contextValue),requestSha256=office||original?evidence?.requestSha256:v.nativeRequestSha256(request,context,baseVersionId),life=operation(context,signal);
 let verified=false;
 try{
  if(!evidence||Object.keys(evidence).sort().join()!=='invocationId,requestSha256,versionId'||!/^sdk:[a-f0-9]{64}$/u.test(evidence.invocationId)||!uuid.test(evidence.versionId)||!/^[a-f0-9]{64}$/u.test(requestSha256)||evidence.requestSha256!==requestSha256||request.format==='sandbox'||context.analysisAdmission)fail('ARTIFACT_REPLAY_EVIDENCE');
  if(office)officeEditRequestSha256(v,request,context,baseVersionId);
  if(original)officeOriginalRequestSha256(v,request,context);
  const action=baseVersionId===null?'artifact.generate':'artifact.revise',resource={versionId:baseVersionId,object:null,assetObjects:context.assets.map(a=>a.object)};
  await authority(life,action,resource,requestSha256,context);await servable(life,context);await recoverTenant(life,context,evidence.versionId);
  const candidate=await life.run(signal=>versions.read({kind:'artifact-replay',versionId:evidence.versionId,requestSha256,resultSha256:null},signal));
  const record=scopeVersion(candidate,evidence.versionId,context);
  if(record.requestSha256!==requestSha256||record.specSha256!==v.hash(request)||record.version.parentVersionId!==baseVersionId||!office&&!original&&v.hash(record.version.binding)!==v.hash(context.binding)||v.hash(record.version.evidence)!==v.hash(context.evidence))fail('ARTIFACT_REPLAY_EVIDENCE');
  // A reconnect may renew the run, never the saved source or original request.
  // Scope/actor/conversation were checked by scopeVersion; use the immutable
  // historical binding to verify the journal's original request hash exactly.
  if(office&&officeEditRequestSha256(v,request,{...context,binding:record.version.binding},baseVersionId)!==requestSha256)fail('ARTIFACT_REPLAY_EVIDENCE');
  if(original&&officeOriginalRequestSha256(v,request,{...context,binding:record.version.binding})!==requestSha256)fail('ARTIFACT_REPLAY_EVIDENCE');
  await authority(life,action,{...resource,object:record.version.object},requestSha256,context);await servable(life,context,record);
  const bytes=await bytesFor(life,record.version.object,context.maxBytes),inspection=inspectBytes(record.inspection,bytes,request.format,request);verified=true;
  const receipt=await authority(life,action,{...resource,object:record.version.object},requestSha256,context);await servable(life,context,record);
  return {version:record.version,inspection,execution:{kind:'native-document',invocationId:evidence.invocationId,requestSha256,authorizationReceiptId:receipt.receiptId,objectCommitted:true,versionCommitted:true,nativeQualified:false}};
 }catch(cause){throw Object.assign(new Error('ARTIFACT_REPLAY_UNRESOLVED'),{code:'ARTIFACT_REPLAY_UNRESOLVED',cause,versionId:evidence?.versionId??null,versionCommitted:verified,lifetime:life.close()});}
 finally{life.close();}
}
