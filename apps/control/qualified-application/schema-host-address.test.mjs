/** SQL projection and strict identity regression; no native database imports. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareOwnedApplicationSchema,verifyOwnedApplicationSchema} from './schema.mjs';
import {createScriptedSchemaFixture,fixtureMigrationBytes} from './schema.fixture.mjs';

const projected='pg_catalog.host(pg_catalog.inet_server_addr()) AS address';
const identities=[['IPv4','192.0.2.41','192.0.2.42','/32'],['IPv6','2001:db8::41','2001:db8::42','/128']];
const made=(address,observed=address)=>createScriptedSchemaFixture({fixture:{serverAddress:address,serverPort:5432},identity:{address:observed},before(text){if(text.startsWith('SELECT current_database'))assert.ok(text.includes(projected));}});
const ddlCount=s=>s.log.filter(r=>fixtureMigrationBytes.includes(r.text)).length;
for(const [family,address,other,mask]of identities){
 test(`${family} proper host projection installs and reconstructs with separate loopback dial`,async()=>{
  const s=made(address),installed=await prepareOwnedApplicationSchema(s.args());
  assert.equal(installed.engine.host,'127.0.0.1');assert.equal(installed.engine.serverAddress,address);
  const verified=await verifyOwnedApplicationSchema({...s.args(),fixture:{...s.f,schemaSha256:installed.schemaSha256}});
  assert.equal(verified.schemaSha256,installed.schemaSha256);assert.equal(ddlCount(s),6);
 });
 for(const observed of [address+mask,other])test(`${family} masked or foreign observed address ${observed} refuses before DDL`,async()=>{
  const s=made(address,observed);
  await assert.rejects(prepareOwnedApplicationSchema(s.args()),e=>e.stage==='identity'&&e.outcome==='NOT_INSTALLED');
  assert.equal(ddlCount(s),0);assert.equal(s.releases.length,1);
 });
 test(`${family} caller cannot put a mask into the strict server address descriptor`,async()=>{
  const s=made(address+mask);
  await assert.rejects(prepareOwnedApplicationSchema(s.args()),e=>e.stage==='admission'&&e.outcome==='NOT_INSTALLED');
  assert.equal(s.log.length,0);
 });
}
for(const path of ['apps/control/qualified-application/schema.mjs','apps/proxy/qualification/assembly/lifecycle.py','apps/gateway/test/postgres-budget-native-fixture.mjs','apps/control/task-lookup/local-integration/fixture-checks.mjs'])test(`native identity projection retains qualified host semantics: ${path}`,async()=>{
 const text=await readFile(new URL('../../../'+path,import.meta.url),'utf8');
 assert.match(text,/pg_catalog\.host\(pg_catalog\.inet_server_addr\(\)\) AS (?:address|addr)/);
 assert.doesNotMatch(text,/inet_server_addr\(\)::text/);
});
