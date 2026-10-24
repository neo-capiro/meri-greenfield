import canonicalize from 'canonicalize';
// One content-format vocabulary shared by validation and publication metadata.
export const ARTIFACT_MIME_TYPES=Object.freeze({docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain; charset=utf-8',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',pdf:'application/pdf',zip:'application/zip'});
export const artifactFilename=request=>(request.title.replace(/[^A-Za-z0-9._ -]/g,'_').replace(/^\.+/,'').trim().slice(0,120)||'artifact')+'.'+request.format;

/** One native workspace path, with the same file/path bounds as the native file owner. */
export function nativeArtifactBasename(path){
 if(typeof path!=='string'||!path.isWellFormed()||path.length<1||path.length>4096||path.normalize('NFC')!==path||/[\\\x00-\x1f\x7f:]/u.test(path)||path.split('/').some(part=>!part||part==='.'||part==='..'||part.length>128))throw Error('NATIVE_ARTIFACT_PATH');
 return path.split('/').at(-1);
}
export function nativeArtifactFilename(path){return nativeArtifactBasename(path).replace(/[^A-Za-z0-9._ -]/g,'_').replace(/^\.+/,'').trim().slice(0,120)||'file';}
export function nativeArtifactDisposition(path){const name=nativeArtifactBasename(path),safe=nativeArtifactFilename(path),base=`attachment; filename="${safe}"`;return name===safe?base:base+"; filename*=UTF-8''"+encodeURIComponent(name).replace(/[!'()*]/g,char=>'%'+char.charCodeAt(0).toString(16).toUpperCase());}
/** Schema admission precedes these correlations; this is byte metadata, never a render claim. */
export function assertNativeArtifactInspectionCorrelations(result){
 const {version,integrity}=result;nativeArtifactBasename(version.path);
 if(version.versionId!==version.object.objectId||['null','pending'].includes(version.object.versionId)||version.object.bytes>8388608||canonicalize(version.scopes)!==canonicalize(version.object.scopes)||version.scopes.some(scope=>scope.tenantId!==version.binding.tenantId)||integrity.sha256!==version.object.sha256||integrity.bytes!==version.object.bytes)throw Error('NATIVE_ARTIFACT_CORRELATION');
 return result;
}

/** Structural provenance preserves the source run; current writers separately admit any cross-run use. */
export function assertNativeArtifactEvidenceBinding(binding,evidence){
 for(const item of evidence)if(Object.hasOwn(item,'binding')&&['tenantId','actorId','conversationId'].some(key=>item.binding[key]!==binding[key]))throw Error('NATIVE_ARTIFACT_EVIDENCE_BINDING');
}
