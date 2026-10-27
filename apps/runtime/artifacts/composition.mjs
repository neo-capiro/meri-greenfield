/** Trusted in-process composition; no grant creation, native calls or startup IO. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createS3ArtifactObjects,createPostgresArtifactVersions,createPrivateBucketVerifier,createS3ArtifactPublication} from '../../artifacts/storage/index.mjs';
import {createLocalArtifactExecutor} from '../../artifacts/local-executor.mjs';
import {admittedConverter,isRendererPort} from '../../artifacts/renderer.mjs';
import {createPostgresS3PreviewCustody} from '../../artifacts/preview/postgres-composition.mjs';
import {createS3ArtifactPublications} from '../../artifacts/storage/s3-artifact-publication.mjs';
const recoveryOwners=new WeakMap();
/** Internal provenance only. Recovery cannot be supplied by a lookalike product port or a JSON configuration callback. */
export function runtimeArtifactRecovery(storage){return recoveryOwners.get(storage)??null;}
export function createRuntimeArtifactStorage(options){const c=own(options,['s3','versionsPool','now'],['maxRequestMs','maxBytes','custody']);
 const s3=own(c.s3,['client','bucket','prefix','expectedBucketOwner','kmsKeyId']);
 const deadline=c.maxRequestMs===undefined?{}:{maxRequestMs:c.maxRequestMs},privacy=createPrivateBucketVerifier({client:s3.client,bucket:s3.bucket,expectedBucketOwner:s3.expectedBucketOwner,now:c.now,...deadline});
 // verifyPrivate is the read-only bucket privacy proof the download-link readiness gate requires (the `artifactStore` product port).
 let versions,previews,recover,record;
 if(c.custody===undefined)versions=createPostgresArtifactVersions({pool:c.versionsPool,now:c.now,...deadline});
 else{
  const p=own(c.custody,['journal','retention','evidenceS3'],['tenantId','artifactId','enabled']),enabled=p.enabled===undefined?false:p.enabled;
  if(typeof enabled!=='boolean')throw Error('ARTIFACT_RUNTIME_CONFIGURATION');
  if(p.artifactId!==undefined){const owner=createPostgresS3PreviewCustody({journal:p.journal,retention:p.retention,versionsPool:c.versionsPool,evidenceS3:p.evidenceS3,tenantId:p.tenantId,artifactId:p.artifactId,now:c.now,enabled,...deadline});versions=owner.versions;previews=owner.previews;recover=signal=>owner.recovery.reconcileExclusive(signal);}
  else{const evidence=own(p.evidenceS3,['client','bucket','prefix','expectedBucketOwner','kmsKeyId']);
   const publication=p.tenantId===undefined?{publications:createS3ArtifactPublications({...evidence,now:c.now,enabled,...deadline})}:{publication:createS3ArtifactPublication({...evidence,tenantId:p.tenantId,now:c.now,enabled,...deadline}),tenantId:p.tenantId};
   versions=createPostgresArtifactVersions({pool:c.versionsPool,now:c.now,journal:p.journal,retention:p.retention,...publication,...deadline});
   // Retention startup certifies its own ledger only. Dynamic artifact projections recover on authenticated tenant access.
   recover=p.tenantId===undefined?async()=>undefined:signal=>versions.recoverExclusive(signal);}
  record=Object.freeze({journal:p.journal,retention:p.retention,versions,state:enabled?'composed':'disabled',recoverPrerequisitesExclusive:recover});
 }
 const storage=Object.freeze({objects:createS3ArtifactObjects({...s3,now:c.now,...deadline,...(c.maxBytes===undefined?{}:{maxBytes:c.maxBytes})}),versions,...(previews?{previews}:{}),verifyPrivate:input=>privacy.verifyPrivate(input)});
 if(record)recoveryOwners.set(storage,record);return storage;}
/** The fixed generator owner. PDF conversion is bound only through a qualified-renderer port (`../../artifacts/renderer.mjs`);
 * a raw `officeTransformer` is refused, and an absent or unavailable port leaves PDF fail-closed (ARTIFACT_RENDERER_UNAVAILABLE). */
export function createFixedRuntimeArtifactExecutor(configuration){const {renderer,...c}=own(configuration,['pythonExecutable','nodeExecutable','pptxModulePath','tempRoot'],['timeoutMs','renderer']);
 if(renderer!==undefined&&!isRendererPort(renderer))throw Error('ARTIFACT_RUNTIME_CONFIGURATION');
 return createLocalArtifactExecutor({...c,officeTransformer:admittedConverter(renderer)});}
/** Usable by approvedOutput.read independently of the browser HTTP mount. `renderer` is the same qualified-renderer port bound into `executor`. PDF is admitted only when the explicit `pdfAdmission`
 * switch is true AND that port is available; the switch alone never admits PDF. `previews` (a preview record store) composes
 * preview publication and serving with the same renderer; without it the preview routes stay unavailable. */
export function createRuntimeDocumentOptionsComposer(options){const c=own(options,['storage','executor','pool','sessions','store','now'],['renderer','pdfAdmission','previews','previewStoreForContext','maxPreviewBytes']);
 const storage=own(c.storage,['objects','versions'],['verifyPrivate','previews']);if(typeof c.now!=='function'||typeof c.store?.lifecycle?.readArtifactFile!=='function'||c.renderer!==undefined&&!isRendererPort(c.renderer)||typeof(c.pdfAdmission??false)!=='boolean'||c.previews!==undefined&&storage.previews!==undefined&&c.previews!==storage.previews)throw Error('ARTIFACT_RUNTIME_CONFIGURATION');
 const admitPdf=c.pdfAdmission===true&&admittedConverter(c.renderer)!==null,previews=c.previews??storage.previews;
 if(c.previewStoreForContext!==undefined&&(typeof c.previewStoreForContext!=='function'||previews!==undefined))throw Error('ARTIFACT_RUNTIME_CONFIGURATION');
 return trusted=>{const o=own(trusted,['artifactOptions','selectedClientId','limits'],['enabled']),a=own(o.artifactOptions,['pool','context','validators','authorize','versions','objects','executor','now','ids'],['retention','admitRetainedEvidence','authorizeOrigin']);
  if(a.validators!==v||a.now!==c.now)throw Error('ARTIFACT_RUNTIME_CONFIGURATION');
  const selectedPreviews=c.previewStoreForContext?c.previewStoreForContext(a.context):previews;
  const previewOptions=selectedPreviews===undefined?undefined:{previews:selectedPreviews,renderer:c.renderer??null,...(c.maxPreviewBytes===undefined?{}:{maxPreviewBytes:c.maxPreviewBytes})};
  const nativeFiles={async read(versionId,signal){const check=()=>{if(signal?.aborted)throw Error('ARTIFACT_CANCELLED');if(c.now()>=a.context.deadlineMs)throw Error('ARTIFACT_DEADLINE');};check();
   return c.store.lifecycle.readArtifactFile({binding:a.context.binding,scopes:a.context.scopes,selectedClientId:o.selectedClientId,versionId},check);}};
  return {...o,sessions:c.sessions,now:c.now,admitPdf,nativeFiles,...(previewOptions?{previewOptions}:{}),artifactOptions:{...a,pool:c.pool,versions:storage.versions,objects:storage.objects,executor:c.executor}};
 };}
