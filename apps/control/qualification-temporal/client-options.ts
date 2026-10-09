// W02-03 inert client/NativeConnection TLS + JWT option fixtures.
//
// Preparation only. These builders construct real, typed connection option
// objects for the pinned @temporalio/client and @temporalio/worker 1.24.0
// packages. No connection is ever established: nothing here talks to a server,
// a database, a model provider or any network endpoint.
//
// Design encoded here (see docs/qualification/PROXY-TEMPORAL-DECISIONS.md):
//   - Trusted application orchestration clients reach ONLY the external
//     authenticated frontend over TLS with hostname verification, presenting a
//     short-lived bearer (JWT) credential minted by the dedicated workload
//     issuer with a bounded expiry.
//   - Internode/server roles use mutual TLS only, with no external JWT.
//   - The internal frontend is internode-only and must never accept
//     application/conversation ingress.
//
// The exact field types below (apiKey becoming `Authorization: Bearer`, TLS
// serverNameOverride/serverRootCACertificate/clientCertPair) are asserted
// against the installed .d.ts in compatibility.test.mjs.

import type { Connection, ConnectionOptions, ClientOptions } from '@temporalio/client';
import type { NativeConnectionOptions, TLSConfig } from '@temporalio/worker';

/** PEM material for one private trust root and client leaf (never a Capiro cert). */
export interface TlsMaterial {
  /** Root CA PEM that signs the server leaf. */
  readonly serverRootCaPem: Uint8Array;
  /** Client leaf certificate PEM used for mTLS. */
  readonly clientCertPem: Uint8Array;
  /** Client private key PEM matching the leaf. */
  readonly clientKeyPem: Uint8Array;
  /** Expected SNI / hostname-verification target; must be nonempty. */
  readonly serverName: string;
}

export function buildTlsConfig(material: TlsMaterial): TLSConfig {
  if (material.serverName.trim() === '') {
    throw new Error('TLS hostname verification requires a nonempty serverName');
  }
  if (material.serverRootCaPem.byteLength === 0 || material.clientCertPem.byteLength === 0 || material.clientKeyPem.byteLength === 0) {
    throw new Error('TLS material must be present');
  }
  return {
    serverNameOverride: material.serverName,
    serverRootCACertificate: material.serverRootCaPem,
    clientCertPair: { crt: material.clientCertPem, key: material.clientKeyPem },
  };
}

export interface ExternalClientInputs {
  readonly address: string;
  readonly namespace: string;
  /** Nonempty JWT audience required by the external default mapper/authorizer. */
  readonly audience: string;
  /** Dedicated workload issuer; must mint only bounded-expiry bearer tokens. */
  readonly issuer: string;
  /** Short-lived bearer credential; becomes `Authorization: Bearer <jwt>`. */
  readonly jwt: string;
  readonly tls: TlsMaterial;
}

/**
 * Build the external-frontend ConnectionOptions for a trusted orchestration
 * client. Fails closed on an empty audience, issuer or bearer token.
 */
export function buildExternalConnectionOptions(inputs: ExternalClientInputs): ConnectionOptions {
  if (inputs.audience.trim() === '') {
    throw new Error('external frontend requires a nonempty audience');
  }
  if (inputs.issuer.trim() === '') {
    throw new Error('external frontend requires a dedicated issuer');
  }
  if (inputs.jwt.trim() === '') {
    throw new Error('external frontend requires a short-lived bearer credential');
  }
  return {
    address: inputs.address,
    tls: buildTlsConfig(inputs.tls),
    // apiKey is serialized to the Authorization header as `Bearer <jwt>`.
    apiKey: inputs.jwt,
  };
}

/**
 * Build ClientOptions from an already-constructed Connection. Typed against the
 * real `ConnectionLike` interface; constructing/connecting a Connection is out
 * of scope for this inert fixture.
 */
export function buildClientOptions(connection: Connection, namespace: string): ClientOptions {
  if (namespace.trim() === '') {
    throw new Error('client namespace must be nonempty');
  }
  return { connection, namespace };
}

export interface ApplicationWorkerInputs {
  readonly address: string;
  readonly namespace: string;
  /** Nonempty JWT audience required by the external frontend's default mapper/authorizer. */
  readonly audience: string;
  /** Dedicated workload issuer; must mint only bounded-expiry bearer tokens. */
  readonly issuer: string;
  /** Short-lived, task-bound bearer credential; becomes `Authorization: Bearer <jwt>`. */
  readonly jwt: string;
  readonly tls: TlsMaterial;
}

/**
 * Build the NativeConnectionOptions for a real TypeScript APPLICATION WORKER
 * connecting to the EXTERNAL authenticated frontend. Carries BOTH mTLS-capable
 * TLS (with hostname verification) AND the short-lived task-bound bearer
 * (`apiKey`). Fails closed on an empty audience, issuer or bearer.
 */
export function buildApplicationWorkerConnectionOptions(inputs: ApplicationWorkerInputs): NativeConnectionOptions {
  if (inputs.audience.trim() === '') {
    throw new Error('application worker requires a nonempty audience');
  }
  if (inputs.issuer.trim() === '') {
    throw new Error('application worker requires a dedicated issuer');
  }
  if (inputs.jwt.trim() === '') {
    throw new Error('application worker requires a short-lived bearer credential');
  }
  return {
    address: inputs.address,
    tls: buildTlsConfig(inputs.tls),
    apiKey: inputs.jwt,
  };
}

export interface InternodeInputs {
  readonly address: string;
  readonly namespace: string;
  readonly tls: TlsMaterial;
}

/**
 * SERVER / INTERNODE route only: mutual TLS with deliberately NO external JWT.
 * This models the Go internode/server path (and cluster-internal clients). It is
 * NOT the authentication used by SDK application workers, which must use
 * {@link buildApplicationWorkerConnectionOptions} with a bearer token against the
 * external authenticated frontend. Do not present this builder as app-worker auth.
 */
export function buildInternodeNativeConnectionOptions(inputs: InternodeInputs): NativeConnectionOptions {
  return {
    address: inputs.address,
    tls: buildTlsConfig(inputs.tls),
  };
}
