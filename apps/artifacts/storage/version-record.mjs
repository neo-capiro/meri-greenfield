/** Canonical immutable artifact storage envelope and relational proof; inert and shared by publication/recovery. */
import {ARTIFACT_MIME_TYPES,artifactFilename} from '../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
import {v,own,data,fail,same,uuid,digest,scopeFacts} from './boundary.mjs';
/** Bounded immutable asset references retained BESIDE the version: the original spec's own
 * `id -> ObjectReference` pairs, so a private current-authorized revision can re-present exactly the
 * objects the immutable parent used instead of stripping or re-deriving them. Optional, so a record
 * written before this field keeps its exact legacy envelope and hash. Identification and retention
 * only: it grants no access to bytes and no scope of its own. */
function assetRefs(raw,version){
 if(raw===undefined)return undefined;
 const assets=data(raw);
 if(!Array.isArray(assets)||!assets.length||assets.length>64)fail('ARTIFACT_VERSION_CORRUPT');
 const ids=new Set();
 return assets.map(entry=>{
  const asset=own(entry,['id','object']);
  // The canonical identifier rule the trusted context assets and the immutable spec's own assetId
  // references already use: a durable map can never carry an identifier neither of them could produce.
  if(typeof asset.id!=='string'||!/^[A-Za-z0-9_-]{1,64}$/u.test(asset.id)||ids.has(asset.id))fail('ARTIFACT_VERSION_CORRUPT');
  const object=v.object(asset.object);
  if(object.scopes.some(scope=>!version.scopes.some(parent=>same(parent,scope))))fail('ARTIFACT_VERSION_CORRUPT');
  ids.add(asset.id);return {id:asset.id,object};
 });
}
function recordValue(raw){const r=data(own(raw,['version','spec','specSha256','requestSha256','inspection'],['assets']));
 const version=v.version(r.version),spec=v.request(r.spec),inspection=v.inspection(r.inspection);digest(r.requestSha256);uuid(version.versionId);uuid(version.artifactId);
 if(r.specSha256!==v.hash(spec)||!same(version.object.scopes,version.scopes)||version.scopes.some(s=>s.tenantId!==version.binding.tenantId)||
  version.evidence.some(e=>e.scopes.some(s=>!version.scopes.some(parent=>same(parent,s))))||version.object.sha256!==inspection.sha256||version.object.bytes!==inspection.bytes||inspection.format!==spec.format||
  version.mimeType!==ARTIFACT_MIME_TYPES[spec.format]||version.filename!==artifactFilename(spec)||version.generationStatus!=='draft'||version.previewStatus!=='pending')fail('ARTIFACT_VERSION_CORRUPT');
 scopeFacts(version.scopes);const assets=assetRefs(r.assets,version);if(Buffer.byteLength(JSON.stringify(assets===undefined?r:{...r,assets}))>4194304)fail('ARTIFACT_VERSION_LIMIT');return assets===undefined?r:{...r,assets};}
function decode(row){if(!row||v.hash(row.record)!==row.record_sha256)fail('ARTIFACT_VERSION_CORRUPT');const r=recordValue(row.record),b=r.version.binding;
 if(row.version_id!==r.version.versionId||row.artifact_id!==r.version.artifactId||row.tenant_id!==b.tenantId||row.actor_id!==b.actorId||row.conversation_id!==b.conversationId||row.request_sha256!==r.requestSha256)fail('ARTIFACT_VERSION_CORRUPT');return r;}
// The same inert packet validator is used when immutable source prerequisites are retained outside SQL rollback.
export {recordValue as verifyArtifactVersionStorageRecord,decode as verifyArtifactVersionStorageRow};
export const artifactHeadProjection=record=>{const version=record.version,b=version.binding;return {artifactId:version.artifactId,versionId:version.versionId,tenantId:b.tenantId,actorId:b.actorId,conversationId:b.conversationId,scopesSha256:v.hash(version.scopes)};};
export function verifyArtifactVersionStorageHead(row,record){const expected=artifactHeadProjection(record);if(!row||!same(row.projection,expected)||v.hash(row.projection)!==row.projection_sha256||row.artifact_id!==expected.artifactId||row.version_id!==expected.versionId||row.tenant_id!==expected.tenantId||row.actor_id!==expected.actorId||row.conversation_id!==expected.conversationId)fail('ARTIFACT_VERSION_CORRUPT');return row;}
