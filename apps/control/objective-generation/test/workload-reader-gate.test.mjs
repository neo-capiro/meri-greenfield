/** Synthetic RFC8032 test-vector signatures only; no issued product credential. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createPrivateKey,createPublicKey,sign} from 'node:crypto';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createObjectiveRetainedReaderGate,objectiveRetainedReadRoute} from '../workload-reader-gate.mjs';

const privateKey=createPrivateKey({key:Buffer.from('302e020100300506032b6570042204209d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60','hex'),format:'der',type:'pkcs8'});
const publicKey=createPublicKey(privateKey).export({format:'jwk'});
const at=1760650000000,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const binding=()=>({tenantId:id(1),actorId:'user_synthetic_clerk',conversationId:id(2),runId:id(3),attemptId:id(4),workerId:id(5),writerFence:1});
const source=()=>({generationJobId:id(6),binding:binding(),sourceAdmissionSha256:'a'.repeat(64)});
const body=()=>Buffer.from(JSON.stringify({schemaVersion:1,source:source()}));
function signed(bytes,overrides={}){
 const header={alg:'EdDSA',kid:'test-key',typ:'JWT',...overrides.header};
 const claims={iss:'https://issuer.synthetic.invalid',sub:'capiro-objective-core-result-reader:v1',aud:'meri-objective-private:v1',
  iat:Math.floor(at/1000),nbf:Math.floor(at/1000),exp:Math.floor(at/1000)+30,jti:id(7),
  objective:{operation:'objective.retained-result.read',phase:'retained-result-read',method:'POST',path:objectiveRetainedReadRoute,query:'',
   bodySha256:hash(bytes),sourceSha256:canonicalSha256(source()),generationJobId:source().generationJobId,...overrides.objective},...overrides.claims};
 const payload=[header,claims].map(value=>Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
 return payload+'.'+sign(null,Buffer.from(payload),privateKey).toString('base64url');
}
function fixture(changes={}){
 const state={effects:0,current:0,revoked:false,ownerAvailable:true,resultHook:null,entries:new Map()};
 const current={async assertCurrent({source:given}){state.current++;return !state.revoked&&canonicalSha256(given)===canonicalSha256(source());}};
 const idempotency={async runOnce({identity},effect){
  const prior=state.entries.get(identity.tokenId);
  if(prior){if(prior.fingerprint!==canonicalSha256(identity))throw Error('JTI_CONFLICT');return {status:'replayed',value:await prior.result};}
  const entry={fingerprint:canonicalSha256(identity),result:Promise.resolve().then(effect)};
  state.entries.set(identity.tokenId,entry);return {status:'executed',value:await entry.result};
 }};
 const resultOwner={available(){return state.ownerAvailable;},async read(given){state.effects++;assert.equal(canonicalSha256(given),canonicalSha256(source()));
  return state.resultHook?.()??{generationJobId:source().generationJobId,retained:'synthetic-only'};}};
 const config={enabled:true,issuer:'https://issuer.synthetic.invalid',audience:'meri-objective-private:v1',
  subject:'capiro-objective-core-result-reader:v1',trustedKeys:{'test-key':publicKey},source:source(),current,idempotency,resultOwner,now:()=>at,...changes};
 const gate=createObjectiveRetainedReaderGate(config),bytes=body();
 const request=(token=signed(bytes),rawBody=bytes,target=objectiveRetainedReadRoute)=>({authorization:'Bearer '+token,method:'POST',target,rawBody});
 return {gate,state,bytes,request};
}
const denied=error=>error.code==='OBJECTIVE_WORKLOAD_UNAVAILABLE';

test('fixed issuer and route allow one current retained read; same signed request replays prior result',async()=>{
 const f=fixture();assert.equal(f.gate.available(),true);
 const [first,second]=await Promise.all([f.gate.read(f.request()),f.gate.read(f.request())]);
 assert.deepEqual(first,second);assert.equal(f.state.effects,1);assert.ok(f.state.current>=4);
 assert.deepEqual(await f.gate.read(f.request()),first);assert.equal(f.state.effects,1);
 f.state.revoked=true;await assert.rejects(f.gate.read(f.request()),denied);assert.equal(f.state.effects,1);
});

test('exact wire bytes, route, query, and operation are bound before current access',async()=>{
 const f=fixture(),cases=[
  f.request(signed(f.bytes),Buffer.from(f.bytes.toString()+' ')),
  f.request(signed(f.bytes),f.bytes,objectiveRetainedReadRoute+'?x=1'),
  f.request(signed(f.bytes,{objective:{path:'/v1/internal/other'}})),
  f.request(signed(f.bytes,{objective:{method:'GET'}})),
  f.request(signed(f.bytes,{objective:{phase:'generation-accept'}})),
  f.request(signed(f.bytes,{objective:{sourceSha256:'b'.repeat(64)}})),
 ];
 for(const request of cases)await assert.rejects(f.gate.read(request),denied);
 assert.equal(f.state.current,0);assert.equal(f.state.effects,0);
});

test('fixed issuer-qualified identity and bounded times reject substitute claims',async()=>{
 const f=fixture(),cases=[{iss:'https://foreign.invalid'},{aud:'core-objective-private:v1'},{sub:'ordinary-user'},
  {iat:Math.floor(at/1000)+1},{nbf:Math.floor(at/1000)+1},{exp:Math.floor(at/1000)},
  {exp:Math.floor(at/1000)+61},{jti:''},{jti:'x'}];
 for(const claims of cases)await assert.rejects(f.gate.read(f.request(signed(f.bytes,{claims}))),denied);
 assert.equal(f.state.current,0);
});

test('unknown rotation key, token key URL, altered signature and private-key config fail closed',async()=>{
 const f=fixture();
 for(const token of [signed(f.bytes,{header:{kid:'unknown'}}),signed(f.bytes,{header:{jku:'https://attacker.invalid/key'}}),
  signed(f.bytes).slice(0,-1)+(signed(f.bytes).at(-1)==='A'?'B':'A')])await assert.rejects(f.gate.read(f.request(token)),denied);
 const disabled=fixture({trustedKeys:{'test-key':{...publicKey,d:'private-not-allowed'}}});
 assert.equal(disabled.gate.available(),false);await assert.rejects(disabled.gate.read(disabled.request()),denied);
 assert.equal(f.state.current,0);
});

test('missing current authority or durable replay port disables only this Objective gate',async()=>{
 for(const change of [{enabled:false},{source:null},{current:null},{idempotency:null},{resultOwner:null},{trustedKeys:{}}]){
  const f=fixture(change);assert.equal(f.gate.available(),false);await assert.rejects(f.gate.read(f.request()),denied);
 }
});

test('retained result owner readiness controls availability and prevents replay release',async()=>{
 const f=fixture();f.state.ownerAvailable=false;
 assert.equal(f.gate.available(),false);await assert.rejects(f.gate.read(f.request()),denied);
 assert.equal(f.state.current,0);assert.equal(f.state.effects,0);
 f.state.ownerAvailable=true;assert.equal(f.gate.available(),true);await f.gate.read(f.request());
 f.state.ownerAvailable=false;assert.equal(f.gate.available(),false);
 await assert.rejects(f.gate.read(f.request()),denied);assert.equal(f.state.effects,1);
});

test('valid signed request for another source is refused before current or retained reads',async()=>{
 const f=fixture();
 const other=Buffer.from(JSON.stringify({schemaVersion:1,source:{...source(),sourceAdmissionSha256:'b'.repeat(64)}}));
 const token=signed(other,{objective:{sourceSha256:canonicalSha256(JSON.parse(other).source)}});
 await assert.rejects(f.gate.read(f.request(token,other)),denied);
 assert.equal(f.state.current,0);assert.equal(f.state.effects,0);
});

test('same jti with another valid signed token conflicts despite identical body and scope',async()=>{
 const f=fixture();await f.gate.read(f.request());
 const second=signed(f.bytes,{claims:{nbf:Math.floor(at/1000)-1}});
 await assert.rejects(f.gate.read(f.request(second)),denied);
 assert.equal(f.state.effects,1);assert.equal(f.state.entries.size,1);
});

test('same jti on differently transmitted bytes cannot invoke a second effect',async()=>{
 const f=fixture();await f.gate.read(f.request());
 const other=Buffer.from(JSON.stringify({schemaVersion:1,source:source()},null,1));
 const changed=signed(other);
 await assert.rejects(f.gate.read(f.request(changed,other)),denied);
 assert.equal(f.state.effects,1);
});

test('revocation after a retained read starts withholds the reply',async()=>{
 const f=fixture();
 f.state.resultHook=()=>{f.state.revoked=true;return {retained:'synthetic-only'};};
 await assert.rejects(f.gate.read(f.request()),denied);
 assert.equal(f.state.effects,1);
});
