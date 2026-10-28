/** Private upload -> SDK source boundary. Every call reopens canonical custody and current Core access.
 * Only extracted inert text crosses the native JSON transport; original bytes stay with the upload owner. */
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertUploadSelections} from '../../../packages/contracts/upload-selection.mjs';
import {borrowedRunSession,assertActionSessionReceipt} from '../action-host/session/owner.mjs';
import {createRequestCurrent} from '../action-host/current.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {createUploadCustody,hash,fail,uploadRecord} from './custody.mjs';
import {uploadError} from './policy.mjs';
import {UPLOAD_SOURCE_PAGE_FRAGMENTS,UPLOAD_SOURCE_FRAGMENT_CHARACTERS} from '../../../packages/runtime/upload-sources.mjs';
export {UPLOAD_SOURCE_PAGE_FRAGMENTS,UPLOAD_SOURCE_FRAGMENT_CHARACTERS};
const same=(a,b)=>hash(a)===hash(b);

/** A page is bounded JSON lines for native Read: no long source line is silently truncated by that tool. */
export function projectUploadInputSource(value,page){
 const record=uploadRecord(value);
 if(record.state!=='stored'||record.inspection?.scan.status!=='clean'||!['available','partial'].includes(record.inspection.extraction.status))fail('UPLOAD_EXTRACTION_UNAVAILABLE');
 const source={uploadId:record.uploadId,sha256:record.declaration.sha256,versionId:record.object.versionId,
  filename:record.declaration.filename,mimeType:record.declaration.mimeType,bytes:record.declaration.bytes,
  extraction:{status:record.inspection.extraction.status,limitations:record.inspection.extraction.limitations,segments:record.inspection.extraction.segments}};
 const pieces=[];
 for(const segment of source.extraction.segments){let start=0;do{let end=Math.min(segment.text.length,start+UPLOAD_SOURCE_FRAGMENT_CHARACTERS);
  if(end<segment.text.length&&/[\uD800-\uDBFF]/u.test(segment.text[end-1])&&/[\uDC00-\uDFFF]/u.test(segment.text[end]))end++;
  pieces.push({...segment,text:segment.text.slice(start,end),startCharacter:start,endCharacter:end});start=end;
 }while(start<segment.text.length);}
 const pageCount=Math.max(1,Math.ceil(pieces.length/UPLOAD_SOURCE_PAGE_FRAGMENTS));if(pageCount>256)fail('UPLOAD_SIZE');
 const manifest={selection:{uploadId:record.uploadId,sha256:record.declaration.sha256},versionId:record.object.versionId,
  filename:record.declaration.filename,mimeType:record.declaration.mimeType,bytes:record.declaration.bytes,
  extractionStatus:record.inspection.extraction.status,limitations:record.inspection.extraction.limitations,
  sourceSha256:hash(source),pageCount,scopes:record.scopes};
 if(page===undefined)return data(manifest);
 if(!Number.isSafeInteger(page)||page<0||page>=pageCount)fail('UPLOAD_ID');
 const fragments=pieces.slice(page*UPLOAD_SOURCE_PAGE_FRAGMENTS,(page+1)*UPLOAD_SOURCE_PAGE_FRAGMENTS);
 return data({...manifest,page,fragments,pageSha256:hash(fragments),nextPage:page+1<pageCount?page+1:null});
}
export function createUploadInputReader({sessions,conversationStore,store,objects,inspection,retention,removeOriginal,now=Date.now}){
 const ports=Object.fromEntries(['authenticateSession','readCurrentState'].map(name=>[name,async args=>sessions[name](args)]));
 async function readWithSession(value){
  const {signal:callSignal,...raw}=own(value,['credential','binding','selection','deadlineMs'],['signal','page']),q=data(raw),selection=assertUploadSelections([q.selection])[0];
  const life=createOperationLifetime({signal:callSignal,deadlineMs:q.deadlineMs,now,errorFactory:uploadError});
  try{
   const authentication=await life.run(signal=>ports.authenticateSession({credential:q.credential,signal,deadlineMs:life.deadline()}));
   const selected=data(await life.run(signal=>ports.readCurrentState({authentication,signal,deadlineMs:life.deadline()})));
   if(selected.authenticationSha256!==hash(authentication)||!same(selected.binding,q.binding))fail('UPLOAD_ACCESS_DENIED');
   const current=createRequestCurrent({credential:q.credential,deadlineMs:life.deadline(),signal:life.signal,ports,now,maxBytes:65536,
    commandContext:{binding:q.binding,clientResolution:selected.selectedClientId===null?null:{clientId:selected.selectedClientId,reference:selected.selectedClientId}}});
   const custody=createUploadCustody({store,objects,inspection,retention,removeOriginal,now,ids:()=>fail('UPLOAD_SOURCE_READ_ONLY'),current:async()=>{const observed=await current.fresh(life);return observed.current;}});
   const source=await custody.readForInput(selection,{signal:life.signal,deadlineMs:life.deadline()});
   const projected=projectUploadInputSource(source.record,q.page);await current.fresh(life);life.check();return projected;
  }finally{life.close();}
 }
 return Object.freeze({admit:readWithSession,async read(value){
  const {signal,...raw}=own(value,['binding','selection','deadlineMs'],['signal','page']),q=data(raw),selection=assertUploadSelections([q.selection])[0];
  const saved=await conversationStore.read(q.binding,{after:0,limit:1},()=>signal?.throwIfAborted());
  if(!same(saved.run.binding,q.binding)||!assertUploadSelections(saved.request.uploads).some(item=>same(item,selection)))fail('UPLOAD_ACCESS_DENIED');
  const scopes=saved.run.scopes,clients=scopes.filter(scope=>scope.kind==='client');
  const selectedClientId=scopes.length===1&&clients.length===1?clients[0].resourceId:scopes.length===1&&scopes[0].kind==='private-user'&&scopes[0].resourceId===q.binding.actorId?null:undefined;
  if(selectedClientId===undefined)fail('UPLOAD_ACCESS_DENIED');
  const borrow=borrowedRunSession(sessions);if(!borrow)fail('UPLOAD_ACCESS_DENIED');
  const session=assertActionSessionReceipt(await borrow({binding:q.binding,selectedClientId,signal}),now());
  return readWithSession({...q,selection,credential:session.credential,deadlineMs:Math.min(q.deadlineMs,session.expiresAtMs),signal});
 }});
}
