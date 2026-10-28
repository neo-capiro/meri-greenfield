/** Closed draft correlation after the canonical artifact owner has completed its
 * own current-authority/context checks. This creates no access or publication. */
import {artifactValidators as v,validateShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {ARTIFACT_MIME_TYPES,artifactFilename} from '../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
export function assertIntentArtifactDraft(value,{binding,request,context=null,baseVersion=null}){
 const result=v.snapshot(value);validateShape('ArtifactCreatedResult',result);
 if(context!==null)v.assertArtifactOutput(request.operation,result,request,context);
 const {version,inspection}=result;
 if(version.generationStatus!=='draft'||version.parentVersionId!==(baseVersion?.versionId??null)||baseVersion!==null&&version.artifactId!==baseVersion.artifactId||version.previewStatus!=='pending'||
  v.hash(version.binding)!==v.hash(binding)||v.hash(version.scopes)!==v.hash(version.object.scopes)||
  version.scopes.some(scope=>scope.tenantId!==binding.tenantId)||
  version.mimeType!==ARTIFACT_MIME_TYPES[request.format]||version.filename!==artifactFilename(request)||
  inspection.format!==request.format||inspection.sha256!==version.object.sha256||inspection.bytes!==version.object.bytes)
  throw Error('INVALID_ARTIFACT_DRAFT');
 return result;
}
