/** Content-free current-tenant accounting. No principal selectors, credits or execution authority. */
export const USAGE_OVERVIEW_SCHEMA='meri.usage-overview/1',USAGE_OVERVIEW_PATH='/api/conversations/usage-overview';
export const overviewStates=Object.freeze(['queued','starting','running','waiting-for-approval','paused','completed','failed','cancelled']);
export const usageOverviewErrors=Object.freeze({INVALID_REQUEST:[400],UNAUTHENTICATED:[401],ACCESS_DENIED:[403],MEMBERSHIP_REVOKED:[403],NOT_FOUND:[404],METHOD_NOT_ALLOWED:[405],DEADLINE:[408],MEMBERSHIP_CHANGED:[409],REQUEST_TOO_LARGE:[413],UNSUPPORTED_MEDIA_TYPE:[415],CANCELLED:[499],PRODUCT_UNAVAILABLE:[502],USAGE_OVERVIEW_REQUEST_INVALID:[400],USAGE_OVERVIEW_CORRUPT:[500],USAGE_OVERVIEW_UNAVAILABLE:[503]});
export const usageOverviewMetadata=Object.freeze({schemaId:'urn:meri:usage-overview:1.0.0',version:'1.0.0',path:USAGE_OVERVIEW_PATH,method:'POST',requestBytes:1024,responseBytes:16384,
 authentication:'current native tenant membership, rechecked before release',scope:'tenant aggregate numbers only; no conversation, client or other member identifiers',
 currency:'USD',money:'integer micro-USD of known recorded SDK estimates; missing or unavailable accounting is not zero cost',
 periods:'UTC day, ISO Monday week and calendar month; attempt cohorts use run.createdAt, admission cap uses sdk_usage_recorded_at',
 limits:'current canonical SDK limits and tenant admission cap; no reservations or budget editing',
 capacity:'recorded durable states only; no physical worker concurrency or available capacity observation',
 economics:'attempts are not complete jobs; provider billing and complete-job economics unavailable'});
export function usageOverviewPeriods(at){
 const date=new Date(at);if(!Number.isSafeInteger(at)||!Number.isFinite(date.getTime()))throw Error('USAGE_OVERVIEW_CLOCK');
 const day=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()),week=day-((date.getUTCDay()+6)%7)*86400000;
 const month=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1),nextMonth=Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1);
 return [['day',day,day+86400000],['week',week,week+7*86400000],['month',month,nextMonth]].map(([kind,start,end])=>({kind,startInclusive:new Date(start).toISOString(),endExclusive:new Date(end).toISOString()}));
}
