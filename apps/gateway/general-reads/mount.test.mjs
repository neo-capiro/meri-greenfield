/** Synthetic: actual mail adapter/handler, current authority and durable dispatch over the scripted SQL protocol.
 * No PostgreSQL, live source, identity, SDK query or model call. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {generalReadFixture,MAIL_OPERATIONS} from './fixture.mjs';
import {createGeneralReadInstallationOwner} from './installation.mjs';
import {executionCatalogSha256} from '../catalog/installed-catalog.mjs';
const SEARCH=MAIL_OPERATIONS[1];
const code=expected=>error=>error.message===expected;
const run=(f,changes={},mount=f.mount())=>mount.execute({operation:SEARCH,arguments:f.search,deliveryId:'sdk:synthetic-delivery-1',...changes});

test('availability is the current measured installation intersected with the run allocation, plus the discovery grant',async()=>{
 const f=await generalReadFixture(),r=await f.mount().readAvailability();
 assert.deepEqual(r.installation.operations,[...MAIL_OPERATIONS]);assert.equal(r.installation.baseCatalogSha256,canonicalSha256(catalog));assert.match(r.installation.executionCatalogSha256,/^[a-f0-9]{64}$/u);
 assert.deepEqual(r.discovery.operations,[...MAIL_OPERATIONS]);assert.deepEqual(r.discovery.binding,f.binding);
 f.state.installed=[...MAIL_OPERATIONS,{id:'meeting.query_debriefs',version:'0.2.0'}];
 await assert.rejects(f.mount().readAvailability(),code('UNAVAILABLE'),'an installed handler without a registered measured source refuses the whole receipt');
});

test('source disabled by default and an absent or revoked installation are explicit UNAVAILABLE, never an empty result',async()=>{
 const f=await generalReadFixture(),before=f.state.connections;
 await assert.rejects(f.mount({sourceEnabled:undefined}).readAvailability(),code('UNAVAILABLE'));
 await assert.rejects(run(f,{},f.mount({sourceEnabled:false})),code('UNAVAILABLE'));
 f.state.installed=[];await assert.rejects(f.mount().readAvailability(),code('UNAVAILABLE'),'no receipt row: nothing is installed');
 f.state.installed=[...MAIL_OPERATIONS];f.state.installRevoked=true;await assert.rejects(run(f),code('UNAVAILABLE'));
 assert.equal(f.wire.length,0);assert.equal(f.state.connections,before,'no SQL before the installation is current');
});

test('an authorized mail read runs once through the durable owner; a duplicate delivery never reaches the source again',async()=>{
 const f=await generalReadFixture(),page=JSON.parse(await run(f));
 assert.deepEqual(page.operation,SEARCH);assert.deepEqual(page.binding,f.binding);assert.equal(page.subject.entityIds[0],f.clientId);
 assert.equal(f.wire.length,1);assert.equal(f.wire[0].url,'https://mail.example.invalid/mail.search_messages');assert.equal(JSON.stringify(f.wire[0].body).includes('tenantId'),false);
 assert.equal(f.state.reservations.size,1);assert.equal([...f.state.reservations.values()][0].state,'SETTLED');assert.equal(f.state.budget.consumed_micro_usd,1);
 await assert.rejects(run(f),code('BUDGET_UNCERTAIN'));assert.equal(f.wire.length,1);assert.equal(f.state.budget.consumed_micro_usd,1);
});

test('an installation revoked while the source call runs withholds the result as UNAVAILABLE',async()=>{
 const f=await generalReadFixture();f.state.afterFetch=()=>{f.state.installRevoked=true;};
 await assert.rejects(run(f),code('UNAVAILABLE'));assert.equal(f.wire.length,1);
});

test('operations outside the allocation or the current installation are UNAVAILABLE before any invocation',async()=>{
 const f=await generalReadFixture();
 await assert.rejects(run(f,{operation:{id:'meeting.query_debriefs',version:'0.2.0'}}),code('UNAVAILABLE'));
 f.state.installed=[MAIL_OPERATIONS[0]];await assert.rejects(run(f),code('UNAVAILABLE'));
 assert.equal(f.wire.length,0);assert.equal(f.state.produced.size,0);
});

test('argument-borne authority, a foreign client and revoked membership are refused with closed codes and no source call',async()=>{
 const f=await generalReadFixture();
 await assert.rejects(run(f,{arguments:{...f.search,tenantId:'other-tenant'}}),code('INVALID_ARGUMENTS'));
 await assert.rejects(run(f,{arguments:{...f.search,subject:{kind:'client',entityId:'71000000-0000-4000-8000-000000000999'}},deliveryId:'sdk:foreign'}),code('ACCESS_DENIED'));
 f.state.revoked=true;await assert.rejects(run(f,{deliveryId:'sdk:revoked'}),error=>error.message==='ACCESS_DENIED'&&!error.message.includes('PRIVATE'));
 assert.equal(f.wire.length,0);
});

test('a pre-aborted signal produces no installation read, SQL or source call',async()=>{
 const f=await generalReadFixture(),controller=new AbortController(),before=f.state.connections;controller.abort();
 await assert.rejects(run(f,{signal:controller.signal}));assert.equal(f.state.connections,before);assert.equal(f.wire.length,0);
});

test('the general installation owner measures handler bytes and refuses substituted receipts',async()=>{
 const f=await generalReadFixture(),dir=await mkdtemp(join(tmpdir(),'meri-general-read-measure-'));
 const valid=(handlerSourceSha256,change=()=>{})=>async()=>{const r={binding:f.binding,scopes:f.scopes,policyRevision:f.policy,baseCatalogSha256:canonicalSha256(catalog),installationId:'71000000-0000-4000-8000-000000000080',executionCatalogSha256:'',
  operations:[{operation:SEARCH,descriptorSha256:canonicalSha256(catalog.operations.find(o=>o.operation.id===SEARCH.id)),handlerSourceSha256,qualificationReceiptId:'71000000-0000-4000-8000-000000000081'}],checkedAtMs:f.now(),expiresAtMs:f.now()+1000};change(r);r.executionCatalogSha256=executionCatalogSha256(r);return r;};
 const owner=(readCurrentInstallation,extra={})=>createGeneralReadInstallationOwner({binding:f.binding,scopes:f.scopes,handlers:f.handlers,catalogJson:JSON.stringify(catalog),now:f.now,readCurrentInstallation,...extra});
 try{
  assert.deepEqual((await owner(valid(f.sourceSha256)).readCurrent()).operations.map(o=>o.operation),[SEARCH],'positive control');
  await writeFile(join(dir,'wrong.mjs'),'different');const sourceFiles=[{label:'wrong.mjs',sha256:'0'.repeat(64)}],sourceSha256=canonicalSha256(sourceFiles);
  await assert.rejects(owner(valid(sourceSha256),{sourceRoot:dir,handlers:new Map([...f.handlers].map(([k,h])=>[k,{execute:h.execute,sourceFiles,sourceSha256}]))}).readCurrent(),/GENERAL_READ_INSTALLATION_REFUSED/,'bytes differ from the registered hash');
  for(const change of [r=>{r.policyRevision='c'.repeat(64);},r=>{r.binding={...r.binding,writerFence:2};},r=>{r.scopes=[r.scopes[0]];},r=>{r.baseCatalogSha256='0'.repeat(64);},r=>{r.expiresAtMs=f.now();},r=>{r.checkedAtMs=f.now()+1;},r=>{r.operations=[];},r=>{r.operations[0].descriptorSha256='0'.repeat(64);},r=>{r.operations.push(structuredClone(r.operations[0]));},r=>{r.extra=true;}])
   await assert.rejects(owner(valid(f.sourceSha256,change)).readCurrent(),/GENERAL_READ_INSTALLATION_REFUSED/,String(change));
  await assert.rejects(owner(async()=>{const r=await valid(f.sourceSha256)();r.executionCatalogSha256='0'.repeat(64);return r;}).readCurrent(),/GENERAL_READ_INSTALLATION_REFUSED/,'execution catalog digest is recomputed');
 }finally{await rm(dir,{recursive:true,force:true});}
});
