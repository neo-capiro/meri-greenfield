import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareOwnedApplicationSchema,verifyOwnedApplicationSchema} from './schema.mjs';
import {createScriptedSchemaFixture as scripted,fixtureSchemaDescriptor as fixture,fixtureMigrationBytes as ddl} from './schema.fixture.mjs';

const ddls=s=>s.log.filter(r=>ddl.includes(r.text));
const rejects=async(work,outcome,stage)=>assert.rejects(work,e=>e.code==='QUALIFICATION_SCHEMA_REFUSED'&&e.outcome===outcome&&(!stage||e.stage===stage)&&!JSON.stringify(e).includes('PASSWORD'));

test('installs exactly the six unchanged files, then verifies13 relations and empty accounting',async()=>{
 const s=scripted(),r=await prepareOwnedApplicationSchema(s.args());assert.equal(r.status,'PASS');assert.equal(r.operation,'installed');assert.equal(r.relationCount,13);assert.equal(r.initialStateVerified,true);assert.match(r.schemaSha256,/^[a-f0-9]{64}$/);assert.deepEqual(Object.keys(r.migrationSha256),['qualification','budget','invocation','lookup','metadata','command']);assert.deepEqual(ddls(s).map(r=>r.text),ddl);assert(s.log.findIndex(r=>r.text.startsWith('SELECT current_database'))<s.log.findIndex(r=>ddl.includes(r.text)));assert(s.log.some(r=>r.text==='SET LOCAL search_path TO public'));assert.equal(s.state.commits,1);assert.equal(s.releases.length,1);assert.equal(s.state.ended,0);assert(Object.isFrozen(r.catalog[0].columns));
});
test('reconstruction permits retained accounting but binds original complete catalog hash',async()=>{
 const s=scripted(),initial=await prepareOwnedApplicationSchema(s.args());s.state.budget.consumed_micro_usd='20';s.state.budget.quarantined=true;
 const before=ddls(s).length,r=await verifyOwnedApplicationSchema({...s.args(),fixture:{...s.f,schemaSha256:initial.schemaSha256}});assert.equal(r.operation,'verified');assert.equal(r.initialStateVerified,false);assert.equal(r.budget.consumed_micro_usd,'20');assert.equal(r.budget.quarantined,true);assert.equal(ddls(s).length,before);assert.equal(r.schemaSha256,initial.schemaSha256);
});
for(const [field,value]of Object.entries({database:'other',username:'postgres',address:'::1',port:55433,version:'170010',start_ms:'0',system_identifier:'different',fsync:'off',synchronous_commit:'off',search_path:'private, public'}))test(`identity ${field} mismatch refuses before DDL`,async()=>{const s=scripted({identity:{[field]:value}});await rejects(prepareOwnedApplicationSchema(s.args()),'NOT_INSTALLED','identity');assert.equal(ddls(s).length,0);assert.equal(s.releases.length,1);});
test('closed descriptor, accessors, proxy and expired/cancelled inputs allocate no client',async()=>{
 const s=scripted();for(const change of [{fixture:{...s.f,extra:true}},{fixture:new Proxy(s.f,{})},{deadlineMs:Date.now()-1},{deadlineMs:Date.now()+120000},{signal:AbortSignal.abort()}])await rejects(prepareOwnedApplicationSchema({...s.args(),...change}),'NOT_INSTALLED','admission');let getters=0;const f={...s.f};Object.defineProperty(f,'host',{get(){getters++;return '127.0.0.1';},enumerable:true});await rejects(prepareOwnedApplicationSchema({...s.args(),fixture:f}),'NOT_INSTALLED');assert.equal(getters,0);assert.equal(s.log.length,0);
});
test('install refuses partial namespaces, preexisting relation and same fixture reapply',async()=>{
 for(const opts of [{namespaces:[{name:'meri_qualification'}]},{preexisting:[{name:'public.other'}]}]){const s=scripted(opts);await rejects(prepareOwnedApplicationSchema(s.args()),'NOT_INSTALLED','ownership');assert.equal(ddls(s).length,0);}
 const s=scripted();await prepareOwnedApplicationSchema(s.args());await rejects(prepareOwnedApplicationSchema(s.args()),'NOT_INSTALLED','ownership');assert.equal(ddls(s).length,6);
});
test('concurrent installers cannot both acquire fixed transaction lock',async()=>{
 let unlock;const barrier=new Promise(r=>unlock=r);let arrived;const entered=new Promise(r=>arrived=r);
 const s=scripted({before:async text=>{if(text===ddl[0]){arrived();await barrier;}}});const first=prepareOwnedApplicationSchema(s.args());await entered;await rejects(prepareOwnedApplicationSchema(s.args()),'NOT_INSTALLED','ownership');unlock();assert.equal((await first).status,'PASS');assert.equal(ddls(s).length,6);
});
for(const [name,change]of Object.entries({missing:r=>r.pop(),nullable:r=>r[0].columns[0].notNull=false,type:r=>r[0].columns[0].type='text',constraint:r=>r[0].constraints.pop(),unvalidated:r=>r[0].constraints[0].validated=false,index:r=>r[0].indexes[0].valid=false,trigger:r=>r[0].triggers=1,owner:r=>r[0].owner='other',view:r=>r[8].view=null,rowSecurity:r=>r[0].rowSecurity=true}))test(`post-install ${name} corruption is UNKNOWN, never retry/success`,async()=>{const s=scripted();change(s.state.catalog);await rejects(prepareOwnedApplicationSchema(s.args()),'UNKNOWN','catalog');assert.equal(ddls(s).length,6);assert.equal(s.state.commits,0);assert.equal(s.releases.length,1);});
test('reconstruction catches changed check definition even when type/counts remain',async()=>{const s=scripted(),r=await prepareOwnedApplicationSchema(s.args());s.state.catalog[0].constraints[0].definition='changed semantically';await rejects(verifyOwnedApplicationSchema({...s.args(),fixture:{...s.f,schemaSha256:r.schemaSha256}}),'READ_UNAVAILABLE','catalog');assert.equal(ddls(s).length,6);});
test('fresh install requires exact empty application rows and zero unquarantined accounting',async()=>{for(const dirty of ['rows','consumed','quarantine']){const s=scripted({dirty:dirty==='rows'});if(dirty==='consumed')s.state.budget.consumed_micro_usd='1';if(dirty==='quarantine')s.state.budget.quarantined=true;await rejects(prepareOwnedApplicationSchema(s.args()),'UNKNOWN','accounting');}});
test('migration, commit and release errors preserve UNKNOWN and no retry',async()=>{
 for(const opts of [{fail:ddl[2]},{loseCommit:true},{releaseFails:true}]){const s=scripted(opts);await rejects(prepareOwnedApplicationSchema(s.args()),'UNKNOWN');assert.equal(ddls(s).filter(r=>r.text===ddl[0]).length,1);assert.equal(s.state.ended,0);assert.equal(s.releases.length,1);}
});
test('unknown errors are not reflected or evaluated',async()=>{let getter=0;const s=scripted({before(text){if(text===ddl[0])throw Object.defineProperty({},'message',{get(){getter++;throw Error('PASSWORD-CANARY');}});}});await rejects(prepareOwnedApplicationSchema(s.args()),'UNKNOWN','migration');assert.equal(getter,0);});
test('owner query timeout6000 is admitted and shorter bound is preserved for every query',async()=>{const s=scripted();s.pool.options.query_timeout=97;await prepareOwnedApplicationSchema(s.args());assert(s.log.every(r=>r.query_timeout<=97&&r.query_timeout>0));for(const query_timeout of [0,6001,Infinity]){const bad=scripted();bad.pool.options.query_timeout=query_timeout;await rejects(prepareOwnedApplicationSchema(bad.args()),'NOT_INSTALLED','admission');assert.equal(bad.log.length,0);}});
test('late acquisition is released with no BEGIN or DDL after original deadline',async()=>{
 let resolve,entered;const gate=new Promise(r=>resolve=r),started=new Promise(r=>entered=r);const s=scripted({connect:()=>{entered();return gate;}}),pending=prepareOwnedApplicationSchema({...s.args(),deadlineMs:Date.now()+50});await started;await rejects(pending,'NOT_INSTALLED');resolve();await new Promise(r=>setTimeout(r,10));assert.equal(s.log.length,0);assert.equal(s.releases.length,1);assert.equal(s.state.ended,0);
});
test('cancelled parked migration remains UNKNOWN, then rolls back and releases without another DDL',async()=>{
 let release,enter;const gate=new Promise(r=>release=r),entered=new Promise(r=>enter=r),controller=new AbortController();const s=scripted({before:async text=>{if(text===ddl[0]){enter();await gate;}}});const pending=prepareOwnedApplicationSchema({...s.args(),signal:controller.signal});await entered;controller.abort();await rejects(pending,'UNKNOWN','migration');release();await new Promise(r=>setTimeout(r,10));assert.equal(ddls(s).length,1);assert(s.log.some(r=>r.text==='ROLLBACK'));assert.equal(s.releases.length,1);assert.equal(s.state.commits,0);
});
test('absolute clock advancement after identity prevents migration despite responsive ports',async()=>{
 let now=Date.now();const s=scripted({before(text){if(text.startsWith('SELECT current_database'))now+=1000;}});await rejects(prepareOwnedApplicationSchema({...s.args(),now:()=>now,deadlineMs:now+500}),'NOT_INSTALLED','identity');assert.equal(ddls(s).length,0);
});
test('receipt binds original cutoff and reports port observation without native qualification',async()=>{const s=scripted(),args=s.args(),r=await prepareOwnedApplicationSchema(args);assert.equal(r.originalDeadlineMs,args.deadlineMs);assert.equal(r.evidenceKind,'borrowed-pool-catalog-observation');assert.equal(r.runtimeQualified,false);assert.equal(r.poolClosed,false);});
test('namespace query excludes only literal pg_ prefix and refuses user pgx_private',async()=>{
 const s=scripted({namespaces:[{name:'pgx_private'}]});await rejects(prepareOwnedApplicationSchema(s.args()),'NOT_INSTALLED','ownership');assert.equal(ddls(s).length,0);
 const query=s.log.find(r=>r.text.startsWith('SELECT nspname')).text;
 assert.doesNotMatch(query,/NOT\s+LIKE\s+'pg_%'/i);
 assert.match(query,/left\(nspname,3\)\s*<>\s*'pg_'/i);
});
test('reusable scripted fixture binds configured target identity without allocating a database',async()=>{
 const descriptor=fixture({port:55433,serverVersion:'170010',systemIdentifier:'8888888888888888888'}),s=scripted({fixture:descriptor});
 const r=await prepareOwnedApplicationSchema(s.args());assert.equal(r.engine.port,descriptor.port);assert.equal(r.engine.serverVersion,descriptor.serverVersion);assert.equal(r.engine.systemIdentifier,descriptor.systemIdentifier);assert.equal(s.state.ended,0);
});
