/** SYNTHETIC SQL script + static allocated DDL. No PostgreSQL, driver, SQL parser, real credentials or provider. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createPostgresIssuanceStore,createPostgresModelGrantStore} from '../prepared-run-issuance-postgres.mjs';
import {createModelGrantIssuer} from '../model-grant-issuer.mjs';import {createModelMaterialAuthority} from '../model-material-authority.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';import {capabilityDigest} from '../native-authority/task-verifier.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,at=1900000000000;
const binding={tenantId:'t',actorId:'a',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const intent={issuanceKey:hash(binding),binding,requestSha256:'a'.repeat(64),expiresAtMs:at+1000};
function sqlFixture(){
 const s={rows:new Map(),calls:[],loseClaim:false,loseComplete:false,race:false};
 const pool={async query(sql,p=[]){s.calls.push({sql,p});const table=/meri_conversations\.(model_run_issuances|run_issuances)/u.exec(sql)?.[0];assert.ok(table,'closed canonical table');
  const key=table+'/'+p[0],r=s.rows.get(key),answer=row=>({rows:row?[structuredClone(row)]:[]});
  if(sql.startsWith('SELECT'))return answer(r);
  if(sql.startsWith('INSERT')){
   if(r)return answer();const row={issuance_key:p[0],tenant_id:p[1],conversation_id:p[2],run_id:p[3],binding:p[4],binding_sha256:p[0],request_sha256:p[5],expires_at_ms:String(p[6]),state:'CLAIMED',claim_fence:p[7],version:'1',claimed_at:new Date(at),issued_at:null,grant_id:null,capability_sha256:null,material_ref:null,facts_sha256:null};s.rows.set(key,row);
   if(s.loseClaim){s.loseClaim=false;throw Error('synthetic claim ACK loss');}return answer(row);
  }
  if(sql.includes("SET state='ISSUED'")){
   if(s.race){s.race=false;r.version=String(Number(r.version)+1);}
   if(!r||r.state!=='CLAIMED'||Number(r.version)!==p[4]||table.endsWith('model_run_issuances')&&r.claim_fence!==p[5])return answer();
   Object.assign(r,{state:'ISSUED',grant_id:p[1],capability_sha256:p[2],material_ref:p[3],issued_at:new Date(at),version:String(Number(r.version)+1)});
   if(s.loseComplete){s.loseComplete=false;throw Error('synthetic completion ACK loss');}return answer(r);
  }
  if(sql.includes('SET facts_sha256=')){if(!r||r.state!=='ISSUED'||r.facts_sha256!==null||Number(r.version)!==p[2])return answer();Object.assign(r,{facts_sha256:p[1],version:String(Number(r.version)+1)});return answer(r);}
  assert.fail('Unexpected SQL');
 }};
 return {s,pool,model:createPostgresModelGrantStore({pool}),task:createPostgresIssuanceStore({pool})};
}
const identity={grantId:id(20),capabilitySha256:'c'.repeat(64),materialRef:'model-material:v1:'+intent.issuanceKey};
test('model and task share a binding-derived key but never a SQL row; existing task identity/facts behavior is preserved',async()=>{
 const f=sqlFixture(),m=await f.model.claim(intent),t=await f.task.claim(intent);assert.equal(m.fresh,true);assert.equal(t.fresh,true);assert.equal(f.s.rows.size,2);
 await f.model.complete({issuanceKey:intent.issuanceKey,...identity,claimFence:m.claimFence});
 const taskIdentity={...identity,grantId:id(21),materialRef:'material:'+intent.issuanceKey};const task=await f.task.complete({issuanceKey:intent.issuanceKey,...taskIdentity});assert.equal(task.materialRef,taskIdentity.materialRef);
 const bound=await f.task.bindFacts({issuanceKey:intent.issuanceKey,factsSha256:'e'.repeat(64)});assert.equal(bound.factsSha256,'e'.repeat(64));
 assert.equal((await f.model.read({issuanceKey:intent.issuanceKey})).factsSha256,undefined);assert.equal((await f.model.read({issuanceKey:intent.issuanceKey})).grantId,id(20));
});
test('model completion requires original claim fence and version CAS, then refuses identity/intent/ref/expiry changes',async()=>{
 const f=sqlFixture(),row=await f.model.claim(intent),v={issuanceKey:intent.issuanceKey,...identity,claimFence:row.claimFence};
 await assert.rejects(f.model.complete({issuanceKey:intent.issuanceKey,...identity}),/ISSUANCE_STORE_INVALID/);
 await assert.rejects(f.model.complete({...v,claimFence:id(999)}),/ISSUANCE_STORE_CLAIM_FENCED/);
 await assert.rejects(f.model.complete({...v,materialRef:'material:'+intent.issuanceKey}),/ISSUANCE_STORE_INVALID/);
 const done=await f.model.complete(v);assert.deepEqual(await f.model.complete(v),done);
 const update=f.s.calls.find(c=>c.sql.includes("SET state='ISSUED'"));assert.match(update.sql,/version=\$5 AND claim_fence=\$6/u);assert.equal(update.p[5],row.claimFence);
 await assert.rejects(f.model.complete({...v,grantId:id(22)}),/ISSUANCE_STORE_ISSUED_CONFLICT/);
 for(const i of [{...intent,expiresAtMs:intent.expiresAtMs+1},{...intent,requestSha256:'b'.repeat(64)}])await assert.rejects(f.model.claim(i),/ISSUANCE_STORE_INTENT_CONFLICT/);
});
test('model compare-and-set race cannot complete over a changed version',async()=>{
 const f=sqlFixture(),row=await f.model.claim(intent);f.s.race=true;await assert.rejects(f.model.complete({issuanceKey:intent.issuanceKey,...identity,claimFence:row.claimFence}),/ISSUANCE_STORE_UNAVAILABLE/);
 assert.equal((await f.model.read({issuanceKey:intent.issuanceKey})).state,'CLAIMED');
});
test('model terminal replay requires the original claim fence even for the identical issued identity',async()=>{
 const f=sqlFixture(),row=await f.model.claim(intent),v={issuanceKey:intent.issuanceKey,...identity,claimFence:row.claimFence};
 const retained=await f.model.complete(v),updates=f.s.calls.filter(c=>c.sql.startsWith('UPDATE')).length;
 await assert.rejects(f.model.complete({...v,claimFence:id(998)}),/ISSUANCE_STORE_CLAIM_FENCED/);
 assert.deepEqual(await f.model.complete(v),retained);assert.equal(f.s.calls.filter(c=>c.sql.startsWith('UPDATE')).length,updates);
 assert.equal((await f.model.read({issuanceKey:intent.issuanceKey})).grantId,retained.grantId);
});
for(const boundary of ['claim','complete'])test('canonical issuer over scripted model SQL handles '+boundary+' lost ACK without second material',async()=>{
 const f=sqlFixture();f.s[boundary==='claim'?'loseClaim':'loseComplete']=true;let generated=0;const capability='synthetic-model-opaque-'+intent.issuanceKey;
 const authority=createModelMaterialAuthority({authority:{async generate(){generated++;assert.equal((await f.model.read({issuanceKey:intent.issuanceKey})).state,'CLAIMED');return {grantId:id(30),capability,materialRef:'material:'+intent.issuanceKey};},async retrieve(){return {state:'PRESENT',capability};},async status(){throw Error('no generation/reconcile on uncertainty');}}});
 const create=()=>createModelGrantIssuer({store:createPostgresModelGrantStore({pool:f.pool}),authority,now:()=>at,maxRequestMs:30});
 if(boundary==='claim'){await assert.rejects(create().issue({intent}),/MODEL_GRANT_UNKNOWN/);await assert.rejects(create().issue({intent}),/MODEL_GRANT_UNKNOWN/);assert.equal(generated,0);}
 else{const a=await create().issue({intent}),b=await create().issue({intent});assert.deepEqual(a,b);assert.equal(generated,1);assert.equal(a.capabilitySha256,capabilityDigest(capability));assert.ok(!JSON.stringify([...f.s.rows]).includes(capability));}
});
test('allocated model DDL fixes namespace, purpose, immutable intent/fence/identity and non-reusable keys without execution',()=>{
 const sql=readFileSync(new URL('../../control/conversations/migrations/0015_model_run_issuance.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE meri_conversations\.model_run_issuances/u);assert.match(sql,/model-material:v1:/u);assert.match(sql,/BEFORE UPDATE OR DELETE/u);assert.match(sql,/NEW\.version <> OLD\.version \+ 1/u);
 for(const name of ['issuance_key','tenant_id','conversation_id','run_id','binding','binding_sha256','request_sha256','expires_at_ms','claim_fence','claimed_at']){assert.ok(sql.includes('NEW.'+name));assert.ok(sql.includes('OLD.'+name));}
 assert.doesNotMatch(sql,/\bCREATE\s+(?:ROLE|EXTENSION)|\bGRANT\s|\bpublic\.|\bIF NOT EXISTS\b/iu);assert.doesNotMatch(sql,/^\s*(?:INSERT INTO|DELETE FROM)/imu);
});
