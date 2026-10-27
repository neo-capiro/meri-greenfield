/** Concrete publication purpose binding. Disabled by default; existing protected evidence resource only, never SQL bootstrap. */
import {own,configuration,fail} from './boundary.mjs';
import {createS3ConditionalDocument} from './s3-conditional-document.mjs';
import {createS3ArtifactObjects} from './s3-objects.mjs';
import {ARTIFACT_PUBLICATION_NAMESPACE,emptyArtifactPublications} from './artifact-publication.mjs';
import {createPagedArtifactPublicationJournal,verifyArtifactPublicationRoot} from './artifact-publication-paged-journal.mjs';
import {createS3ArtifactPublicationPages} from './s3-artifact-publication-pages.mjs';
export function createS3ArtifactPublication(options){
 const {tenantId,now,maxDecisions=1024,maxCasAttempts=3,pagedWritesEnabled=false,...config}=own(options,['client','bucket','prefix','expectedBucketOwner','kmsKeyId','tenantId','now'],['enabled','maxRequestMs','maxIndexBytes','maxDecisions','maxCasAttempts','pagedWritesEnabled']);
 const transport=createS3ConditionalDocument({...config,tenantId,now,namespace:ARTIFACT_PUBLICATION_NAMESPACE,purpose:'artifact-publication',empty:()=>emptyArtifactPublications(tenantId),parse:value=>verifyArtifactPublicationRoot(value,tenantId,maxDecisions),errorPrefix:'ARTIFACT_PUBLICATION'});
 const {enabled,maxIndexBytes,...storage}=config,pages=createS3ArtifactPublicationPages({...storage,tenantId,now});
 return createPagedArtifactPublicationJournal({transport,pages,tenantId,now,pagedWritesEnabled,maxCasAttempts,maxDecisions});
}

/** No tenant inventory or cache. Each authenticated access selects its own existing canonical document. */
export function createS3ArtifactPublications(options){
 const c=own(options,['client','bucket','prefix','expectedBucketOwner','kmsKeyId','now'],['enabled','maxRequestMs','pagedWritesEnabled']);
 configuration(c.now,c.maxRequestMs??15000);const {enabled,pagedWritesEnabled,...storage}=c;createS3ArtifactObjects(storage);
 if(enabled!==undefined&&typeof enabled!=='boolean')fail('ARTIFACT_STORAGE_CONFIGURATION');
 return Object.freeze({forTenant(tenantId){
  if(typeof tenantId!=='string'||!tenantId||tenantId.length>128||tenantId.trim()!==tenantId)fail('ARTIFACT_STORAGE_INPUT');
  return createS3ArtifactPublication({...c,tenantId});
 }});
}
