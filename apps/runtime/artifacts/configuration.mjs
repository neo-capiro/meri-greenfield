/** Closed `artifacts` control declaration for the private artifact store composed by `../product-ports/documents.mjs`.
 * Pure: no SDK import, no secret read, no IO. `config.mjs` calls it while validating the control role and the documents family
 * calls it again at composition, so a hand-built configuration cannot skip it.
 *
 *   artifacts: {
 *     enabled: boolean,              // false composes no artifact port; product readiness names artifacts.privateStore unavailable
 *     region: 'us-east-1',           // the bucket's region; the KMS key must be in the same region (SSE-KMS requirement)
 *     bucket, prefix,                // S3 general purpose bucket (never a directory bucket) and the object key prefix
 *     expectedBucketOwner,           // 12-digit account sent as ExpectedBucketOwner on every request
 *     kmsKeyId,                      // full KMS key ARN used for SSE-KMS on every PutObject
 *     tenantId?                      // publication custody tenant; REQUIRED exactly when control also declares `retention`
 *   }
 *
 * The five storage keys are required when `enabled` is true and validated whenever present. `tenantId` without a declared
 * `retention` is refused: publication custody needs the control-owned retention journal, which exists only then. */
const fault=()=>Object.assign(new Error('ARTIFACT_CONFIGURATION'),{code:'ARTIFACT_CONFIGURATION'});
const REQUIRED=Object.freeze(['region','bucket','prefix','expectedBucketOwner','kmsKeyId']);
const KEYS=Object.freeze(['enabled',...REQUIRED,'tenantId']);
const REGION=/^[a-z]{2}(?:-gov)?-[a-z]+-[0-9]$/u,BUCKET=/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u,OWNER=/^[0-9]{12}$/u;
const PREFIX=/^[A-Za-z0-9][A-Za-z0-9/_-]{0,127}$/u,KMS_KEY=/^arn:aws(?:-us-gov|-cn)?:kms:([a-z0-9-]+):[0-9]{12}:key\/[a-f0-9-]{36}$/u;
function plain(value){
 if(value===null||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw fault();
 const descriptors=Object.getOwnPropertyDescriptors(value);
 for(const [key,d] of Object.entries(descriptors))if(!KEYS.includes(key)||!d.enumerable||!Object.hasOwn(d,'value'))throw fault();
 if(Object.getOwnPropertySymbols(value).length)throw fault();
 return Object.fromEntries(Object.entries(descriptors).map(([key,d])=>[key,d.value]));
}
/** Returns null when `configuration.artifacts` is absent, otherwise the frozen validated declaration. */
export function compileRuntimeArtifactsConfiguration(configuration){
 const raw=configuration?.artifacts;if(raw===undefined)return null;
 const a=plain(raw);
 if(typeof a.enabled!=='boolean')throw fault();
 if(a.enabled)for(const key of REQUIRED)if(!Object.hasOwn(a,key))throw fault();
 if(a.region!==undefined&&(typeof a.region!=='string'||!REGION.test(a.region)))throw fault();
 if(a.bucket!==undefined&&(typeof a.bucket!=='string'||!BUCKET.test(a.bucket)||a.bucket.endsWith('--x-s3')||a.bucket.includes('..')))throw fault();
 if(a.prefix!==undefined&&(typeof a.prefix!=='string'||!PREFIX.test(a.prefix)||a.prefix.endsWith('/')||a.prefix.includes('//')))throw fault();
 if(a.expectedBucketOwner!==undefined&&(typeof a.expectedBucketOwner!=='string'||!OWNER.test(a.expectedBucketOwner)))throw fault();
 if(a.kmsKeyId!==undefined){const match=typeof a.kmsKeyId==='string'?KMS_KEY.exec(a.kmsKeyId):null;if(!match||a.region!==undefined&&match[1]!==a.region)throw fault();}
 if(a.tenantId!==undefined&&(typeof a.tenantId!=='string'||a.tenantId.length<1||a.tenantId.length>128||a.tenantId.trim()!==a.tenantId))throw fault();
 const retention=configuration.retention!==undefined;
 if(a.tenantId!==undefined&&!retention)throw fault();
 if(a.enabled&&retention&&a.tenantId===undefined)throw fault();
 return Object.freeze(a);
}
