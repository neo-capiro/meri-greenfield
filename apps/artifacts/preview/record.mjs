/** The immutable preview record (local wire proposal `meri.artifact-preview.proposal-1`; not a frozen contract). One record per
 * artifact version binds the exact source object, the stored preview object, its page count and the conversion provenance.
 * The frozen ArtifactVersion keeps `previewStatus:'pending'`; publication state lives here, never in the version. */
import {PREVIEW_MIME_TYPE,MAX_PREVIEW_PAGES} from './render.mjs';
export const PREVIEW_RECORD_VERSION='meri.artifact-preview.proposal-1';
const KEYS=['recordVersion','previewId','versionId','artifactId','tenantId','conversationId','source','preview','conversion','status','nativeQualified','createdAt'];
const CONVERSION_KEYS=['method','inputSha256','outputSha256','qualificationId','imageDigest'];
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu,DIGEST=/^[a-f0-9]{64}$/u;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const closed=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join()===[...keys].sort().join();

export function previewRecord({v,previewId,version,object,pages,conversion,createdAt}){
 return verifyPreviewRecord(v,{recordVersion:PREVIEW_RECORD_VERSION,previewId,versionId:version.versionId,artifactId:version.artifactId,tenantId:version.binding.tenantId,
  conversationId:version.binding.conversationId,source:{sha256:version.object.sha256,bytes:version.object.bytes,mimeType:version.mimeType},
  preview:{object,mimeType:PREVIEW_MIME_TYPE,pages},conversion,status:'published',nativeQualified:false,createdAt},version);
}
/** A detached, validated copy of `value`, bound to the exact `version` it previews; anything else is ARTIFACT_PREVIEW_CORRUPT. */
export function verifyPreviewRecord(v,value,version){
 let r;try{r=v.snapshot(value);}catch{fail('ARTIFACT_PREVIEW_CORRUPT');}
 if(!closed(r,KEYS)||!closed(r.source,['sha256','bytes','mimeType'])||!closed(r.preview,['object','mimeType','pages'])||!closed(r.conversion,CONVERSION_KEYS))fail('ARTIFACT_PREVIEW_CORRUPT');
 try{r.preview.object=v.object(r.preview.object);}catch{fail('ARTIFACT_PREVIEW_CORRUPT');}
 const c=r.conversion,o=r.preview.object,sameScopes=v.hash(o.scopes)===v.hash(version.scopes);
 if(r.recordVersion!==PREVIEW_RECORD_VERSION||!UUID.test(r.previewId??'')||r.versionId!==version.versionId||r.artifactId!==version.artifactId||r.tenantId!==version.binding.tenantId||r.conversationId!==version.binding.conversationId||
  r.source.sha256!==version.object.sha256||r.source.bytes!==version.object.bytes||r.source.mimeType!==version.mimeType||r.preview.mimeType!==PREVIEW_MIME_TYPE||!Number.isSafeInteger(r.preview.pages)||r.preview.pages<1||r.preview.pages>MAX_PREVIEW_PAGES||!sameScopes||
  !['source-pdf','office-pdf'].includes(c.method)||c.inputSha256!==r.source.sha256||c.outputSha256!==o.sha256||!DIGEST.test(o.sha256)||
  (c.method==='source-pdf'?c.qualificationId!==null||c.imageDigest!==null||o.sha256!==r.source.sha256:typeof c.qualificationId!=='string'||!c.qualificationId||typeof c.imageDigest!=='string')||
  r.status!=='published'||r.nativeQualified!==false||typeof r.createdAt!=='string'||new Date(Date.parse(r.createdAt)).toISOString()!==r.createdAt)fail('ARTIFACT_PREVIEW_CORRUPT');
 return Object.freeze(r);
}
