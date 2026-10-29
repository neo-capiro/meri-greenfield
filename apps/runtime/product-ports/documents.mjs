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
 *    journal and forwarder (`context.artifactRecovery`) for each actual record/query tenant, evidence in the same bucket and prefix (key
 *    `<prefix>/artifact-publication/<sha256(tenantId)>/index.json`, disjoint from object keys `<prefix>/<64-hex>/<uuid>/<sha>`).
 *    Without that forwarder the store is NOT composed: a store with no recovery owner would keep retention serving fenced and
 *    stop control readiness (`control.mjs` retentionGate + `ensureServing`).
 *  - `artifactOptionsOwner` is composed ONLY when a trusted Core artifact authority and the fixed executor are supplied through
 *    `documentsFamily({authority,executor})` (never configuration) AND the `artifacts` block declares `authority` (the Core origin
 *    and service-secret file of docs/integration/ARTIFACT-CURRENT-AUTHORITY-CONTRACT.md). An authority that names its `origin` or
 *    `now` must match the declared origin and control's clock. Startup builds that authority with `composeDocumentsFamily`
 *    (`../artifacts/authority-composition.mjs`). The CLI supplies current artifact authority ports and the fixed executor only when their declared bindings exist; absent inputs keep `/api/documents/*` unavailable. When composed, the owner is late-bound to
 *    control's own action-session owner: `createRuntimeDocumentOptionsComposer` and the runtime document application both require
 *    the exact `sessions` object, which `assembleControl` creates after the product-port factory returns. Until trusted assembly
 *    calls `bindDocumentsSessions(context, sessions)` (`../artifacts/session-binding.mjs`) every resolve answers null (the
 *    application's 503 UNAVAILABLE). */
import {types} from 'node:util';
import {S3Client} from '../../artifacts/storage/s3-sdk.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createRuntimeArtifactStorage,createRuntimeDocumentOptionsComposer} from '../artifacts/composition.mjs';
import {createRuntimePreviewCustody} from '../artifacts/preview-custody.mjs';
import {isRendererPort} from '../../artifacts/renderer.mjs';
import {compileRuntimeArtifactsConfiguration} from '../artifacts/configuration.mjs';
import {registerDocumentsSessionBinder,bindDocumentsSessions} from '../artifacts/session-binding.mjs';
import {createDocumentRevisionRunOwner} from '../artifacts/revision-composition.mjs';
import {createRuntimeDocumentIntentPreparers} from '../artifacts/intent-preparers.mjs';
import {registerDocumentIntentOwner} from '../artifacts/intent-binding.mjs';
import {createSelectedDocumentExecution} from '../artifacts/selected-documents.mjs';
import {createSelectedAttachmentFilingExecution} from '../artifacts/selected-filing.mjs';
import {createRuntimeAttachmentFilingPreparer} from '../artifacts/filing-preparer.mjs';
import {createFilingVersionResolver} from '../artifacts/filing-version-resolver.mjs';
import {intentsComposition} from './intents.mjs';
import {createS3RetentionLedgerSink} from '../../control/retention/s3-ledger.mjs';
import {createRuntimeRetentionStorage} from '../artifacts/retention-storage.mjs';
const fault=()=>Object.assign(new Error('PRODUCT_PORTS_CONFIGURATION'),{code:'PRODUCT_PORTS_CONFIGURATION'});
const ordinary=fn=>typeof fn==='function'&&!types.isProxy(fn)&&!types.isAsyncFunction(fn)&&!types.isGeneratorFunction(fn);
/** Re-exported for tests; trusted assembly imports it from `../artifacts/session-binding.mjs`, which loads no storage graph. */
export {bindDocumentsSessions};

function lateBoundOptionsOwner({authority,compose}){
 const resolveAuthority=storageMethod(authority,'resolve');let bound=null;
 const bind=(sessions,retention,store)=>{
  if(sessions===null||typeof sessions!=='object'||types.isProxy(sessions))throw fault();
  if(bound!==null){if(bound.sessions!==sessions||bound.retention!==retention||bound.store!==store)throw fault();return;}
  bound=Object.freeze({sessions,retention,store,compose:compose(sessions,store)});
 };
 // The resolved shape is closed; `recheck` must be the authority's own method and is called with the application's exact check.
 const owner=Object.freeze({async resolve(call){
  const current=bound;if(current===null)return null;
  const raw=await resolveAuthority({...call,sessions:current.sessions,store:current.store});if(raw===null||raw===undefined)return null;
  const r=own(raw,['artifactOptions','selectedClientId','limits','recheck'],['enabled','federalSource']),recheck=storageMethod(raw,'recheck');
  const documentOptions=current.compose({artifactOptions:r.artifactOptions,selectedClientId:r.selectedClientId,limits:r.limits,...(r.enabled===undefined?{}:{enabled:r.enabled}),...(r.federalSource===undefined?{}:{federalSource:r.federalSource})});
  return {documentOptions,recheck:check=>recheck(check)};
 }});
 return {owner,bind,current:()=>bound};
}

/** Family factory with optional trusted owners. `createS3Client({region})` exists for synthetic tests only; production uses the
 * pinned SDK client from the artifact storage package. `authority` (Core artifact authority, `resolve({sessions,credential,intent,
 * body,requestSha256,deadlineMs,signal})` -> `{artifactOptions,selectedClientId,credential,limits,enabled?,recheck}` or null) and
 * `executor` (`createFixedRuntimeArtifactExecutor(...)` over approved image paths) must be supplied together. */
export function documentsFamily(owners={}){
 const o=own(owners,[],['authority','executor','createS3Client','nativeCredentials','renderer']);
 if(o.renderer!==undefined&&!isRendererPort(o.renderer))throw fault();
 if(o.createS3Client!==undefined&&!ordinary(o.createS3Client))throw fault();
 if(o.nativeCredentials!==undefined)storageMethod(o.nativeCredentials,'nativeCredentialFor');
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
  const retentionPorts=retention?{retentionLedgerSink:createS3RetentionLedgerSink({...s3,now,maxRequestMs:configuration.limits.requestMs}),
   ...(configuration.retention.purge?.enabled?{retentionStorage:createRuntimeRetentionStorage({...s3,now,maxRequestMs:Math.min(configuration.limits.requestMs,3000)})}:{})}:{};
  const storage=createRuntimeArtifactStorage({s3,versionsPool:pool,now,maxRequestMs:configuration.limits.requestMs,
   ...(retention?{custody:{journal:artifactRecovery.journal,retention:artifactRecovery.retention,evidenceS3:s3,enabled:true,publicationPagedWrites:declared.publicationPagedWrites??false}}:{})});
  // Composed disabled: without a declared Core authority origin the supplied authority is never reached.
  if(o.authority===undefined||declared.authority===undefined)return {ports:{artifactStore:storage,...retentionPorts}};
  if(Object.hasOwn(o.authority,'origin')&&o.authority.origin!==declared.authority.origin||Object.hasOwn(o.authority,'now')&&o.authority.now!==now)throw fault();
  const previewStoreForContext=retention?createRuntimePreviewCustody({journal:artifactRecovery.journal,retention:artifactRecovery.retention,
   versionsPool:pool,evidenceS3:s3,versions:storage.versions,now,maxRequestMs:configuration.limits.requestMs}):undefined;
  const late=lateBoundOptionsOwner({authority:o.authority,compose:(sessions,store)=>createRuntimeDocumentOptionsComposer({storage,executor:o.executor,pool,sessions,store,now,
   ...(o.renderer?{renderer:o.renderer}:{}),pdfAdmission:declared.pdfAdmission===true,retainedAssetMapWrites:declared.retainedAssetMapWrites===true,...(previewStoreForContext?{previewStoreForContext}:{})})});
  registerDocumentsSessionBinder(context,late.bind);
  const limits={maxRequestMs:configuration.limits.requestMs,maxRequestBytes:configuration.limits.requestBytes,maxResponseBytes:configuration.native.maxResponseBytes};
  const filingEnabled=retention&&configuration.intents?.enabled===true&&configuration.intents.core!==undefined;
  const resolveVersion=value=>{
   const bound=late.current(),clients=value.scopes.filter(scope=>scope.kind==='client');
   if(!bound?.store||!bound.retention||clients.length!==1)throw fault();
   return createFilingVersionResolver({versions:storage.versions,store:bound.store,selectedClientId:clients[0].resourceId,now})(value);
  };
  const readDecision=value=>{const reader=intentsComposition(context).readDecision;if(!reader)throw fault();return reader(value);};
  const filing=filingEnabled?createSelectedAttachmentFilingExecution({bound:late.current,optionsOwner:late.owner,resolveVersion,readDecision,now,maxRequestMs:configuration.limits.requestMs,limits,
   source:Object.fromEntries(['register','execute','read'].map(name=>[name,value=>{const source=intentsComposition(context).filingSource;if(!source)throw fault();return source[name](value);}]))}):undefined;
  const revision=createDocumentRevisionRunOwner({bound:late.current,optionsOwner:late.owner,now,limits});
  if(o.nativeCredentials)registerDocumentIntentOwner(context,async value=>{
   const bound=late.current(),selectedClientId=value.clientResolution?.clientId;
   if(!bound||retention&&!bound.retention||!(selectedClientId===null||typeof selectedClientId==='string'))return [];
   const selection=await revision.selectionFor({binding:value.binding,signal:value.signal});
   const documents=createRuntimeDocumentIntentPreparers({binding:value.binding,selectedClientId,sessions:bound.sessions,optionsOwner:late.owner,nativeCredentials:o.nativeCredentials,now,
    limits,...(selection?{revision:selection}:{}),...(bound.retention?{retention:bound.retention}:{})});
   if(!filing||selectedClientId===null||typeof value.readCurrent!=='function')return documents;
   return [...documents,createRuntimeAttachmentFilingPreparer({pool,binding:value.binding,scopes:value.scopes,selectedClientId,policyRevision:value.policyRevision,expiresAtMs:value.expiresAtMs,
    readCurrent:value.readCurrent,bound,optionsOwner:late.owner,resolveVersion,now,limits})];
  },createSelectedDocumentExecution({bound:late.current,pool,optionsOwner:late.owner,now,maxRequestMs:configuration.limits.requestMs,maxOutputBytes:configuration.agentcore.maxOutputBytes,
   readDecision}),filing,revision);
  return {ports:{artifactStore:storage,artifactOptionsOwner:late.owner,...retentionPorts}};
 };
}

/** The production registration: real S3 client, no Core authority, so only the private store can compose. */
export const createDocumentsFamily=documentsFamily();
