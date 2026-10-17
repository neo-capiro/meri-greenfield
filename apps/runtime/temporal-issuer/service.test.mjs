import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import {X509Certificate,createHash,generateKeyPairSync,sign as rsaSign} from 'node:crypto';
import {rootCertificates} from 'node:tls';
import {createTemporalIssuerService,parseTemporalIssuerServiceConfiguration} from './service.mjs';
import {verifyTemporalIssuerToken} from './protocol.mjs';

const ORIGIN='https://issuer.meri.internal';
const IDENTITY=Object.freeze({role:'control',subject:'meri-temporal-control:v1',workloadPrincipal:'meri-workload-control:v1'});
const CONFIG=Object.freeze({schemaVersion:1,issuerOrigin:ORIGIN,kid:'test-rotation-1',namespace:'meri',
 audience:'meri-temporal',maxRequestMs:1000,bootstrapMaxRequestMs:4000,
 maxBodyBytes:4096,currentnessLeaseMs:10000});
const NOW=1792240496000;
const PEER={raw:Buffer.from('test-certificate'),fingerprint256:'AA:'.repeat(31)+'AA'};
const REQUEST={schemaVersion:1,...IDENTITY,namespace:'meri',audience:'meri-temporal',issuer:ORIGIN+'/'};
const TEST_CERT=rootCertificates[0];
const TEST_CERT_SHA=createHash('sha256').update(new X509Certificate(TEST_CERT).raw).digest('hex');
const registration=taskArn=>({schemaVersion:1,state:'CURRENT',certificateSha256:TEST_CERT_SHA,role:'control',
 peerSanUri:'spiffe://meri.internal/service/control/'+encodeURIComponent(taskArn),
 taskArn,revision:'revision-1',expiresAtMs:NOW+10000});

function fixture(){
 const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,publicExponent:0x10001});
 const publicJwk=Object.freeze({...publicKey.export({format:'jwk'}),kid:CONFIG.kid,alg:'RS256',use:'sig'});
 const sign=(bytes)=>rsaSign('sha256',bytes,privateKey);
 return {publicJwk,sign};
}
function request({method='POST',url='/v1/internal/temporal/token/read',body=REQUEST,authorized=true,
  contentType='application/json',encrypted=true,remoteAddress='10.0.1.4',raw}={}){
 const bytes=Buffer.from(raw??JSON.stringify(body));
 const stream=Readable.from(method==='GET'?[]:[bytes]);
 stream.method=method;stream.url=url;stream.headers={'content-type':contentType,
  ...(method==='GET'?{}:{'content-length':String(bytes.length)})};
 stream.socket={encrypted,authorized,remoteAddress,getPeerCertificate:()=>PEER};
 return stream;
}
function response(){
 const value=new EventEmitter();value.headersSent=false;value.writableEnded=false;
 value.writeHead=(status,headers)=>{value.status=status;value.headers=headers;value.headersSent=true;};
 value.end=bytes=>{value.bytes=bytes;value.writableEnded=true;value.emit('finish');};
 return value;
}
function body(response){return JSON.parse(response.bytes.toString('utf8'));}
function current(revision='revision-1'){
 return {state:'CURRENT',identity:IDENTITY,observedAtMs:NOW,validUntilMs:NOW+9000,revision};
}
function create({facts=[current(),current()],sign:signOverride,bootstrapOwner,now=()=>NOW}={}){
 const keys=fixture();let calls=0,signCalls=0;
 const authority={async readCurrent({peer,identity}){
  assert.equal(peer.authorized,true);assert.equal(peer.certificate,PEER);assert.deepEqual(identity,IDENTITY);
  return facts[Math.min(calls++,facts.length-1)];
 }};
 const service=createTemporalIssuerService({configuration:CONFIG,taskAuthority:authority,
  sign:(bytes,context)=>{signCalls++;return signOverride?signOverride(bytes,context):keys.sign(bytes);},
  publicJwk:keys.publicJwk,bootstrapOwner,now});
 return {...keys,service,calls:()=>calls,signCalls:()=>signCalls};
}

test('closed configuration requires a bare HTTPS issuer origin and bounded currentness',()=>{
 assert.equal(parseTemporalIssuerServiceConfiguration(CONFIG).issuerOrigin,ORIGIN);
 assert.throws(()=>parseTemporalIssuerServiceConfiguration({...CONFIG,issuerOrigin:ORIGIN+'/'}));
 assert.throws(()=>parseTemporalIssuerServiceConfiguration({...CONFIG,issuerOrigin:'http://issuer.meri.internal'}));
 assert.throws(()=>parseTemporalIssuerServiceConfiguration({...CONFIG,currentnessLeaseMs:1000}));
 const {bootstrapMaxRequestMs,...withoutBootstrapBudget}=CONFIG;
 assert.throws(()=>parseTemporalIssuerServiceConfiguration(withoutBootstrapBudget));
 assert.throws(()=>parseTemporalIssuerServiceConfiguration({...CONFIG,bootstrapMaxRequestMs:2999}));
 assert.throws(()=>parseTemporalIssuerServiceConfiguration({...CONFIG,bootstrapMaxRequestMs:15000}));
 assert.equal(parseTemporalIssuerServiceConfiguration({...CONFIG,bootstrapMaxRequestMs:14000}).bootstrapMaxRequestMs,14000);
 assert.throws(()=>parseTemporalIssuerServiceConfiguration({...CONFIG,unreviewed:true}));
});

test('GET JWKS is public and exact; token POST requires authorized TLS peer',async()=>{
 const f=create();const jwks=response();await f.service.handle(request({method:'GET',url:'/.well-known/jwks.json'}),jwks);
 assert.equal(jwks.status,200);assert.deepEqual(body(jwks),{keys:[f.publicJwk]});
 assert.equal(jwks.headers['Cache-Control'],'no-store');assert.equal(f.calls(),0);
 const unauthorized=response();await f.service.handle(request({authorized:false}),unauthorized);
 assert.equal(unauthorized.status,401);assert.equal(f.calls(),0);assert.equal(f.signCalls(),0);
 const query=response();await f.service.handle(request({method:'GET',url:'/.well-known/jwks.json?x=1'}),query);
 assert.equal(query.status,404);
 await f.service.close();
});

test('CURRENT token is issued only after two fresh current-task reads, with exact issuer and namespace Writer claim',async()=>{
 const f=create();const result=response();await f.service.handle(request(),result);
 assert.equal(result.status,200);assert.equal(result.headers['Cache-Control'],'no-store');
 assert.equal(f.calls(),2);assert.equal(f.signCalls(),1);
 const issued=body(result);assert.equal(issued.state,'CURRENT');
 assert.deepEqual(issued.identity,IDENTITY);assert.equal(issued.validUntilMs,issued.token.expiresAtMs);
 assert.deepEqual(issued.token.claims,{namespace:'meri',audience:'meri-temporal',issuer:ORIGIN+'/'});
 const claims=verifyTemporalIssuerToken({token:issued.token.token,issuerOrigin:ORIGIN,
  kid:CONFIG.kid,publicJwk:f.publicJwk,role:IDENTITY.role,subject:IDENTITY.subject,audience:'meri-temporal',namespace:'meri',nowMs:NOW});
 assert.equal(claims.iss,ORIGIN+'/');assert.deepEqual(claims.permissions,['meri:write']);
 await f.service.close();
});

test('a second-read revocation withholds the signed token and reports no current lease',async()=>{
 const f=create({facts:[current(),{state:'REVOKED',identity:IDENTITY,observedAtMs:NOW,validUntilMs:null}]});
 const result=response();await f.service.handle(request(),result);
 assert.equal(f.calls(),2);assert.equal(f.signCalls(),1);assert.equal(result.status,200);
 assert.deepEqual(body(result),{schemaVersion:1,state:'REVOKED',identity:IDENTITY,
  observedAtMs:NOW,validUntilMs:null,token:null});
 await f.service.close();
});

test('a changed current-task revision, signer failure, and stale lease fail closed',async()=>{
 for(const setup of [
  {facts:[current('first'),current('second')]},
  {sign:()=>{throw Error('external signer unavailable');}},
  {facts:[{...current(),validUntilMs:NOW+500},current()]},
  {facts:[current(),{...current(),validUntilMs:NOW+2000}]},
 ]){
  const f=create(setup),result=response();await f.service.handle(request(),result);
  assert.equal(result.status,200);assert.equal(body(result).state,'UNAVAILABLE');
  assert.equal(body(result).token,null);await f.service.close();
 }
});

test('closing during an unsettled signing operation aborts and never releases its later token',async()=>{
 let begin,finish;const started=new Promise(resolve=>{begin=resolve;});
 const suspended=new Promise(resolve=>{finish=resolve;});
 const keys=fixture();let authorityReads=0;
 const service=createTemporalIssuerService({configuration:CONFIG,publicJwk:keys.publicJwk,now:()=>NOW,
  taskAuthority:{async readCurrent(){authorityReads++;return current();}},
  sign:async bytes=>{begin();await suspended;return keys.sign(bytes);}});
 const result=response();const handling=service.handle(request(),result);
 await started;await service.close();
 assert.equal(result.status,503);assert.equal(body(result).error,'TEMPORAL_ISSUER_REFUSED');
 finish();await handling;
 assert.equal(authorityReads,1);assert.equal(result.status,503);
 assert.equal(service.available(),false);
});

test('an authority port that never settles is bounded by the service deadline',async()=>{
 const keys=fixture();let signCalls=0;
 const service=createTemporalIssuerService({configuration:{...CONFIG,maxRequestMs:5},
  publicJwk:keys.publicJwk,now:()=>NOW,
  taskAuthority:{readCurrent:()=>new Promise(()=>{})},
  sign:bytes=>{signCalls++;return keys.sign(bytes);}});
 const result=response();await service.handle(request(),result);
 assert.equal(result.status,503);assert.equal(signCalls,0);
 await service.close();
});

test('unknown request fields, wrong issuer, and oversized original body never reach authority or signer',async()=>{
 const f=create();
 for(const invalid of [{...REQUEST,extra:'untrusted'},
  {...REQUEST,issuer:ORIGIN},
  {...REQUEST,subject:'wrong',padding:'x'.repeat(4096)}]){
  const result=response();await f.service.handle(request({body:invalid}),result);
  assert.equal(result.status,400);assert.equal(body(result).error,'TEMPORAL_ISSUER_REFUSED');
 }
 assert.equal(f.calls(),0);assert.equal(f.signCalls(),0);await f.service.close();
});

test('post-placement bootstrap routes are absent unless an owner is supplied',async()=>{
 const f=create();
 for(const url of ['/v1/internal/temporal/bootstrap/challenge','/v1/internal/temporal/bootstrap/redeem']){
  const result=response();await f.service.handle(request({url,authorized:false}),result);
  assert.equal(result.status,404);assert.equal(body(result).error,'TEMPORAL_ISSUER_REFUSED');
 }
 assert.equal(f.calls(),0);assert.equal(f.signCalls(),0);await f.service.close();
});

test('bootstrap delegates closed challenge and redeem requests with the actual TLS socket',async()=>{
 const challengeBody={schemaVersion:1,role:'control',taskArn:'arn:aws:ecs:us-east-1:967807252336:task/capiro-dev/task-1',csrPem:'CSR'};
 const redeemBody={...challengeBody,challengeId:'6a8084ef-11ec-4f8d-98d5-80f0e3acc879',proofBase64:'cHJvb2Y='};
 const receipt=registration(challengeBody.taskArn);
 const calls=[];
 const bootstrapOwner={available:()=>true,
  async challenge(body,{socket,signal}){
   calls.push({kind:'challenge',body,socket});assert.equal(socket.encrypted,true);
   assert.equal(socket.authorized,false);assert.equal(socket.remoteAddress,'10.0.1.4');
   assert.equal(signal.aborted,false);
   return {schemaVersion:1,challengeId:redeemBody.challengeId,proofMessage:'e30=',expiresAtMs:NOW+5000};
  },
  async redeem(body,{socket,signal}){
   calls.push({kind:'redeem',body,socket});assert.equal(socket.encrypted,true);
   assert.equal(socket.remoteAddress,'10.0.1.4');assert.equal(signal.aborted,false);
   return {schemaVersion:1,certPem:TEST_CERT,registration:receipt};
  }};
 const f=create({bootstrapOwner});
 for(const [kind,input] of [['challenge',challengeBody],['redeem',redeemBody]]){
  const result=response();await f.service.handle(request({url:`/v1/internal/temporal/bootstrap/${kind}`,
   body:input,authorized:false}),result);
  assert.equal(result.status,200);assert.equal(result.headers['Cache-Control'],'no-store');
  assert.equal(calls.at(-1).kind,kind);assert.deepEqual(calls.at(-1).body,input);
 }
 assert.equal(calls.length,2);assert.equal(f.calls(),0);assert.equal(f.signCalls(),0);
 const token=response();await f.service.handle(request(),token);
 assert.equal(token.status,200);assert.equal(body(token).state,'CURRENT');
 assert.equal(f.calls(),2);assert.equal(f.signCalls(),1);await f.service.close();
});

test('bootstrap refuses non-TLS, non-IPv4, malformed and oversized requests before owner I/O',async()=>{
 let calls=0;
 const bootstrapOwner={challenge:()=>{calls++;throw Error('must not run');},redeem:()=>{calls++;throw Error('must not run');}};
 const f=create({bootstrapOwner});const url='/v1/internal/temporal/bootstrap/challenge';
 const payload={schemaVersion:1,role:'control',taskArn:'task-1',csrPem:'CSR'};
 for(const input of [
  {encrypted:false,body:payload,status:401},
  {remoteAddress:'::1',body:payload,status:401},
  {body:{...payload,remoteAddress:'10.0.1.4'},status:400},
  {body:{...payload,csrPem:'x'.repeat(9000)},status:400},
  {raw:'{"schemaVersion":1,"schemaVersion":1}',status:400},
  {raw:Buffer.concat([Buffer.from('{"schemaVersion":1,"role":"control","taskArn":"task-1","csrPem":"'),
   Buffer.from([0xff]),Buffer.from('"}')]),status:400},
 ]){
  const result=response();await f.service.handle(request({...input,url,authorized:false}),result);
  assert.equal(result.status,input.status);
 }
 assert.equal(calls,0);await f.service.close();
});

test('bootstrap maps proof refusal to denial and dependency failure to unavailable without exposing errors',async()=>{
 for(const [code,status] of [['TEMPORAL_ISSUER_BOOTSTRAP_REFUSED',403],
  ['RUNNER_POSTSTART_REFUSED',403],['TEMPORAL_ISSUER_BOOTSTRAP_UNAVAILABLE',503]]){
  const bootstrapOwner={challenge:()=>{throw Object.assign(Error('private detail'),{code});},redeem:()=>{throw Error('not used');}};
  const f=create({bootstrapOwner});const result=response();
  await f.service.handle(request({url:'/v1/internal/temporal/bootstrap/challenge',authorized:false,
   body:{schemaVersion:1,role:'control',taskArn:'task-1',csrPem:'CSR'}}),result);
  assert.equal(result.status,status);assert.deepEqual(body(result),{error:'TEMPORAL_ISSUER_REFUSED'});
  await f.service.close();
 }
});

test('bootstrap uses its own bounded deadline while the token deadline stays short',async()=>{
 const keys=fixture(),taskArn='arn:aws:ecs:us-east-1:967807252336:task/capiro-dev/0123456789abcdef0123456789abcdef';
 const owner={async challenge(){await new Promise(resolve=>setTimeout(resolve,25));
   return {schemaVersion:1,challengeId:'6a8084ef-11ec-4f8d-98d5-80f0e3acc879',
    proofMessage:'e30=',expiresAtMs:NOW+5000};},redeem:()=>{throw Error('not used');}};
 const service=createTemporalIssuerService({configuration:{...CONFIG,maxRequestMs:5},
  taskAuthority:{readCurrent:()=>current()},sign:keys.sign,publicJwk:keys.publicJwk,
  bootstrapOwner:owner,now:()=>NOW});
 const result=response();await service.handle(request({url:'/v1/internal/temporal/bootstrap/challenge',
  authorized:false,body:{schemaVersion:1,role:'control',taskArn,csrPem:'CSR'}}),result);
 assert.equal(result.status,200);assert.equal(body(result).challengeId,'6a8084ef-11ec-4f8d-98d5-80f0e3acc879');
 await service.close();
});

test('bootstrap withholds malformed, mismatched or expired owner certificate receipts',async()=>{
 const taskArn='arn:aws:ecs:us-east-1:967807252336:task/capiro-dev/0123456789abcdef0123456789abcdef';
 const bodyValue={schemaVersion:1,role:'control',taskArn,csrPem:'CSR',
  challengeId:'6a8084ef-11ec-4f8d-98d5-80f0e3acc879',proofBase64:'cHJvb2Y='};
 for(const reply of [
  {schemaVersion:1,certPem:'CERT',registration:registration(taskArn)},
  {schemaVersion:1,certPem:TEST_CERT,registration:{...registration(taskArn),certificateSha256:'a'.repeat(64)}},
  {schemaVersion:1,certPem:TEST_CERT,registration:{...registration(taskArn),peerSanUri:'spiffe://other.invalid/forged'}},
  {schemaVersion:1,certPem:TEST_CERT,registration:{...registration(taskArn),revision:null}},
  {schemaVersion:1,certPem:TEST_CERT,registration:{...registration(taskArn),expiresAtMs:NOW-1}},
 ]){
  const owner={challenge:()=>{throw Error('not used');},redeem:()=>reply};
  const f=create({bootstrapOwner:owner});const result=response();
  await f.service.handle(request({url:'/v1/internal/temporal/bootstrap/redeem',body:bodyValue,
   authorized:false}),result);
  assert.equal(result.status,503);assert.deepEqual(body(result),{error:'TEMPORAL_ISSUER_REFUSED'});
  await f.service.close();
 }
});
