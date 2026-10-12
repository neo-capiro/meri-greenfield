// Explicit PostgreSQL connection and transaction adapter.
//
// One owned connection per operation, an explicit BEGIN/COMMIT, database time
// from the server, and an ambiguity rule that never guesses: once COMMIT has been
// dispatched an unobserved acknowledgement becomes CommitUncertain, which callers
// must reconcile by reading the immutable commit row back. There is no automatic
// migration, no automatic retry, no in-memory fallback and no pool.
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { CommitUncertain, StateDenied, fail } from './errors.mjs';

export const QUALIFICATION_DATABASE = /^meri_qualification_sdk_fixture(?:_[a-z0-9_]+)?$/;
export const MIGRATION_URL = new URL('./migrations/0001_qualification_sdk_fixture_state.sql', import.meta.url);
export const STATEMENT_TIMEOUT_MS = 5000;
export const LOCK_TIMEOUT_MS = 2000;
export const CONNECT_TIMEOUT_MS = 5000;
const APPLICATION_NAME = 'meri-qualification-sdk-fixture-state';
const CONFIGURATION_KEYS = Object.freeze(['host', 'port', 'database', 'user', 'password', 'ssl']);
const HOST = /^(?:[A-Za-z0-9][A-Za-z0-9.-]{0,253}|::1)$/;
const DUPLICATE_OBJECT = new Set(['42P06', '42P07', '42710']);

function assertConfiguration(parameters) {
  if (parameters === null || typeof parameters !== 'object' || Array.isArray(parameters) ||
      Object.getPrototypeOf(parameters) !== Object.prototype ||
      Reflect.ownKeys(parameters).some(key => !CONFIGURATION_KEYS.includes(key))) {
    fail('INVALID_DATABASE_CONFIGURATION');
  }
  const { host, port, database, user, password, ssl } = parameters;
  if (typeof host !== 'string' || !HOST.test(host) || !Number.isInteger(port) || port < 1 ||
      port > 65535 || typeof database !== 'string' || !QUALIFICATION_DATABASE.test(database) ||
      typeof user !== 'string' || user.length === 0 || user.length > 128) {
    fail('INVALID_DATABASE_CONFIGURATION');
  }
  if (!QUALIFICATION_DATABASE.test(database)) fail('QUALIFICATION_DATABASE_REQUIRED');
  if (password !== undefined && typeof password !== 'string') fail('INVALID_DATABASE_CONFIGURATION');
  const loopback = host === '127.0.0.1' || host === '::1';
  if (!loopback) {
    if (ssl === null || typeof ssl !== 'object' || ssl.rejectUnauthorized !== true ||
        ssl.ca === undefined) fail('VERIFIED_DATABASE_TLS_REQUIRED');
  } else if (ssl !== undefined && (ssl === null || typeof ssl !== 'object' ||
      ssl.rejectUnauthorized !== true)) fail('INVALID_DATABASE_CONFIGURATION');
  return Object.freeze({ ...parameters });
}

export class PostgresStore {
  #parameters;
  #afterCommit;

  /** `afterCommit` is a trusted test seam that can only make a commit ambiguous. */
  constructor(connectionParameters, { afterCommit = null } = {}) {
    this.#parameters = assertConfiguration(connectionParameters);
    if (afterCommit !== null && typeof afterCommit !== 'function') {
      fail('INVALID_COMMIT_OBSERVER');
    }
    this.#afterCommit = afterCommit;
  }

  #connect() {
    try {
      return new Client({ ...this.#parameters, application_name: APPLICATION_NAME,
        connectionTimeoutMillis: CONNECT_TIMEOUT_MS });
    } catch {
      fail('DATABASE_CONNECTION_FAILED');
    }
  }

  /**
   * Runs `operation(client)` in one transaction. A missing server, a refused
   * connection or a failed statement is a handled, content-free failure that
   * writes nothing and is never silently retried.
   */
  async transact(operation) {
    if (typeof operation !== 'function') fail('INVALID_TRANSACTION_OPERATION');
    const client = this.#connect();
    let begun = false;
    let committing = false;
    try {
      try {
        await client.connect();
      } catch {
        fail('DATABASE_UNAVAILABLE');
      }
      await client.query('BEGIN');
      begun = true;
      await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
      await client.query(`SET LOCAL lock_timeout = ${LOCK_TIMEOUT_MS}`);
      const result = await operation(client);
      committing = true;
      await client.query('COMMIT');
      if (this.#afterCommit !== null) await this.#afterCommit();
      return result;
    } catch (error) {
      if (committing) throw new CommitUncertain('COMMIT_ACKNOWLEDGEMENT_UNKNOWN');
      if (begun) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // A rollback whose outcome cannot be observed is reported as an outage,
          // never as a clean rollback.
        }
      }
      if (error instanceof StateDenied) throw error;
      throw new StateDenied('DATABASE_TRANSACTION_FAILED');
    } finally {
      try {
        await client.end();
      } catch {
          // Closing the owned connection is best-effort and never authoritative.
      }
    }
  }

  /** Authoritative database time. Never the process clock. */
  async databaseNow() {
    const result = await this.transact(client => client.query('SELECT clock_timestamp() AS now'));
    const now = result.rows[0]?.now;
    if (!(now instanceof Date)) fail('DATABASE_TIME_UNAVAILABLE');
    return now.getTime();
  }

  /** Explicit owner/test operation: the qualification schema must not exist yet. */
  async migrateNewDatabase() {
    const sql = await readFile(MIGRATION_URL, 'utf8');
    return this.transact(async client => {
      try {
        await client.query(sql);
      } catch (error) {
        if (DUPLICATE_OBJECT.has(error?.code)) fail('QUALIFICATION_SCHEMA_ALREADY_EXISTS');
        throw error;
      }
    });
  }
}
