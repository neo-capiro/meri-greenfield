import test from 'node:test';
import assert from 'node:assert/strict';
import {constants,generateKeyPairSync,sign as rsaSign} from 'node:crypto';
import {createTemporalIssuerToken,verifyTemporalIssuerToken,validateTemporalIssuerPublicJwk,TEMPORAL_ISSUER_PERMISSIONS} from './protocol.mjs';

const nowMs=1_760_700_000_123;
const jti='706430d8-2676-4dd5-9f8e-19d2186beb66';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048,publicExponent:65537});
const publicJwk={...publicKey.export({format:'jwk'}),kid:'temporal-key-1',alg:'RS256',use:'sig'};
const sign=input=>rsaSign('sha256',input,{key:privateKey,padding:constants.RSA_PKCS1_PADDING});
const base={issuerOrigin:'https://issuer.meri.internal',kid:'temporal-key-1',publicJwk,role:'control',subject:'meri-temporal-control:v1',audience:'meri-temporal',namespace:'meri',nowMs};
const issue=extra=>createTemporalIssuerToken({...base,validUntilMs:nowMs+30_000,sign,jti,...extra});
const verify=(token,extra)=>verifyTemporalIssuerToken({...base,token,...extra});
const failCode=(fn,code)=>assert.throws(fn,{code:'TEMPORAL_ISSUER_PROTOCOL_'+code});
const rejectCode=(fn,code)=>assert.rejects(fn,{code:'TEMPORAL_ISSUER_PROTOCOL_'+code});
const encode=value=>Buffer.from(JSON.stringify(value),'utf8').toString('base64url');
const forged=(header,claims,key=privateKey)=>{
 const input=encode(header)+'.'+encode(claims);
 return input+'.'+rsaSign('sha256',Buffer.from(input,'ascii'),{key,padding:constants.RSA_PKCS1_PADDING}).toString('base64url');
};

test('externally signed RS256 token is verified, narrowly authorized and clipped to current lease',async()=>{
 const issued=await issue();
 const [encodedHeader,encodedClaims]=issued.token.split('.');
 assert.deepEqual(JSON.parse(Buffer.from(encodedHeader,'base64url').toString('utf8')),{alg:'RS256',typ:'JWT',kid:base.kid});
 const claims=JSON.parse(Buffer.from(encodedClaims,'base64url').toString('utf8'));
 assert.deepEqual(claims,{iss:base.issuerOrigin+'/',aud:'meri-temporal',sub:base.subject,iat:Math.floor(nowMs/1000),nbf:Math.floor(nowMs/1000),exp:Math.floor((nowMs+30_000)/1000),jti,permissions:['meri:write']});
 assert.equal(issued.expiresAtMs,claims.exp*1000);
 assert.deepEqual(verify(issued.token),claims);
 assert.deepEqual(TEMPORAL_ISSUER_PERMISSIONS,['meri:write']);
 assert.ok(Object.isFrozen(issued.claims.permissions));
});

test('absolute 60 second limit and exact bare origin plus slash join',async()=>{
 const issued=await issue({validUntilMs:nowMs+300_000});
 assert.equal(issued.claims.exp-issued.claims.iat,60);
 assert.equal(issued.claims.iss,'https://issuer.meri.internal/');
 const first=await createTemporalIssuerToken({...base,validUntilMs:nowMs+30_000,sign});
 const second=await createTemporalIssuerToken({...base,validUntilMs:nowMs+30_000,sign});
 assert.match(first.claims.jti,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
 assert.notEqual(first.claims.jti,second.claims.jti);
 failCode(()=>verify(issued.token,{issuerOrigin:'https://issuer.meri.internal/'}),'ISSUER');
 failCode(()=>verify(issued.token,{issuerOrigin:'https://issuer.meri.internal/other'}),'ISSUER');
 failCode(()=>verify(issued.token,{issuerOrigin:'http://issuer.meri.internal'}),'ISSUER');
 await rejectCode(()=>issue({issuerOrigin:'https://issuer.meri.internal/'}),'ISSUER');
 await rejectCode(()=>issue({validUntilMs:nowMs+400}),'CURRENTNESS');
});

test('wrong signer and private or weak public key cannot mint',async()=>{
 const other=generateKeyPairSync('rsa',{modulusLength:2048,publicExponent:65537});
 await rejectCode(()=>issue({sign:input=>rsaSign('sha256',input,{key:other.privateKey,padding:constants.RSA_PKCS1_PADDING})}),'SIGNATURE');
 failCode(()=>validateTemporalIssuerPublicJwk({...publicJwk,d:'private-material'},base.kid),'SHAPE');
 const weak=generateKeyPairSync('rsa',{modulusLength:1024,publicExponent:65537});
 failCode(()=>validateTemporalIssuerPublicJwk({...weak.publicKey.export({format:'jwk'}),kid:base.kid,alg:'RS256',use:'sig'},base.kid),'KEY');
 await rejectCode(()=>issue({sign:()=>Buffer.alloc(0)}),'SIGNATURE');
});

test('verified signatures still refuse wrong issuer, audience, subject, time, JTI and permission breadth',async()=>{
 const issued=await issue();
 const [headerSegment,claimsSegment]=issued.token.split('.');
 const header=JSON.parse(Buffer.from(headerSegment,'base64url'));
 const claims=JSON.parse(Buffer.from(claimsSegment,'base64url'));
 const cases=[
  {iss:'https://issuer.meri.internal'},
  {aud:'other-temporal'},
  {sub:'meri-temporal-worker:v1'},
  {iat:claims.iat+3},
  {nbf:claims.nbf-1},
  {exp:claims.iat+61},
  {exp:claims.iat},
  {jti:'not-a-uuid'},
  {permissions:['meri:read']},
  {permissions:['meri:write','system:admin']},
  {permissions:{meri:4}},
 ];
 for(const delta of cases)failCode(()=>verify(forged(header,{...claims,...delta})),'CLAIMS');
 failCode(()=>verify(forged({...header,alg:'HS256'},claims)),'TOKEN');
 failCode(()=>verify(forged({...header,kid:'other-key'},claims)),'TOKEN');
 failCode(()=>verify(forged(header,{...claims,extra:true})),'SHAPE');
});

test('bad signature, overlong token, duplicate JSON property and noncanonical base64 are refused',async()=>{
 const issued=await issue(),parts=issued.token.split('.');
 failCode(()=>verify(parts[0]+'.'+parts[1]+'.'+Buffer.alloc(256,1).toString('base64url')),'SIGNATURE');
 failCode(()=>verify('x'.repeat(8193)),'TOKEN');
 const rawHeader='{"alg":"RS256","typ":"JWT","kid":"temporal-key-1","kid":"temporal-key-1"}';
 const duplicated=Buffer.from(rawHeader).toString('base64url')+'.'+parts[1];
 const signature=rsaSign('sha256',Buffer.from(duplicated,'ascii'),{key:privateKey,padding:constants.RSA_PKCS1_PADDING});
 failCode(()=>verify(duplicated+'.'+signature.toString('base64url')),'ENCODING');
 failCode(()=>verify(parts[0]+'!.'+parts[1]+'.'+parts[2]),'ENCODING');
});
