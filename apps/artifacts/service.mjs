import {createHash} from 'node:crypto';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {recoverArtifact} from './recovery.mjs';
import {ARTIFACT_MIME_TYPES as mime,artifactFilename as filenameFor} from '../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const closed=(value,keys)=>{if(!value||Array.isArray(value)||Object.keys(value).sort().join()!==keys.sort().join())fail('ARTIFACT_PORT_SHAPE');};
export function createArtifactService({validators:v,authorize,versions,objects,executor,now,ids,retention,admitRetainedEvidence}){
  if(admitRetainedEvidence!==undefined&&typeof admitRetainedEvidence!=='function')fail('ARTIFACT_CONFIGURATION');
  if(![authorize,now,ids,versions?.read,versions?.commit,objects?.put,objects?.get,executor?.execute].every(x=>typeof x==='function')||retention!==undefined&&typeof retention?.assertServable!=='function'||versions?.recoverTenant!==undefined&&typeof versions.recoverTenant!=='function')fail('ARTIFACT_CONFIGURATION');
  const same=(a,b)=>v.hash(a)===v.hash(b);
  // The canonical retention read gate: the conversation the caller is bound to, and, once a trusted scoped record resolved the version,
  // the artifact and the conversation that version belongs to. Consulted before object bytes are read and again before release; its
  // refusals keep their own codes (RETENTION_SUPPRESSED, RETENTION_RECOVERY_BARRIER, RETENTION_READ_UNAVAILABLE).
  async function servable(life,context,record=null){if(!retention)return;
    const subjects=[{tenantId:context.binding.tenantId,kind:'conversation',subjectId:context.binding.conversationId}];
    if(record){const b=record.version.binding;if(b.conversationId!==context.binding.conversationId)subjects.push({tenantId:b.tenantId,kind:'conversation',subjectId:b.conversationId});subjects.push({tenantId:b.tenantId,kind:'artifact',subjectId:record.version.artifactId});}
    for(const subject of subjects)await life.run(()=>retention.assertServable(subject));life.check();}
  async function recoverTenant(life,context){if(versions.recoverTenant)await life.run(signal=>versions.recoverTenant(context.binding.tenantId,signal));life.check();}
  function scopeVersion(record,id,context){
    closed(record,['version','spec','specSha256','requestSha256','inspection']);record=v.snapshot(record);record.version=v.version(record.version);record.spec=v.request(record.spec);
    if(record.version.versionId!==id||record.version.binding.tenantId!==context.binding.tenantId||record.version.binding.actorId!==context.binding.actorId||record.version.binding.conversationId!==context.binding.conversationId||!same(record.version.scopes,context.scopes)||!same(record.version.object.scopes,record.version.scopes)||record.specSha256!==v.hash(record.spec))fail('ARTIFACT_VERSION_CONTEXT');
    if(record.version.mimeType!==mime[record.spec.format]||record.version.filename!==filenameFor(record.spec)||record.version.generationStatus!=='draft'||record.version.previewStatus!=='pending')fail('ARTIFACT_VERSION_METADATA');
    return record;
  }
  function inspectBytes(value,bytes,format){
    let inspection;try{inspection=v.inspection(value);}catch(cause){throw Object.assign(new Error('ARTIFACT_INSPECTION_MISMATCH'),{code:'ARTIFACT_INSPECTION_MISMATCH',cause});}closed(inspection,['sha256','bytes','format','nativeOpened','rendered','recalculated','members','details']);
    if(inspection.sha256!==sha(bytes)||inspection.bytes!==bytes.length||inspection.format!==format||inspection.nativeOpened!==false||inspection.rendered!==false||inspection.recalculated!==false||!Array.isArray(inspection.members)||!inspection.members.every(x=>typeof x==='string')||!inspection.details||typeof inspection.details!=='object'||Array.isArray(inspection.details))fail('ARTIFACT_INSPECTION_MISMATCH');return inspection;
  }
  function operation(context,signal){return createOperationLifetime({deadlineMs:context.deadlineMs,now,signal,errorFactory:code=>Object.assign(new Error(code),{code:'ARTIFACT_'+code})});}
  async function authority(life,action,resource,requestSha256,context){
    const receipt=v.snapshot(await life.run(signal=>authorize({action,resource:v.snapshot(resource),requestSha256,binding:v.snapshot(context.binding),scopes:v.snapshot(context.scopes),deadlineMs:context.deadlineMs,signal})));
    closed(receipt,['receiptId','decision','action','binding','scopesSha256','resourceSha256','requestSha256','expiresAtMs']);
    if(typeof receipt.receiptId!=='string'||!receipt.receiptId||receipt.decision!=='allow'||receipt.action!==action||!same(receipt.binding,context.binding)||receipt.scopesSha256!==v.hash(context.scopes)||receipt.resourceSha256!==v.hash(resource)||receipt.requestSha256!==requestSha256||!Number.isSafeInteger(receipt.expiresAtMs)||receipt.expiresAtMs<=now())fail('ARTIFACT_AUTHORITY');
    life.limitDeadline(receipt.expiresAtMs);return receipt;
  }
  async function bytesFor(life,object,maxBytes){
    const bytes=await life.run(signal=>objects.get(v.snapshot(object),signal));
    if(!Buffer.isBuffer(bytes)||bytes.length!==object.bytes||bytes.length>maxBytes||sha(bytes)!==object.sha256)fail('ARTIFACT_OBJECT_MISMATCH');return Buffer.from(bytes);
  }
  async function generate(baseVersionId,requestValue,contextValue,{signal,invocation}={}){
    const request=v.request(requestValue),context=v.context(contextValue);
    if(request.format==='sandbox')fail('ANALYSIS_SANDBOX_DISPATCH_REQUIRED');
    if(context.analysisAdmission)fail('IRRELEVANT_ANALYSIS_ADMISSION');
    // Stored historical evidence remains readable; new native writes require current run-bound evidence.
    const retained=context.evidence.map(v.nativeSourceEvidence).some(e=>!same(e.binding,context.binding));
    if(retained&&(typeof admitRetainedEvidence!=='function'||admitRetainedEvidence(v.snapshot(context))!==undefined))fail('ARTIFACT_EVIDENCE_BINDING');
    const requestSha256=v.nativeRequestSha256(request,context,baseVersionId),allocation=v.snapshot(ids());
    closed(invocation,['invocationId','versionId','requestSha256']);
    if(!/^sdk:[a-f0-9]{64}$/u.test(invocation.invocationId)||invocation.requestSha256!==requestSha256)fail('ARTIFACT_INVOCATION');
    const versionId=invocation.versionId;
    closed(allocation,['artifactId','versionId','objectId']);
    for(const id of Object.values(allocation))if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))fail('ARTIFACT_ID');
    if(versionId!==undefined){if(typeof versionId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(versionId))fail('ARTIFACT_ID');allocation.versionId=versionId;}
    const life=operation(context,signal);
    let executionStarted=false,writeStarted=false,versionCommitted=false,readBase=null,baseBytes=null,receipt;
    const action=baseVersionId===null?'artifact.generate':'artifact.revise';
    let resource={versionId:baseVersionId,object:null,assetObjects:context.assets.map(a=>a.object)};
    try{
      receipt=await authority(life,action,resource,requestSha256,context);await servable(life,context);await recoverTenant(life,context);
      if(baseVersionId!==null){
        readBase=scopeVersion(await life.run(signal=>versions.read(baseVersionId,signal)),baseVersionId,context);
        if(readBase.spec.operation!==request.operation||readBase.spec.format!==request.format)fail('ARTIFACT_REVISION_FORMAT');
        // Revision consumes the exact original bytes as well as retained spec; a suppressed base is never read.
        await servable(life,context,readBase);baseBytes=await bytesFor(life,readBase.version.object,context.maxBytes);
        resource={...resource,object:readBase.version.object};receipt=await authority(life,action,resource,requestSha256,context);
      }
      const assets=[];for(const asset of context.assets){const bytes=await bytesFor(life,asset.object,2097152);assets.push({id:asset.id,bytes});}
      receipt=await authority(life,action,resource,requestSha256,context);await servable(life,context,readBase);
      executionStarted=true;
      const result=await life.run(signal=>executor.execute({request:v.snapshot(request),assets,base:readBase?{request:v.snapshot(readBase.spec),bytes:Buffer.from(baseBytes)}:null,deadlineMs:Math.min(context.deadlineMs,receipt.expiresAtMs),maxBytes:context.maxBytes,signal}));
      if(!Buffer.isBuffer(result.bytes)||result.bytes.length>context.maxBytes)fail('ARTIFACT_OUTPUT_LIMIT');
      const bytes=Buffer.from(result.bytes),inspection=inspectBytes(result.inspection,bytes,request.format);
      receipt=await authority(life,action,resource,requestSha256,context);
      writeStarted=true;
      const object=v.object(await life.run(signal=>objects.put({objectId:allocation.objectId,bytes:Buffer.from(bytes),scopes:v.snapshot(context.scopes),requestSha256},signal)));
      if(object.objectId!==allocation.objectId||object.bytes!==bytes.length||object.sha256!==sha(bytes)||!same(object.scopes,context.scopes))fail('ARTIFACT_OBJECT_MISMATCH');
      await bytesFor(life,object,context.maxBytes);
      receipt=await authority(life,action,resource,requestSha256,context);
      const version=v.version({contractVersion:'0.2.0',artifactId:readBase?.version.artifactId??allocation.artifactId,versionId:allocation.versionId,parentVersionId:baseVersionId,binding:context.binding,object,filename:filenameFor(request),mimeType:mime[request.format],scopes:context.scopes,evidence:context.evidence,generationStatus:'draft',previewStatus:'pending',createdAt:new Date(now()).toISOString()});
      await servable(life,context,{version});
      const publication={authorization:receipt,invocation:{kind:'native-document',versionId:version.versionId,invocationId:invocation.invocationId,binding:v.snapshot(context.binding),requestSha256}};
      const commit=v.snapshot(await life.run(signal=>versions.commit({version:v.snapshot(version),spec:v.snapshot(request),specSha256:v.hash(request),requestSha256,inspection:v.snapshot(inspection),expectedParentVersionId:baseVersionId},signal,publication)));
      closed(commit,['status','versionId','requestSha256','versionSha256']);
      if(!['committed','duplicate'].includes(commit.status)||commit.versionId!==version.versionId||commit.requestSha256!==requestSha256||commit.versionSha256!==v.hash(version))fail('ARTIFACT_COMMIT_RECEIPT');versionCommitted=true;
      receipt=await authority(life,action,{...resource,object},requestSha256,context);await servable(life,context,{version});
      return {version,inspection,execution:{kind:'native-document',invocationId:invocation.invocationId,requestSha256,authorizationReceiptId:receipt.receiptId,objectCommitted:true,versionCommitted:true,nativeQualified:false}};
    }catch(cause){
      const error=executionStarted||writeStarted?Object.assign(new Error('ARTIFACT_EFFECT_UNKNOWN'),{code:'ARTIFACT_EFFECT_UNKNOWN',cause,versionId:allocation.versionId,versionCommitted}):cause;
      error.lifetime=life.close();throw error;
    }finally{life.close();}
  }
  async function read(versionId,contextValue,options={},download=false){
    if(typeof versionId!=='string')fail('ARTIFACT_VERSION_ID');
    const context=v.context(contextValue),life=operation(context,options.signal),action=download?'artifact.download':'artifact.inspect';
    const requestSha256=v.hash({action,versionId,context});let resource={versionId,object:null,assetObjects:[]};
    try{
      await authority(life,action,resource,requestSha256,context);await servable(life,context);await recoverTenant(life,context);
      const record=scopeVersion(await life.run(signal=>versions.read(versionId,signal)),versionId,context);
      resource={...resource,object:record.version.object};await authority(life,action,resource,requestSha256,context);await servable(life,context,record);
      const bytes=await bytesFor(life,record.version.object,context.maxBytes);
      const inspection=inspectBytes(record.inspection,bytes,record.spec.format);
      await authority(life,action,resource,requestSha256,context);await servable(life,context,record);
      return download?{version:record.version,bytes}:{version:record.version,inspection:{...inspection,currentBytesVerified:true}};
    }catch(error){error.lifetime=life.close();throw error;}finally{life.close();}
  }
  return Object.freeze({create:(request,context,options)=>generate(null,request,context,options),revise:(baseVersionId,request,context,options)=>{if(typeof baseVersionId!=='string')fail('ARTIFACT_VERSION_ID');return generate(baseVersionId,request,context,options);},
    recover:(baseVersionId,request,context,options)=>recoverArtifact({v,operation,authority,scopeVersion,bytesFor,inspectBytes,versions,servable,recoverTenant},baseVersionId,request,context,options),
    inspect:(id,context,options)=>read(id,context,options),download:(id,context,options)=>read(id,context,options,true)});
}
