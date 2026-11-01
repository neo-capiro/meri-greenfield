/** Current clean-original read for attended Office import. It does not require
 * extracted text, mutate upload custody, or project bytes through the browser. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertUploadSelections} from '../../../packages/contracts/upload-selection.mjs';
import {OFFICE_ORIGINAL_KIND,OFFICE_OPERATIONS,officeOriginalSource,officeOriginalTitle} from '../../../packages/contracts/office-edit.mjs';
import {authenticatedCurrentState} from '../action-host/session/owner.mjs';
import {createUploadCustody,hash,fail} from './custody.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {uploadError} from './policy.mjs';
export function createOfficeOriginalReader({sessions,store,objects,inspection,retention,removeOriginal,now}){
 const native=authenticatedCurrentState(sessions),same=(a,b)=>hash(a)===hash(b);
 return Object.freeze({async open(value){
  const q=own(value,['credential','selection','binding','scopes','selectedClientId','deadlineMs'],['signal']);
  const selection=assertUploadSelections([q.selection])[0],life=createOperationLifetime({signal:q.signal,deadlineMs:q.deadlineMs,now,errorFactory:uploadError});
  let pin;
  const current=async()=>{
   const {authentication,current:c}=await life.run(signal=>native({credential:q.credential,signal,deadlineMs:life.deadline()}));
   const identity=hash({principal:authentication.principal,sessionRevision:authentication.sessionRevision});
   if(pin!==undefined&&identity!==pin||!same(c.binding,q.binding)||!same(c.scopes,q.scopes)||c.selectedClientId!==q.selectedClientId)fail('UPLOAD_ACCESS_DENIED');
   pin??=identity;life.limitDeadline(Math.min(authentication.expiresAtMs,c.expiresAtMs));return c;
  };
  const custody=createUploadCustody({store,objects,inspection,retention,removeOriginal,now,current,ids:()=>fail('UPLOAD_SOURCE_READ_ONLY')});
  const options={signal:life.signal,deadlineMs:life.deadline()};
  const provenance=r=>{
   // A structurally refused original (active content, bad container) is retained as a blocked extraction; it is never offered to the editor.
   if(r.state!=='stored'||r.inspection?.scan.status!=='clean'||r.inspection.extraction.status==='blocked'||r.declaration.sha256!==selection.sha256||!same(r.scopes,q.scopes))fail('UPLOAD_NOT_CLEAN');
   const format=r.inspection.file.format;
   if(!Object.hasOwn(OFFICE_OPERATIONS,format))fail('EDITOR_FORMAT_UNSUPPORTED');
   const original={uploadId:r.uploadId,requestId:r.requestId,objectId:r.object.objectId,objectVersionId:r.object.versionId,
    sha256:r.declaration.sha256,bytes:r.declaration.bytes,filename:r.declaration.filename};
   return officeOriginalSource({sourceKind:OFFICE_ORIGINAL_KIND,operation:OFFICE_OPERATIONS[format],format,
    title:officeOriginalTitle(r.declaration.filename,format),original});
  };
  try{
   const original=await custody.read(selection.uploadId,options),source=provenance(original.record);
   const fresh=async()=>{const latest=await custody.status(selection.uploadId,options);if(!same(provenance(latest),source))fail('UPLOAD_ORIGINAL_MISMATCH');life.check();};
   await fresh();return Object.freeze({source:data(source),bytes:Buffer.from(original.bytes),fresh,close:()=>life.close()});
  }catch(error){life.close();throw error;}
 }});
}
