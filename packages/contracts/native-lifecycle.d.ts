/** Pure native-processing lifecycle/identity wire contract. Validation grants no permission. */
export declare const NATIVE_LIFECYCLE_PATH: '/v1/native-processing/lifecycle';
export declare const NATIVE_LIFECYCLE_SCHEMA: 'meri-native-host-lifecycle/1';
export declare const NATIVE_ABSENCE_SCHEMA: 'meri-d005-native-absence/1';
export declare const NATIVE_LIFECYCLE_ACTIONS: readonly ['close','processes','observe'];
export declare const NATIVE_LIFECYCLE_MAX_MS: 30000;
export declare const NATIVE_LIFECYCLE_BODY_BYTES: 16384;
export declare const HOST_ALLOCATION_SCHEMA: 'meri-conversation-host-allocation/1';
export declare const D005_HOST_IDENTITY_SCHEMA: 'meri-d005-host-identity/1';
export declare function assertHostAllocationShape(value: unknown): Readonly<Record<string, unknown>>;
export declare function assertNativeHostAllocation(value: unknown): Readonly<Record<string, unknown>>;
export declare function assertHostRunBindingPin(allocation: unknown, binding: unknown): Readonly<Record<string, unknown>>;
export declare function assertD005HostIdentityShape(value: unknown, binding: unknown, allocation: unknown): Readonly<Record<string, unknown>>;
export declare function nativeLifecycleRequest(raw: unknown, options?: {config?: unknown}): Readonly<{action: string; allocation: Readonly<Record<string, unknown>>; binding: Readonly<Record<string, unknown>>; hostIdentity: Readonly<Record<string, unknown>>}>;
export declare function nativeAbsenceRecord(value: unknown): Readonly<Record<string, unknown>> | null;
export declare function nativeLifecycleCloseAnswer(value: unknown, input: {allocation: unknown; binding: unknown; hostIdentity: unknown; nowMs: number; maxFreshMs?: number}): Readonly<Record<string, unknown>> | null;
