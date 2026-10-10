// W02-18 fixed-source / input / graph integrity and inert compiler composition.
//
// Repair F1: the two allocated raw inputs (static-pins and graph) are snapshotted
// synchronously and checked against their exact raw byte length + SHA256 BEFORE any
// dynamic compiler import; the binding/plan retain that raw-byte identity.
// Repair F2: the branded binding exposes only immutable authority (primitive graph
// text, deeply frozen graph/member/pins/provenance records); production source reads
// are fixed and internal (no caller reader seam).
//
// NO filesystem/network/process work happens at import time: the fixed dynamic import
// and all reads occur only inside composeFixedBinding.

import { TextDecoder } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { scanJsonKeys } from '../sdk-capture/json-records.mjs';
import { readBoundedRegularFile } from './files.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// binding.mjs lives two levels below the repository root (scripts/native-teststate).
export const REPO_ROOT = resolve(HERE, '..', '..');
export const APP_RELATIVE_PATH = 'infra/native-enforcement/app.mjs';

export const EXPECTED_STATIC_BINDING_ID = '0599b1c8ed11af66130c08a54db950cac3cc79ba6e4941fa00ba2493fe907548';
export const GRAPH_RAW = Object.freeze({ bytes: 112210, sha256: '2c962d23a3ab42317e9b9d9ecd80c9d8eab7af6a7e9c59f46359de106f51eac3' });
export const STATIC_PINS_RAW = Object.freeze({ bytes: 10904, sha256: 'fc9f1beb1fc0e0c065abb9339ad4cfccc9a5b12591386064e113d128686591cc' });
export const EXPECTED_GRAPH = GRAPH_RAW;

export const BOUNDS = Object.freeze({ staticPins: 65536, graph: 1048576, seed: 4096 });

const bound = (v) => createHash('sha256').update(v).digest('hex');

function deepFreeze(value) {
  if (value && typeof value === 'object' && !ArrayBuffer.isView(value)) {
    if (Array.isArray(value)) for (const item of value) deepFreeze(item);
    else for (const key of Object.getOwnPropertyNames(value)) deepFreeze(value[key]);
    Object.freeze(value);
  }
  return value;
}

// Accepted fixed W14 source pins (candidate 3da63e67…, integrated fcc666fb). Byte
// length AND sha256 are checked before and after the fixed import. Recursively frozen.
export const FIXED_SOURCE_PINS = deepFreeze([
  { path: APP_RELATIVE_PATH, bytes: 422, sha256: '813a912999253b147d3d88ac50d24fbe7dd063aa98c3453a9e5e825d3fe7f70c' },
  { path: 'infra/native-enforcement/lib/binding.mjs', bytes: 7772, sha256: 'a14cea09763f44cd727857b2031700b4cadc9f9b53ba049e3b0ba237207db007' },
  { path: 'infra/native-enforcement/lib/expressions.mjs', bytes: 12917, sha256: 'e5a1931f3058e02e20bff10faf837b65eac11c226077e9a66d0501d323b4b648' },
  { path: 'infra/native-enforcement/lib/workflow.mjs', bytes: 23805, sha256: '4dfca118e7ea7c5f59ff684f9a9301fbd8e96cccb9eaf6b187403fb7b5ecdc19' },
  { path: 'infra/native-enforcement/lib/infrastructure.mjs', bytes: 3625, sha256: '6e57537dfbb675a8bc7673e26185cd4df0f769637ac3b783c4cca02681b95ae0' },
  { path: 'infra/native-enforcement/lib/task-definition.mjs', bytes: 7965, sha256: 'fbe770912afaa119c50a9e1681a691a605b94c8a6f9ebd686e3555ab9e9a36ad' },
]);

const FORBIDDEN_JSON_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_JSON_DEPTH = 64;

const branded = new WeakSet();
export const isOwnedBinding = (value) => typeof value === 'object' && value !== null && branded.has(value);

/** Pure predicate: an inert compiled admission (runtimeEnabled false + binding id). */
export const isInertAdmission = (compiled) => Boolean(compiled)
  && compiled.runtimeEnabled === false
  && typeof compiled.staticBindingId === 'string' && compiled.staticBindingId.length > 0;

/**
 * Pure validation of one source record against its accepted pin.
 * @returns {{ok: boolean, reason?: string}}
 */
export function validateSourceRecord(record, pin) {
  if (!record || typeof record !== 'object') return { ok: false, reason: 'missing source record' };
  if (record.path !== pin.path) return { ok: false, reason: 'source path mismatch' };
  if (!Number.isSafeInteger(record.bytes) || record.bytes !== pin.bytes) return { ok: false, reason: 'source byte length mismatch' };
  if (typeof record.sha256 !== 'string' || record.sha256 !== pin.sha256) return { ok: false, reason: 'source sha256 mismatch' };
  return { ok: true };
}

/** Verify all six source records; returns the first drift. */
export function verifySourceRecords(records, pins = FIXED_SOURCE_PINS) {
  if (!Array.isArray(records) || records.length !== pins.length) return { ok: false, reason: 'source record set size mismatch' };
  for (let i = 0; i < pins.length; i += 1) {
    const check = validateSourceRecord(records[i], pins[i]);
    if (!check.ok) return { ok: false, reason: `source drift: ${pins[i].path} (${check.reason})` };
  }
  return { ok: true };
}

function findUnsafeJson(value, depth) {
  if (depth > MAX_JSON_DEPTH) return 'json exceeds depth bound';
  if (typeof value === 'number') return Number.isFinite(value) ? null : 'non-finite number';
  if (Array.isArray(value)) {
    for (const item of value) { const r = findUnsafeJson(item, depth + 1); if (r) return r; }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.getOwnPropertyNames(value)) {
      if (FORBIDDEN_JSON_KEYS.has(key)) return 'forbidden JSON member';
      const r = findUnsafeJson(value[key], depth + 1); if (r) return r;
    }
    return null;
  }
  return null;
}

/**
 * Strict JSON: bounded bytes, fatal UTF-8 (lexical node:util TextDecoder, immune to a
 * poisoned global), duplicate-member scan BEFORE JSON.parse, depth bound, recursive
 * finite-number check and no __proto__/prototype/constructor members.
 * @returns {{ok: true, value: any, text: string} | {ok: false, reason: string}}
 */
export function parseStrictJson(bytes, options = {}) {
  const { maxBytes } = options;
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes ?? '');
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) return { ok: false, reason: 'internal byte bound is invalid' };
  if (buf.length > maxBytes) return { ok: false, reason: 'json exceeds byte bound' };
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return { ok: false, reason: 'invalid UTF-8' };
  }
  try {
    scanJsonKeys(text);
  } catch (error) {
    return { ok: false, reason: error && error.name === 'DuplicateKeyError' ? 'duplicate JSON member' : 'malformed JSON' };
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'malformed JSON' };
  }
  const unsafe = findUnsafeJson(value, 0);
  if (unsafe) return { ok: false, reason: unsafe };
  return { ok: true, value, text };
}

/** Read one fixed repository source record into a Buffer (or null when refused). */
export function readFixedSource(relativePath, options = {}) {
  const result = readBoundedRegularFile(join(REPO_ROOT, relativePath), { maxBytes: options.maxBytes });
  return result.ok ? result.bytes : null;
}

function readAndVerifyFixedSources() {
  const records = [];
  for (const pin of FIXED_SOURCE_PINS) {
    const bytes = readFixedSource(pin.path, { maxBytes: pin.bytes + 1 });
    if (!bytes) return { ok: false, reason: `source unreadable: ${pin.path}` };
    const record = { path: pin.path, bytes: bytes.length, sha256: bound(bytes) };
    const check = validateSourceRecord(record, pin);
    if (!check.ok) return { ok: false, reason: `source drift: ${pin.path} (${check.reason})` };
    records.push(record);
  }
  return { ok: true, records };
}

function rawIdentity(buf, pin) {
  if (buf.length !== pin.bytes) return { ok: false, reason: `raw byte length ${buf.length} != ${pin.bytes}` };
  const sha256 = bound(buf);
  if (sha256 !== pin.sha256) return { ok: false, reason: 'raw byte sha256 mismatch' };
  return { ok: true, sha256 };
}

async function importFixedApp() {
  const url = pathToFileURL(join(REPO_ROOT, APP_RELATIVE_PATH)).href;
  return import(url);
}

/**
 * Compose the inert, branded initial-TestState binding.
 *
 * Order is deliberate: snapshot the caller buffers synchronously, check their raw byte
 * identity and parse them, read+verify the six fixed source records, THEN dynamically
 * import the accepted compiler, compile, reproduce the graph, and re-verify the source
 * records. No caller-supplied reader, import path or import function is accepted: the
 * production source reads are fixed and internal, so a caller cannot synthesize passing
 * records while different code is imported.
 *
 * @returns {{ok: true, binding: object} | {ok: false, reason: string}}
 */
export async function composeFixedBinding(input = {}) {
  const pinsIn = Buffer.isBuffer(input.staticPinsBytes) ? input.staticPinsBytes : null;
  const graphIn = Buffer.isBuffer(input.graphBytes) ? input.graphBytes : null;
  if (!pinsIn || pinsIn.length > BOUNDS.staticPins) return { ok: false, reason: 'static pins missing or oversized' };
  if (!graphIn || graphIn.length > BOUNDS.graph) return { ok: false, reason: 'graph missing or oversized' };

  // F1: synchronous snapshots so later caller mutation cannot substitute bytes.
  const staticPinsSnapshot = Buffer.from(pinsIn);
  const graphSnapshot = Buffer.from(graphIn);

  // F1: raw input byte identity BEFORE any dynamic import.
  const pinsRaw = rawIdentity(staticPinsSnapshot, STATIC_PINS_RAW);
  if (!pinsRaw.ok) return { ok: false, reason: `static pins raw identity: ${pinsRaw.reason}` };
  const graphRaw = rawIdentity(graphSnapshot, GRAPH_RAW);
  if (!graphRaw.ok) return { ok: false, reason: `graph raw identity: ${graphRaw.reason}` };
  const parsedPins = parseStrictJson(staticPinsSnapshot, { maxBytes: BOUNDS.staticPins });
  if (!parsedPins.ok) return { ok: false, reason: `static pins: ${parsedPins.reason}` };
  const parsedGraph = parseStrictJson(graphSnapshot, { maxBytes: BOUNDS.graph });
  if (!parsedGraph.ok) return { ok: false, reason: `graph json: ${parsedGraph.reason}` };

  // Six fixed source records, verified BEFORE the dynamic import (internal reads).
  const preSource = readAndVerifyFixedSources();
  if (!preSource.ok) return { ok: false, reason: preSource.reason };

  let mod;
  try {
    mod = await importFixedApp();
  } catch {
    return { ok: false, reason: 'fixed source import failed' };
  }

  let compiled;
  try {
    compiled = mod.buildNativeEnforcementAdmission({ staticPins: parsedPins.value, executeAdmitted: false });
  } catch {
    return { ok: false, reason: 'compiler refused static pins' };
  }
  if (!isInertAdmission(compiled)) return { ok: false, reason: 'admission is not inert (runtimeEnabled must be false)' };
  if (compiled.staticBindingId !== EXPECTED_STATIC_BINDING_ID) return { ok: false, reason: 'static binding id mismatch' };

  let graph;
  try {
    graph = mod.buildNativeEnforcementStateMachine(compiled);
  } catch {
    return { ok: false, reason: 'graph build failed' };
  }
  const graphJson = JSON.stringify(graph);
  const graphSha256 = bound(Buffer.from(graphJson, 'utf8'));
  const graphBytesLength = Buffer.byteLength(graphJson, 'utf8');
  if (graphJson !== parsedGraph.text) return { ok: false, reason: 'compiled graph differs from supplied graph bytes' };
  if (graphSha256 !== GRAPH_RAW.sha256 || graphBytesLength !== GRAPH_RAW.bytes) return { ok: false, reason: 'graph hash mismatch' };

  const guard = graph && graph.States && graph.States.GuardInput;
  const guardCondition = guard && Array.isArray(guard.Choices) && guard.Choices[0] && guard.Choices[0].Condition;
  if (!guard || guard.Type !== 'Choice' || typeof guardCondition !== 'string' || !guardCondition.startsWith('{% false and ')) {
    return { ok: false, reason: 'GuardInput is not inert' };
  }

  // Post-compile source re-verification (internal reads).
  const postSource = readAndVerifyFixedSources();
  if (!postSource.ok) return { ok: false, reason: postSource.reason };

  const memberHashes = deepFreeze({
    DispatchIdentity: bound(JSON.stringify(graph.States.DispatchIdentity)),
    ListFirst: bound(JSON.stringify(graph.States.ListFirst)),
  });

  const binding = Object.freeze({
    runtimeEnabled: false,
    staticBindingId: compiled.staticBindingId,
    graphText: graphJson, // immutable primitive string: the authoritative definition
    graphBytesLength,
    graphSha256,
    graph: deepFreeze(graph),
    pins: deepFreeze(compiled.pins),
    authorityReferences: deepFreeze(compiled.pins.authorityReferences || []),
    sourceRecords: deepFreeze(preSource.records),
    postCompileRecords: deepFreeze(postSource.records),
    memberHashes,
    inputProvenance: deepFreeze({
      staticPins: { bytes: staticPinsSnapshot.length, sha256: pinsRaw.sha256 },
      graph: { bytes: graphSnapshot.length, sha256: graphRaw.sha256 },
    }),
  });
  branded.add(binding);
  return { ok: true, binding };
}
