// Strict duplicate-key scanning and bounded transcript/framing parsing for the
// SDK raw-capture decoder.
//
// The duplicate-key scanner runs BEFORE JSON.parse (which silently keeps the
// last duplicate member, hiding credentials/headers/record values). The
// transcript parser bounds the input by bytes/lines/records. Depends only on the
// protocol leaf module; performs no filesystem or network work on import.

import { MAX_INPUT_BYTES, MAX_LINES, MAX_RECORDS, MAX_RECORD_BYTES, MAX_REASONS, isPlainObject, countLinesUpTo } from './protocol.mjs';

// ---------------------------------------------------------------------------
// Strict JSON member-name scanner (duplicate-key detection BEFORE JSON.parse).
//
// JSON.parse silently keeps the LAST duplicate member, which can hide a
// credential/header/record value. This scanner walks the raw text, tracking a
// per-object member-name set at EVERY nesting depth, decoding JSON string
// escapes (\uXXXX, \", \\, ...) so escaped/colliding names are compared by
// their decoded value. Same names in DISTINCT object scopes are allowed.
// Bounded by MAX_JSON_DEPTH; failures are constant diagnostics (no excerpts).
// ---------------------------------------------------------------------------
export const MAX_JSON_DEPTH = 64;
export class DuplicateKeyError extends Error { constructor() { super('duplicate JSON member'); this.name = 'DuplicateKeyError'; } }
export class JsonScanError extends Error { constructor() { super('malformed JSON'); this.name = 'JsonScanError'; } }

/** Throw DuplicateKeyError on any duplicate object member, JsonScanError on malformed JSON. */
export function scanJsonKeys(text) {
  const n = text.length;
  let i = 0;
  const isWs = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r';
  const isDigit = (c) => c >= '0' && c <= '9';
  const fail = () => { throw new JsonScanError(); };
  function ws() { while (i < n && isWs(text[i])) i += 1; }
  function scanString() {
    if (text[i] !== '"') fail();
    i += 1;
    let out = '';
    while (i < n) {
      const c = text[i];
      if (c === '"') { i += 1; return out; }
      if (c === '\\') {
        i += 1;
        if (i >= n) fail();
        const e = text[i];
        if (e === '"' || e === '\\' || e === '/') { out += e; i += 1; }
        else if (e === 'b') { out += '\b'; i += 1; }
        else if (e === 'f') { out += '\f'; i += 1; }
        else if (e === 'n') { out += '\n'; i += 1; }
        else if (e === 'r') { out += '\r'; i += 1; }
        else if (e === 't') { out += '\t'; i += 1; }
        else if (e === 'u') {
          if (i + 4 >= n) fail();
          const hex = text.slice(i + 1, i + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail();
          out += String.fromCharCode(parseInt(hex, 16));
          i += 5;
        } else fail();
      } else if (c.charCodeAt(0) < 0x20) { fail(); } else { out += c; i += 1; }
    }
    return fail();
  }
  function scanNumber() {
    if (text[i] === '-') i += 1;
    if (text[i] === '0') i += 1;
    else if (text[i] >= '1' && text[i] <= '9') { while (isDigit(text[i])) i += 1; }
    else return fail();
    if (text[i] === '.') { i += 1; if (!isDigit(text[i])) fail(); while (isDigit(text[i])) i += 1; }
    if (text[i] === 'e' || text[i] === 'E') { i += 1; if (text[i] === '+' || text[i] === '-') i += 1; if (!isDigit(text[i])) fail(); while (isDigit(text[i])) i += 1; }
  }
  function scanObject(depth) {
    if (depth > MAX_JSON_DEPTH) fail();
    i += 1; ws();
    const seen = new Set();
    if (text[i] === '}') { i += 1; return; }
    while (true) {
      ws();
      if (text[i] !== '"') fail();
      const key = scanString();
      if (seen.has(key)) throw new DuplicateKeyError();
      seen.add(key);
      ws();
      if (text[i] !== ':') fail();
      i += 1;
      scanValue(depth + 1);
      ws();
      if (text[i] === ',') { i += 1; continue; }
      if (text[i] === '}') { i += 1; return; }
      return fail();
    }
  }
  function scanArray(depth) {
    if (depth > MAX_JSON_DEPTH) fail();
    i += 1; ws();
    if (text[i] === ']') { i += 1; return; }
    while (true) {
      scanValue(depth + 1);
      ws();
      if (text[i] === ',') { i += 1; continue; }
      if (text[i] === ']') { i += 1; return; }
      return fail();
    }
  }
  function scanValue(depth) {
    if (depth > MAX_JSON_DEPTH) fail();
    ws();
    if (i >= n) fail();
    const c = text[i];
    if (c === '"') { scanString(); return; }
    if (c === '{') { scanObject(depth); return; }
    if (c === '[') { scanArray(depth); return; }
    if (c === '-' || isDigit(c)) { scanNumber(); return; }
    if (text.startsWith('true', i)) { i += 4; return; }
    if (text.startsWith('false', i)) { i += 5; return; }
    if (text.startsWith('null', i)) { i += 4; return; }
    return fail();
  }
  ws();
  if (i >= n) fail();
  scanValue(0);
  ws();
  if (i !== n) fail();
}

/** Bounded parse of the captured stdout into JSON record lines. */
export function parseRecords(text) {
  const raw = typeof text === 'string' ? text : '';
  if (Buffer.byteLength(raw, 'utf8') > MAX_INPUT_BYTES) return { ok: false, reasons: [`input exceeds ${MAX_INPUT_BYTES} bytes`], records: [] };
  // Only JSON whitespace is framing; Unicode trim() also discards BOM/NBSP/VT.
  const trimmed = raw.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
  if (!trimmed) return { ok: false, reasons: ['empty input'], records: [] };
  if (countLinesUpTo(trimmed, MAX_LINES).exceeded) return { ok: false, reasons: [`input exceeds ${MAX_LINES} lines`], records: [] };
  const lines = trimmed.split('\n');
  if (lines.length > MAX_LINES) return { ok: false, reasons: [`input exceeds ${MAX_LINES} lines`], records: [] };
  const reasons = [];
  const records = [];
  for (const line of lines) {
    const recordLine = line.replace(/\r$/, '');
    if (recordLine === '') continue;
    if (Buffer.byteLength(recordLine, 'utf8') > MAX_RECORD_BYTES) { if (reasons.length < MAX_REASONS) reasons.push(`record line exceeds ${MAX_RECORD_BYTES} bytes`); continue; }
    let value;
    try {
      scanJsonKeys(recordLine); // reject duplicate members before JSON.parse hides them
      value = JSON.parse(recordLine);
    } catch (error) {
      if (reasons.length < MAX_REASONS) reasons.push(error && error.name === 'DuplicateKeyError' ? 'record contains duplicate JSON object members' : 'malformed JSON record');
      continue;
    }
    if (!isPlainObject(value)) { if (reasons.length < MAX_REASONS) reasons.push('record is not a JSON object'); continue; }
    records.push(value);
    if (records.length > MAX_RECORDS) return { ok: false, reasons: [`more than ${MAX_RECORDS} records`], records: [] };
  }
  if (records.length === 0 && reasons.length === 0) reasons.push('no records found');
  return { ok: reasons.length === 0, reasons, records };
}