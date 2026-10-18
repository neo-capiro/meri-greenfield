/** Tenant-settings transport paths (routes.mjs owns the handlers and policy). Shared by the control route boundary and the
 * runtime product dispatcher so the public allowlist and the mount cannot drift apart. */
export const TENANT_SETTINGS_PATHS=Object.freeze({read:'/api/settings/tenant/read',save:'/api/settings/tenant/save',audit:'/api/settings/tenant/audit'});
