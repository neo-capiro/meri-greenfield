import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;
assert.ok(root,'Exact source root required');
const effects=[];
const originals={fetch:globalThis.fetch,setTimeout:globalThis.setTimeout,setInterval:globalThis.setInterval,exit:process.exit};
globalThis.fetch=(...args)=>{effects.push('fetch');throw Error('Import must not fetch');};
globalThis.setTimeout=(...args)=>{effects.push('timeout');throw Error('Import must not schedule');};
globalThis.setInterval=(...args)=>{effects.push('interval');throw Error('Import must not schedule');};
process.exit=(...args)=>{effects.push('exit');throw Error('Import must not exit');};
const paths=['client-evidence','identity-contacts','client-knowledge'].flatMap(domain=>['handler.mjs','request-context.mjs','http-adapter.mjs'].map(file=>'apps/gateway/sources/'+domain+'/'+file));
paths.push('packages/contracts/retrieval-0.2/mail-utf16.mjs','packages/contracts/retrieval-0.2/mail-validation.mjs','apps/gateway/sources/client-knowledge/memory-eligibility.mjs','apps/gateway/sources/client-knowledge/monday-mapping.mjs','apps/gateway/dispatch/projection-read-context.mjs','apps/gateway/dispatch/tool-dispatch.mjs');
try {
 for(const path of paths)await import(pathToFileURL(root+'/'+path));
 assert.deepEqual(effects,[]);
 console.log(JSON.stringify({paths,effects,result:'PASS_INERT_IMPORT'}));
} finally {
 globalThis.fetch=originals.fetch;globalThis.setTimeout=originals.setTimeout;globalThis.setInterval=originals.setInterval;process.exit=originals.exit;
}
