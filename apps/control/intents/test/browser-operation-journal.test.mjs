import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createIntentJournal} from '../journal.mjs';
import {createBrowserOperationOwner} from '../browser-operation-owner.mjs';
import {assertBrowserOperationDescriptor,browserOperationArgumentsSha256,browserExecutionDeliveryId,
 browserApprovalDeliveryId,BROWSER_OPERATION_CONTRACT} from '../../../../packages/contracts/runtime-0.2/browser-operation.mjs';
import {PLAN} from '../../../../infra/product-preview/first-chat-migrate.mjs';

const NOW=1700000000000;
const binding={tenantId:'tenant',actorId:'actor',conversationId:'22222222-2222-4222-8222-222222222222',
 runId:'33333333-3333-4333-8333-333333333333',attemptId:'44444444-4444-4444-8444-444444444444',
 workerId:'55555555-5555-4555-8555-555555555555',writerFence:7};
const scopes=[{tenantId:'tenant',kind:'client',resourceId:'66666666-6666-4666-8666-666666666666',policyRevision:'p1'}];
const args={tool:'browser_click',arguments:{selector:'#confirm'}};
const request=({requestId='a1b2'.repeat(16),tool='browser_click',inputSha256=hash(args),
 policySha256='f'.repeat(64),bound=binding}={})=>({binding:bound,requestId,tool,inputSha256,policySha256,scopes});

/** The documented journal store port, in memory. The real SQL adapter keeps its own tests. */
function journalPort(){
 const rows=new Map(),calls=[];
 const keyOf=k=>JSON.stringify([k.tenantId,k.actorId,k.conversationId,k.deliveryId]);
 return {calls,rows,
  async claim({key,record}){calls.push('claim');
   const id=keyOf(key);
   if(rows.has(id))return {claimed:false,entry:structuredClone(rows.get(id))};
   rows.set(id,{record:structuredClone(record),state:'PENDING',outcome:null});return {claimed:true};},
  async settle({key,record,state,outcome}){calls.push('settle');const id=keyOf(key),current=rows.get(id);
   if(!current||current.state!=='PENDING'||hash(current.record)!==hash(record))throw Object.assign(Error('refused'),{code:'INTENT_JOURNAL_STATE'});
   const next={record:structuredClone(record),state,outcome:structuredClone(outcome)};
   rows.set(id,next);return structuredClone(next);},
  async read({key}){calls.push('read');const row=rows.get(keyOf(key));return row?structuredClone(row):null;}};
}
/** The journal takes only its documented ports, so the in-memory store is passed explicitly. */
const owner=()=>{const port=journalPort();
 return createBrowserOperationOwner({journal:createIntentJournal({claim:port.claim,settle:port.settle,read:port.read})});};

test('the descriptor digest is the only browser content in the SQL record and never carries time',()=>{
 const descriptor=assertBrowserOperationDescriptor({schema:'meri-browser-operation-descriptor/1',...request()});
 const sha=browserOperationArgumentsSha256(descriptor);
 assert.match(sha,/^[0-9a-f]{64}$/u);
 const record={operation:BROWSER_OPERATION_CONTRACT,argumentsSha256:sha};
 assert.deepEqual(Object.keys(record).sort(),['argumentsSha256','operation']);
 assert.deepEqual(Object.keys(record.operation).sort(),['id','version']);
 // The same call recomputes the same identity: no now/lease/expiry field is involved.
 assert.equal(browserOperationArgumentsSha256(assertBrowserOperationDescriptor({schema:'meri-browser-operation-descriptor/1',...request()})),sha);
 // A changed tool, input, policy or binding changes the digest; the identity is domain separated.
 assert.notEqual(browserOperationArgumentsSha256(assertBrowserOperationDescriptor({schema:'meri-browser-operation-descriptor/1',...request({tool:'browser_type'})})),sha);
 assert.notEqual(browserExecutionDeliveryId({binding,requestId:request().requestId}),
  browserApprovalDeliveryId({binding,requestId:request().requestId}));
});

test('a browser call is claimed before dispatch and never dispatched twice',async()=>{
 const o=owner();
 const first=await o.claim(request());
 assert.equal(first.dispatch,true);assert.equal(first.argumentsSha256,hash(assertBrowserOperationDescriptor({schema:'meri-browser-operation-descriptor/1',...request()})));
 // PENDING replay: no second dispatch while the first delivery is unresolved.
 const again=await o.claim(request());
 assert.equal(again.dispatch,false);assert.equal(again.variant,'unresolved');
 assert.equal(again.result,null);
 // The same identity with different contents is a conflict, not a new delivery.
 await assert.rejects(o.claim(request({tool:'browser_type'})),{message:'CONFLICT'});
});

test('a settled call replays its retained result and a changed call refuses',async()=>{
 const o=owner();
 await o.claim(request());
 const release={binding,scopes,expiresAtMs:NOW+60000};
 await o.settle({...request(),state:'PREPARED',outcome:{result:{outcome:'ok',reference:null},release}});
 const replay=await o.claim(request());
 assert.equal(replay.dispatch,false);
 assert.deepEqual(replay.result,{outcome:'ok',reference:null});
 assert.deepEqual(replay.release,release);
 await assert.rejects(o.claim(request({policySha256:'e'.repeat(64)})),{message:'CONFLICT'});
});

test('the verify read distinguishes absent, in-flight, dispatched and refused without trusting a digest',async()=>{
 const o=owner();
 const sha=browserOperationArgumentsSha256(assertBrowserOperationDescriptor({schema:'meri-browser-operation-descriptor/1',...request()}));
 const absent=await o.verify({binding,requestId:request().requestId,descriptorSha256:sha});
 assert.equal(absent.variant,'absent');
 await o.claim(request());
 assert.equal((await o.verify({binding,requestId:request().requestId,descriptorSha256:sha})).variant,'in-flight');
 // A digest for a DIFFERENT descriptor is a conflict even though a row exists for this identity.
 const other=browserOperationArgumentsSha256(assertBrowserOperationDescriptor({schema:'meri-browser-operation-descriptor/1',...request({tool:'browser_type'})}));
 await assert.rejects(o.verify({binding,requestId:request().requestId,descriptorSha256:other}),{message:'BROWSER_OPERATION_CONFLICT'});
 await o.settle({...request(),state:'PREPARED',outcome:{result:{outcome:'ok'},release:{binding,scopes,expiresAtMs:Date.now()+60000}}});
 const dispatched=await o.verify({binding,requestId:request().requestId,descriptorSha256:sha});
 assert.equal(dispatched.variant,'dispatched');assert.deepEqual(dispatched.result,{outcome:'ok'});
 // A retained release that has already expired is no longer current authority for the read.
 const stale=owner();
 await stale.claim(request());
 await stale.settle({...request(),state:'PREPARED',outcome:{result:{outcome:'ok'},release:{binding,scopes,expiresAtMs:NOW}}});
 await assert.rejects(stale.verify({binding,requestId:request().requestId,descriptorSha256:sha}),
  {message:'BROWSER_OPERATION_RELEASE_EXPIRED'});
});

test('the journal admits the internal operation, keeps sdk rows public and separates the domains',async()=>{
 const source=readFileSync(new URL('../postgres-journal.mjs',import.meta.url),'utf8');
 assert.match(source,/INTERNAL_OPERATIONS=Object\.freeze\(\['browser_action@0\.2\.0'\]\)/u);
 assert.match(source,/delivery_id LIKE 'sdk:%'/u,'the public list stays sdk-only');
 assert.match(source,/\^\(\?:sdk\|browser\):\[a-f0-9\]\{64\}\$/u,'row keys accept both families');
 // An execution delivery never equals an approval delivery for the same binding and request.
 assert.notEqual(browserExecutionDeliveryId({binding,requestId:'c'.repeat(64)}),
  browserApprovalDeliveryId({binding,requestId:'c'.repeat(64)}));
});

test('the migration is appended exactly once at ordinal 77 and only widens the delivery identity',()=>{
 assert.equal(PLAN.length,77);
 const entry=PLAN[76];
 assert.equal(entry.ordinal,77);
 assert.equal(entry.path,'apps/control/intents/migrations/0003_browser_operation_preparations.sql');
 assert.equal(entry.stage,'integration');
 assert.ok(entry.pinned&&/^[a-f0-9]{64}$/u.test(entry.pinned));
 const bytes=readFileSync(new URL('../migrations/0003_browser_operation_preparations.sql',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.pinned,'the pinned bytes are the committed bytes');
 const sql=bytes.toString('utf8');
 assert.match(sql,/\^\(sdk\|browser\):\[a-f0-9\]\{64\}\$/u);
 assert.match(sql,/att\.attname = 'delivery_id'/u,'located by attribute, not a guessed name');
 assert.match(sql,/pg_get_constraintdef/u);
 assert.doesNotMatch(sql,/CREATE TABLE|CREATE INDEX|GRANT |ALTER COLUMN|DROP TABLE/u);
 // Exactly one original constraint, verified in full, and a hard refusal before any ALTER.
 assert.match(sql,/SELECT count\(\*\) INTO matches/u,'counts the matching originals');
 assert.match(sql,/IF matches <> 1 THEN/u);
 assert.match(sql,/RAISE EXCEPTION 'MERI_INTENT_DELIVERY_CHECK_NOT_UNIQUE/u);
 assert.match(sql,/IF definition NOT IN \(/u);
 assert.match(sql,/RAISE EXCEPTION 'MERI_INTENT_DELIVERY_CHECK_UNEXPECTED/u);
 assert.match(sql,/CHECK \(\(delivery_id ~ ''\^sdk:\[a-f0-9\]\{64\}\$''/u,'the exact original predicate');
 assert.doesNotMatch(sql,/FOR constraint_name IN|LOOP/u,'no broad loop that can silently match nothing');
 assert.equal((sql.match(/DROP CONSTRAINT/gu)??[]).length,1,'exactly one constraint is replaced');
 // The neighbouring ordinals keep their reviewed pins.
 assert.equal(PLAN[75].path,'apps/control/browser-hosts/migrations/0003_browser_only_teardown.sql');
 assert.equal(PLAN[75].pinned,'ad06f879d0202b37b32e5de7fae612e7a2603e7388a7393d5834bb2983c85992');
});
