/** Exact-version filing attachments, owned by the artifact service: the `resolveAttachments` port that the governed filing
 * command source (`apps/control/commands/source-http.mjs`, action `artifact.file`) invokes inside its claimed execution before it calls the source's
 * save_chat_attachments route. For each selected immutable object, in order:
 *   1. the trusted version store resolves which version of this tenant conversation holds exactly that object;
 *   2. the canonical artifact read (`artifact.download` authorization, retention gate, current bytes) returns its bytes, and
 *      the stored object must equal the selected reference exactly (id, object version, digest, size, scopes);
 *   3. the trusted host attachment broker registers exactly those bytes for the trusted destination and returns the source
 *      attachment id with the digest and size it stored, which must match.
 * Every version is then re-read through the canonical inspect path before the fact is released, so authority or a
 * suppression that changed during registration refuses. Nothing is registered for an object that fails steps 1–2. A failure
 * once the first registration attempt has started is ARTIFACT_EFFECT_UNKNOWN with the number of attempts started (each may
 * have left a source attachment); never a no-effect refusal.
 * The broker owns the source-side upload and its credentials; this module holds none. Construction performs no IO. */
const fail=code=>{throw Object.assign(new Error(code),{code});};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const closed=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join()===[...keys].sort().join();

export function createArtifactFilingResolver({validators:v,artifacts,versions,readContext,attachments,now}){
 if(![artifacts?.download,artifacts?.inspect,versions?.findByObject,readContext,attachments?.register,now].every(f=>typeof f==='function')||typeof v?.hash!=='function')fail('ARTIFACT_CONFIGURATION');
 const same=(a,b)=>v.hash(a)===v.hash(b);
 return async function resolveAttachments({objects,destination,binding,deadlineMs,signal}){
  if(!Array.isArray(objects)||objects.length<1||objects.length>10||!Number.isSafeInteger(deadlineMs))fail('ARTIFACT_FILING_INPUT');
  const trusted=v.context(await readContext({binding:v.snapshot(binding),destination:v.snapshot(destination),deadlineMs,signal}));
  if(!same(trusted.binding,binding))fail('ARTIFACT_FILING_CONTEXT');
  const context=v.context({...trusted,deadlineMs:Math.min(trusted.deadlineMs,deadlineMs)});
  const selected=[];
  for(const value of objects){
   const object=v.object(value);let versionId;
   try{versionId=await versions.findByObject({objectId:object.objectId,tenantId:binding.tenantId,conversationId:binding.conversationId},signal);}catch(error){if(error?.code==='ENOENT')fail('ARTIFACT_FILING_OBJECT_UNKNOWN');throw error;}
   const read=await artifacts.download(versionId,context,{signal});
   if(!same(read.version.object,object))fail('ARTIFACT_FILING_OBJECT_MISMATCH');
   selected.push({object,version:read.version,bytes:read.bytes});
  }
  const rows=[];let expiresAtMs=context.deadlineMs;
  try{
   for(const s of selected){
    rows.push(s);// the attempt has started: from here the source may hold an attachment
    const receipt=v.snapshot(await attachments.register({binding:v.snapshot(binding),destination:v.snapshot(destination),versionId:s.version.versionId,object:v.snapshot(s.object),
     filename:s.version.filename,mimeType:s.version.mimeType,bytes:Buffer.from(s.bytes),deadlineMs:context.deadlineMs,signal}));
    if(!closed(receipt,['attachmentId','sha256','bytes','expiresAtMs'])||typeof receipt.attachmentId!=='string'||!UUID.test(receipt.attachmentId)||receipt.sha256!==s.object.sha256||receipt.bytes!==s.object.bytes||
     !Number.isSafeInteger(receipt.expiresAtMs)||receipt.expiresAtMs<=now()||selected.some(r=>r.attachmentId===receipt.attachmentId.toLowerCase()))fail('ARTIFACT_FILING_ATTACHMENT_RECEIPT');
    s.attachmentId=receipt.attachmentId.toLowerCase();expiresAtMs=Math.min(expiresAtMs,receipt.expiresAtMs);
   }
   // Current authority and retention for every selected version after registration, before the fact is released.
   for(const s of selected){const current=await artifacts.inspect(s.version.versionId,context,{signal});if(!same(current.version.object,s.object))fail('ARTIFACT_FILING_OBJECT_MISMATCH');}
   if(signal?.aborted||now()>=expiresAtMs)fail('ARTIFACT_CANCELLED');
   return {binding:v.snapshot(binding),destination:v.snapshot(destination),expiresAtMs,objects:selected.map(s=>({object:v.snapshot(s.object),attachmentId:s.attachmentId}))};
  }catch(cause){
   if(!rows.length)throw cause;
   throw Object.assign(new Error('ARTIFACT_EFFECT_UNKNOWN'),{code:'ARTIFACT_EFFECT_UNKNOWN',cause,registrationAttempts:rows.length});
  }
 };
}
