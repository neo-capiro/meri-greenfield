import {createHash} from 'node:crypto';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {data,own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {recoverArtifact,recoverOfficeEdit,recoverOfficeOriginal} from './recovery.mjs';
import {readArtifactLibrary} from './library.mjs';
import {readPagedArtifactHistory} from './history-page.mjs';
import {prepareFederalDraft} from './federal-drafting/preparation.mjs';
import {officeEditSource,isOfficeEdit,storedArtifactSource,storedArtifactInspection,assertOfficeEditRecord,officeEditRequestSha256,officeEditParentMatches} from '../../packages/contracts/office-edit.mjs';
import {inspectOfficeEdit} from './edit-sessions/inspect-office.mjs';
import {isOfficeOriginal,officeOriginalSource,officeOriginalRequestSha256} from '../../packages/contracts/office-edit.mjs';
// The canonical immutable-spec asset identification the intent layer already owns, so a retained
// revision and this write identify exactly the same references instead of two walks that can drift.
import {referencedAssetIds} from '../control/intents/document-revision.mjs';
import {ARTIFACT_MIME_TYPES as mime,artifactFilename as filenameFor} from '../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
import {BROWSER_IMPORT_KIND,BROWSER_IMPORT_OPERATION,browserImportSource,browserImportInspection,browserImportRequestSha256,isBrowserImport} from '../../packages/contracts/browser-import.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const closed=(value,keys)=>{if(!value||Array.isArray(value)||Object.keys(value).sort().join()!==keys.sort().join())fail('ARTIFACT_PORT_SHAPE');};
export function createArtifactService({validators:v,authorize,versions,objects,executor,now,ids,retention,admitRetainedEvidence,authorizeOrigin,retainedAssetMapWrites,officeEditWrites=false,officeOriginalWrites=false}){
  if(typeof officeEditWrites!=='boolean'||typeof officeOriginalWrites!=='boolean')fail('ARTIFACT_CONFIGURATION');
  if(authorizeOrigin!==undefined&&typeof authorizeOrigin!=='function')fail('ARTIFACT_CONFIGURATION');
  if(admitRetainedEvidence!==undefined&&typeof admitRetainedEvidence!=='function')fail('ARTIFACT_CONFIGURATION');
  // The private producer activation for the retained asset map. Absent or false (the default) this service
  // emits no map-bearing record at all, preserving the exact pre-activation record bytes and keeping an
  // older binary able to read every record this one writes; the readers below accept both formats either way.
  if(retainedAssetMapWrites!==undefined&&typeof retainedAssetMapWrites!=='boolean')fail('ARTIFACT_CONFIGURATION');
  if(![authorize,now,ids,versions?.read,versions?.commit,objects?.put,objects?.get,executor?.execute].every(x=>typeof x==='function')||retention!==undefined&&typeof retention?.assertServable!=='function'||versions?.recoverTenant!==undefined&&typeof versions.recoverTenant!=='function')fail('ARTIFACT_CONFIGURATION');
  const same=(a,b)=>v.hash(a)===v.hash(b);
  // The canonical retention read gate: the conversation the caller is bound to, and, once a trusted scoped record resolved the version,
  // the artifact and the conversation that version belongs to. Consulted before object bytes are read and again before release; its
  // refusals keep their own codes (RETENTION_SUPPRESSED, RETENTION_RECOVERY_BARRIER, RETENTION_READ_UNAVAILABLE).
  async function servable(life,context,record=null){if(!retention)return;
    const subjects=[{tenantId:context.binding.tenantId,kind:'conversation',subjectId:context.binding.conversationId}];
    if(record){const b=record.version.binding;if(b.conversationId!==context.binding.conversationId)subjects.push({tenantId:b.tenantId,kind:'conversation',subjectId:b.conversationId});subjects.push({tenantId:b.tenantId,kind:'artifact',subjectId:record.version.artifactId});}
    for(const subject of subjects)await life.run(()=>retention.assertServable(subject));life.check();}
  async function recoverTenant(life,context,versionId=null){if(versionId!==null&&versions.recoverVersion)await life.run(signal=>versions.recoverVersion(context.binding.tenantId,versionId,signal));else if(versions.recoverTenant)await life.run(signal=>versions.recoverTenant(context.binding.tenantId,signal));life.check();}
  function scopeVersion(record,id,context){
    closed(record,['version','spec','specSha256','requestSha256','inspection',...(record?.assets===undefined?[]:['assets'])]);record=v.snapshot(record);record.version=v.version(record.version);record.spec=storedArtifactSource(v,record.spec);assertOfficeEditRecord(record.spec,record.version);
    if(record.version.versionId!==id||record.version.binding.tenantId!==context.binding.tenantId||record.version.binding.actorId!==context.binding.actorId||record.version.binding.conversationId!==context.binding.conversationId||!same(record.version.scopes,context.scopes)||!same(record.version.object.scopes,record.version.scopes)||record.specSha256!==v.hash(record.spec))fail('ARTIFACT_VERSION_CONTEXT');
    if(record.version.mimeType!==mime[record.spec.format]||record.version.filename!==filenameFor(record.spec)||record.version.generationStatus!=='draft'||record.version.previewStatus!=='pending')fail('ARTIFACT_VERSION_METADATA');
    return record;
  }
  function inspectBytes(value,bytes,format,spec){
    let inspection;try{inspection=storedArtifactInspection(v,spec,value);}catch(cause){throw Object.assign(new Error('ARTIFACT_INSPECTION_MISMATCH'),{code:'ARTIFACT_INSPECTION_MISMATCH',cause});}closed(inspection,['sha256','bytes','format','nativeOpened','rendered','recalculated','members','details']);
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
  /** The bounded immutable asset map the generated version retains BESIDE its spec: the original spec's
   * own id -> ObjectReference pairs, in spec order, taken only from the already-admitted trusted context.
   * A declared reference the trusted context did not supply is simply not retained, so that parent stays
   * explicitly unavailable for revision rather than being re-rendered without its object, and an
   * unreferenced context asset is not part of this document's immutable identity. */
  function assetPins(request,context){
    const declared=[...new Set(referencedAssetIds(request))];if(!declared.length)return undefined;
    const available=new Map(context.assets.map(asset=>[asset.id,asset.object])),pins=[];
    for(const id of declared){const object=available.get(id);if(object!==undefined)pins.push({id,object:v.object(object)});}
    return pins.length?pins:undefined;
  }
  async function generate(baseVersionId,requestValue,contextValue,{signal,invocation}={},editedBytes=null,original=false){
    const office=editedBytes!==null&&!original;
    if(office&&(!officeEditWrites||baseVersionId===null))fail('EDITOR_PUBLISH_UNAVAILABLE');
    if(original&&(!officeOriginalWrites||baseVersionId!==null))fail('OFFICE_IMPORT_UNAVAILABLE');
    // The retained map is emitted only under the deployment's explicit write activation: with it off (the
    // default) no new map-bearing record is produced, while the declared assets still reach the executor
    // with their actual verified bytes exactly as before.
    const request=original?officeOriginalSource(requestValue):office?officeEditSource(requestValue):v.request(requestValue),context=v.context(contextValue),pins=!office&&!original&&retainedAssetMapWrites===true?assetPins(request,context):undefined;
    if((office||original)&&(!Buffer.isBuffer(editedBytes)||sha(editedBytes)!==(original?request.original.sha256:request.edit.draftSha256)||editedBytes.length>context.maxBytes||original&&editedBytes.length!==request.original.bytes))fail('EDITOR_SAVE_INVALID');
    if(office||original)editedBytes=Buffer.from(editedBytes);
    if(request.format==='sandbox')fail('ANALYSIS_SANDBOX_DISPATCH_REQUIRED');
    if(context.analysisAdmission)fail('IRRELEVANT_ANALYSIS_ADMISSION');
    // Stored historical evidence remains readable; new native writes require current run-bound evidence.
    const retained=context.evidence.map(v.nativeSourceEvidence).some(e=>!same(e.binding,context.binding));
    if(retained&&(typeof admitRetainedEvidence!=='function'||admitRetainedEvidence(v.snapshot(context))!==undefined))fail('ARTIFACT_EVIDENCE_BINDING');
    const requestSha256=original?officeOriginalRequestSha256(v,request,context):office?officeEditRequestSha256(v,request,context,baseVersionId):v.nativeRequestSha256(request,context,baseVersionId),allocation=v.snapshot(ids());
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
      receipt=await authority(life,action,resource,requestSha256,context);await servable(life,context);await recoverTenant(life,context,baseVersionId);
      if(baseVersionId!==null){
        readBase=scopeVersion(await life.run(signal=>versions.read(baseVersionId,signal)),baseVersionId,context);
        if(readBase.spec.operation!==request.operation||readBase.spec.format!==request.format)fail('ARTIFACT_REVISION_FORMAT');
        if(!office&&(isOfficeEdit(readBase.spec)||isOfficeOriginal(readBase.spec)))fail('EDITOR_TYPED_REVISION_UNAVAILABLE');
        if(office&&(!officeEditParentMatches(readBase,{spec:request})||!same(readBase.version.evidence,context.evidence)))fail('EDITOR_SOURCE_MISMATCH');
        // Revision consumes the exact original bytes as well as retained spec; a suppressed base is never read.
        await servable(life,context,readBase);baseBytes=await bytesFor(life,readBase.version.object,context.maxBytes);
        resource={...resource,object:readBase.version.object};receipt=await authority(life,action,resource,requestSha256,context);
      }
      const assets=[];for(const asset of context.assets){const bytes=await bytesFor(life,asset.object,2097152);assets.push({id:asset.id,bytes});}
      receipt=await authority(life,action,resource,requestSha256,context);await servable(life,context,readBase);
      let result;
      if(office||original){life.check();result={bytes:editedBytes,inspection:inspectOfficeEdit(editedBytes,request.format)};life.check();}
      else{executionStarted=true;result=await life.run(signal=>executor.execute({request:v.snapshot(request),assets,base:readBase?{request:v.snapshot(readBase.spec),bytes:Buffer.from(baseBytes)}:null,deadlineMs:Math.min(context.deadlineMs,receipt.expiresAtMs),maxBytes:context.maxBytes,signal}));}
      if(!Buffer.isBuffer(result.bytes)||result.bytes.length>context.maxBytes)fail('ARTIFACT_OUTPUT_LIMIT');
      const bytes=Buffer.from(result.bytes),inspection=inspectBytes(result.inspection,bytes,request.format,request);
      receipt=await authority(life,action,resource,requestSha256,context);
      writeStarted=true;
      const object=v.object(await life.run(signal=>objects.put({objectId:allocation.objectId,bytes:Buffer.from(bytes),scopes:v.snapshot(context.scopes),requestSha256},signal)));
      if(object.objectId!==allocation.objectId||object.bytes!==bytes.length||object.sha256!==sha(bytes)||!same(object.scopes,context.scopes))fail('ARTIFACT_OBJECT_MISMATCH');
      await bytesFor(life,object,context.maxBytes);
      receipt=await authority(life,action,resource,requestSha256,context);
      const version=v.version({contractVersion:'0.2.0',artifactId:readBase?.version.artifactId??allocation.artifactId,versionId:allocation.versionId,parentVersionId:baseVersionId,binding:context.binding,object,filename:filenameFor(request),mimeType:mime[request.format],scopes:context.scopes,evidence:context.evidence,generationStatus:'draft',previewStatus:'pending',createdAt:new Date(now()).toISOString()});
      await servable(life,context,{version});
      const publication={authorization:receipt,invocation:{kind:'native-document',versionId:version.versionId,invocationId:invocation.invocationId,binding:v.snapshot(context.binding),requestSha256}};
      const commit=v.snapshot(await life.run(signal=>versions.commit({version:v.snapshot(version),spec:v.snapshot(request),specSha256:v.hash(request),requestSha256,inspection:v.snapshot(inspection),expectedParentVersionId:baseVersionId,...(pins===undefined?{}:{assets:v.snapshot(pins)})},signal,publication)));
      closed(commit,['status','versionId','requestSha256','versionSha256']);
      if(!['committed','duplicate'].includes(commit.status)||commit.versionId!==version.versionId||commit.requestSha256!==requestSha256||commit.versionSha256!==v.hash(version))fail('ARTIFACT_COMMIT_RECEIPT');versionCommitted=true;
      receipt=await authority(life,action,{...resource,object},requestSha256,context);await servable(life,context,{version});
      return {version,inspection,execution:{kind:'native-document',invocationId:invocation.invocationId,requestSha256,authorizationReceiptId:receipt.receiptId,objectCommitted:true,versionCommitted:true,nativeQualified:false}};
    }catch(cause){
      // The canonical publisher's stale-parent refusal is definite: the uploaded
      // immutable object may need cleanup, but no new artifact head was committed.
      if(office&&!versionCommitted&&cause?.code==='ARTIFACT_STALE_PARENT'){cause.lifetime=life.close();throw cause;}
      const error=executionStarted||writeStarted?Object.assign(new Error('ARTIFACT_EFFECT_UNKNOWN'),{code:'ARTIFACT_EFFECT_UNKNOWN',cause,versionId:allocation.versionId,versionCommitted}):cause;
      error.lifetime=life.close();throw error;
    }finally{life.close();}
  }
  async function read(versionId,contextValue,options={},download=false,revisionSource=false,editorWrite=null){
    if(typeof versionId!=='string')fail('ARTIFACT_VERSION_ID');
    // A private WOPI read must include retention and current revise authority for
    // an editing token. It does not execute a renderer or publish a revision.
    if(editorWrite!==null&&(!retention||typeof editorWrite!=='boolean'))fail('ARTIFACT_CONFIGURATION');
    const context=v.context(contextValue),life=operation(context,options.signal),action=editorWrite===true?'artifact.revise':download?'artifact.download':'artifact.inspect';
    const requestSha256=v.hash({action,versionId,context});let resource={versionId,object:null,assetObjects:[]};
    try{
      await authority(life,action,resource,requestSha256,context);await servable(life,context);await recoverTenant(life,context,versionId);
      const record=scopeVersion(await life.run(signal=>versions.read(versionId,signal)),versionId,context);
      resource={...resource,object:record.version.object};await authority(life,action,resource,requestSha256,context);await servable(life,context,record);
      const bytes=await bytesFor(life,record.version.object,context.maxBytes);
      const inspection=inspectBytes(record.inspection,bytes,record.spec.format,record.spec);
      await authority(life,action,resource,requestSha256,context);await servable(life,context,record);
      // Private revision preparation receives the retained typed source only after the
      // same byte, current-authority and retention checks as inspect. No new write or brand.
      // The record's own retained asset map rides this private return only; ordinary inspect and
      // download DTOs keep their exact public shape.
      if(revisionSource)return {version:record.version,request:record.spec,specSha256:record.specSha256,inspection:{...inspection,currentBytesVerified:true},...(record.assets===undefined?{}:{assets:record.assets})};
      return download?{version:record.version,bytes}:{version:record.version,inspection:{...inspection,currentBytesVerified:true}};
    }catch(error){error.lifetime=life.close();throw error;}finally{life.close();}
  }
  async function history(queryValue,contextValue,options={}){
    closed(queryValue,['versionId','limit','cursor']);const query=v.snapshot(queryValue);
    if(typeof query.versionId!=='string'||!Number.isInteger(query.limit)||query.limit<1||query.limit>100||query.cursor!==null&&(typeof query.cursor!=='string'||!/^[a-f0-9]{64}$/u.test(query.cursor)))fail('ARTIFACT_HISTORY_INPUT');
    if(typeof versions.history!=='function')fail('UNAVAILABLE');
    const context=v.context(contextValue),life=operation(context,options.signal),action='artifact.inspect',resource={versionId:query.versionId,object:null,assetObjects:[]},requestSha256=v.hash({action,intent:'history',query,context});
    try{
      await authority(life,action,resource,requestSha256,context);await servable(life,context);await recoverTenant(life,context,query.versionId);
      if(typeof versions.publicationSnapshot==='function'){const publication=await life.run(signal=>versions.publicationSnapshot(context.binding.tenantId,signal));if(publication.paged)return await readPagedArtifactHistory({v,versions,scopeVersion,authority,servable},query,context,life,resource,requestSha256,publication);}
      const result=v.snapshot(await life.run(signal=>versions.history(query.versionId,signal)));closed(result,['artifactId','anchorVersionId','headVersionId','records']);
      if(result.anchorVersionId!==query.versionId||!Array.isArray(result.records)||!result.records.length||result.records.length>1024)fail('ARTIFACT_HISTORY_RESULT');
      const records=result.records.map(record=>scopeVersion(record,record.version?.versionId,context)),ids=new Set();
      for(let i=0;i<records.length;i++){const version=records[i].version;if(ids.has(version.versionId)||version.artifactId!==result.artifactId||version.parentVersionId!==(records[i+1]?.version.versionId??null))fail('ARTIFACT_HISTORY_RESULT');ids.add(version.versionId);}
      if(records[0].version.versionId!==result.headVersionId||!ids.has(query.versionId))fail('ARTIFACT_HISTORY_RESULT');
      const anchor=records.find(record=>record.version.versionId===query.versionId);resource.object=anchor.version.object;
      await authority(life,action,resource,requestSha256,context);await servable(life,context,anchor);
      // The cursor selects a page of this freshly authorized snapshot; it is never an authority capability.
      const snapshotSha256=v.hash({query:{versionId:query.versionId,limit:query.limit},binding:context.binding,scopes:context.scopes,records}),cursorAt=offset=>v.hash({intent:'artifact.history',snapshotSha256,offset});let offset=0;
      if(query.cursor!==null){offset=-1;for(let i=query.limit;i<records.length;i+=query.limit)if(cursorAt(i)===query.cursor){offset=i;break;}if(offset<0)fail('ARTIFACT_HISTORY_CURSOR');}
      const page=records.slice(offset,offset+query.limit).map(record=>record.version),nextOffset=offset+page.length;
      await authority(life,action,resource,requestSha256,context);await servable(life,context,anchor);
      return {artifactId:result.artifactId,anchorVersionId:query.versionId,headVersionId:result.headVersionId,versions:page,nextCursor:nextOffset<records.length?cursorAt(nextOffset):null};
    }catch(error){error.lifetime=life.close();throw error;}finally{life.close();}
  }
  /** One downloaded file, published immutably through the same authority, retention, object custody, version CAS
   * and publication journal as a generated artifact — without pretending a renderer or SDK produced it. The
   * identity is derived from the caller's idempotency key, so a retried or restarted attempt reconciles the
   * SAME version instead of publishing a second one. */
  const IMPORT_MAX_BYTES=16777216;
  function importIds(key){
    const seed=role=>{const h=createHash('sha256').update(`meri-browser-import:${role}:${key}`).digest('hex'),c=h.slice(0,32).split('');
      c[12]='4';c[16]=((parseInt(c[16],16)&0x3)|0x8).toString(16);const x=c.join('');
      return `${x.slice(0,8)}-${x.slice(8,12)}-${x.slice(12,16)}-${x.slice(16,20)}-${x.slice(20)}`;};
    return {artifactId:seed('artifact'),versionId:seed('version'),objectId:seed('object')};
  }
  async function ingest(requestValue,contextValue,{signal}={}){
    // Bytes are kept out of the generic snapshot: a Buffer stays a Buffer and is re-hashed here.
    if(!requestValue||typeof requestValue!=='object'||!Buffer.isBuffer(requestValue.bytes))fail('BROWSER_IMPORT_BYTES');
    const raw=own(requestValue,['binding','scopes','filename','format','mimeType','bytes','sha256','idempotencyKey','source']);
    const context=v.context(contextValue);
    const bytes=Buffer.from(raw.bytes),max=Math.min(context.maxBytes??IMPORT_MAX_BYTES,IMPORT_MAX_BYTES);
    if(!bytes.length||bytes.length>max)fail('ARTIFACT_OUTPUT_LIMIT');
    if(typeof raw.mimeType!=='string'||raw.mimeType!==mime[raw.format])fail('BROWSER_IMPORT_FORMAT');
    if(typeof raw.sha256!=='string'||raw.sha256!==sha(bytes))fail('BROWSER_IMPORT_HASH');
    if(!same(raw.binding,context.binding)||!same(raw.scopes,context.scopes))fail('BROWSER_IMPORT_CONTEXT');
    const title=raw.filename.slice(0,-(String(raw.format).length+1));
    const spec=browserImportSource({sourceKind:BROWSER_IMPORT_KIND,operation:BROWSER_IMPORT_OPERATION,format:raw.format,title,originalFilename:raw.filename,source:data(raw.source),sha256:raw.sha256,bytes:bytes.length});
    const requestSha256=browserImportRequestSha256(v,spec,raw.idempotencyKey,context),action='artifact.generate';
    const life=operation(context,signal),resource={versionId:null,object:null,assetObjects:[]},allocation=importIds(raw.idempotencyKey);
    const inspection=browserImportInspection({sha256:raw.sha256,bytes:bytes.length,format:raw.format,nativeOpened:false,rendered:false,recalculated:false,members:[],details:{mimeType:raw.mimeType}});
    let writeStarted=false,version=null;
    try{
      let receipt=await authority(life,action,resource,requestSha256,context);
      await servable(life,context);await recoverTenant(life,context,allocation.versionId);
      // Restart/retry reconciliation: the deterministic identity already admitted a version, so the ORIGINAL
      // record is read back under current authority/retention instead of publishing a second one. The acquisition
      // timestamp is provenance, not identity: a restarted caller with a new clock still reconciles.
      let existing=null;
      try{existing=scopeVersion(await life.run(signal=>versions.read(allocation.versionId,signal)),allocation.versionId,context);}
      catch(error){if(error?.code!=='ENOENT')throw error;}
      if(existing){
        await servable(life,context,existing);
        if(isBrowserImport(existing.spec)&&existing.spec.originalFilename===undefined)fail('BROWSER_IMPORT_IDENTITY_UNKNOWN');
        if(!isBrowserImport(existing.spec)||existing.spec.sha256!==raw.sha256||existing.spec.bytes!==bytes.length||
          existing.spec.format!==raw.format||existing.spec.title!==title||existing.spec.originalFilename!==raw.filename||
          existing.spec.source.origin!==raw.source.origin||existing.spec.source.urlHost!==raw.source.urlHost||
          existing.spec.source.policySha256!==raw.source.policySha256)fail('BROWSER_IMPORT_CONFLICT');
        receipt=await authority(life,action,{versionId:existing.version.versionId,object:existing.version.object,assetObjects:[]},requestSha256,context);
        return Object.freeze({versionId:existing.version.versionId,sha256:raw.sha256,bytes:bytes.length,idempotencyKey:raw.idempotencyKey,
         acquiredAtMs:existing.spec.source.acquiredAtMs,reconciled:true});
      }
      receipt=await authority(life,action,resource,requestSha256,context);
      writeStarted=true;
      const object=v.object(await life.run(signal=>objects.put({objectId:allocation.objectId,bytes:Buffer.from(bytes),scopes:v.snapshot(context.scopes),requestSha256},signal)));
      if(object.objectId!==allocation.objectId||object.bytes!==bytes.length||object.sha256!==raw.sha256||!same(object.scopes,context.scopes))fail('ARTIFACT_OBJECT_MISMATCH');
      await bytesFor(life,object,max);
      receipt=await authority(life,action,resource,requestSha256,context);
      version=v.version({contractVersion:'0.2.0',artifactId:allocation.artifactId,versionId:allocation.versionId,parentVersionId:null,binding:context.binding,object,filename:filenameFor(spec),mimeType:mime[spec.format],scopes:context.scopes,evidence:[],generationStatus:'draft',previewStatus:'pending',createdAt:new Date(raw.source.acquiredAtMs).toISOString()});
      await servable(life,context,{version});
      const publication={authorization:receipt,invocation:{kind:'browser-import',versionId:version.versionId,binding:v.snapshot(context.binding),requestSha256,idempotencyKey:raw.idempotencyKey}};
      const commit=v.snapshot(await life.run(signal=>versions.commit({version:v.snapshot(version),spec:v.snapshot(spec),specSha256:v.hash(spec),requestSha256,inspection:v.snapshot(inspection),expectedParentVersionId:null},signal,publication)));
      closed(commit,['status','versionId','requestSha256','versionSha256']);
      if(!['committed','duplicate'].includes(commit.status)||commit.versionId!==version.versionId||commit.requestSha256!==requestSha256||commit.versionSha256!==v.hash(version))fail('ARTIFACT_COMMIT_RECEIPT');
      return Object.freeze({versionId:version.versionId,sha256:raw.sha256,bytes:bytes.length,idempotencyKey:raw.idempotencyKey,
       acquiredAtMs:spec.source.acquiredAtMs});
    }catch(cause){
      // A repeated attempt that reconciles the identical immutable version is a definite success, not an unknown.
      const error=writeStarted&&cause?.code!=='ARTIFACT_COMMIT_RECEIPT'&&cause?.code!=='ARTIFACT_IMMUTABLE_CONFLICT'
        ?Object.assign(new Error('ARTIFACT_EFFECT_UNKNOWN'),{code:'ARTIFACT_EFFECT_UNKNOWN',cause,versionId:allocation.versionId,version})
        :Object.assign(cause instanceof Error?cause:new Error(String(cause)),{versionId:allocation.versionId});
      error.lifetime=life.close();throw error;
    }finally{life.close();}
  }
  return Object.freeze({create:(request,context,options)=>generate(null,request,context,options),revise:(baseVersionId,request,context,options)=>{if(typeof baseVersionId!=='string')fail('ARTIFACT_VERSION_ID');return generate(baseVersionId,request,context,options);},
    publishOfficeEdit:(baseVersionId,request,bytes,context,options)=>generate(baseVersionId,request,context,options,bytes),
    importOfficeOriginal:(request,bytes,context,options)=>generate(null,request,context,options,bytes,true),
    recover:(baseVersionId,request,context,options)=>recoverArtifact({v,operation,authority,scopeVersion,bytesFor,inspectBytes,versions,servable,recoverTenant},baseVersionId,request,context,options),
    recoverOfficeEdit:(baseVersionId,request,context,options)=>recoverOfficeEdit({v,operation,authority,scopeVersion,bytesFor,inspectBytes,versions,servable,recoverTenant},baseVersionId,request,context,options),
    recoverOfficeOriginal:(request,context,options)=>recoverOfficeOriginal({v,operation,authority,scopeVersion,bytesFor,inspectBytes,versions,servable,recoverTenant},request,context,options),
    list:(query,context,options)=>readArtifactLibrary({v,versions,authorizeOrigin,operation,authority,servable,recoverTenant,now},query,context,options),
    history,revisionSource:(id,context,options)=>read(id,context,options,false,true),inspect:(id,context,options)=>read(id,context,options),download:(id,context,options)=>read(id,context,options,true),
    editorSource:(id,context,{write,signal}={})=>{if(typeof write!=='boolean')fail('ARTIFACT_CONFIGURATION');return read(id,context,{signal},true,false,write);},
    prepareFederalDraft:(input,context,options)=>prepareFederalDraft({read:(id,c,o)=>read(id,c,o,false,true)},input,context,options),
    ingest:(request,context,options={})=>ingest(request,context,options)});
}
