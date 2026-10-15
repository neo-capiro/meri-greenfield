/** Short-lived revocable download links over the unchanged canonical document application. Two additive routes; every other path,
 * including the existing `/api/documents/download`, is delegated to the wrapped application unchanged, and link bytes still flow
 * through that canonical download.
 *   POST /api/documents/links/issue  {versionId} -> {versionId, token, expiresAtMs}
 *   POST /api/documents/links/redeem {token}     -> the attachment the canonical download returns
 * Both require the caller's Bearer session and a JSON body; a token is accepted only in the redeem body, never in a URL, so it cannot
 * reach request-line access logs, URL telemetry or a Referer. Issuance and redemption run the same authorized read: canonical inspect
 * (version-scoped `artifact.inspect` authorization, retention gate, current bytes), the suppression generation, then the canonical
 * download (version-scoped `artifact.download` authorization for that exact version and its bytes), the exact bytes hash and the
 * generation again. Issuance signs the version's sha256, the current actor, scope digest and generation; it never signs a link the
 * caller could not download now. Redemption authenticates first, verifies the MAC and expiry, requires the same current actor and
 * scope digest, the signed sha256 and generation before any byte read. After the final body and suppression reads both paths re-read
 * current authority (same actor, scope digest, unexpired session) and redemption rechecks link expiry, synchronously before release. Every response on these
 * routes is `no-store`, `no-referrer` and `nosniff`; refusals carry closed codes only and never echo a token. */
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {own,data,CommandError} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {jsonBody,response} from '../../control/document-application/http.mjs';
import {createSignedDownloadCodec,MIN_KEY_BYTES,MAX_TTL_MS} from '../../artifacts/storage/signed-download.mjs';
import {readSecret,fault} from '../config.mjs';
export const LINK_ROUTE=/^\/api\/documents\/links\/(issue|redeem)$/u;
const MAX_BODY_BYTES=4096,JSON_TYPE=/^application\/json(?:\s*;\s*charset=utf-8)?$/iu;
const LINK_HEADERS=Object.freeze({'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'});
const statuses=new Map([['INVALID_REQUEST',400],['INVALID_COMMAND',400],['INVALID_JSON',400],['INVALID_UTF8',400],['INVALID_BODY',400],['INVALID_CONTENT_LENGTH',400],['REQUEST_TOO_LARGE',413],['UNSUPPORTED_MEDIA_TYPE',415],['METHOD_NOT_ALLOWED',405],['UNAUTHENTICATED',401],
 ['SESSION_REFUSED',403],['ACCESS_DENIED',403],['DOWNLOAD_LINK_INVALID',403],['DOWNLOAD_LINK_ACTOR',403],['DOWNLOAD_LINK_CLAIMS',403],['DOWNLOAD_LINK_EXPIRED',410],['DOWNLOAD_LINK_REVOKED',410],['RETENTION_SUPPRESSED',410],
 ['DOWNLOAD_LINK_BYTES',409],['RETENTION_RECOVERY_BARRIER',503],['RETENTION_READ_UNAVAILABLE',503],['DEADLINE',408],['CANCELLED',499]]);
const fail=code=>{throw Object.assign(new Error(code),{code});};
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
/** The same response with the link-route cache, referrer and sniffing headers forced, including canonical pass-through refusals. */
export function hardenLinkResponse(r){const headers=new Headers(r.headers);for(const [name,value] of Object.entries(LINK_HEADERS))headers.set(name,value);return new Response(r.body,{status:r.status,statusText:r.statusText,headers});}
function refusal(error){const code=typeof error?.code==='string'?error.code:typeof error?.message==='string'?error.message:'',status=statuses.get(code);return response({error:{code:status?code:'DOWNLOAD_LINK_REFUSED'}},status??502);}
/** The retention subjects the canonical artifact read gate consults for a version read from this session's conversation. */
const versionSubjects=(binding,version)=>[{tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId},
 ...(version.binding.conversationId===binding.conversationId?[]:[{tenantId:version.binding.tenantId,kind:'conversation',subjectId:version.binding.conversationId}]),
 {tenantId:version.binding.tenantId,kind:'artifact',subjectId:version.artifactId}];
/** The signing key is a secret file read through the runtime's owner-only readSecret. */
export async function readDownloadLinkKey(keyFile){const key=await readSecret(keyFile);if(key.length<MIN_KEY_BYTES)throw fault('DOWNLOAD_LINK_CONFIGURATION');return key;}
export function createDownloadLinkApplication({documents,sessions,key,generation,now=Date.now,ttlMs=60000,maxRequestMs}){
 if(typeof documents?.handle!=='function'||typeof sessions?.authenticateSession!=='function'||typeof sessions?.readCurrentState!=='function'||typeof generation!=='function'||!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>MAX_TTL_MS||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>60000)throw fault('DOWNLOAD_LINK_CONFIGURATION');
 const codec=createSignedDownloadCodec({key,now});
 const forward=(request,intent,body,signal)=>{const serialized=JSON.stringify(body),headers=new Headers(request.headers);headers.set('content-length',String(Buffer.byteLength(serialized)));
  return documents.handle(new Request(new URL('/api/documents/'+intent,request.url),{method:'POST',headers,body:serialized,signal}));};
 async function current(request,life){
  const credential=/^Bearer (\S{1,4096})$/u.exec(request.headers.get('authorization')??'')?.[1];if(!credential)fail('UNAUTHENTICATED');
  const authentication=await life.run(signal=>sessions.authenticateSession({credential,signal})),c=data(await life.run(signal=>sessions.readCurrentState({authentication,signal})));
  return {binding:c.binding,actorId:c.binding.actorId,expiresAtMs:c.expiresAtMs,scopeDigest:canonicalSha256({tenantId:c.binding.tenantId,conversationId:c.binding.conversationId,selectedClientId:c.selectedClientId,scopes:c.scopes})};
 }
 /** Canonical inspect, generation, canonical download, exact bytes and unchanged generation, all under the caller's own session.
  * With `expected` (redemption) the signed sha256 and generation must match before the download is attempted. A canonical refusal is
  * returned as `{refused}` unchanged. */
 async function authorizedRead(request,versionId,who,life,expected=null){
  const inspected=await life.run(signal=>forward(request,'inspect',{versionId},signal));if(inspected.status!==200)return {refused:inspected};
  const {version}=data(await life.run(()=>inspected.json()));if(version?.versionId!==versionId)fail('DOWNLOAD_LINK_REFUSED');
  if(expected&&version.object.sha256!==expected.sha256)fail('DOWNLOAD_LINK_BYTES');
  const subjects=versionSubjects(who.binding,version),read=()=>life.run(()=>generation(subjects)),suppressionGeneration=await read();
  if(expected&&suppressionGeneration!==expected.suppressionGeneration)fail('DOWNLOAD_LINK_REVOKED');
  const downloaded=await life.run(signal=>forward(request,'download',{versionId},signal));if(downloaded.status!==200)return {refused:downloaded};
  const bytes=Buffer.from(await life.run(()=>downloaded.arrayBuffer()));if(sha256(bytes)!==version.object.sha256)fail('DOWNLOAD_LINK_BYTES');
  if(await read()!==suppressionGeneration)fail('DOWNLOAD_LINK_REVOKED');
  // Final authority read after the last asynchronous body and suppression reads: the same actor and scope digest under a session that
  // is still current and unexpired. Nothing is awaited between this check and the caller's release or signature.
  const latest=await current(request,life);if(latest.actorId!==who.actorId||latest.scopeDigest!==who.scopeDigest)fail('DOWNLOAD_LINK_ACTOR');
  if(now()>=latest.expiresAtMs)fail('SESSION_REFUSED');life.check();
  return {version,bytes,headers:downloaded.headers,suppressionGeneration,sessionExpiresAtMs:latest.expiresAtMs};
 }
 async function issue(request,body,life){
  const {versionId}=own(body,['versionId']);if(typeof versionId!=='string')fail('INVALID_REQUEST');const who=await current(request,life),read=await authorizedRead(request,versionId,who,life);if(read.refused)return read.refused;
  const expiresAtMs=Math.min(now()+ttlMs,read.sessionExpiresAtMs),token=codec.issue({versionId,sha256:read.version.object.sha256,scopeDigest:who.scopeDigest,actorId:who.actorId,expiresAtMs,suppressionGeneration:read.suppressionGeneration});
  return response({versionId,token,expiresAtMs});
 }
 async function redeem(request,body,life){
  const {token}=own(body,['token']),who=await current(request,life),claims=codec.verify(token);
  if(who.actorId!==claims.actorId||who.scopeDigest!==claims.scopeDigest)fail('DOWNLOAD_LINK_ACTOR');
  const read=await authorizedRead(request,claims.versionId,who,life,claims);if(read.refused)return read.refused;
  if(now()>=claims.expiresAtMs)fail('DOWNLOAD_LINK_EXPIRED');life.check();
  return new Response(read.bytes,{status:200,headers:read.headers});
 }
 return Object.freeze({async handle(request){
  const url=new URL(request.url),route=LINK_ROUTE.exec(url.pathname);if(!route)return documents.handle(request);let life;
  try{
   if(request.method!=='POST')fail('METHOD_NOT_ALLOWED');if(url.search||url.hash)fail('INVALID_REQUEST');if(!JSON_TYPE.test(request.headers.get('content-type')??'')||request.headers.get('content-encoding')!==null)fail('UNSUPPORTED_MEDIA_TYPE');
   const length=request.headers.get('content-length');if(length!==null&&!/^(0|[1-9][0-9]*)$/u.test(length))fail('INVALID_CONTENT_LENGTH');
   life=createOperationLifetime({deadlineMs:now()+maxRequestMs,now,signal:request.signal,errorFactory:code=>new CommandError(code)});
   const body=data(await jsonBody({body:request.body,length:length===null?null:Number(length)},MAX_BODY_BYTES,life,life.check));
   return hardenLinkResponse(await (route[1]==='issue'?issue:redeem)(request,body,life));
  }catch(error){return hardenLinkResponse(refusal(error));}finally{life?.close();}
 }});
}
