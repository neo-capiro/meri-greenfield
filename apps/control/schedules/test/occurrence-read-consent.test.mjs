/** Synthetic joined PostgreSQL rows through the real schedule owner and occurrence relay. This proves the local consent
 * adapter and exact native facts contract, not Core's independent consent or a live database transaction. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createPostgresScheduleOwner} from '../postgres-schedule-owner.mjs';
import {occurrenceIdentity,snapshotOccurrence} from '../scheduled-occurrence.mjs';
import {workflowId} from '../../conversations/temporal-dispatch.mjs';
import {createOccurrenceRelay} from '../../../runtime/occurrence-relay.mjs';
import {assertOccurrence} from '../../../runtime/native-authority/read-delegation/contract.mjs';
import {occurrence,projection} from './scheduled-dispatch-harness.mjs';

const clientId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',policyRevision='b'.repeat(64),operationsDigest='c'.repeat(64);
const now=Date.parse('2026-10-15T12:00:05.000Z');
const p=projection({scopes:[{tenantId:'tenant-a',kind:'client',resourceId:clientId,policyRevision}]});
const firing=occurrence({projection:p}),identity=occurrenceIdentity(snapshotOccurrence(firing));
const effect={binding:identity.binding,requestId:identity.requestId,eventId:identity.eventId,workflowId:workflowId(identity.binding)};
const consent={consentId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',state:'active',createdAtMs:now-60000,
 expiresAtMs:now+60000,scheduleProjectionSha256:hash(p),operationsDigest};
const selection={tenantId:identity.binding.tenantId,conversationId:identity.binding.conversationId};
const row=()=>({tenant_id:selection.tenantId,generation:'1',occurrence_key:identity.occurrenceKey,schedule_id:p.scheduleId,
 occurrence:structuredClone(firing),effect:structuredClone(effect),effect_sha256:hash(effect),state:'DISPATCHED',
 created_at:new Date('2026-10-15T12:00:01.000Z'),current_tenant_id:selection.tenantId,current_schedule_id:p.scheduleId,
 current_owner_actor_id:identity.binding.actorId,current_generation:'1',current_projection:structuredClone(p),
 current_projection_sha256:hash(p),current_active_intent:null,read_consent:structuredClone(consent)});

function fixture(initialRows=[row()]){
 const state={rows:initialRows,selects:[],releases:0};
 const pool={async connect(){return {async query(sql,params){
  if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK'||sql.startsWith('SET LOCAL'))return {rows:[]};
  if(sql.startsWith('SELECT o.tenant_id')){state.selects.push({sql,params});return {rows:structuredClone(state.rows)};}
  throw Error(`unexpected SQL: ${sql}`);
 },release(){state.releases++;}};}};
 return {owner:createPostgresScheduleOwner({pool}),state};
}
const read=(f,s=selection)=>f.owner.readConsentForOccurrence(s,()=>{});
const denied=promise=>assert.rejects(promise,e=>e?.code==='SCHEDULE_READ_CONSENT');

test('one joined read returns only the exact consent contract for a dispatched occurrence',async()=>{
 const f=fixture(),relay=createOccurrenceRelay();relay.bind(f.owner);
 const facts=await relay.port.readOccurrence({binding:effect.binding});
 assert.deepEqual(facts,{consentId:consent.consentId,consentState:'active',consentExpiresAtMs:consent.expiresAtMs,
  consentCreatedAtMs:consent.createdAtMs,scheduleId:p.scheduleId,occurrenceKey:identity.occurrenceKey,
  startedAtMs:Date.parse('2026-10-15T12:00:01.000Z'),clientId,operationsDigest,policyRevision,runBinding:effect.binding});
 assert.deepEqual(assertOccurrence(facts,{binding:effect.binding,clientId,operationsSha256:operationsDigest,policyRevision,now:()=>now}),facts);
 for(const changed of [{clientId:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'},{operationsSha256:'e'.repeat(64)},
  {policyRevision:'e'.repeat(64)},{binding:{...effect.binding,writerFence:2}}])
  assert.throws(()=>assertOccurrence(facts,{binding:effect.binding,clientId,operationsSha256:operationsDigest,policyRevision,now:()=>now,...changed}),{code:'ACCESS_DENIED'});
 assert.equal(f.state.selects.length,1);assert.deepEqual(f.state.selects[0].params,[selection.tenantId,selection.conversationId]);
 assert.match(f.state.selects[0].sql,/LEFT JOIN meri_schedules\.projections p ON p\.tenant_id=o\.tenant_id AND p\.schedule_id=o\.schedule_id/u);
 assert.match(f.state.selects[0].sql,/p\.read_consent/u);
 assert.equal(f.state.releases,1);relay.close();assert.equal(await relay.port.readOccurrence({binding:effect.binding}),null);
});

test('only genuine occurrence absence returns null; duplicate or mismatched custody refuses',async()=>{
 const missing=fixture([]);assert.equal(await read(missing),null);
 const duplicates=fixture([row(),row()]);await assert.rejects(read(duplicates),e=>e?.code==='SCHEDULE_CORRUPT');
 const changed=row();changed.effect.binding.conversationId='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';changed.effect_sha256=hash(changed.effect);
 await assert.rejects(read(fixture([changed])),e=>e?.code==='SCHEDULE_JOB_LINEAGE');
});

test('missing, inactive or superseded consent and projection facts refuse rather than fall back to attended',async()=>{
 const mutations=[
  r=>{r.read_consent=null;},r=>{r.read_consent.state='paused';},r=>{r.read_consent.state='revoked';},
  r=>{r.read_consent.scheduleProjectionSha256='a'.repeat(64);},r=>{r.read_consent.operationsDigest='invalid';},
  r=>{r.state='OPEN';},r=>{r.state='REFUSED';},r=>{r.current_projection=null;},
  r=>{r.current_generation='2';},r=>{r.current_projection.state='paused';r.current_projection_sha256=hash(r.current_projection);},
  r=>{r.current_projection_sha256='a'.repeat(64);},r=>{r.current_active_intent='ffffffff-ffff-4fff-8fff-ffffffffffff';},
  r=>{r.current_owner_actor_id='other';},r=>{r.current_tenant_id=null;},r=>{r.created_at='invalid';},
 ];
 for(const mutate of mutations){const r=row();mutate(r);await denied(read(fixture([r])));}
});

test('relay requires the joined consent reader and checks cancellation before the store read',async()=>{
 const relay=createOccurrenceRelay();assert.throws(()=>relay.bind({readOccurrenceForConversation(){}}),{code:'OCCURRENCE_RELAY_CONFIGURATION'});
 const f=fixture();relay.bind(f.owner);const controller=new AbortController();controller.abort();
 await assert.rejects(relay.port.readOccurrence({binding:effect.binding,signal:controller.signal}),{code:'OCCURRENCE_RELAY_CANCELLED'});
 assert.equal(f.state.selects.length,0);
});
