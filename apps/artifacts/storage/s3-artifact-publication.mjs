/** Concrete publication purpose binding. Disabled by default; existing protected evidence resource only, never SQL bootstrap. */
import {own} from './boundary.mjs';
import {createS3ConditionalDocument} from './s3-conditional-document.mjs';
import {ARTIFACT_PUBLICATION_NAMESPACE,emptyArtifactPublications,verifyArtifactPublications,createArtifactPublicationJournal} from './artifact-publication.mjs';
export function createS3ArtifactPublication(options){
 const {tenantId,now,maxDecisions=1024,maxCasAttempts=3,...config}=own(options,['client','bucket','prefix','expectedBucketOwner','kmsKeyId','tenantId','now'],['enabled','maxRequestMs','maxIndexBytes','maxDecisions','maxCasAttempts']);
 const transport=createS3ConditionalDocument({...config,tenantId,now,namespace:ARTIFACT_PUBLICATION_NAMESPACE,purpose:'artifact-publication',empty:()=>emptyArtifactPublications(tenantId),parse:value=>verifyArtifactPublications(value,tenantId,maxDecisions),errorPrefix:'ARTIFACT_PUBLICATION'});
 return createArtifactPublicationJournal({transport,tenantId,now,maxDecisions,maxCasAttempts});
}
