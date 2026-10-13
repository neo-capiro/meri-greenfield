/** Trusted in-process composition; no grant creation, native calls or startup IO. */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createS3ArtifactObjects,createPostgresArtifactVersions} from '../../artifacts/storage/index.mjs';
import {createLocalArtifactExecutor} from '../../artifacts/local-executor.mjs';
export function createRuntimeArtifactStorage(options){const c=own(options,['s3','versionsPool','now'],['maxRequestMs','maxBytes']);
 const s3=own(c.s3,['client','bucket','prefix','expectedBucketOwner','kmsKeyId']);
 return Object.freeze({objects:createS3ArtifactObjects({...s3,now:c.now,...(c.maxRequestMs===undefined?{}:{maxRequestMs:c.maxRequestMs}),...(c.maxBytes===undefined?{}:{maxBytes:c.maxBytes})}),versions:createPostgresArtifactVersions({pool:c.versionsPool,now:c.now,...(c.maxRequestMs===undefined?{}:{maxRequestMs:c.maxRequestMs})})});}
export function createFixedRuntimeArtifactExecutor(configuration){return createLocalArtifactExecutor(configuration);}
/** Usable by approvedOutput.read independently of the browser HTTP mount. */
export function createRuntimeDocumentOptionsComposer(options){const c=own(options,['storage','executor','budgetPool','sessions','now'],['namespace']);
 const storage=own(c.storage,['objects','versions']);if(typeof c.now!=='function'||c.namespace!==undefined&&c.namespace!=='product')throw Error('ARTIFACT_RUNTIME_CONFIGURATION');
 return trusted=>{const o=own(trusted,['artifactOptions','selectedClientId','credential','limits'],['enabled']);
  // Full canonical configuration/admission is checked by createDocumentApplication.
  // Preserve existing sourceEnabled/enabled and the actual native owner/context.
  const a=own(o.artifactOptions,['pool','allocationJson','producerContext','descriptor','context','validators','authority','authorize','versions','objects','executor','now','ids','newReservationId','limits'],['sourceEnabled','namespace']);
  if(a.validators!==v||a.now!==c.now)throw Error('ARTIFACT_RUNTIME_CONFIGURATION');
  return {...o,sessions:c.sessions,now:c.now,artifactOptions:{...a,pool:c.budgetPool,versions:storage.versions,objects:storage.objects,executor:c.executor,...(c.namespace===undefined?{}:{namespace:c.namespace})}};
 };}
