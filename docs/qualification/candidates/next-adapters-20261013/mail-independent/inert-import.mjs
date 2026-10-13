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
const paths=['apps/gateway/sources/mail/handler.mjs','apps/gateway/sources/mail/request-context.mjs','apps/gateway/sources/mail/http-adapter.mjs'];
try {
 for(const path of paths)await import(pathToFileURL(root+'/'+path));
 assert.deepEqual(effects,[]);
 console.log(JSON.stringify({paths,effects,result:'PASS_INERT_IMPORT'}));
} finally {
 globalThis.fetch=originals.fetch;globalThis.setTimeout=originals.setTimeout;globalThis.setInterval=originals.setInterval;process.exit=originals.exit;
}
