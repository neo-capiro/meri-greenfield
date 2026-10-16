/** Trusted in-process composition; no grant creation, native calls or startup IO. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createS3ArtifactObjects,createPostgresArtifactVersions,createPrivateBucketVerifier} from '../../artifacts/storage/index.mjs';
import {createLocalArtifactExecutor} from '../../artifacts/local-executor.mjs';
import {admittedConverter,isRendererPort} from '../../artifacts/renderer.mjs';
export function createRuntimeArtifactStorage(options){const c=own(options,['s3','versionsPool','now'],['maxRequestMs','maxBytes','journal','publication','retention','tenantId']);
 const s3=own(c.s3,['client','bucket','prefix','expectedBucketOwner','kmsKeyId']);
 const deadline=c.maxRequestMs===undefined?{}:{maxRequestMs:c.maxRequestMs},privacy=createPrivateBucketVerifier({client:s3.client,bucket:s3.bucket,expectedBucketOwner:s3.expectedBucketOwner,now:c.now,...deadline});
 // verifyPrivate is the read-only bucket privacy proof the download-link readiness gate requires (the `artifactStore` product port).
 const publication=Object.fromEntries(['journal','publication','retention','tenantId'].filter(k=>c[k]!==undefined).map(k=>[k,c[k]]));
 return Object.freeze({objects:createS3ArtifactObjects({...s3,now:c.now,...deadline,...(c.maxBytes===undefined?{}:{maxBytes:c.maxBytes})}),versions:createPostgresArtifactVersions({pool:c.versionsPool,now:c.now,...deadline,...publication}),verifyPrivate:input=>privacy.verifyPrivate(input)});}
/** The fixed generator owner. PDF conversion is bound only through a qualified-renderer port (`../../artifacts/renderer.mjs`);
 * a raw `officeTransformer` is refused, and an absent or unavailable port leaves PDF fail-closed (ARTIFACT_RENDERER_UNAVAILABLE). */
export function createFixedRuntimeArtifactExecutor(configuration){const {renderer,...c}=own(configuration,['pythonExecutable','nodeExecutable','pptxModulePath','tempRoot'],['timeoutMs','renderer']);
 if(renderer!==undefined&&!isRendererPort(renderer))throw Error('ARTIFACT_RUNTIME_CONFIGURATION');
 return createLocalArtifactExecutor({...c,officeTransformer:admittedConverter(renderer)});}
/** Usable by approvedOutput.read independently of the browser HTTP mount. `renderer` is the same qualified-renderer port bound into `executor`. PDF is admitted only when the explicit `pdfAdmission`
 * switch is true AND that port is available; the switch alone never admits PDF. `previews` (a preview record store) composes
 * preview publication and serving with the same renderer; without it the preview routes stay unavailable. */
export function createRuntimeDocumentOptionsComposer(options){const c=own(options,['storage','executor','budgetPool','sessions','now'],['namespace','renderer','pdfAdmission','previews','maxPreviewBytes']);
 const storage=own(c.storage,['objects','versions'],['verifyPrivate']);if(typeof c.now!=='function'||c.namespace!==undefined&&c.namespace!=='product'||c.renderer!==undefined&&!isRendererPort(c.renderer)||typeof(c.pdfAdmission??false)!=='boolean')throw Error('ARTIFACT_RUNTIME_CONFIGURATION');
 const admitPdf=c.pdfAdmission===true&&admittedConverter(c.renderer)!==null;
 const previewOptions=c.previews===undefined?undefined:{previews:c.previews,renderer:c.renderer??null,...(c.maxPreviewBytes===undefined?{}:{maxPreviewBytes:c.maxPreviewBytes})};
 return trusted=>{const o=own(trusted,['artifactOptions','selectedClientId','credential','limits'],['enabled']);
  // Full canonical configuration/admission is checked by createDocumentApplication.
  // Preserve existing sourceEnabled/enabled and the actual native owner/context.
  const a=own(o.artifactOptions,['pool','allocationJson','producerContext','descriptor','context','validators','authority','authorize','versions','objects','executor','now','ids','newReservationId','limits'],['sourceEnabled','namespace']);
  if(a.validators!==v||a.now!==c.now)throw Error('ARTIFACT_RUNTIME_CONFIGURATION');
  // PDF belongs to the create_word family only; an Excel-bound application is never asked to admit it.
  return {...o,sessions:c.sessions,now:c.now,...(admitPdf&&a.descriptor?.operation?.id==='create_word'?{admitPdf}:{}),...(previewOptions?{previewOptions}:{}),artifactOptions:{...a,pool:c.budgetPool,versions:storage.versions,objects:storage.objects,executor:c.executor,...(c.namespace===undefined?{}:{namespace:c.namespace})}};
 };}
