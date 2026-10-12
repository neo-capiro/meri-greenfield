import {createHash} from 'node:crypto';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const mime={docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain; charset=utf-8',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',pdf:'application/pdf',zip:'application/zip'};
const filenameFor=request=>(request.title.replace(/[^A-Za-z0-9._ -]/g,'_').replace(/^\.+/,'').trim().slice(0,120)||'artifact')+'.'+request.format;
const closed=(value,keys)=>{if(!value||Array.isArray(value)||Object.keys(value).sort().join()!==keys.sort().join())fail('ARTIFACT_PORT_SHAPE');};
export function createArtifactService({validators:v,authorize,budget,versions,objects,executor,now,ids}){
  if(![authorize,now,ids,budget?.reserve,budget?.settle,versions?.read,versions?.commit,objects?.put,objects?.get,executor?.execute].every(x=>typeof x==='function'))fail('ARTIFACT_CONFIGURATION');
  const same=(a,b)=>v.hash(a)===v.hash(b);
  function scopeVersion(record,id,context){
    closed(record,['version','spec','specSha256','requestSha256','inspection']);record=v.snapshot(record);record.version=v.version(record.version);record.spec=v.request(record.spec);
    if(record.version.versionId!==id||record.version.binding.tenantId!==context.binding.tenantId||record.version.binding.conversationId!==context.binding.conversationId||!same(record.version.scopes,context.scopes)||!same(record.version.object.scopes,record.version.scopes)||record.specSha256!==v.hash(record.spec))fail('ARTIFACT_VERSION_CONTEXT');
    if(record.version.mimeType!==mime[record.spec.format]||record.version.filename!==filenameFor(record.spec)||record.version.generationStatus!=='draft'||record.version.previewStatus!=='pending')fail('ARTIFACT_VERSION_METADATA');
    return record;
  }
  function inspectBytes(value,bytes,format){
    const inspection=v.snapshot(value);closed(inspection,['sha256','bytes','format','nativeOpened','rendered','recalculated','members','details']);
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
  async function generate(baseVersionId,requestValue,contextValue,{signal}={}){
    const request=v.request(requestValue),context=v.context(contextValue);
    const intent={request,context,baseVersionId},requestSha256=v.hash(intent),allocation=v.snapshot(ids());
    closed(allocation,['artifactId','versionId','objectId']);
    for(const id of Object.values(allocation))if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))fail('ARTIFACT_ID');
    const life=operation(context,signal);
    let ticket,reservationStarted=false,writeStarted=false,versionCommitted=false,settlementStarted=false,settlementCompleted=false,settlementUnknown=false,readBase=null,baseBytes=null,receipt;
    const action=baseVersionId===null?'artifact.generate':'artifact.revise';
    let resource={versionId:baseVersionId,object:null,assetObjects:context.assets.map(a=>a.object)};
    async function settle(outcome,bytes){
      settlementStarted=true;
      const result=v.snapshot(await life.run(signal=>budget.settle({ticketId:ticket.ticketId,requestSha256,bytes,outcome,signal})));
      closed(result,['ticketId','requestSha256','bytes','outcome','status']);
      if(result.ticketId!==ticket.ticketId||result.requestSha256!==requestSha256||result.bytes!==bytes||result.outcome!==outcome||result.status!=='settled')fail('ARTIFACT_BUDGET_RECEIPT');
      settlementCompleted=true;
    }
    try{
      receipt=await authority(life,action,resource,requestSha256,context);
      if(baseVersionId!==null){
        readBase=scopeVersion(await life.run(signal=>versions.read(baseVersionId,signal)),baseVersionId,context);
        if(readBase.spec.operation!==request.operation||readBase.spec.format!==request.format)fail('ARTIFACT_REVISION_FORMAT');
        // Revision consumes the exact original bytes as well as retained spec.
        baseBytes=await bytesFor(life,readBase.version.object,context.maxBytes);
        resource={...resource,object:readBase.version.object};receipt=await authority(life,action,resource,requestSha256,context);
      }
      reservationStarted=true;
      const reserved=v.snapshot(await life.run(signal=>budget.reserve({binding:v.snapshot(context.binding),requestSha256,maxBytes:context.maxBytes,deadlineMs:context.deadlineMs,signal})));
      closed(reserved,['ticketId','binding','requestSha256','maxBytes','deadlineMs']);
      if(typeof reserved.ticketId!=='string'||!reserved.ticketId||!same(reserved.binding,context.binding)||reserved.requestSha256!==requestSha256||!Number.isInteger(reserved.maxBytes)||reserved.maxBytes<1||reserved.maxBytes>context.maxBytes||!Number.isSafeInteger(reserved.deadlineMs)||reserved.deadlineMs>context.deadlineMs)fail('ARTIFACT_BUDGET');
      ticket=reserved;
      life.limitDeadline(ticket.deadlineMs);
      const assets=[];for(const asset of context.assets){const bytes=await bytesFor(life,asset.object,2097152);assets.push({id:asset.id,bytes});}
      receipt=await authority(life,action,resource,requestSha256,context);
      const result=await life.run(signal=>executor.execute({request:v.snapshot(request),assets,base:readBase?{request:v.snapshot(readBase.spec),bytes:Buffer.from(baseBytes)}:null,deadlineMs:Math.min(context.deadlineMs,ticket.deadlineMs,receipt.expiresAtMs),maxBytes:ticket.maxBytes,signal}));
      if(!Buffer.isBuffer(result.bytes)||result.bytes.length>ticket.maxBytes)fail('ARTIFACT_OUTPUT_LIMIT');
      const bytes=Buffer.from(result.bytes),inspection=inspectBytes(result.inspection,bytes,request.format);
      receipt=await authority(life,action,resource,requestSha256,context);
      writeStarted=true;
      const object=v.object(await life.run(signal=>objects.put({objectId:allocation.objectId,bytes:Buffer.from(bytes),scopes:v.snapshot(context.scopes),requestSha256},signal)));
      if(object.objectId!==allocation.objectId||object.bytes!==bytes.length||object.sha256!==sha(bytes)||!same(object.scopes,context.scopes))fail('ARTIFACT_OBJECT_MISMATCH');
      await bytesFor(life,object,ticket.maxBytes);
      receipt=await authority(life,action,resource,requestSha256,context);
      const version=v.version({contractVersion:'0.1.0',artifactId:readBase?.version.artifactId??allocation.artifactId,versionId:allocation.versionId,parentVersionId:baseVersionId,binding:context.binding,object,filename:filenameFor(request),mimeType:mime[request.format],scopes:context.scopes,evidence:context.evidence,generationStatus:'draft',previewStatus:'pending',createdAt:new Date(now()).toISOString()});
      const commit=v.snapshot(await life.run(signal=>versions.commit({version:v.snapshot(version),spec:v.snapshot(request),specSha256:v.hash(request),requestSha256,inspection:v.snapshot(inspection),expectedParentVersionId:baseVersionId},signal)));
      closed(commit,['status','versionId','requestSha256','versionSha256']);
      if(!['committed','duplicate'].includes(commit.status)||commit.versionId!==version.versionId||commit.requestSha256!==requestSha256||commit.versionSha256!==v.hash(version))fail('ARTIFACT_COMMIT_RECEIPT');versionCommitted=true;
      await settle('completed',bytes.length);receipt=await authority(life,action,{...resource,object},requestSha256,context);
      return {version,inspection,execution:{requestSha256,authorizationReceiptId:receipt.receiptId,budgetTicketId:ticket.ticketId,objectCommitted:true,versionCommitted:true,nativeQualified:false}};
    }catch(cause){
      if(ticket&&!writeStarted&&!settlementStarted)try{await settle('failed',0);}catch{settlementUnknown=true;}
      const budgetUnknown=settlementUnknown||Boolean(reservationStarted&&!ticket)||Boolean(ticket&&!settlementCompleted);
      const budgetCode=ticket?'ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN':'ARTIFACT_BUDGET_RESERVATION_UNKNOWN';
      const error=writeStarted?Object.assign(new Error('ARTIFACT_EFFECT_UNKNOWN'),{code:'ARTIFACT_EFFECT_UNKNOWN',cause,versionId:allocation.versionId,versionCommitted}):budgetUnknown?Object.assign(new Error(budgetCode),{code:budgetCode,cause}):cause;
      error.lifetime=life.close();error.budgetSettlementUnknown=Boolean(ticket&&budgetUnknown);error.budgetReservationUnknown=Boolean(reservationStarted&&!ticket);if(reservationStarted)error.budget={ticketId:ticket?.ticketId??null,requestSha256,binding:v.snapshot(context.binding)};throw error;
    }finally{life.close();}
  }
  async function read(versionId,contextValue,options={},download=false){
    if(typeof versionId!=='string')fail('ARTIFACT_VERSION_ID');
    const context=v.context(contextValue),life=operation(context,options.signal),action=download?'artifact.download':'artifact.inspect';
    const requestSha256=v.hash({action,versionId,context});let resource={versionId,object:null,assetObjects:[]};
    try{
      await authority(life,action,resource,requestSha256,context);
      const record=scopeVersion(await life.run(signal=>versions.read(versionId,signal)),versionId,context);
      resource={...resource,object:record.version.object};await authority(life,action,resource,requestSha256,context);
      const bytes=await bytesFor(life,record.version.object,context.maxBytes);
      const inspection=inspectBytes(record.inspection,bytes,record.spec.format);
      await authority(life,action,resource,requestSha256,context);
      return download?{version:record.version,bytes}:{version:record.version,inspection:{...inspection,currentBytesVerified:true}};
    }catch(error){error.lifetime=life.close();throw error;}finally{life.close();}
  }
  return Object.freeze({create:(request,context,options)=>generate(null,request,context,options),revise:(baseVersionId,request,context,options)=>{if(typeof baseVersionId!=='string')fail('ARTIFACT_VERSION_ID');return generate(baseVersionId,request,context,options);},inspect:(id,context,options)=>read(id,context,options),download:(id,context,options)=>read(id,context,options,true)});
}
