import {createRequire} from 'node:module';
import {performance} from 'node:perf_hooks';
const root=new URL('../../../../../',import.meta.url),at=performance.now();
await import(new URL('apps/runtime/control.mjs',root));
const require=createRequire(new URL('apps/worker/qualification/checkpoint/bound-session-store.mjs',root));
console.log(JSON.stringify({elapsedMs:performance.now()-at,publicSource:new URL('packages/contracts/validate.mjs',root).href,qualifiedPublicPackage:require.resolve('@capiro/meri-contracts/node'),scope:'IMPORT_ONLY_NO_LISTENERS_DATABASE_PROVIDER_OR_TASK_ALLOCATION'}));
