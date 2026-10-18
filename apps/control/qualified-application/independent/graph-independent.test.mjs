import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createQualificationActionHost} from '../mount.mjs';
import {admittedFixture} from '../../admitted-runs/test/fixture.mjs';
import {createPostgresApprovalMetadataStore} from '../../commands/approval-metadata/postgres-store.mjs';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};

// Configuration-only fixture: every table-facing owner receives this same inert pool.
// Full execution uses the actual composed child/owner fixture in the application tests.
async function configured(t){
 const f=await admittedFixture();t.after(()=>f.close());const {source:ignored,...command}=f.config.command;
 let calls=0;const pool={options:{connectionTimeoutMillis:1000,query_timeout:1000},async connect(){calls++;throw Error('unexpected I/O');},end(){throw Error('borrowed disposal');}};
 const c={hostConfiguration:{...f.config,admission:{...f.config.admission,pool},lookup:{...f.config.lookup,pool},metadata:{...f.config.metadata,pool},command:{...command,budgetPool:pool,journalPool:pool}},source:{read:f.p.source,command:f.p.source}};
 return {f,c,pool,get calls(){return calls;}};
}
test('qualification graph construction and close are inert and cannot mutate production catalog',async t=>{
 const f=await configured(t),before=JSON.stringify(catalog),g=createQualificationActionHost(f.c);assert.equal(g.status().sourceEnabled,true);assert.equal(f.calls,0);assert.equal(JSON.stringify(catalog),before);assert.equal(catalog.operations.every(x=>x.handler===null),true);g.close();g.close();assert.equal(g.status().closed,true);assert.equal(f.calls,0);
});
for(const key of ['lookup','metadata','journalPool','budgetPool'])test(`qualification graph rejects a separate ${key} pool`,async t=>{
 const f=await configured(t),h=f.c.hostConfiguration,foreign={connect(){throw Error('must not connect');}};const replacement=key.endsWith('Pool')?{command:{...h.command,[key]:foreign}}:{[key]:{...h[key],pool:foreign}};
 assert.throws(()=>createQualificationActionHost({...f.c,hostConfiguration:{...h,...replacement}}),/POOL_MISMATCH/);assert.equal(f.calls,0);
});
for(const part of ['read','command'])test(`qualified ${part} transport rejects live origin`,async t=>{
 const f=await configured(t);assert.throws(()=>createQualificationActionHost({...f.c,source:{...f.c.source,[part]:{...f.c.source[part],origin:'https://production.example.com'}}}));assert.equal(f.calls,0);
});
test('nested host accessors and proxies cannot execute during qualification admission',async t=>{
 const f=await configured(t);let effects=0;const h={...f.c.hostConfiguration};Object.defineProperty(h,'command',{get(){effects++;return f.c.hostConfiguration.command;},enumerable:true});assert.throws(()=>createQualificationActionHost({...f.c,hostConfiguration:h}));assert.throws(()=>createQualificationActionHost({...f.c,source:new Proxy(f.c.source,{get(){effects++;throw Error('trap');}})}));assert.equal(effects,0);assert.equal(f.calls,0);
});
test('metadata autocommit read explicitly targets the meri_commands schema rather than inherited search_path',async()=>{
 const statements=[];let releases=0;const pool={options:{connectionTimeoutMillis:1000,query_timeout:1000},async connect(){return {async query(q){statements.push(q);return {rows:[]};},release(){releases++;}};},end(){assert.fail('borrowed pool ended');}};
 const owner=createPostgresApprovalMetadataStore({pool});assert.equal(await owner.read({tenantId:'tenant',actorId:'actor',proposalId:'11111111-1111-4111-8111-111111111111'},()=>{}),null);assert.equal(statements.length,1);assert.match(statements[0].text,/^SELECT payload,payload_sha256 FROM meri_commands\.approval_metadata WHERE /);assert.equal(releases,1);
});
test('all six canonical metadata/journal relation references are schema-qualified',async()=>{
 const files=['../../commands/approval-metadata/postgres-store.mjs','../../commands/postgres-command-journal.mjs'];let count=0;
 for(const file of files){const code=await readFile(new URL(file,import.meta.url),'utf8');assert.equal(/(?:FROM|INTO|UPDATE) (?!meri_commands\.)[a-z_.]*(?:approval_metadata|command_journal)\b/.test(code),false);count+=[...code.matchAll(/(?:FROM|INTO|UPDATE) meri_commands\.(?:approval_metadata|command_journal)\b/g)].length;}
 assert.equal(count,6);
});
