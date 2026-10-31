/** Pure lifecycle contract now lives in the public contracts package; this module is only the app-local re-export
 * so existing producer/HTTP/teardown imports keep one canonical implementation. */
export {NATIVE_LIFECYCLE_PATH,NATIVE_LIFECYCLE_SCHEMA,NATIVE_ABSENCE_SCHEMA,NATIVE_LIFECYCLE_ACTIONS,
 NATIVE_LIFECYCLE_MAX_MS,NATIVE_LIFECYCLE_BODY_BYTES,nativeLifecycleRequest,nativeAbsenceRecord,
 assertNativeHostAllocation,assertHostRunBindingPin,assertD005HostIdentityShape,assertHostAllocationShape}
 from '../../../packages/contracts/native-lifecycle.mjs';
