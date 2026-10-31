/** Attended upload adoption. The source reader and immutable publisher retain
 * their own authority, retention and unknown-effect recovery responsibilities. */
export async function importOfficeOriginal({source,current,selection,operation,credential,generation}){
 const fail=code=>{throw Object.assign(Error(code),{code});};
 if(typeof source?.open!=='function')fail('OFFICE_IMPORT_UNAVAILABLE');
 let original;
 try{
  original=await current.life.run(signal=>source.open({credential,selection,binding:current.context.binding,scopes:current.context.scopes,
   selectedClientId:current.selectedClientId,signal,deadlineMs:current.life.deadline()}));
  const context=current.validators.context({...current.context,evidence:[],assets:[]});
  const publisher=current.originalPublisherFor(context,original.fresh);
  await current.fresh('effect');await original.fresh();
  const result=await current.life.run(signal=>operation==='recover'?publisher.recoverOfficeOriginal(original.source,original.bytes,signal):publisher.executeOfficeOriginal(original.source,original.bytes,signal));
  const document=await current.life.run(signal=>current.artifacts.inspect(result.version.versionId,context,{signal}));
  if(document.version.object.sha256!==selection.sha256||document.version.parentVersionId!==null||
   document.version.object.bytes!==original.bytes.length||current.validators.hash(document.version)!==current.validators.hash(result.version))fail('EDITOR_SOURCE_MISMATCH');
  const subjects=[{tenantId:context.binding.tenantId,kind:'conversation',subjectId:context.binding.conversationId},
   {tenantId:context.binding.tenantId,kind:'artifact',subjectId:document.version.artifactId}];
  const before=await current.life.run(()=>generation(subjects));
  if(!Number.isSafeInteger(before)||before<0)fail('EDITOR_RETENTION_UNAVAILABLE');
  await original.fresh();await current.fresh();
  if(await current.life.run(()=>generation(subjects))!==before)fail('EDITOR_RESULT_NOT_RELEASED');
  current.life.check();return {uploadId:selection.uploadId,sha256:selection.sha256,document};
 }catch(cause){
  if(cause?.code==='ARTIFACT_REPLAY_UNRESOLVED')throw Object.assign(Error('OFFICE_IMPORT_UNRESOLVED'),{code:'OFFICE_IMPORT_UNRESOLVED',cause});
  throw cause;
 }finally{original?.close();}
}
