/** Filing reads only the existing authenticated document application. The trusted storage lookup chooses a visible version;
 * exact selected object bytes and canonical typed/native metadata are checked here without creating another authority owner. */
import {createHash} from 'node:crypto';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {nativeArtifactBasename,nativeArtifactDisposition} from '../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {readJsonResponse,cancelBody} from '../../gateway/sources/json-response.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {documentLimits} from '../../control/document-application/current.mjs';
import {createRuntimeArtifactApplication} from './application.mjs';

const fail=code=>{throw Object.assign(Error(code),{code});},same=(a,b)=>hash(a)===hash(b);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
const TOKEN=/^[A-Za-z0-9._~+/-]{1,4096}={0,2}$/u;

export function createRuntimeFilingCustody(configuration){
 const c=own(configuration,['sessions','optionsOwner','now','limits','resolveVersion'],['retention']),limits=documentLimits(c.limits);
 const resolve=storageMethod(c.optionsOwner,'resolve');
 if(typeof c.now!=='function'||typeof c.resolveVersion!=='function')fail('ARTIFACT_CONFIGURATION');
 // Validate the existing application's configuration without resolving a session or reading storage.
 createRuntimeArtifactApplication({sessions:c.sessions,optionsOwner:c.optionsOwner,now:c.now,limits,...(c.retention===undefined?{}:{retention:c.retention})});
 async function perform(value,rechecking){
  const {signal,...raw}=own(value,['object','credential','binding','scopes','deadlineMs',...(rechecking?['versionId']:[])],['signal']);nativeSignal(signal);
  const call=data(raw),object=v.object(call.object);validateShape('RunBinding',call.binding);
  if(typeof call.credential!=='string'||!TOKEN.test(call.credential)||!same(call.scopes,object.scopes)||object.scopes.some(s=>s.tenantId!==call.binding.tenantId)||
   !Number.isSafeInteger(call.deadlineMs)||rechecking&&!UUID.test(call.versionId??''))fail('ARTIFACT_FILING_INPUT');
  if(object.bytes>limits.maxResponseBytes)fail('ARTIFACT_FILING_LIMIT');
  const life=createOperationLifetime({deadlineMs:Math.min(call.deadlineMs,c.now()+limits.maxRequestMs),now:c.now,signal,errorFactory:code=>Object.assign(Error(code),{code})});
  try{
   const versionId=await life.run(signal=>c.resolveVersion({object,binding:call.binding,scopes:call.scopes,deadlineMs:life.deadline(),signal}));
   if(typeof versionId!=='string'||!UUID.test(versionId)||rechecking&&versionId!==call.versionId)fail('ARTIFACT_FILING_OBJECT_MISMATCH');
   const app=createRuntimeArtifactApplication({sessions:c.sessions,now:c.now,limits,...(c.retention===undefined?{}:{retention:c.retention}),optionsOwner:{async resolve(request){
    const result=await resolve(request);if(result===null||result===undefined)return result;
    const context=result.documentOptions?.artifactOptions?.context;
    if(!context||!same(context.binding,call.binding)||!same(context.scopes,call.scopes))fail('ARTIFACT_FILING_CONTEXT');
    life.limitDeadline(context.deadlineMs);return result;
   }}});
   async function request(intent){
    const body=JSON.stringify({versionId});
    const response=await life.run(signal=>app.handle(new Request('https://meri-control.internal/api/documents/'+intent,{method:'POST',
     headers:{authorization:'Bearer '+call.credential,'content-type':'application/json','content-length':String(Buffer.byteLength(body))},body,signal}),{deadlineMs:life.deadline()}));
    if(response.status!==200){cancelBody(response.body);fail('ARTIFACT_FILING_CUSTODY_REFUSED');}return response;
   }
   const inspected=await readJsonResponse(await request('inspect'),{lifetime:life,maxResponseBytes:limits.maxResponseBytes});
   let version,filename,mimeType,disposition;
   if(inspected.kind==='native-file'){
    version=v.nativeFileInspection(inspected).version;
    // A committed continuation/fork can retain its source conversation/run; the canonical app owns that mapping.
    filename=nativeArtifactBasename(version.path);mimeType='application/octet-stream';disposition=nativeArtifactDisposition(version.path);
   }else{
    own(inspected,['version','inspection']);version=v.version(inspected.version);
    const {currentBytesVerified,...material}=own(inspected.inspection,['sha256','bytes','format','nativeOpened','rendered','recalculated','members','details','currentBytesVerified']);
    v.inspection(material);
    if(currentBytesVerified!==true||material.sha256!==object.sha256||material.bytes!==object.bytes||version.binding.conversationId!==call.binding.conversationId)fail('ARTIFACT_FILING_OBJECT_MISMATCH');
    filename=version.filename;mimeType=version.mimeType;disposition=`attachment; filename="${filename}"`;
   }
   if(version.versionId!==versionId||version.binding.tenantId!==call.binding.tenantId||version.binding.actorId!==call.binding.actorId||
    !same(version.scopes,call.scopes)||!same(version.object,object))fail('ARTIFACT_FILING_OBJECT_MISMATCH');
   const metadata=data({versionId,filename,mimeType,object});
   if(rechecking){life.check();return metadata;}
   const response=await request('download');let reader;
   try{
    if(response.redirected||response.headers.get('content-type')!==mimeType||response.headers.get('content-disposition')!==disposition||
     ![null,'identity'].includes(response.headers.get('content-encoding'))||response.headers.get('content-length')!==String(object.bytes)||!response.body)fail('ARTIFACT_FILING_OBJECT_MISMATCH');
    reader=response.body.getReader();const chunks=[];let length=0;
    for(;;){const part=await life.run(()=>reader.read());if(part.done)break;
     if(!(part.value instanceof Uint8Array))fail('ARTIFACT_FILING_OBJECT_MISMATCH');
     length+=part.value.byteLength;if(length>object.bytes||length>limits.maxResponseBytes)fail('ARTIFACT_FILING_LIMIT');chunks.push(Buffer.from(part.value));
    }
    const bytes=Buffer.concat(chunks);
    if(length!==object.bytes||createHash('sha256').update(bytes).digest('hex')!==object.sha256)fail('ARTIFACT_FILING_OBJECT_MISMATCH');
    life.check();return {...metadata,bytes};
   }finally{if(reader){try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}try{reader.releaseLock();}catch{}}else cancelBody(response.body);}
  }finally{life.close();}
 }
 return Object.freeze({read:value=>perform(value,false),recheck:value=>perform(value,true)});
}
