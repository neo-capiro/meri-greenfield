#!/usr/bin/env node
/** Resolves a RUNNER_FIRST_FAILURE `msg=` hash to the constant message it was computed from. Nothing is committed: the table
 * is built on demand from the pinned Claude Agent SDK bundle (string and template literals passed to Error and to the
 * bundle's own Error subclasses) and the runner/worker/contract sources (constant codes and messages) of the checkout.
 * Template literals with interpolation cannot be hashed; they are listed as patterns. From the repository root, at the
 * commit the image was built from:
 *   node scripts/diagnostics/runner-first-failure-message-hashes.mjs <msg> [<msg>…]   resolve live msg= values
 *   node scripts/diagnostics/runner-first-failure-message-hashes.mjs                   print the whole table as JSON */
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative, sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {firstFailureMessageHash} from '../../apps/runtime/runner-runtime-diagnostics.mjs';

// String or template literal starting right after `(`; returns [value, isTemplateWithInterpolation] or null.
function literalAt(text, index) {
  const quote = text[index];
  if (!['"', "'", '`'].includes(quote)) return null;
  let value = '', interpolated = false;
  for (let i = index + 1; i < text.length && i < index + 4096; i++) {
    const c = text[i];
    if (c === '\\') {const next = text[++i]; value += next === 'n' ? '\n' : next === 't' ? '\t' : next; continue;}
    if (quote === '`' && c === '$' && text[i + 1] === '{') {
      interpolated = true; let depth = 0;
      for (i += 1; i < text.length; i++) {if (text[i] === '{') depth++; else if (text[i] === '}' && --depth === 0) break;}
      value += '${…}'; continue;
    }
    if (c === quote) return [value, interpolated];
    value += c;
  }
  return null;
}

// Repository sources reachable by the runner: constant identifiers handed to an error constructor or a fault helper.
const roots = ['apps/runtime', 'apps/worker/conversation', 'apps/control/conversations', 'packages/runtime', 'packages/contracts/commands-0.2',
  'packages/contracts/runtime-0.2', 'packages/contracts/conversation-lifecycle', 'packages/contracts/validate.mjs'];
const skip = new Set(['node_modules', 'test', 'tests', 'qualification', 'evidence']);
function* sources(directory) {
  if (!statSync(directory).isDirectory()) {yield directory; return;}
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {if (!skip.has(name)) yield* sources(path);}
    else if (name.endsWith('.mjs') && !name.endsWith('.test.mjs')) yield path;
  }
}
const constant = /(?<![A-Za-z0-9_$])(?:new\s+)?(?:[A-Za-z]*Error|(?:[a-z][A-Za-z]*)?(?:[Ff]ault|[Ff]ail)|deny|refuse)\(\s*'([A-Z][A-Z0-9_]{2,80})'/gu;

/** The table for the checkout at `root`: {sdkVersion, messages: [{msg, message, origins}], unhashablePatterns: [{pattern, origins}]}. */
export function buildMessageHashTable({root = process.cwd()} = {}) {
  const sdkDirectory = join(root, 'apps/worker/conversation/node_modules/@anthropic-ai/claude-agent-sdk');
  const sdkVersion = JSON.parse(readFileSync(join(sdkDirectory, 'package.json'), 'utf8')).version;
  const entries = new Map(), patterns = new Map();
  const add = (map, key, origin) => {const row = map.get(key) ?? new Set(); row.add(origin); map.set(key, row);};
  const sdk = readFileSync(join(sdkDirectory, 'sdk.mjs'), 'utf8'), sdkOrigin = `@anthropic-ai/claude-agent-sdk@${sdkVersion}`;
  const sdkClasses = [...new Set([...sdk.matchAll(/class ([A-Za-z0-9_$]{1,24}) extends Error\b/gu)].map(match => match[1]))];
  const constructors = new RegExp(`(?<![A-Za-z0-9_$.])(?:new\\s+)?(?:Error|TypeError|RangeError|${sdkClasses.map(name => name.replace(/\$/gu, '\\$')).join('|')})\\(`, 'gu');
  for (const match of sdk.matchAll(constructors)) {
    const literal = literalAt(sdk, match.index + match[0].length);
    if (literal) add(literal[1] ? patterns : entries, literal[0], sdkOrigin);
  }
  for (const base of roots) {
    for (const path of sources(join(root, base))) {
      const origin = relative(root, path).split(sep).join('/');
      for (const match of readFileSync(path, 'utf8').matchAll(constant)) add(entries, match[1], origin);
    }
  }
  const cap = origins => [...origins].sort().slice(0, 4);
  return {
    sdkVersion,
    messages: [...entries].map(([message, origins]) => ({msg: firstFailureMessageHash(message), message, origins: cap(origins)}))
      .sort((a, b) => a.msg.localeCompare(b.msg) || a.message.localeCompare(b.message)),
    unhashablePatterns: [...patterns].map(([pattern, origins]) => ({pattern, origins: cap(origins)})).sort((a, b) => a.pattern.localeCompare(b.pattern)),
  };
}

/** Exit 0 when every value resolves, 1 when one does not (templated, interpolated or not on the runner path), 2 on bad input. */
export function resolveMessageHashes(values, table) {
  if (!values.every(value => /^[0-9a-f]{12}$/u.test(value))) return {code: 2, lines: ['usage: runner-first-failure-message-hashes.mjs [<12 hex msg= value> …]']};
  const lines = [];let code = 0;
  for (const value of values) {
    const rows = table.messages.filter(row => row.msg === value);
    if (!rows.length) {code = 1; lines.push(`${value}\tno constant message (templated, interpolated or not on the runner path)`);}
    for (const row of rows) lines.push(`${value}\t${JSON.stringify(row.message)}\t${row.origins.join(' ')}`);
  }
  return {code, lines};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const values = process.argv.slice(2), table = buildMessageHashTable();
  if (!values.length) process.stdout.write(JSON.stringify(table, null, 1) + '\n');
  else {const {code, lines} = resolveMessageHashes(values, table); process.stdout.write(lines.join('\n') + '\n'); process.exitCode = code;}
}
