/** Concrete source composition using the existing pg pool, canonical transaction/version owners and actual S3 evidence adapter.
 * Disabled by default; no connection/client/credential/resource is created. Runtime/serving wiring remains Startup-owned. */
import {own,configuration,storageMethod,fail} from '../storage/boundary.mjs';
import {createPostgresArtifactVersions} from '../storage/postgres-versions.mjs';
import {createPostgresArtifactSourceRecovery} from '../storage/postgres-source-recovery.mjs';
import {createS3PreviewEvidence} from '../storage/s3-preview-evidence.mjs';
import {createPreviewCustodyJournal} from './custody-journal.mjs';import {createPostgresPreviewStore} from './postgres-store.mjs';import {createPreviewCustodyRecovery} from './custody-recovery.mjs';
export function createPostgresS3PreviewCustody(options){
 const {journal,versionsPool,evidenceS3,tenantId,artifactId,now,enabled=false,maxRequestMs=15000,maxRows=128}=own(options,
  ['journal','versionsPool','evidenceS3','tenantId','artifactId','now'],['enabled','maxRequestMs','maxRows']);configuration(now,maxRequestMs);storageMethod(journal,'exclusive');
 if(typeof enabled!=='boolean')fail('ARTIFACT_STORAGE_CONFIGURATION');const s3=own(evidenceS3,['client','bucket','prefix','expectedBucketOwner','kmsKeyId']);
 const versions=createPostgresArtifactVersions({pool:versionsPool,now,maxRequestMs}),evidence=createS3PreviewEvidence({...s3,tenantId,now,maxRequestMs,enabled});
 const custodyJournal=createPreviewCustodyJournal({evidence,tenantId,artifactId,now,maxRequestMs}),previews=createPostgresPreviewStore({journal,versions,custodyJournal,tenantId,artifactId,now,maxRequestMs,maxRows});
 const sourceRecovery=createPostgresArtifactSourceRecovery({journal,versions,tenantId,artifactId,now,maxRequestMs}),recovery=createPreviewCustodyRecovery({store:previews,sourceRecovery,now,maxRequestMs});
 const unavailable=async()=>fail('ARTIFACT_PREVIEW_CUSTODY_DISABLED');
 return Object.freeze(enabled?{previews,recovery}:{previews:Object.freeze(Object.fromEntries(['read','custody','claim','recordObject','commit','assertCurrent','ensureServing','replay'].map(name=>[name,unavailable]))),
  recovery:Object.freeze({reconcileExclusive:unavailable,ensureServing:unavailable})});
}
