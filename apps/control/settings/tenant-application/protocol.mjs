/** Tenant-settings transport paths (routes.mjs owns the handlers and policy). Shared by the control route boundary and the
 * runtime product dispatcher so the public allowlist and the mount cannot drift apart. */
export const TENANT_SETTINGS_PATHS=Object.freeze({read:'/api/settings/tenant/read',save:'/api/settings/tenant/save',audit:'/api/settings/tenant/audit'});
/** Transport ceilings for the tenant mount; the control's own limits can only lower them. A tenant read carries the platform record
 * (five capability policies at most a few KiB each) and an audit page of at most 100 content-free rows. */
export const TENANT_SETTINGS_LIMITS=Object.freeze({maxRequestMs:30000,maxRequestBytes:65536,maxResponseBytes:262144});
