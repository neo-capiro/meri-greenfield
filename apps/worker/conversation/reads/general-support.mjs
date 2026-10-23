/** Source-supported General read protocol, not an installation or capability grant.
 * Exact operations here use the existing native credential owner with Core v2
 * General-origin and per-client target proof. Every installation/discovery gate
 * and every current per-result wall still applies. Other readers need a client chat. */
export const GENERAL_PUBLIC_READ_OPERATIONS=Object.freeze(['search_cbo_cost_estimates','search_gao_reports','search_crs_reports','search_state_bills','get_state_legislator'].map(id=>Object.freeze({id,version:'0.2.0'})));
export const supportsGeneralPublicRead=operation=>GENERAL_PUBLIC_READ_OPERATIONS.some(candidate=>candidate.id===operation?.id&&candidate.version===operation.version);
export const GENERAL_NATIVE_READ_OPERATIONS=Object.freeze([
 'get_representation',
 'get_district_nexus_context',
 'get_district_nexus_changes',
 'search_tracked_bills',
 'query_outreach',
 'get_business_development_context',
 'get_business_development_recent_changes',
].map(id=>Object.freeze({id,version:'0.2.0'})).concat(GENERAL_PUBLIC_READ_OPERATIONS));
export const supportsGeneralRead=operation=>GENERAL_NATIVE_READ_OPERATIONS.some(candidate=>candidate.id===operation?.id&&candidate.version===operation.version);
