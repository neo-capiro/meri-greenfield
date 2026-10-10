// W02-21 deterministic user-data assembly: raw text, gzip, base64 and the
// exact metadata/source relationships. Preserved verbatim; import is inert.
import { gzipSync } from 'node:zlib';
import { PINS } from './config.mjs';
import { exactSources, sha256 } from './asset-sources.mjs';
import { fullUserData } from './asset-loader.mjs';

export function buildUserData(runUUID, assetsImage) {
  return fullUserData(runUUID, assetsImage, exactSources());
}
export function buildUserDataPayload(runUUID, assetsImage) {
  const sources = exactSources();
  const text = fullUserData(runUUID, assetsImage, sources);
  const raw = Buffer.from(text, 'utf8');
  const compressed = gzipSync(raw, { level: 9 });
  if (compressed.length > PINS.userDataLimitBytes) {
    throw new Error(`Compressed EC2 user-data ${compressed.length} exceeds ${PINS.userDataLimitBytes} bytes; no fallback`);
  }
  return {
    text, raw, compressed, base64: compressed.toString('base64'),
    metadata: {
      owner: 'Codex integration owner', decision: 'D006', encoding: 'gzip; API base64 exactly once', qualificationRun: runUUID,
      assetsImage, workerImage: PINS.image, assetContainerExecution: 'NEVER STARTED; create/cp/remove only',
      rawPayload: { bytes: raw.length, sha256: sha256(raw) },
      compressedPayload: { bytes: compressed.length, sha256: sha256(compressed), limitBytes: PINS.userDataLimitBytes },
      sources: Object.fromEntries(sources.map(({ name, bytes }) => [name, { bytes: bytes.length, sha256: sha256(bytes) }])),
      nativeCloudInitExecution: 'NOT RUN',
    },
  };
}
