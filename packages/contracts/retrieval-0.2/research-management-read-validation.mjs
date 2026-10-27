/** Native management read DTOs. Only the named read actions can cross this boundary; no proposal, write result,
 * arbitrary top-level field or unbounded payload is accepted. Core remains the current authorization owner. */
const fail=()=>{throw Error('RESEARCH_MANAGEMENT_READ_CONTRACT');};
const fields=(value,required,optional='')=>{
 const keys=required.split(' ').filter(Boolean),allowed=new Set([...keys,...optional.split(' ').filter(Boolean)]);
 if(!value||typeof value!=='object'||Array.isArray(value)||keys.some(key=>!Object.hasOwn(value,key))||Object.keys(value).some(key=>!allowed.has(key)))fail();
 return value;
};
const rows=(value,check)=>{if(!Array.isArray(value)||value.length>1000)fail();value.forEach(check);};
const snapshotKeys='id portfolioId operationKey contentHash name portfolioRevision createdByUserId calculationVersion capturedAt';
const templateVersion=value=>fields(value,'id version schemaVersion expression readableExpression mode qualificationPolicy taxonomyVersionId publishedAt');
const comparison=value=>{fields(value,'id name ownerUserId portfolioId revision archivedAt currentVersion');fields(value.currentVersion,'id version schemaVersion displayVersion projectionVersion subjects selection basisPair passageMode sourcePins capturedProjection contentHash capturedAt captureKnownAt knownAtSupport limitations');};
export function assertResearchManagementResult(action,value,shape){
 // Existing recursive JSON DTO bounds plus a whole-response bound cover all native opaque checkpoints and projections.
 shape('ResearchPortfolioJsonValue',value);if(Buffer.byteLength(JSON.stringify(value),'utf8')>262144)fail();
 switch(action){
  case 'grants_list':rows(value,row=>shape('ResearchPortfolioGrant',row));break;
  case 'client_links_list':rows(value,row=>shape('ResearchPortfolioClientLink',row));break;
  case 'members_list':rows(value,row=>shape('ResearchPortfolioMember',row));break;
  case 'annual_review_get':fields(value,'items counts','knownAtSupport limitations');rows(value.items,row=>fields(row,'id tenantId portfolioId priorDecisionId currentDecisionId continuityKey priorDependencyFingerprint dependencyFingerprint status identityMapping changedDependencies originalEvidence sourceEdition relevantPeriodStart relevantPeriodEnd expiryDate reopeningReason reopeningReviewId createdAt updatedAt','persisted'));break;
  case 'subscriptions_list':rows(value,row=>fields(row,'id portfolioId subscriberUserId targetKind targetId channel cadence active baselineEventId baselineRevision baselineCompletedAt checkpoint createdAt updatedAt'));break;
  case 'deliveries_list':rows(value,row=>fields(row,'id subscriptionId eventId recipientUserId channel status attemptNumber checkpoint receipt errorCode createdAt completedAt'));break;
  case 'watch_conversion_preview':fields(value,'portfolioId expectedRevision previewHash legacyWatches convertibleWatches alreadyConverted limitations previewItems');rows(value.previewItems,row=>fields(row,'watchId userId channel legacyKind targetKind targetId active reason willConvert'));break;
  case 'output_get':fields(value,'id requestId operationKey status attemptCount deadlineAt lastErrorCode lastError createdAt updatedAt request attempts artifact');fields(value.request,'id portfolioId snapshotId operationKey requestHash selectedSections includeSourceAppendix format status requestedByUserId requestedAt deadlineAt');rows(value.attempts,row=>fields(row,'id attemptNumber operationKey action outcome checkpoint receipt errorCode actorUserId startedAt completedAt'));if(value.artifact!==null)fields(value.artifact,'id contentHash byteSize mediaType fileName createdAt downloadPath');break;
  case 'snapshots_list':rows(value,row=>fields(row,snapshotKeys));break;
  case 'snapshot_get':fields(value,snapshotKeys+' basis membership projection versions limitations clientAccessRequirements observedAt readAt');rows(value.membership,row=>shape('ResearchPortfolioMember',row));shape('ResearchWorkflowAnalyticsOutput',value.projection);fields(value.versions,'structure rules decisions templates taxonomy labels sources');break;
  case 'taxonomy_get':rows(value,row=>{fields(row,'id version label vocabulary source provenance publishedAt concepts');rows(row.concepts,concept=>fields(concept,'id stableKey name kind parentKey aliases provenance qualification'));});break;
  case 'templates_list':rows(value,row=>{fields(row,'id name description archivedAt versions');rows(row.versions,templateVersion);});break;
  case 'template_version_get':templateVersion(value);break;
  case 'comparison_list':rows(value,comparison);break;
  case 'comparison_get':comparison(value);break;
  default:fail();
 }
 return value;
}
