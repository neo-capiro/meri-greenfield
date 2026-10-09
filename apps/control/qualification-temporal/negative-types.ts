// W02-03 negative and positive type fixtures.
//
// Preparation only. Every `@ts-expect-error` below asserts that the pinned
// 1.24.0 API rejects an incorrect option shape. If a future SDK relaxes one of
// these rules, the directive becomes "unused" and `tsc --noEmit` fails with
// TS2578 — so the fixture fails closed when the API changes.
//
// The positive controls (no directive) prove the correct shapes DO compile, so
// a fixture that rejected everything would still fail. Nothing here runs.

import { type WorkerOptions, type WorkerDeploymentOptions, type NativeConnectionOptions, type TLSConfig } from '@temporalio/worker';
import { type Connection, type ConnectionOptions, type ClientOptions } from '@temporalio/client';
import { VersioningBehavior, type WorkerDeploymentVersion } from '@temporalio/common';
import { proxyActivities, defineSignal, setHandler } from '@temporalio/workflow';
import type * as activities from './activities.js';
import { MERI_TASK_QUEUE } from './workflow.js';
import { type TlsMaterial, buildApplicationWorkerConnectionOptions, buildInternodeNativeConnectionOptions } from './client-options.js';

// ---------------------------------------------------------------------------
// Positive controls (MUST compile cleanly)
// ---------------------------------------------------------------------------

export const goodDeploymentVersion: WorkerDeploymentVersion = {
  deploymentName: 'meri-orchestration',
  buildId: 'w02-03-fixture',
};

export const goodWorkerDeploymentOptions: WorkerDeploymentOptions = {
  version: goodDeploymentVersion,
  useWorkerVersioning: true,
  defaultVersioningBehavior: VersioningBehavior.PINNED,
};

export const goodWorkerOptions: WorkerOptions = {
  taskQueue: MERI_TASK_QUEUE,
  workerDeploymentOptions: goodWorkerDeploymentOptions,
};

export const goodTlsMaterial: TlsMaterial = {
  serverRootCaPem: new Uint8Array([1]),
  clientCertPem: new Uint8Array([2]),
  clientKeyPem: new Uint8Array([3]),
  serverName: 'frontend.meri.internal',
};

export const goodTls: TLSConfig = {
  serverNameOverride: 'frontend.meri.internal',
  serverRootCACertificate: new Uint8Array([1]),
  clientCertPair: { crt: new Uint8Array([2]), key: new Uint8Array([3]) },
};

export const goodConnectionOptions: ConnectionOptions = {
  address: 'frontend.meri.internal:7233',
  tls: goodTls,
  apiKey: 'short-lived-bearer',
};

export const goodClientOptions = (connection: Connection): ClientOptions => ({ connection, namespace: 'meri' });

/** Real TS application-worker connection: TLS AND bearer against the external frontend. */
export const goodAppWorkerOptions: NativeConnectionOptions = buildApplicationWorkerConnectionOptions({
  address: 'frontend.meri.internal:7233',
  namespace: 'meri',
  audience: 'meri-temporal',
  issuer: 'issuer.meri.internal',
  jwt: 'short-lived-bearer',
  tls: goodTlsMaterial,
});

/** Server/internode route: mutual TLS only, no bearer. */
export const goodInternodeOptions: NativeConnectionOptions = buildInternodeNativeConnectionOptions({
  address: 'history.meri.internal:7233',
  namespace: 'meri',
  tls: goodTlsMaterial,
});

const proxied = proxyActivities<typeof activities>({ startToCloseTimeout: '1 minute' });
export const goodSignal = defineSignal<[string]>('approval');
export const goodSignalHandler = (): void => setHandler(goodSignal, (approver: string) => void approver);
export const goodActivityCall = (): Promise<unknown> =>
  proxied.recordCheckpoint({ runId: 'r', tenantRef: 't', stage: 's', sequence: 1 });

// ---------------------------------------------------------------------------
// Negative fixtures (each MUST be rejected)
// ---------------------------------------------------------------------------

// useWorkerVersioning:true REQUIRES defaultVersioningBehavior.
// @ts-expect-error defaultVersioningBehavior is required when useWorkerVersioning is true
export const badDeploymentMissingBehavior: WorkerDeploymentOptions = {
  version: goodDeploymentVersion,
  useWorkerVersioning: true,
};

// useWorkerVersioning:false FORBIDS defaultVersioningBehavior (typed `never`).
// @ts-expect-error defaultVersioningBehavior must be absent when useWorkerVersioning is false
export const badDeploymentBehaviorWhenDisabled: WorkerDeploymentOptions = {
  version: goodDeploymentVersion,
  useWorkerVersioning: false,
  defaultVersioningBehavior: VersioningBehavior.PINNED,
};

// The deployment version is mandatory.
// @ts-expect-error version is required on WorkerDeploymentOptions
export const badDeploymentMissingVersion: WorkerDeploymentOptions = {
  useWorkerVersioning: true,
  defaultVersioningBehavior: VersioningBehavior.PINNED,
};

// WorkerDeploymentVersion requires both deploymentName and buildId.
// @ts-expect-error WorkerDeploymentVersion requires both deploymentName and buildId
export const badDeploymentVersionShape: WorkerDeploymentVersion = {
  deploymentName: 'meri-orchestration',
};

// useWorkerVersioning must be a boolean.
export const badUseVersioningType = {
  version: goodDeploymentVersion,
  // @ts-expect-error useWorkerVersioning must be boolean, not string
  useWorkerVersioning: 'true',
  defaultVersioningBehavior: VersioningBehavior.PINNED,
} satisfies WorkerDeploymentOptions;

// VersioningBehavior accepts only the two string literals.
// @ts-expect-error VersioningBehavior is 'PINNED' | 'AUTO_UPGRADE'
export const badVersioningBehavior: VersioningBehavior = 'HARD_PINNED';

// TLS client certificate must be bytes, not a string.
export const badTlsCertType: TLSConfig = {
  serverNameOverride: 'frontend.meri.internal',
  clientCertPair: {
    // @ts-expect-error crt must be Uint8Array, not string
    crt: 'not-bytes',
    key: new Uint8Array([1]),
  },
};

// apiKey must be a string (or callback), not a number.
export const badApiKeyType: ConnectionOptions = {
  address: 'frontend.meri.internal:7233',
  // @ts-expect-error apiKey must be a string (or () => string), not a number
  apiKey: 42,
};

// NativeConnectionOptions.tls must be TLSConfig | boolean | null.
export const badNativeTlsType: NativeConnectionOptions = {
  address: 'frontend.meri.internal:7233',
  // @ts-expect-error tls must be TLSConfig | boolean | null, not an arbitrary string
  tls: 'yes',
};

// NativeConnectionOptions.apiKey must be a string.
export const badNativeApiKeyType: NativeConnectionOptions = {
  address: 'frontend.meri.internal:7233',
  // @ts-expect-error apiKey must be string, not number
  apiKey: 7,
};

// The application-worker builder requires the audience to be a string.
export const badAppWorkerAudienceType = buildApplicationWorkerConnectionOptions({
  address: 'frontend.meri.internal:7233',
  namespace: 'meri',
  // @ts-expect-error audience must be a string, not a number
  audience: 42,
  issuer: 'issuer.meri.internal',
  jwt: 'short-lived-bearer',
  tls: goodTlsMaterial,
});

// Activity proxy options must be an options object.
// @ts-expect-error ActivityProxyOptions must be an object, not a string
export const badProxyOptions = proxyActivities<typeof activities>('not-options');

// A signal handler must accept the declared argument type.
export const badSignalHandler = (): void =>
  // @ts-expect-error handler argument must be string for defineSignal<[string]>
  setHandler(goodSignal, (count: number) => void count);

// A proxied activity call must pass the declared argument shape.
export const badActivityCall = (): Promise<unknown> =>
  // @ts-expect-error recordCheckpoint requires a CheckpointEntry object, not a string
  proxied.recordCheckpoint('not-an-entry');
