import assert from 'node:assert/strict';
import {createHash, constants, generateKeyPairSync, sign} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import test from 'node:test';
import {createTemporalIssuerDelivery, parseTemporalIssuerDeliveryConfiguration} from './client.mjs';
import {createTemporalIssuerToken} from './protocol.mjs';

const NOW=1_800_000_000_000;
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const rsa=publicKey.export({format:'jwk'});
const jwk={kty:'RSA',kid:'meri-test-2026',alg:'RS256',use:'sig',n:rsa.n,e:rsa.e};
const manifest=Buffer.from(JSON.stringify({keys:[jwk]}));
const canonicalJwk=JSON.stringify(jwk);
const pin=createHash('sha256').update(canonicalJwk).digest('hex');
const files=new Map([
 ['/run/meri/issuer-jwks.json',manifest],
 ['/run/meri/issuer-ca.pem',Buffer.from('test CA')],
 ['/run/meri/issuer-client.crt',Buffer.from('test client certificate')],
 ['/run/meri/issuer-client.key',Buffer.from('test client private key')],
]);

function config(overrides={}){
 return {
  schemaVersion:1,issuerOrigin:'https://issuer.meri.internal:8445',audience:'meri-temporal',namespace:'meri',
  identity:{role:'control',subject:'meri-temporal-control:v1',workloadPrincipal:'meri-workload-control:v1'},
  publicKey:{kid:jwk.kid,alg:'RS256',jwkSha256:pin,manifestFile:'/run/meri/issuer-jwks.json'},
  tls:{serverName:'issuer.meri.internal',issuerCaFile:'/run/meri/issuer-ca.pem',
   clientCertFile:'/run/meri/issuer-client.crt',clientKeyFile:'/run/meri/issuer-client.key'},
  requestTimeoutMs:1000,maxReplyBytes:4096,...overrides,
 };
}

function writerRequest(overrides={}){
 return {schemaVersion:1,role:'control',subject:'meri-temporal-control:v1',
  workloadPrincipal:'meri-workload-control:v1',namespace:'meri',audience:'meri-temporal',
  issuer:'https://issuer.meri.internal:8445/',signal:undefined,...overrides};
}

function materials(reads){
 return async (path,{kind})=>{
  reads.push({path,kind});
  const bytes=files.get(path);
  assert.ok(bytes,`unexpected material path ${path}`);
  return bytes;
 };
}

function deferred(){
 let resolve;
 const promise=new Promise(done=>{resolve=done;});
 return {promise,resolve};
}

async function bounded(promise,ms,message){
 let timer;
 try{
  return await Promise.race([promise,new Promise((_,reject)=>{
   timer=setTimeout(()=>reject(Error(message)),ms);
  })]);
 }finally{clearTimeout(timer);}
}

function requestStub(reply,requests){
 return (url,options,onResponse)=>{
  const call=new EventEmitter();
  call.destroy=()=>{};
  call.end=body=>queueMicrotask(async()=>{
   try{
    requests.push({url,options,body:Buffer.from(body)});
    const {statusCode=200,headers={},payload}=await reply({url,options,body});
    const bytes=Buffer.isBuffer(payload)?payload:Buffer.from(JSON.stringify(payload));
    const response=new PassThrough();
    response.statusCode=statusCode;
    response.headers={'content-type':'application/json',...headers};
    response.complete=true;
    response.rawTrailers=[];
    onResponse(response);
    response.end(bytes);
   }catch(error){call.emit('error',error);}
  });
  return call;
 };
}

async function currentReply(){
 const token=await createTemporalIssuerToken({issuerOrigin:'https://issuer.meri.internal:8445',kid:jwk.kid,
  publicJwk:jwk,role:'control',subject:'meri-temporal-control:v1',audience:'meri-temporal',
  namespace:'meri',nowMs:NOW,validUntilMs:NOW+30_000,
  sign:async input=>sign('sha256',input,{key:privateKey,padding:constants.RSA_PKCS1_PADDING})});
 return {schemaVersion:1,state:'CURRENT',
  identity:{role:'control',subject:'meri-temporal-control:v1',workloadPrincipal:'meri-workload-control:v1'},
  observedAtMs:NOW,validUntilMs:token.expiresAtMs,
  token:{token:token.token,expiresAtMs:token.expiresAtMs,
   claims:{namespace:'meri',audience:'meri-temporal',issuer:'https://issuer.meri.internal:8445/'}}};
}

test('pure configuration parser pins the HTTPS :8445 origin and exact slash-terminated issuer',()=>{
 const parsed=parseTemporalIssuerDeliveryConfiguration(config());
 assert.equal(parsed.issuerOrigin,'https://issuer.meri.internal:8445');
 assert.equal(parsed.issuer,'https://issuer.meri.internal:8445/');
 assert.ok(Object.isFrozen(parsed));
 for(const issuerOrigin of [
  'https://issuer.meri.internal',
  'https://issuer.meri.internal:443',
  'https://issuer.meri.internal:8446',
  'https://issuer.meri.internal:8445/',
  'https://issuer.meri.internal:8445/path',
  'https://issuer.meri.internal:8445?query=1',
  'https://issuer.meri.internal:8445#fragment',
  'https://user:password@issuer.meri.internal:8445',
  'http://issuer.meri.internal:8445',
 ])assert.throws(()=>parseTemporalIssuerDeliveryConfiguration(config({issuerOrigin})),
  {code:'TEMPORAL_ISSUER_DELIVERY_REFUSED'},issuerOrigin);
 assert.throws(()=>parseTemporalIssuerDeliveryConfiguration(config({tls:{...config().tls,serverName:'issuer.meri.internal:8445'}})),
  {code:'TEMPORAL_ISSUER_DELIVERY_REFUSED'});
 assert.throws(()=>parseTemporalIssuerDeliveryConfiguration(config({unexpected:'ignored'})),
  {code:'TEMPORAL_ISSUER_DELIVERY_REFUSED'});
});

test('a trusted parsed configuration can be passed to the factory, but a forged derived issuer cannot',()=>{
 const parsed=parseTemporalIssuerDeliveryConfiguration(config());
 const port=createTemporalIssuerDelivery({configuration:parsed,readMaterial:materials([]),now:()=>NOW,
  request:requestStub(async()=>({payload:null}),[])});
 assert.equal(port.available(),true);
 port.close();
 assert.throws(()=>createTemporalIssuerDelivery({configuration:{...config(),issuer:parsed.issuer}}),
  {code:'TEMPORAL_ISSUER_DELIVERY_REFUSED'});
 assert.throws(()=>createTemporalIssuerDelivery({configuration:{...parsed}}),
  {code:'TEMPORAL_ISSUER_DELIVERY_REFUSED'});
});

test('the writer request is exact and refuses wrong role or issuer before material I/O',async()=>{
 const reads=[],requests=[];
 const delivery=createTemporalIssuerDelivery({configuration:config(),readMaterial:materials(reads),now:()=>NOW,
  request:requestStub(async()=>({payload:await currentReply()}),requests)});
 await assert.rejects(delivery.read(writerRequest({role:'temporal-worker'})),
  {code:'TEMPORAL_ISSUER_DELIVERY_REFUSED'});
 await assert.rejects(delivery.read(writerRequest({issuer:'https://issuer.meri.internal:8445'})),
  {code:'TEMPORAL_ISSUER_DELIVERY_REFUSED'});
 assert.deepEqual(reads,[]);
 assert.deepEqual(requests,[]);
});

test('a pinned public key and mTLS POST return only a verified RS256 current token',async()=>{
 const reads=[],requests=[];
 const delivery=createTemporalIssuerDelivery({configuration:config(),readMaterial:materials(reads),now:()=>NOW,
  request:requestStub(async()=>({payload:await currentReply()}),requests)});
 const result=await delivery.read(writerRequest());
 assert.equal(result.state,'CURRENT');
 assert.equal(result.token.claims.issuer,'https://issuer.meri.internal:8445/');
 assert.equal(requests.length,1);
 const {url,options,body}=requests[0];
 assert.equal(url.href,'https://issuer.meri.internal:8445/v1/internal/temporal/token/read');
 assert.equal(options.method,'POST');
 assert.equal(options.servername,'issuer.meri.internal');
 assert.equal(options.minVersion,'TLSv1.3');
 assert.equal(options.rejectUnauthorized,true);
 assert.equal(options.agent,false);
 assert.equal(options.timeout,1000);
 assert.equal(options.ca,files.get('/run/meri/issuer-ca.pem'));
 assert.equal(options.cert,files.get('/run/meri/issuer-client.crt'));
 assert.equal(options.key,files.get('/run/meri/issuer-client.key'));
 assert.equal(options.headers['cache-control'],'no-store');
 assert.equal(options.headers['accept-encoding'],'identity');
 assert.equal(options.headers.cookie,undefined);
 assert.equal(options.headers.authorization,undefined);
 assert.deepEqual(JSON.parse(body.toString('utf8')),{schemaVersion:1,role:'control',
  subject:'meri-temporal-control:v1',workloadPrincipal:'meri-workload-control:v1',
  namespace:'meri',audience:'meri-temporal',issuer:'https://issuer.meri.internal:8445/'});
 assert.deepEqual(reads.map(read=>read.kind),['manifest','issuerCa','clientCert','clientKey']);
 assert.equal(delivery.available(),true);
 delivery.close();
 assert.equal(delivery.available(),false);
 await assert.rejects(delivery.read(writerRequest()),{code:'TEMPORAL_ISSUER_DELIVERY_REFUSED'});
});

test('public JWK pin mismatch refuses before the HTTP request',async()=>{
 const reads=[],requests=[];
 const badPin=pin.replace(/^./u,pin[0]==='a'?'b':'a');
 const delivery=createTemporalIssuerDelivery({configuration:config({publicKey:{...config().publicKey,jwkSha256:badPin}}),
  readMaterial:materials(reads),now:()=>NOW,
  request:requestStub(async()=>({payload:await currentReply()}),requests)});
 await assert.rejects(delivery.read(writerRequest()),{code:'TEMPORAL_ISSUER_DELIVERY_REFUSED'});
 assert.deepEqual(reads.map(read=>read.kind),['manifest']);
 assert.equal(requests.length,0);
});

test('redirects, response cookies and oversized bodies are refused without retry',async t=>{
 const valid=await currentReply();
 for(const scenario of [
  {name:'redirect',statusCode:302,headers:{location:'https://other.invalid/'},payload:valid},
  {name:'cookie',headers:{'set-cookie':['sid=opaque']},payload:valid},
  {name:'oversized',headers:{'content-length':'4097'},payload:valid},
 ]){
  await t.test(scenario.name,async()=>{
   const requests=[];
   const delivery=createTemporalIssuerDelivery({configuration:config(),readMaterial:materials([]),now:()=>NOW,
    request:requestStub(async()=>scenario,requests)});
   await assert.rejects(delivery.read(writerRequest()),{code:'TEMPORAL_ISSUER_DELIVERY_REFUSED'});
   assert.equal(requests.length,1);
  });
 }
});

test('close aborts an in-flight HTTP request immediately',async()=>{
 const entered=deferred();
 let destroyed=0,requests=0;
 const request=()=>{
  requests++;
  const call=new EventEmitter();
  call.end=()=>entered.resolve();
  call.destroy=()=>{destroyed++;};
  return call;
 };
 const delivery=createTemporalIssuerDelivery({configuration:config(),readMaterial:materials([]),
  now:()=>NOW,request});
 const pending=delivery.read(writerRequest());
 await entered.promise;
 delivery.close();
 await assert.rejects(bounded(pending,300,'close did not abort HTTP promptly'),
  {code:'TEMPORAL_ISSUER_DELIVERY_REFUSED'});
 assert.equal(requests,1);
 assert.equal(destroyed,1);
 assert.equal(delivery.available(),false);
});

test('close while material is loading refuses its delayed key and wipes that buffer',async()=>{
 const keyRequested=deferred(),releaseKey=deferred();
 const secret=Buffer.from('test secret client key material');
 let requests=0;
 const readMaterial=async (path,{kind})=>{
  if(kind==='clientKey'){
   keyRequested.resolve();
   return releaseKey.promise;
  }
  return Buffer.from(files.get(path));
 };
 const delivery=createTemporalIssuerDelivery({configuration:config(),readMaterial,now:()=>NOW,
  request:()=>{requests++;throw Error('HTTP must not start after close');}});
 const pending=delivery.read(writerRequest());
 await keyRequested.promise;
 delivery.close();
 releaseKey.resolve(secret);
 await assert.rejects(pending,{code:'TEMPORAL_ISSUER_DELIVERY_REFUSED'});
 assert.equal(requests,0);
 assert.ok(secret.every(byte=>byte===0),'the delivered private-key buffer must be zeroed');
});

test('the overall deadline also bounds material loading before HTTP',async()=>{
 let requests=0;
 const delivery=createTemporalIssuerDelivery({configuration:config({requestTimeoutMs:100}),
  readMaterial:async()=>new Promise(()=>{}),now:Date.now,
  request:()=>{requests++;throw Error('HTTP must not start after material deadline');}});
 const pending=delivery.read(writerRequest());
 await assert.rejects(bounded(pending,750,'material phase exceeded deadline'),
  {code:'TEMPORAL_ISSUER_DELIVERY_REFUSED'});
 assert.equal(requests,0);
});
