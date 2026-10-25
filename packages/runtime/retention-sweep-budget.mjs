/** One bounded background subject, with outer response/transport margins.
 * These ceilings do not certify that uncertain-effect cleanup has settled. */
export const RETENTION_SWEEP_BUDGET=Object.freeze({workMs:60000,httpMs:65000,nativeMs:70000,activityMs:75000});
