/** Correlates a private current-authorized source read with the immutable user selection.
 * The selector and source hashes are not permission. Model arguments cannot choose this base. */
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertDocumentRevisionSelection} from '../../../packages/contracts/document-revision.mjs';
import {intentFault} from './faults.mjs';
const assetReference=value=>value!==null&&typeof value==='object'&&(Object.hasOwn(value,'assetId')||Object.values(value).some(assetReference));
export function admitDocumentRevisionSource(raw,{selection,binding,request}){
 try{
  const s=assertDocumentRevisionSelection(selection),source=data(own(raw,['version','request','specSha256','inspection','headVersionId']));
  const version=v.version(source.version),original=v.request(source.request),{currentBytesVerified,...inspection}=source.inspection;
  v.inspection(inspection);
  if(version.artifactId!==s.artifactId||version.versionId!==s.versionId||version.object.sha256!==s.objectSha256||source.specSha256!==v.hash(original)||
   version.binding.tenantId!==binding.tenantId||version.binding.actorId!==binding.actorId||version.binding.conversationId!==binding.conversationId||
   v.hash(version.scopes)!==v.hash(version.object.scopes)||currentBytesVerified!==true||inspection.sha256!==s.objectSha256||inspection.bytes!==version.object.bytes||inspection.format!==original.format||
   original.operation!==request.operation||original.format!==request.format)throw 0;
  if(source.headVersionId!==s.versionId)throw intentFault('CONFLICT','none');
  // Source-backed recipes need their existing compiler/source-access bridge. Never
  // turn their citations or retained assets into an uncited generic replacement.
  if(version.evidence.length||assetReference(original)||assetReference(request))throw intentFault('UNAVAILABLE','none');
  return Object.freeze({selection:s,request:original,specSha256:source.specSha256,version});
 }catch(error){if(['CONFLICT','UNAVAILABLE'].includes(error?.code)&&error.effect==='none')throw error;throw intentFault('ACCESS_DENIED','none');}
}
