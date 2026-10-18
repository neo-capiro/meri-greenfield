/** SYNTHETIC: the Core-proof run control and its proof verifier. Core's signer is a local test Ed25519 key following Core's
 * issuance bytes; the canonical run store, dispatcher and proof ledger are recording fakes (the ledger is the actual Postgres owner
 * over a scripted pool). Proves verification, single use, run coverage, fence and the lifecycle Stop order — not a live Core key. */
import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync} from 'node:crypto';
import canonicalize from 'canonicalize';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {workflowId} from '../../../control/conversations/temporal-dispatch.mjs';
import {createPostgresRunCancelProofLedger} from '../../../control/schedules/postgres-run-cancel-proofs.mjs';
import {routineCancellationTrust,verifyRoutineCancellationProof,cancellationCoversRun} from '../routines-cancellation-proof.mjs';
import {createRoutinesRunControl} from '../routines-run-control.mjs';
import {compileRoutinesCoreConfiguration} from '../routines-configuration.mjs';
import {coreSigner,proofLedgerPool,ISSUER,KID} from './routines-core-fixture.mjs';

const NOW=Date.parse('2026-10-18T12:00:00.000Z'),id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const owner={tenantId:'tenant-a',actorId:'owner-a'};
const original={...owner,conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1},current={...original,runId:id(5),attemptId:id(6),workerId:id(7),writerFence:2};
const runs=[{workflowId:workflowId(original),runId:id(10)},{workflowId:workflowId(current),runId:id(11)}],targets=[original,current];
const claims=(changes={})=>({tenantId:owner.tenantId,ownerActorId:owner.actorId,scheduleId:id(20),intentId:id(21),intentSha256:'a'.repeat(64),decisionSha256:'b'.repeat(64),runs,targets,...changes});
const expectedOf=c=>({intentId:c.intentId,intentSha256:c.intentSha256,scheduleId:c.scheduleId,decisionSha256:c.decisionSha256,runs:c.runs,targets:c.targets});
const code=c=>e=>e?.code===c;

function harness({state='running',stale=false,journalFails=null,loseCommit=false}={}){
 const signer=coreSigner(),trust=routineCancellationTrust(signer.pin),ledger=proofLedgerPool({loseCommit}),clock={now:NOW},order=[],runs={state};let ids=900;
 const store={
  async readOptional(binding,cursor,check){check();order.push('read');assert.deepEqual(cursor,{after:0,limit:1});
   if(stale||hash(binding)!==hash(current))throw Object.assign(Error('STALE_WRITER'),{code:'STALE_WRITER'});
   return {run:{binding:current,scopes:[{tenantId:owner.tenantId,kind:'client',resourceId:id(30),policyRevision:'p1'}],state:runs.state},request:{},events:[],nextSequence:0,hasMore:false,lastSequence:1};},
  lifecycle:{async cancel(binding,event,check,scopes){check();order.push(['journal',event.type,event.data,scopes.length]);assert.deepEqual(binding,current);
   if(journalFails){runs.state=journalFails;throw Error('synthetic refused append');}runs.state='cancelled';return event;}},
 };
 const dispatcher={async cancel({binding,signal,deadlineMs}){order.push(['dispatcher',binding.runId,signal instanceof AbortSignal,Number.isSafeInteger(deadlineMs)]);return {workflow:'CANCEL_REQUESTED'};}};
 const control=createRoutinesRunControl({trust,ledger:createPostgresRunCancelProofLedger({pool:ledger.pool}),store,dispatcher,now:()=>clock.now,newId:()=>id(ids++),maxRequestMs:30000});
 const call=(proof,changes={})=>control.cancel({binding:current,proof,expected:expectedOf(claims()),deadlineMs:clock.now+10000,...changes});
 return {signer,trust,ledger,clock,order,runs,control,call};
}

test('configuration pins exactly one Ed25519 public key, issuer and kid; malformed pins refuse',()=>{
 const {pin}=coreSigner(),core={origin:'https://core.synthetic.invalid',serviceSecretFile:'/run/meri/routines-service-secret',cancellationProof:pin};
 const compiled=compileRoutinesCoreConfiguration({routines:{enabled:true,core}});assert.deepEqual(compiled.cancellationProof,pin);assert.equal(compileRoutinesCoreConfiguration({routines:{enabled:true}}),null);
 const other=generateKeyPairSync('x25519').publicKey.export({format:'jwk'});
 for(const bad of [{...core,origin:'http://core.synthetic.invalid'},{...core,origin:'https://core.synthetic.invalid/api'},{...core,serviceSecretFile:'relative'},{...core,extra:1},
  {...core,cancellationProof:{...pin,kid:'bad kid'}},{...core,cancellationProof:{...pin,issuer:' x'}},{...core,cancellationProof:{...pin,publicKey:{...pin.publicKey,crv:'X25519'}}},
  {...core,cancellationProof:{...pin,publicKey:{kty:'OKP',crv:'Ed25519',x:other.x+'A'}}},{...core,cancellationProof:{...pin,publicKey:{...pin.publicKey,d:'secret'}}}])
  assert.throws(()=>compileRoutinesCoreConfiguration({routines:{enabled:true,core:bad}}),code('ROUTINES_CONFIGURATION'));
 assert.throws(()=>compileRoutinesCoreConfiguration({routines:{enabled:true,core:{...core,serviceSecretFile:'/run/meri/identity'}},nativeCandidate:{identity:{credentialFile:'/run/meri/identity'}}}),code('ROUTINES_CONFIGURATION'));
});

test('a valid proof verifies exactly and covers only its owner targets whose executions are approved runs',()=>{
 const {signer,trust}=harness(),issued=signer.sign(claims(),{nowMs:NOW}),v=verifyRoutineCancellationProof(issued.proof,{trust,nowMs:NOW+1000});
 assert.deepEqual(v.claims,claims());assert.equal(v.jti,issued.jti);assert.equal(v.issuer,ISSUER);assert.equal(v.kid,KID);assert.equal(v.exp-v.iat,30);assert.match(v.proofSha256,/^[a-f0-9]{64}$/u);
 assert.equal(cancellationCoversRun(v.claims,current),true);assert.equal(cancellationCoversRun(v.claims,original),true);
 for(const binding of [{...current,writerFence:3},{...current,actorId:'other'},{...current,runId:id(99)}])assert.equal(cancellationCoversRun(v.claims,binding),false);
 // A target whose execution is not among the approved runs is not covered either.
 const only=signer.sign(claims({runs:[runs[0]]}),{nowMs:NOW});assert.equal(cancellationCoversRun(verifyRoutineCancellationProof(only.proof,{trust,nowMs:NOW}).claims,current),false);
});

test('tampered, expired, over-long, wrong kid/key/issuer/audience or non-canonical proofs are refused',()=>{
 const {signer,trust}=harness(),good=signer.sign(claims(),{nowMs:NOW}).proof,[h,p,s]=good.split('.'),refused=(token,nowMs=NOW)=>assert.throws(()=>verifyRoutineCancellationProof(token,{trust,nowMs}),code('ROUTINE_CANCELLATION_PROOF_REFUSED'));
 const flip=text=>text.slice(0,-2)+(text.at(-2)==='A'?'B':'A')+text.at(-1);
 refused(`${h}.${flip(p)}.${s}`);refused(`${h}.${p}.${flip(s)}`);refused(`${h}.${p}`);refused(`${h}.${p}.${s}.x`);refused(good+'=');
 refused(good,NOW+30000);refused(good,NOW+31000);refused(good,NOW-1000);
 refused(signer.sign(claims(),{nowMs:NOW,ttl:31}).proof);refused(signer.sign(claims(),{nowMs:NOW,ttl:0}).proof);refused(signer.sign(claims(),{nowMs:NOW,nbfOffset:1}).proof);
 refused(signer.sign(claims(),{nowMs:NOW,headerKid:'routine-cancel-2'}).proof);
 refused(signer.sign(claims(),{nowMs:NOW,key:generateKeyPairSync('ed25519').privateKey}).proof);
 refused(signer.sign(claims(),{nowMs:NOW,iss:'https://other.invalid'}).proof);refused(signer.sign(claims(),{nowMs:NOW,aud:'meri-other'}).proof);
 refused(signer.sign(claims(),{nowMs:NOW,jti:'not-a-uuid'}).proof);refused(signer.sign(claims(),{nowMs:NOW,jti:'10000000-0000-1000-8000-000000000001'}).proof);
 refused(signer.sign(claims(),{nowMs:NOW,header:JSON.stringify({typ:'capiro-meri-routine-cancel+jwt',alg:'EdDSA',kid:KID})}).proof);
 const iat=Math.floor(NOW/1000),body={iss:ISSUER,aud:'meri-schedule-run-control',iat,nbf:iat,exp:iat+30,jti:'4a8a2b06-9b0b-4c43-9d55-4f6f0bd1a1f1',cancel:claims()};
 refused(signer.sign(null,{nowMs:NOW,payload:JSON.stringify(body,null,1)}).proof);
 assert.ok(verifyRoutineCancellationProof(signer.sign(null,{nowMs:NOW,payload:canonicalize(body)}).proof,{trust,nowMs:NOW}));
 refused(signer.sign(null,{nowMs:NOW,payload:canonicalize({...body,extra:1})}).proof);
 for(const bad of [claims({targets:[{...current,actorId:'other'}]}),claims({targets:[]}),claims({runs:[]}),claims({intentSha256:'A'.repeat(64)}),claims({targets:[current,current]}),{...claims(),extra:1}])
  refused(signer.sign(bad,{nowMs:NOW}).proof);
 // A different pinned trust (same key material, other kid) never accepts this signer's proofs.
 assert.throws(()=>verifyRoutineCancellationProof(good,{trust:{...trust},nowMs:NOW}),code('ROUTINE_CANCELLATION_PROOF_REFUSED'));
});

test('cancel order: verify, current fence, single-use jti, journal run.status cancelled, then dispatcher cancel',async()=>{
 const h=harness(),issued=h.signer.sign(claims(),{nowMs:NOW});
 assert.deepEqual(await h.call(issued.proof),{state:'cancelled',workflow:'CANCEL_REQUESTED'});
 assert.deepEqual(h.order,['read',['journal','run.status',{state:'cancelled',reasonCode:'USER_CANCELLED'},1],['dispatcher',current.runId,true,true]]);
 const row=[...h.ledger.state.rows.values()];assert.equal(row.length,1);
 assert.equal(row[0].token_id,issued.jti);assert.equal(row[0].issuer,ISSUER);assert.equal(row[0].key_id,KID);assert.deepEqual(row[0].binding,current);assert.equal(row[0].binding_sha256,hash(current));
 assert.equal(row[0].expires_at_s-row[0].issued_at_s,30);assert.equal(row[0].claims_sha256,hash(claims()));assert.ok(!JSON.stringify(row[0]).includes(issued.proof));
 // Reuse (replay, a second target or a concurrent call) is refused before any effect.
 h.runs.state='running';const before=h.order.length;
 await assert.rejects(h.call(issued.proof),code('SCHEDULE_RUN_CANCEL_PROOF_REUSED'));assert.deepEqual(h.order.slice(before),['read']);
 await assert.rejects(h.call(issued.proof,{binding:original}),code('STALE_WRITER'));assert.equal(h.ledger.state.rows.size,1);
});

test('foreign run, foreign approval, expired proof, stale fence and unattended calls stop nothing and consume nothing',async()=>{
 const h=harness(),proof=h.signer.sign(claims(),{nowMs:NOW}).proof;
 await assert.rejects(h.call(proof,{binding:{...current,runId:id(98)}}),code('ROUTINE_RUN_CONTROL_PROOF'));
 await assert.rejects(h.call(proof,{binding:{...current,actorId:'other'}}),code('ROUTINE_RUN_CONTROL_PROOF'));
 for(const key of ['intentId','intentSha256','scheduleId','decisionSha256'])
  await assert.rejects(h.call(proof,{expected:{...expectedOf(claims()),[key]:key.endsWith('Sha256')?'c'.repeat(64):id(97)}}),code('ROUTINE_RUN_CONTROL_PROOF'));
 await assert.rejects(h.call(proof,{expected:{...expectedOf(claims()),runs:[runs[1]]}}),code('ROUTINE_RUN_CONTROL_PROOF'));
 await assert.rejects(h.call(proof,{expected:{...expectedOf(claims()),targets:[current]}}),code('ROUTINE_RUN_CONTROL_PROOF'));
 h.clock.now=NOW+30000;await assert.rejects(h.call(proof),code('ROUTINE_CANCELLATION_PROOF_REFUSED'));h.clock.now=NOW;
 const covered=h.signer.sign(claims({targets:[original,{...current,writerFence:1,runId:id(5)}],runs}),{nowMs:NOW}).proof;
 await assert.rejects(h.call(covered,{binding:{...current,writerFence:1},expected:expectedOf(claims({targets:[original,{...current,writerFence:1}]}))}),code('STALE_WRITER'));
 // The schedule worker (or any caller) without a proof is refused before reading anything.
 await assert.rejects(h.control.cancel({binding:current,signal:new AbortController().signal,deadlineMs:NOW+1000}),code('ROUTINE_RUN_CONTROL_REQUEST'));
 await assert.rejects(h.call(undefined),code('ROUTINE_RUN_CONTROL_REQUEST'));
 assert.deepEqual(h.order.filter(step=>step!=='read'),[]);assert.equal(h.ledger.state.rows.size,0);
});

test('terminal runs are not re-journaled, a refused append adopts only a terminal state, and lost ledger commits stop nothing',async()=>{
 const done=harness({state:'completed'});assert.deepEqual(await done.call(done.signer.sign(claims(),{nowMs:NOW}).proof),{state:'completed',workflow:'CANCEL_REQUESTED'});
 assert.deepEqual(done.order.map(step=>Array.isArray(step)?step[0]:step),['read','dispatcher']);
 const raced=harness({journalFails:'failed'});assert.deepEqual(await raced.call(raced.signer.sign(claims(),{nowMs:NOW}).proof),{state:'failed',workflow:'CANCEL_REQUESTED'});
 assert.deepEqual(raced.order.map(step=>Array.isArray(step)?step[0]:step),['read','journal','read','dispatcher']);
 const refused=harness({journalFails:'running'});await assert.rejects(refused.call(refused.signer.sign(claims(),{nowMs:NOW}).proof),/synthetic refused append/u);
 assert.deepEqual(refused.order.map(step=>Array.isArray(step)?step[0]:step),['read','journal','read']);
 const lost=harness({loseCommit:true});await assert.rejects(lost.call(lost.signer.sign(claims(),{nowMs:NOW}).proof),code('SCHEDULE_RUN_CANCEL_PROOF_UNKNOWN'));
 assert.deepEqual(lost.order,['read']);
});

test('the migration is CREATE-only, insert-only and bounds proof lifetime; the ledger writes exactly its columns',async()=>{
 const {readFileSync}=await import('node:fs'),sql=readFileSync(new URL('../../../control/schedules/migrations/0003_run_cancel_proofs.sql',import.meta.url),'utf8');
 const source=readFileSync(new URL('../../../control/schedules/postgres-run-cancel-proofs.mjs',import.meta.url),'utf8');
 const columns=/INSERT INTO meri_schedules\.run_cancel_proofs\(([^)]+)\)/u.exec(source)[1].split(',');
 for(const name of columns)assert.match(sql,new RegExp(`\\n ${name} (?:text|uuid|bigint|jsonb) NOT NULL`,'u'),name);
 assert.match(sql,/PRIMARY KEY \(issuer, token_id\)/u);assert.match(sql,/expires_at_s - issued_at_s <= 30/u);
 assert.match(sql,/BEFORE UPDATE OR DELETE ON meri_schedules\.run_cancel_proofs/u);assert.match(sql,/BEFORE TRUNCATE ON meri_schedules\.run_cancel_proofs/u);
 assert.doesNotMatch(sql,/\b(?:ALTER|DROP|GRANT|REVOKE|CREATE SCHEMA|CREATE ROLE)\b/u);assert.match(sql,/\nBEGIN;[\s\S]*\nCOMMIT;\s*$/u);
 const ledger=createPostgresRunCancelProofLedger({pool:proofLedgerPool().pool}),row={issuer:ISSUER,keyId:KID,tokenId:id(1),tenantId:owner.tenantId,ownerActorId:owner.actorId,scheduleId:id(2),intentId:id(3),
  intentSha256:'a'.repeat(64),decisionSha256:'b'.repeat(64),claimsSha256:'c'.repeat(64),proofSha256:'d'.repeat(64),binding:current,issuedAtS:100,expiresAtS:130};
 for(const bad of [{...row,expiresAtS:131},{...row,binding:{...current,actorId:'other'}},{...row,tokenId:'x'},{...row,extra:1}])await assert.rejects(ledger.consume(bad),code('SCHEDULE_RUN_CANCEL_PROOF_REQUEST'));
 assert.equal(await ledger.consume(row),true);await assert.rejects(ledger.consume(row),code('SCHEDULE_RUN_CANCEL_PROOF_REUSED'));
});
