/** Production product family for documents and artifacts (lane 6). Ordinary synchronous composition over the trusted control
 * context: no connection, no SQL, no secret read and no SDK request at construction. The S3 client is constructed here with an
 * explicit region and one attempt; the AWS SDK resolves credentials (the control task role) and endpoints lazily on the first
 * `send`, which happens only when trusted startup opens the download gate (`verifyPrivate`) or a document request runs.
 *
 * Ports, by declaration (`../artifacts/configuration.mjs` defines the closed `artifacts` block):
 *  - no `artifacts` block, or `enabled:false`: no port. Product readiness names artifacts.privateStore and artifacts.options.
 *  - `enabled:true` without declared retention: `artifactStore` over the real S3/PG adapters. Its versions owner is unavailable
 *    BEFORE SQL without publication custody (`apps/artifacts/storage/postgres-versions.mjs:11`), and the download gate stays
 *    closed (DOWNLOAD_LINK_RETENTION_UNAVAILABLE), so this composes only the read-only private-bucket proof.
 *  - `enabled:true` with declared retention: `artifactStore` with enabled publication custody bound to control's own retention
 *    journal and forwarder (`context.artifactRecovery`) for `tenantId`, evidence in the same bucket and prefix (key
 *    `<prefix>/artifact-publication/<sha256(tenantId)>/index.json`, disjoint from object keys `<prefix>/<64-hex>/<uuid>/<sha>`).
 *    Without that forwarder the store is NOT composed: a store with no recovery owner would keep retention serving fenced and
 *    stop control readiness (`control.mjs` retentionGate + `ensureServing`).
 *  - `artifactOptionsOwner` is composed ONLY when a trusted Core artifact authority and the fixed executor are supplied through
 *    `documentsFamily({authority,executor})` (never configuration) AND the `artifacts` block declares `authority` (the Core origin
 *    and service-secret file of docs/integration/ARTIFACT-CURRENT-AUTHORITY-CONTRACT.md). An authority that names its `origin` or
 *    `now` must match the declared origin and control's clock. Startup builds that authority with `composeDocumentsFamily`
 *    (`../artifacts/authority-composition.mjs`). The production registration supplies neither (no Core receiver and no Meri-local
 *    run-options owner exist yet), so it stays absent and `/api/documents/*` answers 503 UNAVAILABLE. When composed, the owner is late-bound to
 *    control's own action-session owner: `createRuntimeDocumentOptionsComposer` and the runtime document application both require
 *    the exact `sessions` object, which `assembleControl` creates after the product-port factory returns. Until trusted assembly
 *    calls `bindDocumentsSessions(context, sessions)` (`../artifacts/session-binding.mjs`) every resolve answers null (the
 *    application's 503 UNAVAILABLE). */
import {types} from 'node:util';
import {S3Client} from '../../artifacts/storage/s3-sdk.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createRuntimeArtifactStorage,createRuntimeDocumentOptionsComposer} from '../artifacts/composition.mjs';
import {compileRuntimeArtifactsConfiguration} from '../artifacts/configuration.mjs';
import {registerDocumentsSessionBinder,bindDocumentsSessions} from '../artifacts/session-binding.mjs';
const fault=()=>Object.assign(new Error('PRODUCT_PORTS_CONFIGURATION'),{code:'PRODUCT_PORTS_CONFIGURATION'});
const ordinary=fn=>typeof fn==='function'&&!types.isProxy(fn)&&!types.isAsyncFunction(fn)&&!types.isGeneratorFunction(fn);
/** Re-exported for tests; trusted assembly imports it from `../artifacts/session-binding.mjs`, which loads no storage graph. */
export {bindDocumentsSessions};

function lateBoundOptionsOwner({authority,compose}){
 const resolveAuthority=storageMethod(authority,'resolve');let bound=null;
 const bind=sessions=>{
  if(sessions===null||typeof sessions!=='object'||types.isProxy(sessions))throw fault();
  if(bound!==null){if(bound.sessions!==sessions)throw fault();return;}
  bound=Object.freeze({sessions,compose:compose(sessions)});
 };
 // The resolved shape is closed; `recheck` must be the authority's own method and is called with the application's exact check.
 const owner=Object.freeze({async resolve(call){
  const current=bound;if(current===null)return null;
  const raw=await resolveAuthority({...call,sessions:current.sessions});if(raw===null||raw===undefined)return null;
  const r=own(raw,['artifactOptions','selectedClientId','credential','limits','recheck'],['enabled']),recheck=storageMethod(raw,'recheck');
  const documentOptions=current.compose({artifactOptions:r.artifactOptions,selectedClientId:r.selectedClientId,credential:r.credential,limits:r.limits,...(r.enabled===undefined?{}:{enabled:r.enabled})});
  return {documentOptions,recheck:check=>recheck(check)};
 }});
 return {owner,bind};
}

/** Family factory with optional trusted owners. `createS3Client({region})` exists for synthetic tests only; production uses the
 * pinned SDK client from the artifact storage package. `authority` (Core artifact authority, `resolve({sessions,credential,intent,
 * body,requestSha256,deadlineMs,signal})` -> `{artifactOptions,selectedClientId,credential,limits,enabled?,recheck}` or null) and
 * `executor` (`createFixedRuntimeArtifactExecutor(...)` over approved image paths) must be supplied together. */
export function documentsFamily(owners={}){
 const o=own(owners,[],['authority','executor','createS3Client']);
 if(o.createS3Client!==undefined&&!ordinary(o.createS3Client))throw fault();
 if((o.authority===undefined)!==(o.executor===undefined))throw fault();
 if(o.authority!==undefined){storageMethod(o.authority,'resolve');storageMethod(o.executor,'execute');}
 const createClient=o.createS3Client??(({region})=>new S3Client({region,maxAttempts:1}));
 return function createDocumentsFamily(context){
  const {configuration,pool,now,artifactRecovery}=context;
  let declared;try{declared=compileRuntimeArtifactsConfiguration(configuration);}catch{throw fault();}
  if(declared===null||declared.enabled!==true)return {ports:{}};
  const retention=configuration.retention!==undefined;
  // Declared retention without control's recovery forwarder cannot host a store (see the module comment).
  if(retention&&artifactRecovery===undefined)return {ports:{}};
  const client=createClient({region:declared.region});
  const s3={client,bucket:declared.bucket,prefix:declared.prefix,expectedBucketOwner:declared.expectedBucketOwner,kmsKeyId:declared.kmsKeyId};
  const storage=createRuntimeArtifactStorage({s3,versionsPool:pool,now,maxRequestMs:configuration.limits.requestMs,
   ...(retention?{custody:{journal:artifactRecovery.journal,retention:artifactRecovery.retention,tenantId:declared.tenantId,evidenceS3:s3,enabled:true}}:{})});
  // Composed disabled: without a declared Core authority origin the supplied authority is never reached.
  if(o.authority===undefined||declared.authority===undefined)return {ports:{artifactStore:storage}};
  if(Object.hasOwn(o.authority,'origin')&&o.authority.origin!==declared.authority.origin||Object.hasOwn(o.authority,'now')&&o.authority.now!==now)throw fault();
  // Production documents charge the admitted run's allocation in the product budget namespace (never the qualification one).
  const late=lateBoundOptionsOwner({authority:o.authority,compose:sessions=>createRuntimeDocumentOptionsComposer({storage,executor:o.executor,budgetPool:pool,sessions,now,namespace:'product'})});
  registerDocumentsSessionBinder(context,late.bind);
  return {ports:{artifactStore:storage,artifactOptionsOwner:late.owner}};
 };
}

/** The production registration: real S3 client, no Core authority, so only the private store can compose. */
export const createDocumentsFamily=documentsFamily();
