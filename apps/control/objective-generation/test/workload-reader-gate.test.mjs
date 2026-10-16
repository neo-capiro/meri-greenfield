/** Disposable RSA fixture only. No issued Objective credential or product key. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,constants,sign} from 'node:crypto';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createObjectiveRetainedReaderGate,objectiveRetainedReadRoute} from '../workload-reader-gate.mjs';

const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:3072});
const other=generateKeyPairSync('rsa',{modulusLength:3072});
const at=1800000000000,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const binding=()=>({tenantId:id(1),actorId:'user_synthetic_clerk',conversationId:id(2),runId:id(3),attemptId:id(4),workerId:id(5),writerFence:1});
const source=()=>({generationJobId:id(6),binding:binding(),sourceAdmissionSha256:'a'.repeat(64)});
const body=(s=source())=>Buffer.from(JSON.stringify({schemaVersion:1,source:s}));
const header=(changes={})=>({alg:'RS256',typ:'capiro-objective-workload+jwt',kid:'fixture-core-rsa-1',...changes});
function claims(bytes=body(),changes={}){return {
 iss:'urn:capiro:objective:core-reader-issuer:v1',sub:'capiro-objective-core-result-reader:v1',
 aud:'capiro:objective-meri-retained-result:v1',iat:at/1000,nbf:at/1000,exp:at/1000+30,jti:id(9),
 method:'POST',path:objectiveRetainedReadRoute,query:'',bodySha256:hash(bytes),
 operation:'objective.retained-result.read',phase:'retained-result-read',tenantId:id(1),generationJobId:id(6),
 delegationRef:id(7),consentId:id(8),attemptId:id(4),runId:id(3),
 acceptedBindingSha256:canonicalSha256(binding()),sourceSha256:canonicalSha256(source()),...changes,
};}
function signedSegments(h,p){
 const head=Buffer.isBuffer(h)?h.toString('base64url'):h;
 const payload=Buffer.isBuffer(p)?p.toString('base64url'):p;
 const input=head+'.'+payload;
 return input+'.'+sign('RSA-SHA256',Buffer.from(input,'ascii'),
  {key:privateKey,padding:constants.RSA_PKCS1_PADDING}).toString('base64url');
}
function signed(bytes=body(),changes={}){
 return signedSegments(Buffer.from(JSON.stringify(header(changes.header))),
  Buffer.from(JSON.stringify(claims(bytes,changes.claims))));
}
function fixture(changes={}){
 const state={effects:0,current:0,runOnceCalls:0,jtiConflicts:0,revoked:false,currentError:false,ownerAvailable:true,
  resultHook:null,runOnceMode:'normal',entries:new Map()};
 const current={async assertCurrent({source:given,identity}){
  state.current++;
  if(state.currentError)throw Error('CURRENT_AUTHORITY_UNAVAILABLE');
  return !state.revoked&&canonicalSha256(given)===canonicalSha256(source())&&
   identity.delegationRef===id(7)&&identity.consentId===id(8)&&
   identity.acceptedBindingSha256===canonicalSha256(binding())&&identity.resultOwnerId==='fixture-retained-owner';
 }};
 const idempotency={async runOnce({identity},effect){
  state.runOnceCalls++;
  const replayKey=[identity.issuer,identity.subject,identity.tokenId].join('\0');
  const prior=state.entries.get(replayKey);
  if(prior){
   if(prior.fingerprint!==canonicalSha256(identity)){state.jtiConflicts++;throw Error('JTI_CONFLICT');}
   if(prior.status!=='done')throw Error('REPLAY_UNKNOWN');
   return {status:'replayed',value:await prior.result};
  }
  const entry={fingerprint:canonicalSha256(identity),status:'pending'};
  state.entries.set(replayKey,entry);
  if(state.runOnceMode==='unknown-before'){entry.status='unknown';throw Error('COMMIT_UNKNOWN');}
  entry.result=Promise.resolve().then(effect);
  if(state.runOnceMode==='unknown-after'){
   await entry.result;entry.status='unknown';throw Error('COMMIT_UNKNOWN');
  }
  const value=await entry.result;entry.status='done';return {status:'executed',value};
 }};
 const resultOwner={available(){return state.ownerAvailable;},async read(given){
  state.effects++;assert.equal(canonicalSha256(given),canonicalSha256(source()));
  return state.resultHook?.()??{generationJobId:id(6),retained:'synthetic-only'};
 }};
 const config={enabled:true,issuer:'urn:capiro:objective:core-reader-issuer:v1',
  audience:'capiro:objective-meri-retained-result:v1',subject:'capiro-objective-core-result-reader:v1',
  trustedKeys:{'fixture-core-rsa-1':publicKey},source:source(),resultOwnerId:'fixture-retained-owner',
  current,idempotency,resultOwner,now:()=>at,...changes};
 const gate=createObjectiveRetainedReaderGate(config),bytes=body();
 const request=(token=signed(bytes),rawBody=bytes,target=objectiveRetainedReadRoute,method='POST')=>
  ({authorization:'Bearer '+token,method,target,rawBody});
 return {gate,state,bytes,request};
}
const denied=error=>error.code==='OBJECTIVE_WORKLOAD_UNAVAILABLE';

test('shared candidate source and full accepted binding digests match the golden vector',()=>{
 const bytes=body(),c=claims(bytes);
 assert.equal(bytes.toString(),'{"schemaVersion":1,"source":{"generationJobId":"'+id(6)+'","binding":'+JSON.stringify(binding())+',"sourceAdmissionSha256":"'+'a'.repeat(64)+'"}}');
 assert.equal(c.bodySha256,'9bfacc0fb70261356d723e038c317c76499c385f422691330ddce74fddb80f7c');
 assert.equal(c.sourceSha256,'292fce5b4e5d89233fe20998076a26c89efdc354d9d776aa03e5f5370dc0c651');
 assert.equal(c.acceptedBindingSha256,'f73a2e7ccef63ca74a064f77b6437004ba74cf6b6e388303bab115f6a93d42bb');
});

test('fixed current source allows one read; exact signed replay releases saved result once',async()=>{
 const f=fixture();assert.equal(f.gate.available(),true);
 const token=signed(f.bytes),first=await f.gate.read(f.request(token)),second=await f.gate.read(f.request(token));
 assert.deepEqual(first,second);assert.equal(f.state.effects,1);assert.equal(f.state.runOnceCalls,2);
 assert.deepEqual(await f.gate.read(f.request(token)),first);assert.equal(f.state.effects,1);
 f.state.revoked=true;await assert.rejects(f.gate.read(f.request(token)),denied);
 assert.equal(f.state.effects,1);
});

test('an identical token while the first retained read is pending is unavailable',async()=>{
 const f=fixture(),token=signed(f.bytes);let started,release;
 const didStart=new Promise(resolve=>{started=resolve;});
 f.state.resultHook=()=>{started();return new Promise(resolve=>{release=resolve;});};
 const first=f.gate.read(f.request(token));await didStart;
 await assert.rejects(f.gate.read(f.request(token)),denied);
 assert.equal(f.state.effects,1);
 release({retained:'synthetic-only'});await first;
 assert.equal(f.state.effects,1);
});

test('route, transmitted body, complete source, and fixed accepted fields deny before current access',async()=>{
 const f=fixture(),other={...source(),binding:{...binding(),writerFence:2}};
 const otherBytes=body(other);
 const cases=[
  f.request(signed(f.bytes),Buffer.from(f.bytes.toString()+' ')),
  f.request(signed(f.bytes),f.bytes,objectiveRetainedReadRoute+'?x=1'),
  f.request(signed(f.bytes),f.bytes,objectiveRetainedReadRoute,'GET'),
  f.request(signed(otherBytes,{claims:{bodySha256:hash(otherBytes),sourceSha256:canonicalSha256(other),
   acceptedBindingSha256:canonicalSha256(other.binding)}}),otherBytes),
  ...[{method:'GET'},{path:'/v1/internal/other'},{query:'x=1'},{operation:'objective.strategy.draft'},
   {phase:'accept'},{bodySha256:'b'.repeat(64)},{sourceSha256:'b'.repeat(64)},
   {tenantId:id(10)},{generationJobId:id(10)},{runId:id(10)},{attemptId:id(10)},
   {acceptedBindingSha256:'b'.repeat(64)}].map(change=>f.request(signed(f.bytes,{claims:change}))),
 ];
 for(const request of cases)await assert.rejects(f.gate.read(request),denied);
 assert.equal(f.state.current,0);assert.equal(f.state.runOnceCalls,0);assert.equal(f.state.effects,0);
});

test('current authority independently denies revoked membership and foreign delegation or consent',async()=>{
 const f=fixture();f.state.revoked=true;
 await assert.rejects(f.gate.read(f.request()),denied);
 assert.equal(f.state.current,1);assert.equal(f.state.runOnceCalls,0);
 f.state.revoked=false;
 for(const change of [{delegationRef:id(10)},{consentId:id(10)}])
  await assert.rejects(f.gate.read(f.request(signed(f.bytes,{claims:change}))),denied);
 assert.equal(f.state.current,3);assert.equal(f.state.runOnceCalls,0);assert.equal(f.state.effects,0);
});

test('current authority outage denies before replay admission or owner read',async()=>{
 const f=fixture();f.state.currentError=true;
 await assert.rejects(f.gate.read(f.request()),denied);
 assert.equal(f.state.current,1);assert.equal(f.state.runOnceCalls,0);assert.equal(f.state.effects,0);
});

test('issuer, named subject/audience, bounded seconds, and UUIDv4 reject substitutes before current access',async()=>{
 const f=fixture(),cases=[{iss:'urn:capiro:other:v1'},{sub:'capiro-objective-generation-worker:v1'},
  {aud:'capiro:objective-strategy-api:v1'},{iat:at/1000+1},{nbf:at/1000+1},
  {exp:at/1000},{exp:at/1000+61},{jti:id(9).replace('-4000-','-1000-')},{jti:''}];
 for(const change of cases)await assert.rejects(f.gate.read(f.request(signed(f.bytes,{claims:change}))),denied);
 assert.equal(f.state.current,0);assert.equal(f.state.effects,0);
});

test('same jti with another valid signed token reaches durable fingerprint conflict',async()=>{
 const f=fixture();await f.gate.read(f.request());
 const second=signed(f.bytes,{claims:{exp:at/1000+29}});
 await assert.rejects(f.gate.read(f.request(second)),denied);
 assert.equal(f.state.runOnceCalls,2,'the valid second token reached runOnce');
 assert.equal(f.state.jtiConflicts,1,'runOnce rejected the changed signed-token fingerprint');
 assert.equal(f.state.effects,1);assert.equal(f.state.entries.size,1);
});

test('UNKNOWN before or after owner work never releases a result or retries an owner callback',async()=>{
 for(const mode of ['unknown-before','unknown-after']){
  const f=fixture();f.state.runOnceMode=mode;const token=signed(f.bytes);
  await assert.rejects(f.gate.read(f.request(token)),denied);
  const expected=mode==='unknown-before'?0:1;
  assert.equal(f.state.effects,expected);
  await assert.rejects(f.gate.read(f.request(token)),denied);
  assert.equal(f.state.effects,expected);assert.equal(f.state.runOnceCalls,2);
 }
});

test('unknown retained custody after a valid read is unavailable on identical replay',async()=>{
 const f=fixture(),token=signed(f.bytes);
 f.state.resultHook=()=>{throw Error('RETAINED_CUSTODY_UNKNOWN');};
 await assert.rejects(f.gate.read(f.request(token)),denied);
 assert.equal(f.state.current,2);assert.equal(f.state.runOnceCalls,1);assert.equal(f.state.effects,1);
 await assert.rejects(f.gate.read(f.request(token)),denied);
 assert.equal(f.state.current,3);assert.equal(f.state.runOnceCalls,2);assert.equal(f.state.effects,1);
});

test('missing current authority, owner, replay port, or pinned RSA key disables only this gate',async()=>{
 for(const change of [{enabled:false},{source:null},{current:null},{idempotency:null},
  {resultOwner:null},{resultOwnerId:null},{trustedKeys:{}},{trustedKeys:{'fixture-core-rsa-1':privateKey}},
  {audience:'other'},{subject:'other'}]){
  const f=fixture(change);assert.equal(f.gate.available(),false);await assert.rejects(f.gate.read(f.request()),denied);
 }
 const f=fixture();f.state.ownerAvailable=false;
 await assert.rejects(f.gate.read(f.request()),denied);
 assert.equal(f.state.current,0);assert.equal(f.state.runOnceCalls,0);
});

test('revocation during read or before a replay reply withholds the result',async()=>{
 const f=fixture();f.state.resultHook=()=>{f.state.revoked=true;return {retained:'synthetic-only'};};
 await assert.rejects(f.gate.read(f.request()),denied);assert.equal(f.state.effects,1);
 const g=fixture();const token=signed(g.bytes);await g.gate.read(g.request(token));
 g.state.revoked=true;await assert.rejects(g.gate.read(g.request(token)),denied);
 assert.equal(g.state.effects,1);
});

test('canonical RSA header, flat payload, UTF-8, signature and size guards reject before callbacks',async()=>{
 const f=fixture(),good=signed(f.bytes),[h,p,sig]=good.split('.');
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
 assert.equal(h.length%4,3,'the fixture header has two unused base64url pad bits');
 const finalIndex=alphabet.indexOf(h.at(-1));
 const noncanonicalHeader=h.slice(0,-1)+alphabet[finalIndex+1];
 assert.notEqual(noncanonicalHeader,h);
 assert.deepEqual(Buffer.from(noncanonicalHeader,'base64url'),Buffer.from(h,'base64url'));
 const alternateHeader=Buffer.from(JSON.stringify({kid:'fixture-core-rsa-1',alg:'RS256',typ:'capiro-objective-workload+jwt'}));
 const baseClaims=claims(f.bytes),{iss,sub,aud,...rest}=baseClaims;
 const alternatePayload=Buffer.from(JSON.stringify({sub,iss,aud,...rest}));
 const malformed=[
  signed(f.bytes,{header:{alg:'EdDSA'}}),signed(f.bytes,{header:{typ:'JWT'}}),
  signed(f.bytes,{header:{kid:'unknown'}}),signed(f.bytes,{header:{jku:'https://invalid.test/key'}}),
  signed(f.bytes,{claims:{extra:'x'}}),
  signedSegments(alternateHeader,Buffer.from(JSON.stringify(baseClaims))),
  signedSegments(Buffer.from(JSON.stringify(header())),alternatePayload),
  signedSegments(Buffer.from([0xff]),Buffer.from(JSON.stringify(baseClaims))),
  signedSegments(Buffer.from(JSON.stringify(header())),Buffer.from([0xff])),
  signedSegments(h+'=',p),signedSegments(h,p+'='),signedSegments(noncanonicalHeader,p),
  signedSegments(Buffer.from(JSON.stringify({...header(),extra:'x'.repeat(1100)})),Buffer.from(JSON.stringify(baseClaims))),
  signedSegments(Buffer.from(JSON.stringify(header())),Buffer.from(JSON.stringify({...baseClaims,extra:'x'.repeat(4100)}))),
  signedSegments(Buffer.from(JSON.stringify({...header(),extra:'x'.repeat(800)})),
   Buffer.from(JSON.stringify({...baseClaims,extra:'x'.repeat(2200)}))),
  h+'.'+p+'.'+sig.slice(0,-1)+(sig.at(-1)==='A'?'B':'A'),
  good+'A'.repeat(8200),
 ];
 for(const token of malformed)await assert.rejects(f.gate.read(f.request(token)),denied);
 const duplicatePayload=Buffer.from(JSON.stringify(baseClaims).replace(/\}$/u,`,"jti":"${id(10)}"}`));
 await assert.rejects(f.gate.read(f.request(signedSegments(h,duplicatePayload))),denied);
 await assert.rejects(f.gate.read(f.request(signed(f.bytes),Buffer.concat([f.bytes,Buffer.alloc(65537)]))),denied);
 assert.equal(f.state.current,0);assert.equal(f.state.runOnceCalls,0);assert.equal(f.state.effects,0);
 const wrong=fixture({trustedKeys:{'fixture-core-rsa-1':other.publicKey}});
 await assert.rejects(wrong.gate.read(wrong.request()),denied);
 assert.equal(wrong.state.current,0);
});
