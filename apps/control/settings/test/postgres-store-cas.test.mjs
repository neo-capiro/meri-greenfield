/** SYNTHETIC pg-compatible SQL/transaction scripts, not PostgreSQL concurrency or migration evidence.
 * The real store and transaction owner run; scripts provide database RETURNING rows and commit/rollback acknowledgements. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPostgresSettingsStore} from '../postgres-store.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {productFailure} from '../../product-access/errors.mjs';
import {createSettingsPoolFixture as scriptedPool} from './postgres-store-fixture.mjs';
import {createUserPreferencesService} from '../user-service.mjs';
import {USER_PREFERENCE_DEFAULTS} from '../documents.mjs';

const hash=canonicalSha256;
const failure=code=>error=>productFailure(error)?.code===code;
const gate=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const row=(revision,document)=>({revision:String(revision),document,document_sha256:hash(document)});
const table=kind=>`meri_settings.${kind==='user'?'user_preferences':'tenant_settings'}`;
const escaped=kind=>table(kind).replace('.','\\.');
const insert=kind=>new RegExp(`^INSERT INTO ${escaped(kind)}\\(.* ON CONFLICT \\(${kind==='user'?'tenant_id,actor_id':'tenant_id'}\\) DO NOTHING RETURNING revision,document,document_sha256$`,'u');
const locked=kind=>new RegExp(`^SELECT revision,document,document_sha256 FROM ${escaped(kind)} WHERE .* FOR UPDATE$`,'u');
const update=kind=>new RegExp(`^UPDATE ${escaped(kind)} SET .* WHERE .* AND revision=\\$${kind==='user'?7:6} RETURNING revision,document,document_sha256$`,'u');
const auditSql=/^INSERT INTO meri_settings\.settings_audit\(/u;
function input(kind,{revision=0,document={theme:'dark'},signal}={}){
 return {kind,tenantId:'tenant-synthetic',...(kind==='user'?{actorId:'subject-synthetic'}:{}),expectedRevision:revision,document,signal,
  audit:{auditId:'00000000-0000-4000-8000-000000000001',actorId:'writer-synthetic',platformSha256:kind==='tenant'?'f'.repeat(64):null,changedFields:['theme']}};
}
for(const kind of ['user','tenant'])test(`${kind}: concurrent initial writers use the PK insert result; the loser writes no audit`,{timeout:2000},async()=>{
 const winnerEntered=gate(),loserEntered=gate(),releaseWinner=gate(),winnerCommitted=gate(),value={theme:'dark'};
 const p=scriptedPool([
  {steps:[{match:insert(kind),rows:[row(1,value)],async run(){winnerEntered.resolve();await releaseWinner.promise;}},
   {match:auditSql,inspect(params){assert.deepEqual(params.slice(1),['tenant-synthetic',kind,kind==='user'?'subject-synthetic':null,'writer-synthetic',0,1,null,hash(value),kind==='tenant'?'f'.repeat(64):null,['theme']]);}}],commit:()=>winnerCommitted.resolve()},
  {steps:[{match:insert(kind),rows:[],async run(){loserEntered.resolve();await winnerCommitted.promise;}}]},
 ]),store=createPostgresSettingsStore({pool:p.pool});
 const winner=store.save(input(kind));await winnerEntered.promise;
 const loser=store.save(input(kind,{document:{theme:'light'}}));const lost=assert.rejects(loser,failure('SETTINGS_REVISION_CONFLICT'));
 await loserEntered.promise;releaseWinner.resolve();
 assert.deepEqual(await winner,{revision:1,documentSha256:hash(value)});await lost;
 assert.deepEqual(p.committed.map(v=>v.kind),['document','audit']);assert.deepEqual(p.committed[0].row,row(1,value));
 assert.equal(p.calls.some(v=>v.id===1&&auditSql.test(v.sql)),false);assert.equal(p.calls.some(v=>v.id===1&&v.sql==='COMMIT'),false);
 assert.equal(p.calls.some(v=>v.id===1&&v.sql==='ROLLBACK'),true);assert.equal(p.calls.some(v=>v.sql.startsWith('SELECT')),false);
 assert.equal(p.released.length,2);assert.ok(p.released.every(v=>v.error===undefined));
 const params=p.calls.find(v=>v.id===0&&insert(kind).test(v.sql)).params;
 assert.deepEqual(params,kind==='user'?['tenant-synthetic','subject-synthetic',1,JSON.stringify(value),hash(value),'writer-synthetic']:['tenant-synthetic',1,JSON.stringify(value),hash(value),'writer-synthetic']);
});

for(const kind of ['user','tenant'])test(`${kind}: existing revision is locked and conditionally updated with an atomic audit`,async()=>{
 const before={theme:'light'},value={theme:'dark'},p=scriptedPool([{steps:[
  {match:locked(kind),rows:[row(1,before)],inspect(params){assert.deepEqual(params,kind==='user'?['tenant-synthetic','subject-synthetic']:['tenant-synthetic']);}},
  {match:update(kind),rows:[row(2,value)],inspect(params){assert.deepEqual(params.slice(kind==='user'?2:1),[2,JSON.stringify(value),hash(value),'writer-synthetic',1]);}},
  {match:auditSql,inspect(params){assert.deepEqual(params.slice(5,9),[1,2,hash(before),hash(value)]);}},
 ]}]),store=createPostgresSettingsStore({pool:p.pool});
 assert.deepEqual(await store.save(input(kind,{revision:1})),{revision:2,documentSha256:hash(value)});
 assert.deepEqual(p.committed.map(v=>v.kind),['document','audit']);assert.equal(p.released[0].error,undefined);
});

for(const [name,rows] of [['stale',[row(2,{theme:'light'})]],['missing',[]]])test(`existing ${name} revision refuses without mutation or audit`,async()=>{
 const p=scriptedPool([{steps:[{match:locked('user'),rows}]}]),store=createPostgresSettingsStore({pool:p.pool});
 await assert.rejects(store.save(input('user',{revision:1})),failure('SETTINGS_REVISION_CONFLICT'));
 assert.deepEqual(p.committed,[]);assert.equal(p.calls.some(v=>/^(?:INSERT|UPDATE)/u.test(v.sql)),false);assert.equal(p.calls.at(-1).sql,'ROLLBACK');
});

test('a conditional update that returns no row is a conflict and never creates an audit',async()=>{
 const p=scriptedPool([{steps:[{match:locked('user'),rows:[row(1,{theme:'light'})]},{match:update('user'),rows:[]}]}]);
 await assert.rejects(createPostgresSettingsStore({pool:p.pool}).save(input('user',{revision:1})),failure('SETTINGS_REVISION_CONFLICT'));
 assert.equal(p.calls.some(v=>auditSql.test(v.sql)),false);assert.deepEqual(p.committed,[]);
});

test('audit changed fields come from the locked revision; user saves never take an earlier unlocked snapshot',async()=>{
 const before={...USER_PREFERENCE_DEFAULTS,theme:'dark',density:'compact'},value={...before,density:'comfortable'};
 const p=scriptedPool([{steps:[
  {match:locked('user'),rows:[row(1,before)]},
  {match:update('user'),rows:[row(2,value)]},
  {match:auditSql,inspect(params){assert.equal(params[7],hash(before));assert.equal(params[8],hash(value));assert.deepEqual(params[10],['density']);}},
 ]}]);
 const service=createUserPreferencesService({store:createPostgresSettingsStore({pool:p.pool}),newId:()=> '00000000-0000-4000-8000-000000000001'});
 assert.deepEqual(await service.saveUser({principal:{tenantId:'tenant-synthetic',actorId:'subject-synthetic',clientIds:[]},body:{expectedRevision:1,preferences:value}}),{revision:2,preferences:value});
 assert.equal(p.calls.filter(v=>v.sql.startsWith('SELECT')).length,1);assert.ok(p.calls.find(v=>v.sql.startsWith('SELECT')).sql.endsWith('FOR UPDATE'));
 assert.deepEqual(p.committed.map(v=>v.kind),['document','audit']);
});

test('corrupt returned document acknowledgement rolls back before audit',async()=>{
 const corrupted=row(1,{theme:'dark'});corrupted.document_sha256='a'.repeat(64);
 const p=scriptedPool([{steps:[{match:insert('user'),rows:[corrupted]}]}]);
 await assert.rejects(createPostgresSettingsStore({pool:p.pool}).save(input('user')),failure('SETTINGS_STORE_STATE'));
 assert.equal(p.calls.some(v=>auditSql.test(v.sql)),false);assert.deepEqual(p.committed,[]);assert.equal(p.calls.at(-1).sql,'ROLLBACK');
});

test('audit failure rolls back the claimed document and does not expose driver text',async()=>{
 const p=scriptedPool([{steps:[{match:insert('user'),rows:[row(1,{theme:'dark'})]},{match:auditSql,error:true}]}]);
 await assert.rejects(createPostgresSettingsStore({pool:p.pool}).save(input('user')),error=>failure('SETTINGS_STORE_UNAVAILABLE')(error)&&!error.message.includes('private'));
 assert.deepEqual(p.committed,[]);assert.equal(p.calls.at(-1).sql,'ROLLBACK');assert.equal(p.released[0].error,undefined);
});

test('lost COMMIT acknowledgement preserves the possible document and audit, reports UNKNOWN, and evicts without rollback',async()=>{
 const p=scriptedPool([{steps:[{match:insert('tenant'),rows:[row(1,{theme:'dark'})]},{match:auditSql}],loseCommitAck:true}]);
 await assert.rejects(createPostgresSettingsStore({pool:p.pool}).save(input('tenant')),error=>failure('SETTINGS_COMMIT_UNKNOWN')(error)&&productFailure(error).outcome==='UNKNOWN');
 assert.deepEqual(p.committed.map(v=>v.kind),['document','audit']);assert.equal(p.calls.some(v=>v.sql==='ROLLBACK'),false);
 assert.equal(productFailure(p.released[0].error)?.code,'SETTINGS_COMMIT_UNKNOWN');assert.equal(p.connections(),1);
});

test('already cancelled save acquires no borrowed client',async()=>{
 const p=scriptedPool([]),controller=new AbortController();controller.abort();
 await assert.rejects(createPostgresSettingsStore({pool:p.pool}).save(input('user',{signal:controller.signal})),failure('CANCELLED'));
 assert.equal(p.connections(),0);assert.deepEqual(p.calls,[]);assert.deepEqual(p.released,[]);
});

test('late borrowed client after cancellation issues no SQL and is released',async()=>{
 const entered=gate(),release=gate(),p=scriptedPool([{steps:[],async connect(){entered.resolve();await release.promise;}}]),controller=new AbortController();
 const pending=createPostgresSettingsStore({pool:p.pool}).save(input('user',{signal:controller.signal}));const rejected=assert.rejects(pending,failure('CANCELLED'));
 await entered.promise;controller.abort();release.resolve();await rejected;
 assert.deepEqual(p.calls,[]);assert.equal(p.released.length,1);assert.equal(productFailure(p.released[0].error)?.code,'CANCELLED');
});

test('cancellation after the insert claim rolls back before audit and cannot publish a save',async()=>{
 const controller=new AbortController(),p=scriptedPool([{steps:[{match:insert('user'),rows:[row(1,{theme:'dark'})],run(){controller.abort();}}]}]);
 await assert.rejects(createPostgresSettingsStore({pool:p.pool}).save(input('user',{signal:controller.signal})),failure('CANCELLED'));
 assert.deepEqual(p.committed,[]);assert.equal(p.calls.some(v=>auditSql.test(v.sql)),false);assert.equal(p.calls.at(-1).sql,'ROLLBACK');assert.equal(p.released[0].error,undefined);
});
