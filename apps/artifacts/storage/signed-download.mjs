/** Short-lived, revocable artifact download tokens. A token is `<claims>.<mac>`: base64url JSON claims
 * {versionId, sha256, scopeDigest, actorId, expiresAtMs, suppressionGeneration} and an HMAC-SHA256 over a fixed domain and those exact
 * claim bytes. Verification is constant-time and checks expiry; everything else a redemption needs (current authority, exact bytes,
 * the retention suppression generation) is rechecked by the redeeming owner against current state, never trusted from the token.
 * The key is supplied by trusted composition (read through the runtime's readSecret); this module reads no files or ambient clocks. */
import {createHmac,timingSafeEqual} from 'node:crypto';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
const DOMAIN='meri.artifact-download.v1.';
export const CLAIMS=Object.freeze(['versionId','sha256','scopeDigest','actorId','expiresAtMs','suppressionGeneration']);
export const MIN_KEY_BYTES=32,MAX_TTL_MS=300000;
const TOKEN=/^[A-Za-z0-9_-]{1,1024}\.[A-Za-z0-9_-]{43}$/u,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,DIGEST=/^[a-f0-9]{64}$/u;
const fail=code=>{throw Object.assign(new Error(code),{code});};
function claims(value,code){
 let c;try{c=data(own(value,CLAIMS));}catch{fail(code);}
 if(typeof c.versionId!=='string'||!UUID.test(c.versionId)||typeof c.sha256!=='string'||!DIGEST.test(c.sha256)||typeof c.scopeDigest!=='string'||!DIGEST.test(c.scopeDigest)||typeof c.actorId!=='string'||!c.actorId||c.actorId.length>128||!Number.isSafeInteger(c.expiresAtMs)||c.expiresAtMs<1||!Number.isSafeInteger(c.suppressionGeneration)||c.suppressionGeneration<0)fail(code);
 return c;
}
export function createSignedDownloadCodec({key,now}){
 if(!Buffer.isBuffer(key)||key.length<MIN_KEY_BYTES||typeof now!=='function')fail('DOWNLOAD_LINK_CONFIGURATION');
 const secret=Buffer.from(key),mac=payload=>createHmac('sha256',secret).update(DOMAIN+payload).digest();
 return Object.freeze({
  /** Signs claims whose expiry lies in the future and within MAX_TTL_MS of now. */
  issue(value){const c=claims(value,'DOWNLOAD_LINK_CLAIMS'),t=now();if(c.expiresAtMs<=t||c.expiresAtMs>t+MAX_TTL_MS)fail('DOWNLOAD_LINK_CLAIMS');
   const payload=Buffer.from(JSON.stringify(Object.fromEntries(CLAIMS.map(k=>[k,c[k]])))).toString('base64url');return `${payload}.${mac(payload).toString('base64url')}`;},
  /** Returns the authenticated, unexpired claims. Any malformed, re-signed or altered token is DOWNLOAD_LINK_INVALID. */
  verify(token){
   if(typeof token!=='string'||!TOKEN.test(token))fail('DOWNLOAD_LINK_INVALID');const [payload,signature]=token.split('.'),given=Buffer.from(signature,'base64url'),expected=mac(payload);
   if(given.length!==expected.length||!timingSafeEqual(given,expected)||given.toString('base64url')!==signature)fail('DOWNLOAD_LINK_INVALID');
   let parsed;try{parsed=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));}catch{fail('DOWNLOAD_LINK_INVALID');}
   const c=claims(parsed,'DOWNLOAD_LINK_INVALID');if(now()>=c.expiresAtMs)fail('DOWNLOAD_LINK_EXPIRED');return c;
  },
 });
}
