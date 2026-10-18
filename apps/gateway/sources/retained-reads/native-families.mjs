/** Eligibility of finite native tool producers; data only. Source presence never grants installation or authority. */
export const NATIVE_READ_FAMILIES=Object.freeze([
 'bill-text','public-reports','acquisition-personnel','disclosures','legislative-directory',
 'pe-references','federal-legislation','state-legislation','stored-intelligence','regulatory-dockets','intelligence-summary',
 'public-web','data-search','public-domain-query','facility-representation','district-nexus','client-registry','federal-market',
 'public-data','program-elements','client-knowledge-search','state-status-votes','tracked-bills','public-domain-hearings','research-legal-legislation','research-legal-news','outreach-query','business-development','funding-opportunities',
]);
/** Only these reviewed source slices exist in otherwise incomplete families. No sibling inherits eligibility. */
export const NATIVE_READ_OPERATION_SUBSETS=Object.freeze({
 'research-legal-legislation':Object.freeze(['search_legislative_research','get_legal_reference']),
 'research-legal-news':Object.freeze(['search_legiwatch_news']),
 'outreach-query':Object.freeze(['query_outreach']),
 'business-development':Object.freeze(['get_business_development_context','get_business_development_recent_changes']),
});
export const nativeReadOperationAllowed=(family,id)=>NATIVE_READ_FAMILIES.includes(family)&&
 (!Object.hasOwn(NATIVE_READ_OPERATION_SUBSETS,family)||NATIVE_READ_OPERATION_SUBSETS[family].includes(id));
