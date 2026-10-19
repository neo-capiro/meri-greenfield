// Import-only local fixture. All runtime configuration and secret reads are forbidden.
export const fault=code=>Object.assign(Error(code),{code});
const forbidden=()=>{throw Error('RUNTIME_CONFIG_ACCESS_FORBIDDEN');};
export const readSecret=forbidden;
export const validateConfiguration=forbidden;
export const loadConfiguration=forbidden;
export const compileControlTaskRouterConfiguration=forbidden;
export const compileControlUserPreferencesConfiguration=forbidden;
