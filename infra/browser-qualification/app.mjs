// W02-21 composition entry: a small module that reexports the frozen public
// API by direct ESM binding and delegates direct execution to the CLI. It
// defines no functions/classes or replacement constants; importing it
// synthesizes nothing.
import { pathToFileURL } from 'node:url';
import { main } from './js/cli.mjs';

export {
  TARGET, QUALIFICATION_NETWORK, PINS, BROWSER_ROOT, BROWSER_EXE_PATTERN_SOURCE,
  PINNED_IMAGE, HOST_EVIDENCE_RULES, validateRunUUID, validateAssetsImage,
} from './js/config.mjs';
export { classifyHostEvidence } from './js/legacy-classifier.mjs';
export { sha256 } from './js/asset-sources.mjs';
export { shellQuote } from './js/asset-loader.mjs';
export { buildUserData, buildUserDataPayload } from './js/user-data.mjs';
export { BrowserQualificationStack } from './js/stack.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
