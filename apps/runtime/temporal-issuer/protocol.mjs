/** The one Temporal issuer protocol. Keys and workload authority are supplied by separate owners. */
import {createPublicKey, randomUUID, verify as verifySignature, constants} from 'node:crypto';
import {types} from 'node:util';

export const TEMPORAL_ISSUER_PERMISSIONS=Object.freeze(['meri:write']);
const jwtKeys=['iss','aud','sub','iat','nbf','exp','jti','permissions'];
const headerKeys=['alg','typ','kid'];
const jwkKeys=['kty','kid','alg','use','n','e'];
const name=/^[A-Za-z0-9._:-]{1,128}$/u;
const uuidV4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const b64url=/^[A-Za-z0-9_-]+$/u;
const textDecoder=new TextDecoder('utf-8',{fatal:true});

function fail(code){throw Object.assign(Error('TEMPORAL_ISSUER_PROTOCOL_'+code),{code:'TEMPORAL_ISSUER_PROTOCOL_'+code});}
function integer(value){return Number.isSafeInteger(value)&&value>=0;}
function record(value,keys){
 if(value===null||typeof value!=='object'||Array.isArray(value)||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype)fail('SHAPE');
 const actual=Reflect.ownKeys(value);
 if(actual.length!==keys.length||actual.some(key=>typeof key!=='string'||!keys.includes(key)))fail('SHAPE');
 for(const key of actual)if(!Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'))fail('SHAPE');
 return value;
}
function origin(value){
 if(typeof value!=='string')fail('ISSUER');
 let parsed;try{parsed=new URL(value);}catch{fail('ISSUER');}
 if(parsed.protocol!=='https:'||parsed.port!=='8445'||parsed.origin!==value||parsed.pathname!=='/'||parsed.search||parsed.hash||parsed.username||parsed.password)fail('ISSUER');
 return value;
}
function identity({issuerOrigin,kid,role,subject,audience,namespace,nowMs}){
 origin(issuerOrigin);
 if(!name.test(kid)||!['control','temporal-worker'].includes(role)||!name.test(subject)||audience!=='meri-temporal'||namespace!=='meri'||!integer(nowMs))fail('CONFIGURATION');
}
function encode(value){return Buffer.from(JSON.stringify(value),'utf8').toString('base64url');}
function decode(segment){
 if(typeof segment!=='string'||!b64url.test(segment)||segment.length>4096)fail('ENCODING');
 let bytes;try{bytes=Buffer.from(segment,'base64url');if(bytes.toString('base64url')!==segment)fail('ENCODING');return textDecoder.decode(bytes);}catch{fail('ENCODING');}
}
function decodeJson(segment,keys){
 const raw=decode(segment);let value;
 try{value=JSON.parse(raw);}catch{fail('ENCODING');}
 record(value,keys);
 // Reject duplicate names, alternate encodings and noncanonical JSON before accepting a signed claim.
 if(JSON.stringify(value)!==raw)fail('ENCODING');
 return value;
}

/** Accepts only a public RSA signing key; no private JWK field is admitted. */
export function validateTemporalIssuerPublicJwk(value,kid){
 const jwk=record(value,jwkKeys);
 if(jwk.kty!=='RSA'||jwk.kid!==kid||jwk.alg!=='RS256'||jwk.use!=='sig'||!b64url.test(jwk.n)||jwk.e!=='AQAB')fail('KEY');
 let key;try{key=createPublicKey({key:jwk,format:'jwk'});}catch{fail('KEY');}
 const bits=key.asymmetricKeyDetails?.modulusLength;
 if(key.asymmetricKeyType!=='rsa'||!Number.isInteger(bits)||bits<2048||bits>4096||key.asymmetricKeyDetails?.publicExponent!==65537n)fail('KEY');
 return key;
}

/** Verify the exact RS256 JWT before returning it to the token-file owner. */
export function verifyTemporalIssuerToken({token,issuerOrigin,kid,publicJwk,role,subject,audience,namespace,nowMs}={}){
 identity({issuerOrigin,kid,role,subject,audience,namespace,nowMs});
 const key=validateTemporalIssuerPublicJwk(publicJwk,kid);
 if(typeof token!=='string'||token.length>8192)fail('TOKEN');
 const parts=token.split('.');if(parts.length!==3)fail('TOKEN');
 const header=decodeJson(parts[0],headerKeys),claims=decodeJson(parts[1],jwtKeys),signature=parts[2];
 if(header.alg!=='RS256'||header.typ!=='JWT'||header.kid!==kid||!b64url.test(signature))fail('TOKEN');
 let signatureBytes;try{signatureBytes=Buffer.from(signature,'base64url');if(signatureBytes.toString('base64url')!==signature)fail('TOKEN');}catch{fail('TOKEN');}
 const input=Buffer.from(parts[0]+'.'+parts[1],'ascii');
 if(!verifySignature('sha256',input,{key,padding:constants.RSA_PKCS1_PADDING},signatureBytes))fail('SIGNATURE');
 const nowSeconds=Math.floor(nowMs/1000);
 if(claims.iss!==issuerOrigin+'/'||claims.aud!==audience||claims.sub!==subject||
    !integer(claims.iat)||!integer(claims.nbf)||!integer(claims.exp)||claims.nbf!==claims.iat||
    claims.iat>nowSeconds||claims.exp<=nowSeconds||claims.exp-claims.iat>60||claims.exp<=claims.iat||
    typeof claims.jti!=='string'||!uuidV4.test(claims.jti)||
    !Array.isArray(claims.permissions)||claims.permissions.length!==1||claims.permissions[0]!==namespace+':write')fail('CLAIMS');
 return Object.freeze({...claims,permissions:TEMPORAL_ISSUER_PERMISSIONS});
}

/**
 * `sign` is a supplied private-key/KMS port: async (signingInput: Buffer) => signature bytes.
 * The returned signature is checked with the pinned public key, so a wrong key or algorithm cannot be released.
 * `validUntilMs` is a fresh task-currentness lease and always clips the JWT expiration.
 */
export async function createTemporalIssuerToken({issuerOrigin,kid,publicJwk,role,subject,audience,namespace,nowMs,validUntilMs,sign,jti=randomUUID()}={}){
 identity({issuerOrigin,kid,role,subject,audience,namespace,nowMs});
 validateTemporalIssuerPublicJwk(publicJwk,kid);
 if(!integer(validUntilMs)||validUntilMs<=nowMs||typeof sign!=='function'||types.isProxy(sign)||typeof jti!=='string'||!uuidV4.test(jti))fail('CONFIGURATION');
 const iat=Math.floor(nowMs/1000),exp=Math.min(iat+60,Math.floor(validUntilMs/1000));
 if(exp*1000<=nowMs||exp<=iat)fail('CURRENTNESS');
 const header={alg:'RS256',typ:'JWT',kid};
 const claims={iss:issuerOrigin+'/',aud:audience,sub:subject,iat,nbf:iat,exp,jti,permissions:['meri:write']};
 const input=Buffer.from(encode(header)+'.'+encode(claims),'ascii');
 let signature;
 try{signature=await sign(Buffer.from(input));}catch{fail('SIGNATURE');}
 if(!(signature instanceof Uint8Array)||signature.length===0)fail('SIGNATURE');
 const token=input.toString('ascii')+'.'+Buffer.from(signature).toString('base64url');
 verifyTemporalIssuerToken({token,issuerOrigin,kid,publicJwk,role,subject,audience,namespace,nowMs});
 return Object.freeze({token,expiresAtMs:exp*1000,claims:Object.freeze({...claims,permissions:TEMPORAL_ISSUER_PERMISSIONS})});
}
