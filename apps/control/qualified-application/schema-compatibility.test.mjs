import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareOwnedApplicationSchema,verifyOwnedApplicationSchema} from './schema.mjs';
import {createScriptedSchemaFixture as scripted,fixtureMigrationBytes as ddl} from './schema.fixture.mjs';
const mapped={serverAddress:'172.17.0.2',serverPort:5432};
const namespaces=Array.from({length:25},(_,i)=>({name:`evidence_${String(i).padStart(2,'0')}`,owner:'qualification_owner'}));
const scope={mode:'preserve-declared-evidence',namespaces};
test('mapped server identity is independent from loopback dial identity',async()=>{
 const s=scripted({fixture:mapped,identity:{address:mapped.serverAddress,port:mapped.serverPort}});
 const r=await prepareOwnedApplicationSchema(s.args());assert.equal(r.status,'PASS');assert.equal(r.engine.host,'127.0.0.1');assert.equal(r.engine.port,55432);assert.equal(r.engine.serverAddress,mapped.serverAddress);assert.equal(r.engine.serverPort,5432);assert.equal(s.log.filter(r=>ddl.includes(r.text)).length,6);
});
test('explicit25 unrelated schemas are retained through install and reconstruction',async()=>{
 const s=scripted({fixture:{schemaScope:scope},namespaces});const r=await prepareOwnedApplicationSchema(s.args());
 const v=await verifyOwnedApplicationSchema({...s.args(),fixture:{...s.f,schemaSha256:r.schemaSha256}});
 assert.equal(r.status,'PASS');assert.equal(v.schemaSha256,r.schemaSha256);assert.equal(r.preservation.namespaceCount,25);assert.equal(r.preservation.metadataSha256,v.preservation.metadataSha256);assert.equal(s.log.filter(r=>ddl.includes(r.text)).length,6);assert.equal(s.state.ended,0);
});
const refuse=(s,stage)=>assert.rejects(prepareOwnedApplicationSchema(s.args()),e=>e.outcome==='NOT_INSTALLED'&&(!stage||e.stage===stage));
for(const key of ['host','port'])test(`dial ${key} mismatch refuses before allocation`,async()=>{
 const s=scripted({fixture:mapped});s.pool.options[key]=key==='host'?'172.17.0.2':5432;await refuse(s,'admission');assert.equal(s.log.length,0);
});
for(const [key,value]of [['address','127.0.0.1'],['port',55432],['system_identifier','999'],['fsync','off']])test(`mapped server ${key} mismatch preserves engine gates`,async()=>{
 const s=scripted({fixture:mapped,identity:{[key]:value}});await refuse(s,'identity');assert.equal(s.log.filter(r=>ddl.includes(r.text)).length,0);
});
for(const fields of [{serverAddress:'172.17.0.2'},{serverPort:5432},{serverAddress:'db.local',serverPort:5432},{serverAddress:'::1%lo',serverPort:5432},{serverAddress:'172.17.0.2',serverPort:0}])test(`invalid paired server shape ${JSON.stringify(fields)}`,async()=>{const s=scripted({fixture:fields});await refuse(s,'admission');assert.equal(s.log.length,0);});
for(const change of [ns=>ns.slice(1),ns=>[...ns,{name:'extra_evidence',owner:'qualification_owner'}],ns=>ns.map((n,i)=>i? n:{...n,owner:'other'}),ns=>[...ns,{name:'meri_qualification',owner:'qualification_owner'}]])test('declared evidence namespace set/owner/target mismatch refuses before DDL',async()=>{
 const s=scripted({fixture:{schemaScope:scope},namespaces:change(namespaces)});await refuse(s,'ownership');assert.equal(s.log.filter(r=>ddl.includes(r.text)).length,0);
});
for(const ns of [[...namespaces,namespaces[0]],[{name:'public',owner:'qualification_owner'}],[{name:'meri_commands',owner:'qualification_owner'}],[{name:'pg_evidence',owner:'qualification_owner'}],[{name:'evidence',owner:'wrong owner'}],[]])test('closed scope refuses duplicates reserved names and invalid owners',async()=>{
 const s=scripted({fixture:{schemaScope:{...scope,namespaces:ns}}});await refuse(s,'admission');assert.equal(s.log.length,0);
});
test('legacy strict mode still refuses unrelated declared-looking namespaces',async()=>{const s=scripted({namespaces});await refuse(s,'ownership');assert.equal(s.log.filter(r=>ddl.includes(r.text)).length,0);});
test('scoped mode does not permit unrelated public relations or target collisions',async()=>{const s=scripted({fixture:{schemaScope:scope},namespaces,preexisting:[{name:'public.evidence'}]});await refuse(s,'ownership');assert.equal(s.log.filter(r=>ddl.includes(r.text)).length,0);});
test('unsupported evidence class refuses before migration',async()=>{const s=scripted({fixture:{schemaScope:scope},namespaces,unsupported:1});await refuse(s,'preservation');assert.equal(s.log.filter(r=>ddl.includes(r.text)).length,0);});
const metadata=()=>Object.fromEntries(['relations','columns','defaults','constraints','indexes','views','types','sequences','triggers','dependencies','comments','labels'].map(k=>[k,namespaces.map((n,i)=>({oid:i+1,name:n.name,metadataKind:k,owner:'qualification_owner',acl:null}))]));
test('populated25 schema metadata is exact across install/reconstruction without row reads',async()=>{
 const preservedMetadata=metadata(),before=structuredClone(preservedMetadata),s=scripted({fixture:{schemaScope:scope},namespaces,preservedMetadata});const r=await prepareOwnedApplicationSchema(s.args());
 await verifyOwnedApplicationSchema({...s.args(),fixture:{...s.f,schemaSha256:r.schemaSha256}});assert.deepEqual(preservedMetadata,before);assert.match(r.preservation.metadataSha256,/^[0-9a-f]{64}$/);
 const sql=s.log.find(q=>q.text.startsWith('WITH ns AS'));assert.deepEqual(sql.values,[namespaces.map(n=>n.name)]);assert.doesNotMatch(sql.text,/last_value|prosrc|pg_get_functiondef/);assert.match(sql.text,/pg_catalog\.pg_sequence/);
});
for(const field of ['relations','columns','defaults','constraints','indexes','views','types','sequences','dependencies','comments','labels'])test(`changed preserved ${field} metadata refuses reconstruction`,async()=>{
 const preservedMetadata=metadata(),s=scripted({fixture:{schemaScope:scope},namespaces,preservedMetadata}),r=await prepareOwnedApplicationSchema(s.args());preservedMetadata[field][0].changed=true;
 await assert.rejects(verifyOwnedApplicationSchema({...s.args(),fixture:{...s.f,schemaSha256:r.schemaSha256}}),e=>e.outcome==='READ_UNAVAILABLE');assert.equal(s.log.filter(r=>ddl.includes(r.text)).length,6);
});
test('metadata changing during migration yields UNKNOWN before COMMIT',async()=>{
 const preservedMetadata=metadata(),s=scripted({fixture:{schemaScope:scope},namespaces,preservedMetadata,before(text){if(text===ddl[5])preservedMetadata.sequences[0].increment=2;}});
 await assert.rejects(prepareOwnedApplicationSchema(s.args()),e=>e.outcome==='UNKNOWN');assert.equal(s.state.commits,0);assert.equal(s.log.filter(r=>ddl.includes(r.text)).length,6);
});
test('mapped schema digest cannot be reused for changed mapped identity even when engine echoes it',async()=>{
 const s=scripted({fixture:mapped}),r=await prepareOwnedApplicationSchema(s.args());s.f.serverPort=5433;
 await assert.rejects(verifyOwnedApplicationSchema({...s.args(),fixture:{...s.f,schemaSha256:r.schemaSha256}}),e=>e.outcome==='READ_UNAVAILABLE');
});
test('pre-existing meri_commands target namespace refuses before any DDL; command tables are created only there',async()=>{
 const s=scripted({fixture:{schemaScope:scope},namespaces:[...namespaces,{name:'meri_commands',owner:'qualification_owner'}]});await refuse(s,'ownership');assert.equal(s.log.filter(r=>ddl.includes(r.text)).length,0);
 for(const sql of ddl.slice(-2)){assert.ok(sql.includes('CREATE SCHEMA IF NOT EXISTS meri_commands;'));assert.doesNotMatch(sql,/CREATE TABLE (?!meri_commands\.)/u);assert.doesNotMatch(sql,/\bpublic\./u);}
});
test('target namespace ownership is checked after install',async()=>{
 const s=scripted(),connect=s.pool.connect.bind(s.pool);s.pool.connect=async()=>{const c=await connect(),query=c.query.bind(c);c.query=async cfg=>{const r=await query(cfg);if(cfg.text.startsWith('SELECT nspname')&&s.state.installed)r.rows[0].owner='other';return r;};return c;};
 await assert.rejects(prepareOwnedApplicationSchema(s.args()),e=>e.outcome==='UNKNOWN');assert.equal(s.state.commits,0);
});
for(const key of ['database','user'])test(`dial ${key} must match trusted fixture`,async()=>{const s=scripted();s.pool.options[key]='other';await refuse(s,'admission');assert.equal(s.log.length,0);});
test('sequence bigint settings are transported losslessly as text, never JS numbers',async()=>{
 const preservedMetadata=metadata();preservedMetadata.sequences=[{seqstart:'9007199254740992',seqincrement:'1',seqmax:'9223372036854775807',seqmin:'1',seqcache:'1'}];
 const s=scripted({fixture:{schemaScope:scope},namespaces,preservedMetadata}),r=await prepareOwnedApplicationSchema(s.args());
 const sql=s.log.find(q=>q.text.startsWith('WITH ns AS')).text;
 for(const field of ['seqstart','seqincrement','seqmax','seqmin','seqcache'])assert.match(sql,new RegExp(`s\\.${field}::pg_catalog\\.text`));
 preservedMetadata.sequences[0].seqstart='9007199254740993';await assert.rejects(verifyOwnedApplicationSchema({...s.args(),fixture:{...s.f,schemaSha256:r.schemaSha256}}),e=>e.outcome==='READ_UNAVAILABLE');
});
test('empty evidence schema identity includes namespace OID to detect replacement',async()=>{
 const allowed=[{name:'empty_evidence',owner:'qualification_owner'}],observed=[{...allowed[0],oid:'30100',acl:null}],s=scripted({fixture:{schemaScope:{mode:'preserve-declared-evidence',namespaces:allowed}},namespaces:observed});
 const r=await prepareOwnedApplicationSchema(s.args()),sql=s.log.find(q=>q.text.startsWith('SELECT nspname')).text;
 assert.match(sql,/\boid::pg_catalog\.text AS oid\b/);observed[0].oid='30101';
 await assert.rejects(verifyOwnedApplicationSchema({...s.args(),fixture:{...s.f,schemaSha256:r.schemaSha256}}),e=>e.outcome==='READ_UNAVAILABLE');
});
test('catalog identity literals cannot resolve through implicit temporary schemas',async()=>{
 const s=scripted({fixture:{schemaScope:scope},namespaces});await prepareOwnedApplicationSchema(s.args());
 const sql=s.log.find(q=>q.text.startsWith('WITH ns AS')).text;
 const literals=[...sql.matchAll(/'([^']+)'::pg_catalog\.regclass/g)].map(m=>m[1]);
 assert(literals.length>=12);for(const name of literals)assert.match(name,/^pg_catalog\.pg_[a-z_]+$/);
 for(const name of ['pg_class','pg_type','pg_constraint','pg_attrdef','pg_rewrite','pg_trigger','pg_namespace'])assert(literals.includes(`pg_catalog.${name}`));
});
test('catalog snapshot builtin cast types cannot resolve through temporary schemas',async()=>{
 const s=scripted({fixture:{schemaScope:scope},namespaces});await prepareOwnedApplicationSchema(s.args());
 const queries=s.log.filter(q=>q.text.startsWith('WITH ns AS')||q.text.startsWith('SELECT nspname'));
 const types=queries.flatMap(q=>[...q.text.matchAll(/::([a-z_][a-z0-9_.]*(?:\[\])?)/g)].map(m=>m[1]));
 assert(types.length>20);for(const name of types)assert.match(name,/^pg_catalog\.(?:regclass|oid|text(?:\[\])?|int4|jsonb)$/);
});
