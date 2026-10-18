/** SYNTHETIC pg pool protocol and SYNTHETIC Ed25519 keys only. The gate case runs the actual reader gate and custody owner
 * over the synthetic custody fixture with this store as its `idempotency`. Nothing proves PostgreSQL execution of migration
 * 0003, its trigger, roles, concurrency or durability. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {readerPurposes,readerTokenType} from '../../../packages/contracts/objective-reader-2/schema.mjs';
import {objectiveReaderRequestBody} from '../../../packages/contracts/objective-reader-2/validate.mjs';
import {createPostgresObjectiveReaderReplayStore} from './postgres-reader-replays.mjs';
import {createObjectiveSourceReaderGate} from './reader-gate.mjs';
import {custodyFixture,id,NOW} from './test/custody-fixture.mjs';
import {syntheticObjectivePool} from './test/run-start-fixture.mjs';
const unavailable=e=>e?.code==='OBJECTIVE_READER_REPLAY_UNAVAILABLE',unknown=e=>e?.code==='OBJECTIVE_READER_REPLAY_UNKNOWN',conflict=e=>e?.code==='OBJECTIVE_READER_REPLAY_CONFLICT';
const sha=v=>createHash('sha256').update(v).digest('hex');

function identityFor({binding,purpose='active-source',tokenId=id(99),bodySha256='b'.repeat(64)}={}){
 const d=readerPurposes[purpose],source={generationJobId:id(21),binding,sourceAdmissionSha256:'a'.repeat(64)};
 const identity={issuer:'https://'+purpose+'.synthetic.invalid',subject:d.subject,audience:d.audience,tokenId,signedTokenSha256:'c'.repeat(64),purpose,operation:d.operation,
  phase:d.phase,method:'POST',path:d.path,query:'',bodySha256,generationJobId:source.generationJobId,sourceAdmissionSha256:source.sourceAdmissionSha256,
  sourceSha256:hash(source),custodyIdentitySha256:'d'.repeat(64),expiresAtMs:NOW+60000};
 return {identity,source};
}
function setup(options={}){
 const f=custodyFixture(),{pool,state}=syntheticObjectivePool(),effects={count:0,value:{schemaVersion:2,observed:'synthetic'}};
 const create=(extra={})=>createPostgresObjectiveReaderReplayStore({enabled:true,pool,tenantId:f.binding.tenantId,now:()=>NOW,allocateFence:()=>id(80),...options,...extra});
 const effect=async()=>{effects.count++;if(effects.fail)throw Error('SYNTHETIC_EFFECT_FAILED');return structuredClone(effects.value);};
 return {f,pool,state,create,store:create(),effects,effect,...identityFor({binding:f.binding})};
}

test('disabled or incomplete configuration is unavailable and never connects or runs the effect',async()=>{
 const s=setup();
 for(const extra of [{enabled:false},{tenantId:''},{allocateFence:'x'},{maxRequestMs:0},{pool:null},{extra:true}]){
  const store=s.create(extra);assert.equal(store.available(),false);await assert.rejects(store.runOnce({identity:s.identity,source:s.source},s.effect),unavailable);
 }
 assert.equal(createPostgresObjectiveReaderReplayStore().available(),false);assert.equal(s.state.connects,0);assert.equal(s.effects.count,0);
});

test('claim, one effect, commit; an identical replay returns the exact stored value without the effect',async()=>{
 const s=setup(),first=await s.store.runOnce({identity:s.identity,source:s.source},s.effect);
 assert.deepEqual(first,{status:'executed',value:s.effects.value});assert.equal(s.effects.count,1);assert.equal(s.state.commits,2);
 assert.deepEqual(s.state.trace.filter(t=>/^(INSERT|UPDATE)/u.test(t.text)).map(t=>t.text.slice(0,6)),['INSERT','UPDATE']);
 const row=[...s.state.replays.values()][0];assert.equal(row.state,'COMMITTED');assert.equal(row.value_sha256,hash(s.effects.value));assert.equal(row.identity_sha256,hash(s.identity));
 assert.deepEqual(await s.create().runOnce({identity:s.identity,source:s.source},s.effect),{status:'replayed',value:s.effects.value});
 assert.equal(s.effects.count,1);assert.equal(s.state.clients.every(c=>c.releaseCount===1&&!c.destroyed),true);assert.equal(s.state.poolEnds,0);
});

test('a reused jti with any other identity or source is a conflict and never runs the effect',async()=>{
 const s=setup();await s.store.runOnce({identity:s.identity,source:s.source},s.effect);
 const changed=identityFor({binding:s.f.binding,bodySha256:'e'.repeat(64)});
 await assert.rejects(s.store.runOnce(changed,s.effect),conflict);
 const otherSource={...s.source,binding:{...s.source.binding,attemptId:id(70)}};
 await assert.rejects(s.store.runOnce({identity:{...s.identity,sourceSha256:hash(otherSource)},source:otherSource},s.effect),conflict);
 assert.equal(s.effects.count,1);
 const mismatched={...s.identity,sourceSha256:'0'.repeat(64)};await assert.rejects(s.store.runOnce({identity:mismatched,source:s.source},s.effect),unavailable);
 await assert.rejects(s.store.runOnce({identity:{...s.identity,tokenId:'00000000-0000-1000-8000-000000000099'},source:s.source},s.effect),unavailable,'jti must be a UUIDv4');
});

test('a failed effect leaves the claim UNKNOWN forever: the same token never reruns it',async()=>{
 const s=setup();s.effects.fail=true;
 await assert.rejects(s.store.runOnce({identity:s.identity,source:s.source},s.effect),unknown);assert.equal(s.effects.count,1);
 assert.equal([...s.state.replays.values()][0].state,'CLAIMED');s.effects.fail=false;
 await assert.rejects(s.create().runOnce({identity:s.identity,source:s.source},s.effect),unknown);assert.equal(s.effects.count,1);
 const oversized=setup();oversized.effects.value={blob:'x'.repeat(4194305)};
 await assert.rejects(oversized.store.runOnce({identity:oversized.identity,source:oversized.source},oversized.effect),unknown);
 assert.equal([...oversized.state.replays.values()][0].state,'CLAIMED');
});

test('lost acknowledgements: claim-before-write is sticky in this instance, claim-after-write and commit-after-write never rerun',async()=>{
 const before=setup();before.state.commitFailure='before';
 await assert.rejects(before.store.runOnce({identity:before.identity,source:before.source},before.effect),unknown);assert.equal(before.state.replays.size,0);
 await assert.rejects(before.store.runOnce({identity:before.identity,source:before.source},before.effect),unknown);assert.equal(before.effects.count,0);
 const after=setup();after.state.commitFailure='after';
 await assert.rejects(after.store.runOnce({identity:after.identity,source:after.source},after.effect),unknown);
 await assert.rejects(after.create().runOnce({identity:after.identity,source:after.source},after.effect),unknown,'a durable CLAIMED row is UNKNOWN');assert.equal(after.effects.count,0);
 const final=setup();
 final.state.queryHook=item=>{if(item.text.startsWith('UPDATE'))final.state.commitFailure='after';};
 await assert.rejects(final.store.runOnce({identity:final.identity,source:final.source},final.effect),unknown);assert.equal(final.effects.count,1);
 assert.deepEqual(await final.store.runOnce({identity:final.identity,source:final.source},final.effect),{status:'replayed',value:final.effects.value},'only the exact durable commit resolves it');
 assert.equal(final.effects.count,1);
});

test('foreign tenant and malformed identities are refused before any connection',async()=>{
 const s=setup({tenantId:id(9)});await assert.rejects(s.store.runOnce({identity:s.identity,source:s.source},s.effect),unavailable);assert.equal(s.state.connects,0);
 const t=setup();
 for(const change of [i=>{i.subject='other';},i=>{i.query='?x';},i=>{i.method='GET';},i=>{i.expiresAtMs=0;},i=>{i.extra=1;},i=>{i.path=readerPurposes['historical-source'].path;}]){
  const identity=structuredClone(t.identity);change(identity);await assert.rejects(t.store.runOnce({identity,source:t.source},t.effect),unavailable);
 }
 await assert.rejects(t.store.runOnce({identity:t.identity,source:t.source},'effect'),unavailable);assert.equal(t.state.connects,0);
});

test('the actual reader gate uses this store as its durable runOnce: one effect, exact replay, stale replay denied',async()=>{
 const purposes=Object.keys(readerPurposes),keys=Object.fromEntries(purposes.map(p=>[p,generateKeyPairSync('ed25519')]));
 const trust=Object.fromEntries(purposes.map(p=>[p,{issuer:'https://'+p+'.synthetic.invalid',publicKeys:{'test-1':keys[p].publicKey.export({format:'jwk'})}}]));
 const f=custodyFixture(),owner=f.create();await owner.publish({issued:f.issued});let reads=0;
 const custody={available:p=>owner.available(p),async read(value){reads++;return owner.read(value);}};
 const {pool,state}=syntheticObjectivePool({now:()=>f.state.now});
 const idempotency=createPostgresObjectiveReaderReplayStore({enabled:true,pool,tenantId:f.binding.tenantId,now:()=>f.state.now});
 const gate=createObjectiveSourceReaderGate({enabled:true,trust,custody,idempotency,now:()=>f.state.now});
 const body={schemaVersion:2,purpose:'active-source',...f.selector},bytes=objectiveReaderRequestBody(body),d=readerPurposes['active-source'],seconds=Math.floor(NOW/1000);
 const header={alg:'EdDSA',typ:readerTokenType,kid:'test-1'},claims={iss:trust['active-source'].issuer,sub:d.subject,aud:d.audience,iat:seconds,nbf:seconds,exp:seconds+60,jti:id(99),
  objective:{purpose:'active-source',operation:d.operation,phase:d.phase,method:'POST',path:d.path,query:'',bodySha256:sha(bytes),sourceAdmissionSha256:body.sourceAdmissionSha256,generationJobId:body.generationJobId}};
 const input=Buffer.from(JSON.stringify(header)).toString('base64url')+'.'+Buffer.from(JSON.stringify(claims)).toString('base64url');
 const token=input+'.'+sign(null,Buffer.from(input,'ascii'),keys['active-source'].privateKey).toString('base64url');
 const request=()=>({method:'POST',target:d.path,authorization:'Bearer '+token,rawBody:objectiveReaderRequestBody(body)});
 const first=await gate.read(request());assert.equal(first.purpose,'active-source');assert.equal(reads,3);
 const row=[...state.replays.values()][0];assert.equal(row.state,'COMMITTED');assert.equal(row.issuer,trust['active-source'].issuer);assert.equal(row.token_id,id(99));
 assert.equal(row.signed_token_sha256,sha(Buffer.from(token,'ascii')));
 assert.deepEqual(await gate.read(request()),first,'contemporaneous exact replay');assert.equal(reads,5,'the replay re-reads custody before and after, not inside the effect');
 f.state.now++;await assert.rejects(gate.read(request()),e=>e?.code==='OBJECTIVE_READER_V2_UNAVAILABLE');
 assert.equal(state.replays.size,1);assert.equal(state.trace.filter(t=>t.text.startsWith('UPDATE')).length,1,'one effect commit in total');
});
