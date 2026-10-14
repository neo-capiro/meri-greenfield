import {performance} from 'node:perf_hooks';
const start=performance.now();await import(new URL('../../../../../packages/contracts/validate.mjs',import.meta.url));console.log(JSON.stringify({elapsedMs:performance.now()-start,scope:'CANONICAL_PUBLIC_IMPORT_ONLY_NO_ALLOCATION'}));
