import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareOwnedApplicationSchema as prepare,verifyOwnedApplicationSchema as verify} from '../schema.mjs';
import {fixtureDescriptor} from '../schema-contract.mjs';
import {namespaceSQL,preservationSQL} from '../schema-preservation.mjs';
import {scripted,ddl,fixture as originalFixture} from '../schema-independent/fixture.mjs';
const clone=structuredClone,hash=s=>createHash('sha256').update(s).digest('hex');
const declared=()=>Array.from({length:25},(_,i)=>({name:`evidence_${String(i).padStart(2,'0')}`,owner:'qualification_owner'}));
const metadata=()=>Object.fromEntries(['relations','columns','defaults','constraints','indexes','views','types','sequences','triggers','dependencies','comments','labels'].map(k=>[k,[]]));
const denied=(outcome,stage)=>e=>{assert.equal(e.code,'QUALIFICATION_SCHEMA_REFUSED');assert.equal(e.outcome,outcome);if(stage)assert.equal(e.stage,stage);return true;};
function setup({mapped=true,scoped=true,verifyMode=false,changeNamespaces,changeMetadata,unsupported=0,identityChange,onQuery}={}){
 const scope={mode:'preserve-declared-evidence',namespaces:declared()};let namespaceReads=0,metadataReads=0;
 const observed=scope.namespaces.map((n,i)=>({...n,acl:null,oid:String(18000+i)}));
 const body=metadata();const h=scripted({verify:verifyMode,identityChange:r=>{if(mapped){r.address='172.17.0.2';r.port=5432;}identityChange?.(r);},onQuery:async(q,state)=>{
  const overridden=await onQuery?.(q,state);if(overridden!==undefined)return overridden;
  if(q.text===namespaceSQL){
   namespaceReads++;const rows=scoped?clone(observed):[];const installed=verifyMode||ddl.every(d=>state.queries.some(x=>x.text===d));
   if(installed)rows.push(...['meri_qualification','meri_task_lookup','meri_commands'].map((name,i)=>({name,owner:'qualification_owner',acl:null,oid:String(19000+i)})));
   changeNamespaces?.(rows,namespaceReads);
   // Narrow scripted SELECT projection. This deliberately does not fabricate an
   // OID observation when the actual production query does not request one.
   if(!/\boid\s*::\s*pg_catalog\.text\s+AS\s+oid\b/i.test(q.text))for(const r of rows)delete r.oid;
   return{rows};
  }
  if(q.text===preservationSQL){metadataReads++;assert.deepEqual(q.values,[scope.namespaces.map(n=>n.name)]);const value=clone(body);changeMetadata?.(value,metadataReads);return{rows:[{unsupported,metadata:value}]};}
 }});
 if(mapped)Object.assign(h.args.fixture,{serverAddress:'172.17.0.2',serverPort:5432});if(scoped)h.args.fixture.schemaScope=scope;
 return Object.assign(h,{scope,observed,body,counts:()=>({namespaceReads,metadataReads})});
}
const queries=h=>h.state.queries.map(x=>x.text),noDDL=h=>assert.equal(queries(h).filter(t=>ddl.includes(t)).length,0);

test('explicit mapped dial/server identity and25 declared schemas succeed without altering preserved data',async()=>{
 const h=setup(),before=clone({observed:h.observed,body:h.body});const r=await prepare(h.args);
 assert.deepEqual(h.state.ddl,ddl);assert.equal(r.engine.host,'127.0.0.1');assert.equal(r.engine.port,55432);assert.equal(r.engine.serverAddress,'172.17.0.2');assert.equal(r.engine.serverPort,5432);assert.equal(r.preservation.namespaceCount,25);assert.equal(r.preservation.coverage,'declared-namespace-catalog-metadata/1');assert.match(r.preservation.metadataSha256,/^[a-f0-9]{64}$/);
 assert.deepEqual({observed:h.observed,body:h.body},before);assert.equal(h.state.ends,0);assert.deepEqual(h.state.releases,[undefined]);assert.equal(r.runtimeQualified,false);assert.equal(h.counts().metadataReads,2);assert(queries(h).filter(q=>/^WITH ns/.test(q)).every(q=>!q.includes('SELECT * FROM evidence_')));
});
test('legacy strict descriptor preserves original signature algorithm',async()=>{const h=setup({mapped:false,scoped:false});const r=await prepare(h.args);assert.equal(r.schemaSha256,hash(JSON.stringify({migrationSha256:r.migrationSha256,catalog:r.catalog})));assert(!Object.hasOwn(r,'preservation'));assert(!Object.hasOwn(r.engine,'serverAddress'));});
test('reconstruction binds mapping scope and retained fingerprint without DDL',async()=>{const r=await prepare(setup().args);const h=setup({verifyMode:true});h.args.fixture.schemaSha256=r.schemaSha256;const after=await verify(h.args);assert.equal(after.schemaSha256,r.schemaSha256);assert.equal(after.initialStateVerified,false);noDDL(h);});
for(const [field,value]of Object.entries({address:'192.0.2.55',port:5433,version:'170000',start_ms:'0',system_identifier:'999',database:'other',username:'postgres',fsync:'off',synchronous_commit:'off'}))test(`mapped identity retains ${field} refusal`,async()=>{const h=setup({identityChange:r=>r[field]=value});await assert.rejects(prepare(h.args),denied('NOT_INSTALLED','identity'));noDDL(h);});
for(const [field,value]of Object.entries({host:'172.17.0.2',port:5432,database:'other',user:'other'}))test(`dial pool ${field} substitution refuses before connection`,async()=>{const h=setup();h.pool.options[field]=value;await assert.rejects(prepare(h.args),denied('NOT_INSTALLED','admission'));assert.equal(h.state.connects,0);});
for(const [name,edit]of Object.entries({unpairedAddress:f=>delete f.serverPort,unpairedPort:f=>delete f.serverAddress,hostName:f=>f.serverAddress='postgres.local',scopedIPv6:f=>f.serverAddress='fe80::1%eth0',booleanPort:f=>f.serverPort=true,zeroPort:f=>f.serverPort=0,nullScope:f=>f.schemaScope=null,wrongMode:f=>f.schemaScope.mode='ignore-evidence',emptyScope:f=>f.schemaScope.namespaces=[],overLimit:f=>f.schemaScope.namespaces=Array.from({length:129},(_,i)=>({name:'n_'+i,owner:'qualification_owner'})),duplicate:f=>f.schemaScope.namespaces.push(f.schemaScope.namespaces[0]),public:f=>f.schemaScope.namespaces[0].name='public',target:f=>f.schemaScope.namespaces[0].name='meri_qualification',commandsTarget:f=>f.schemaScope.namespaces[0].name='meri_commands',system:f=>f.schemaScope.namespaces[0].name='pg_temp',unknownLeaf:f=>f.schemaScope.namespaces[0].grant=true,unknownFixture:f=>f.grant=true}))test(`closed compatibility admission: ${name}`,async()=>{const h=setup();edit(h.args.fixture);await assert.rejects(prepare(h.args),denied('NOT_INSTALLED','admission'));assert.equal(h.state.connects,0);});
for(const [name,change]of Object.entries({missing:r=>r.pop(),undeclared:r=>r.push({name:'not_declared',owner:'qualification_owner',acl:null,oid:'9999'}),wrongOwner:r=>r[0].owner='different_owner',targetCollision:r=>r.push({name:'meri_qualification',owner:'qualification_owner',acl:null,oid:'9999'}),duplicate:r=>r[1]=r[0]}))test(`namespace ${name} refuses before DDL`,async()=>{const h=setup({changeNamespaces:(r,n)=>{if(n===1)change(r);}});await assert.rejects(prepare(h.args),denied('NOT_INSTALLED','ownership'));noDDL(h);});
test('legacy mode still refuses25 undeclared schemas',async()=>{const h=setup({scoped:false,changeNamespaces:r=>r.push(...declared().map(n=>({...n,acl:null,oid:'9000'})))});await assert.rejects(prepare(h.args),denied('NOT_INSTALLED','ownership'));noDDL(h);});
test('pre-existing meri_commands target namespace refuses before any migration',async()=>{const h=setup({changeNamespaces:(r,n)=>{if(n===1)r.push({name:'meri_commands',owner:'qualification_owner',acl:null,oid:'9999'});}});await assert.rejects(prepare(h.args),denied('NOT_INSTALLED','ownership'));noDDL(h);});
test('unsupported evidence catalog classes fail closed before DDL',async()=>{const h=setup({unsupported:1});await assert.rejects(prepare(h.args),denied('NOT_INSTALLED','preservation'));noDDL(h);});
for(const field of ['relations','columns','defaults','constraints','indexes','views','types','sequences','triggers','dependencies','comments','labels'])test(`changed preserved ${field} prevents success after DDL`,async()=>{const h=setup({changeMetadata:(m,n)=>{if(n===2)m[field].push({changed:'value'});}});await assert.rejects(prepare(h.args),denied('UNKNOWN'));assert.deepEqual(h.state.ddl,ddl);assert(queries(h).includes('ROLLBACK'));assert(!queries(h).includes('COMMIT'));});
test('namespace ACL mutation is detected after DDL',async()=>{const h=setup({changeNamespaces:(r,n)=>{if(n>=2)r[0].acl='{changed}';}});await assert.rejects(prepare(h.args),denied('UNKNOWN'));});
test('empty namespace recreation changes exact preserved identity',async()=>{const h=setup({changeNamespaces:(r,n)=>{if(n>=2)r[0].oid='99999';}});await assert.rejects(prepare(h.args),denied('UNKNOWN'));});
test('actual namespace query projects namespace OID losslessly',()=>{assert.match(namespaceSQL,/\boid\s*::\s*pg_catalog\.text\s+AS\s+oid\b/i);});
test('actual sequence catalog query preserves all bigint settings as text',()=>{for(const name of ['seqstart','seqincrement','seqmax','seqmin','seqcache'])assert.match(preservationSQL,new RegExp("'"+name+"'\\s*,\\s*s\\."+name+'::pg_catalog\\.text'));});
test('actual catalog query covers supported metadata and refuses unsupported owners',()=>{
 for(const c of ['pg_attribute','pg_attrdef','pg_constraint','pg_index','pg_rewrite','pg_type','pg_sequence','pg_trigger','pg_depend','pg_description','pg_seclabel'])assert(preservationSQL.includes('pg_catalog.'+c),c);
 for(const c of ['pg_proc','pg_extension','pg_policy','pg_inherits'])assert(preservationSQL.includes('pg_catalog.'+c),c);
 assert(preservationSQL.includes("relkind NOT IN ('r','v','i','S')"));assert(preservationSQL.includes('relispartition'));assert(preservationSQL.includes("d.deptype='e'"));assert(preservationSQL.includes('NOT tgisinternal'));assert(preservationSQL.includes("w.rulename<>'_RETURN'"));assert(!/\blast_value\b|\bprosrc\b/.test(preservationSQL));assert(preservationSQL.includes('nspname=ANY($1::pg_catalog.text[])'));
});
test('scope snapshot deadline expiry prevents subsequent DDL and retains borrowed ownership',async()=>{let h;h=setup({onQuery:({text})=>{if(text===preservationSQL)h.setNow(h.deadlineMs);}});await assert.rejects(prepare(h.args),denied('NOT_INSTALLED'));noDDL(h);assert.equal(h.state.ends,0);await new Promise(setImmediate);assert.equal(h.state.releases.length,1);});
test('unknown COMMIT remains unknown with compatibility enabled and no retry',async()=>{const h=setup({onQuery:({text})=>{if(text==='COMMIT')throw Error('secret canary');}});await assert.rejects(prepare(h.args),denied('UNKNOWN'));assert.equal(h.state.connects,1);assert(!queries(h).includes('ROLLBACK'));assert(h.state.releases[0] instanceof Error);});
test('new server/scope facts survive detached fixture normalization',()=>{const h=setup();h.args.fixture.schemaSha256='a'.repeat(64);const f=fixtureDescriptor(h.args.fixture);assert.deepEqual(f,h.args.fixture);assert(Object.isFrozen(f.schemaScope.namespaces[0]));h.args.fixture.schemaScope.namespaces[0].owner='changed';assert.equal(f.schemaScope.namespaces[0].owner,'qualification_owner');});
for (const value of [undefined,null,0,'0','-1','1.0','4294967296']) test(`preserved namespace OID refuses invalid ${String(value)}`,async()=>{const h=setup({changeNamespaces:r=>r[0].oid=value});await assert.rejects(prepare(h.args),denied('NOT_INSTALLED','ownership'));noDDL(h);});
test('distinct int64 sequence settings retain distinct fingerprints',async()=>{const one=setup({changeMetadata:m=>m.sequences.push({seqrelid:42,seqstart:'9007199254740992'})}),two=setup({changeMetadata:m=>m.sequences.push({seqrelid:42,seqstart:'9007199254740993'})});const a=await prepare(one.args),b=await prepare(two.args);assert.notEqual(a.preservation.metadataSha256,b.preservation.metadataSha256);assert.notEqual(a.schemaSha256,b.schemaSha256);});
test('reconstruction refuses changed preserved OID against trusted original signature',async()=>{const a=await prepare(setup().args),h=setup({verifyMode:true,changeNamespaces:r=>r[0].oid='99999'});h.args.fixture.schemaSha256=a.schemaSha256;await assert.rejects(verify(h.args),denied('READ_UNAVAILABLE'));noDDL(h);});
test('reconstruction cannot substitute a newly matching server mapping under old hash',async()=>{const a=await prepare(setup().args),h=setup({verifyMode:true,identityChange:r=>r.address='192.0.2.3'});h.args.fixture.serverAddress='192.0.2.3';h.args.fixture.schemaSha256=a.schemaSha256;await assert.rejects(verify(h.args),denied('READ_UNAVAILABLE'));noDDL(h);});
test('catalog relation identities remain fixed despite implicit pg_temp search precedence',()=>{const refs=[...preservationSQL.matchAll(/'([^']+)'::pg_catalog\.regclass/g)].map(m=>m[1]);assert.equal(refs.length,12);for(const name of refs)assert.match(name,/^pg_catalog\.pg_[a-z_]+$/);});

test('catalog metadata builtin cast types are independent of pg_temp',()=>{const casts=[...(namespaceSQL+' '+preservationSQL).matchAll(/::([A-Za-z0-9_.]+(?:\[\])?)/g)].map(m=>m[1]);assert(casts.length>20);for(const type of casts)assert.match(type,/^pg_catalog\.(?:regclass|oid|text(?:\[\])?|int4|jsonb)$/);});
