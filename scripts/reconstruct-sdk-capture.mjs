// Standalone strict bounded SDK raw-capture decoder (OFFLINE TOOLING CANDIDATE).
//
// Node BUILTINS ONLY. It does NOT import the frozen producer probe, load the
// Claude Agent SDK, spawn any native/CLI process, open a socket or contact the
// network. It consumes the exact bounded stdout records emitted by the accepted
// sdk-capture probe (buildOutputLines) and validates the COMPLETE wire framing
// and every field BEFORE writing anything.
//
// The public API and CLI are preserved exactly, but the implementation is split
// into cohesive modules under ./sdk-capture/ with an acyclic dependency graph:
//   protocol            immutable constants, exact field sets, pure helpers (leaf)
//   privacy             credential/secret/header-sensitive predicates (leaf)
//   json-records        duplicate-key scanner + bounded transcript parsing
//   request-validation  record shapes + synthetic request/tool semantics
//   capture-validation  bounded byte snapshot + chunk/hash/semantic orchestration
//   filesystem          confined read/path/identity + destination primitives
//   artifacts           exclusive artifact write/readback/scoped cleanup
//   cli                 argument handling + runCli composition
//
// CLI: node reconstruct-sdk-capture.mjs --input <captured.ndjson> --out <new-dir>
//      (default, --input only => bounded validate, write nothing).

export {
  EXPECTED, MAX_INPUT_BYTES, MAX_LINES, MAX_RECORDS, MAX_RECORD_BYTES,
  MAX_REQUEST_BYTES, MAX_DECOMPRESSED_BYTES, MAX_TOTAL_RAW_BYTES,
  MAX_CHUNKS_PER_REQUEST, sha256Hex, isCanonicalBase64, countLinesUpTo,
} from './sdk-capture/protocol.mjs';

export { scrubSecrets, looksLikeSecret, isCredentialKey, hasSensitiveBody } from './sdk-capture/privacy.mjs';

export { MAX_JSON_DEPTH, scanJsonKeys, parseRecords } from './sdk-capture/json-records.mjs';

export { validateCapture } from './sdk-capture/capture-validation.mjs';

export { realIo, assertSafeAncestors, readCaptureFile, checkDestination } from './sdk-capture/filesystem.mjs';

export { writeCapture } from './sdk-capture/artifacts.mjs';

export { runCli } from './sdk-capture/cli.mjs';

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { runCli } from './sdk-capture/cli.mjs';

const invokedDirectly = process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
if (invokedDirectly) { process.exit(runCli()); }