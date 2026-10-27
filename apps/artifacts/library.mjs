/** Current-origin metadata discovery over the existing publication/read owners. No byte or write admission. */
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {verifyArtifactVersionStorageRecord as storedRecord} from './storage/version-record.mjs';
import {publicationCursor} from './publication-cursor.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
const hidden=error=>['ACCESS_DENIED','RETENTION_SUPPRESSED'].includes(error?.code);
export async function readArtifactLibrary({v,versions,authorizeOrigin,operation,authority,servable,recoverTenant,now},raw,contextValue,options={}){
 const query=data(own(raw,['scope','limit','cursor']));
 if(!['conversation','client','owner'].includes(query.scope)||!Number.isInteger(query.limit)||query.limit<1||query.limit>100||query.cursor!==null&&(typeof query.cursor!=='string'||!/^[a-f0-9]{64}$/u.test(query.cursor)))fail('ARTIFACT_LIBRARY_INPUT');
 if(typeof versions.list!=='function'||typeof authorizeOrigin!=='function')fail('UNAVAILABLE');
 const context=v.context(contextValue),clients=context.scopes.filter(s=>s.kind==='client');
 if(query.scope==='client'&&(context.scopes.length!==1||clients.length!==1))fail('ACCESS_DENIED');
 const selection={tenantId:context.binding.tenantId,actorId:context.binding.actorId,conversationId:query.scope==='conversation'?context.binding.conversationId:null,clientId:query.scope==='client'?clients[0].resourceId:null};
 const life=operation(context,options.signal),resource={versionId:null,object:null,assetObjects:[]},requestSha256=v.hash({intent:'list',query,context});
 function candidates(value){const result=data(own(value,['records']));if(!Array.isArray(result.records)||result.records.length>1024)fail('ARTIFACT_LIBRARY_RESULT');const ids=new Set();
  const records=result.records.map(storedRecord);for(const record of records){const version=record.version,b=version.binding;
   if(b.tenantId!==selection.tenantId||b.actorId!==selection.actorId||ids.has(version.artifactId)||selection.conversationId!==null&&b.conversationId!==selection.conversationId||selection.clientId!==null&&(version.scopes.length!==1||version.scopes[0].kind!=='client'||version.scopes[0].resourceId!==selection.clientId))fail('ARTIFACT_LIBRARY_RESULT');ids.add(version.artifactId);}
  return records.sort((a,b)=>b.version.createdAt.localeCompare(a.version.createdAt)||b.version.versionId.localeCompare(a.version.versionId));
 }
 async function origin(record,phase,phaseStart){
  const version=record.version,receipt=data(await life.run(signal=>authorizeOrigin({version:v.snapshot(version),phase,deadlineMs:context.deadlineMs,signal})));
  own(receipt,['versionSha256','principal','conversationId','selectedClientId','identityRevision','contextRevision','scopesSha256','checkedAtMs','expiresAtMs']);own(receipt.principal,['tenantId','actorId']);
  const scopes=version.scopes,client=scopes.length===1&&scopes[0].kind==='client'?scopes[0].resourceId:null;
  if(receipt.versionSha256!==v.hash(version)||receipt.scopesSha256!==v.hash(scopes)||receipt.principal.tenantId!==context.binding.tenantId||receipt.principal.actorId!==context.binding.actorId||receipt.conversationId!==version.binding.conversationId||receipt.selectedClientId!==client||typeof receipt.identityRevision!=='string'||!receipt.identityRevision||typeof receipt.contextRevision!=='string'||!receipt.contextRevision||!Number.isSafeInteger(receipt.checkedAtMs)||receipt.checkedAtMs<phaseStart||receipt.checkedAtMs>now()||!Number.isSafeInteger(receipt.expiresAtMs)||receipt.expiresAtMs<=now())fail('ARTIFACT_LIBRARY_AUTHORITY');
  life.limitDeadline(receipt.expiresAtMs);const {checkedAtMs,expiresAtMs,...pin}=receipt;return v.hash(pin);
 }
 try{
  await authority(life,'artifact.inspect',resource,requestSha256,context);await servable(life,context);
  const publication=typeof versions.publicationSnapshot==='function'?await life.run(signal=>versions.publicationSnapshot(selection.tenantId,signal)):null;
  let records,offset=0,end,nextCursor;
  if(publication?.paged===true){
   const cursor=publicationCursor(v.hash({intent:'artifact.list',selection,query:{scope:query.scope,limit:query.limit},binding:context.binding,scopes:context.scopes,positionSha256:publication.positionSha256}),'ARTIFACT_LIBRARY_CURSOR');
   const page=data(await life.run(signal=>versions.listPage({...selection,offset:cursor.decode(query.cursor),limit:query.limit,positionSha256:publication.positionSha256},signal)));own(page,['records','nextOffset','positionSha256']);
   if(page.positionSha256!==publication.positionSha256||!Array.isArray(page.records)||page.records.length>query.limit)fail('ARTIFACT_LIBRARY_RESULT');records=candidates({records:page.records});end=records.length;nextCursor=page.nextOffset===null?null:cursor.encode(page.nextOffset);
  }else{
   await recoverTenant(life,context);records=candidates(await life.run(signal=>versions.list(selection,signal)));
   const snapshotSha256=v.hash({selection,query:{scope:query.scope,limit:query.limit},binding:context.binding,scopes:context.scopes,records}),cursorAt=position=>v.hash({intent:'artifact.list',snapshotSha256,offset:position});
   if(query.cursor!==null){offset=-1;for(let i=1;i<records.length;i++)if(cursorAt(i)===query.cursor){offset=i;break;}if(offset<0)fail('ARTIFACT_LIBRARY_CURSOR');}end=Math.min(offset+query.limit,records.length);nextCursor=end<records.length?cursorAt(end):null;
  }
  const selected=[],admissionStart=now();
  for(const candidate of records.slice(offset,end)){try{
   await servable(life,context,candidate);const pin=await origin(candidate,'admission',admissionStart);
   if(publication?.paged===true)await life.run(signal=>versions.recoverVersion(selection.tenantId,candidate.version.versionId,signal));
   const record=storedRecord(await life.run(signal=>versions.read(candidate.version.versionId,signal)));if(v.hash(record)!==v.hash(candidate))fail('ARTIFACT_LIBRARY_RESULT');
   await servable(life,context,record);selected.push({record,pin});
  }catch(error){if(!hidden(error))throw error;}}
  const releaseStart=now(),released=[];for(const {record,pin}of selected){try{
   if(await origin(record,'release',releaseStart)!==pin)fail('ARTIFACT_LIBRARY_AUTHORITY');await servable(life,context,record);released.push(record.version);
  }catch(error){if(!hidden(error))throw error;}}
  if(publication?.paged===true){const again=await life.run(signal=>versions.publicationSnapshot(selection.tenantId,signal));if(again.positionSha256!==publication.positionSha256)fail('ARTIFACT_LIBRARY_CURSOR');}
  else{const again=candidates(await life.run(signal=>versions.list(selection,signal)));if(v.hash(again)!==v.hash(records))fail('ARTIFACT_LIBRARY_CURSOR');}
  await authority(life,'artifact.inspect',resource,requestSha256,context);await servable(life,context);life.check();
  return {scope:query.scope,versions:released,nextCursor};
 }catch(error){error.lifetime=life.close();throw error;}finally{life.close();}
}
