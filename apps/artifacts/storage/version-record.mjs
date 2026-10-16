/** Canonical immutable artifact storage envelope and relational proof; inert and shared by publication/recovery. */
import {ARTIFACT_MIME_TYPES,artifactFilename} from '../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
import {v,own,data,fail,same,uuid,digest,scopeFacts} from './boundary.mjs';
function recordValue(raw){const r=data(own(raw,['version','spec','specSha256','requestSha256','inspection']));
 const version=v.version(r.version),spec=v.request(r.spec),inspection=v.inspection(r.inspection);digest(r.requestSha256);uuid(version.versionId);uuid(version.artifactId);
 if(r.specSha256!==v.hash(spec)||!same(version.object.scopes,version.scopes)||version.scopes.some(s=>s.tenantId!==version.binding.tenantId)||
  version.evidence.some(e=>e.scopes.some(s=>!version.scopes.some(parent=>same(parent,s))))||version.object.sha256!==inspection.sha256||version.object.bytes!==inspection.bytes||inspection.format!==spec.format||
  version.mimeType!==ARTIFACT_MIME_TYPES[spec.format]||version.filename!==artifactFilename(spec)||version.generationStatus!=='draft'||version.previewStatus!=='pending')fail('ARTIFACT_VERSION_CORRUPT');
 scopeFacts(version.scopes);if(Buffer.byteLength(JSON.stringify(r))>4194304)fail('ARTIFACT_VERSION_LIMIT');return r;}
function decode(row){if(!row||v.hash(row.record)!==row.record_sha256)fail('ARTIFACT_VERSION_CORRUPT');const r=recordValue(row.record),b=r.version.binding;
 if(row.version_id!==r.version.versionId||row.artifact_id!==r.version.artifactId||row.tenant_id!==b.tenantId||row.actor_id!==b.actorId||row.conversation_id!==b.conversationId||row.request_sha256!==r.requestSha256)fail('ARTIFACT_VERSION_CORRUPT');return r;}
// The same inert packet validator is used when immutable source prerequisites are retained outside SQL rollback.
export {recordValue as verifyArtifactVersionStorageRecord,decode as verifyArtifactVersionStorageRow};
export const artifactHeadProjection=record=>{const version=record.version,b=version.binding;return {artifactId:version.artifactId,versionId:version.versionId,tenantId:b.tenantId,actorId:b.actorId,conversationId:b.conversationId,scopesSha256:v.hash(version.scopes)};};
export function verifyArtifactVersionStorageHead(row,record){const expected=artifactHeadProjection(record);if(!row||!same(row.projection,expected)||v.hash(row.projection)!==row.projection_sha256||row.artifact_id!==expected.artifactId||row.version_id!==expected.versionId||row.tenant_id!==expected.tenantId||row.actor_id!==expected.actorId||row.conversation_id!==expected.conversationId)fail('ARTIFACT_VERSION_CORRUPT');return row;}
