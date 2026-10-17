/** Short-lived WOPI access tokens for one edit session (design section 4.4 "Credential custody": HMAC-signed by control,
 * 10 minutes or less, bound to session, actor and exact version, delivered by POST form, never logged). Same construction
 * as the artifact download links (`../storage/signed-download.mjs`) with its own domain separator, so a download token
 * can never verify as a WOPI token or the reverse.
 *
 * PREPARATION ONLY. This is a Meri-issued capability over Meri artifacts, not a website credential. The signing key is
 * supplied by trusted composition; no key exists yet and none is created here. Everything a WOPI call needs beyond the
 * token (current authority, suppression generation, lock) is rechecked against current state by the WOPI host. */
import {createHmac,timingSafeEqual} from 'node:crypto';
const DOMAIN='meri.wopi-access.v0.';
export const WOPI_TOKEN_CLAIMS=Object.freeze(['editSessionId','fileId','versionId','actorId','tenantId','userCanWrite','expiresAtMs','suppressionGeneration']);
export const MIN_KEY_BYTES=32,MAX_TTL_MS=10*60*1000;
const TOKEN=/^[A-Za-z0-9_-]{1,2048}\.[A-Za-z0-9_-]{43}$/u,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,FILE=/^[A-Za-z0-9_-]{1,128}$/u,ID=/^[A-Za-z0-9_.:@-]{1,128}$/u;
const fault=code=>{throw Object.assign(new Error(code),{code});};
function claims(value,code){
 if(!value||typeof value!=='object'||Array.isArray(value))fault(code);
 const keys=Object.keys(value);
 if(keys.length!==WOPI_TOKEN_CLAIMS.length||!WOPI_TOKEN_CLAIMS.every(k=>Object.hasOwn(value,k)))fault(code);
 const c=value;
 if(!UUID.test(c.editSessionId??'')||!FILE.test(c.fileId??'')||!UUID.test(c.versionId??'')||typeof c.actorId!=='string'||!ID.test(c.actorId)||typeof c.tenantId!=='string'||!ID.test(c.tenantId)
  ||typeof c.userCanWrite!=='boolean'||!Number.isSafeInteger(c.expiresAtMs)||c.expiresAtMs<1||!Number.isSafeInteger(c.suppressionGeneration)||c.suppressionGeneration<0)fault(code);
 return Object.freeze(Object.fromEntries(WOPI_TOKEN_CLAIMS.map(k=>[k,c[k]])));
}
export function createWopiAccessTokenCodec({key,now}){
 if(!Buffer.isBuffer(key)||key.length<MIN_KEY_BYTES||typeof now!=='function')fault('WOPI_TOKEN_CONFIGURATION');
 const secret=Buffer.from(key),mac=payload=>createHmac('sha256',secret).update(DOMAIN+payload).digest();
 return Object.freeze({
  /** Signs claims whose expiry lies in the future and within 10 minutes of now. */
  issue(value){
   const c=claims(value,'WOPI_TOKEN_CLAIMS'),t=now();if(c.expiresAtMs<=t||c.expiresAtMs>t+MAX_TTL_MS)fault('WOPI_TOKEN_CLAIMS');
   const payload=Buffer.from(JSON.stringify(c)).toString('base64url');return `${payload}.${mac(payload).toString('base64url')}`;
  },
  /** Authenticated, unexpired claims bound to the WOPI file being called; anything else refuses. */
  verify(token,{fileId}){
   if(typeof token!=='string'||!TOKEN.test(token))fault('WOPI_TOKEN_INVALID');
   const [payload,signature]=token.split('.'),given=Buffer.from(signature,'base64url'),expected=mac(payload);
   if(given.length!==expected.length||!timingSafeEqual(given,expected)||given.toString('base64url')!==signature)fault('WOPI_TOKEN_INVALID');
   let parsed;try{parsed=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));}catch{fault('WOPI_TOKEN_INVALID');}
   const c=claims(parsed,'WOPI_TOKEN_INVALID');
   if(now()>=c.expiresAtMs)fault('WOPI_TOKEN_EXPIRED');
   if(c.fileId!==fileId)fault('WOPI_TOKEN_FILE_MISMATCH');
   return c;
  },
 });
}
