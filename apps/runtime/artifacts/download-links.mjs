/** Short-lived revocable download links over the unchanged canonical document application. Two additive routes; every other path,
 * including the existing `/api/documents/download`, is delegated to the wrapped application unchanged, and link bytes still flow
 * through that canonical download (or, for `target:'preview'`, through the canonical `/api/documents/preview` route).
 *   POST /api/documents/links/issue  {versionId, target?} -> {versionId, target?, token, expiresAtMs}  (target: download (default) | preview)
 *   POST /api/documents/links/redeem {token}              -> the attachment the canonical download returns, or the inline preview
 * Both require the caller's Bearer session and a JSON body; a token is accepted only in the redeem body, never in a URL, so it cannot
 * reach request-line access logs, URL telemetry or a Referer. Issuance and redemption run the same authorized read: canonical inspect
 * (version-scoped `artifact.inspect` authorization, retention gate, current bytes), the suppression generation, then the canonical
 * download (version-scoped `artifact.download` authorization for that exact version and its bytes), the exact bytes hash and the
 * generation again, then the final authority read (same actor, scope digest, unexpired session) and a final suppression generation
 * read. Issuance signs the version's sha256, the current actor, scope digest and generation; it never signs a link the caller could
 * not download now. Redemption authenticates first, verifies the MAC and expiry, requires the same current actor and scope digest, the
 * signed sha256 and generation before any byte read, and rechecks link expiry synchronously before release.
 *
 * Linearization point. A read (issue or redeem) takes effect at the final authority read. At that instant the caller's session was
 * observed current with the same actor and scope digest, and retention was servable throughout: the final generation read that
 * follows it re-runs the canonical journal check (barrier open before and after, no subject in a non-RELEASED state) and returns the
 * same generation as the read taken before the bytes were fetched. The generation is the highest acknowledged retention ledger
 * sequence of the subjects, strictly increasing on any suppression or release, so equality proves that no suppression or release of
 * any subject committed between those two reads. Nothing is awaited after the final generation read: the remaining actor, scope,
 * session-expiry, link-expiry and request-lifetime checks and the release or signature are synchronous. Consequently:
 *  - a suppression, release or barrier closure that commits before the final generation read is observed, and nothing is released or
 *    signed (this includes one that lands during the final authority read);
 *  - an authority change that commits before the final authority read is observed, and nothing is released or signed;
 *  - a suppression or barrier closure that commits after the final generation read, or an authority change that commits after the
 *    final authority read, is ordered after this read: it is equivalent to that change committing just after a download that had
 *    already completed. That is the retention owner's model: suppression revokes access from its commit onwards and records issued
 *    access it cannot recall (`cannotRecall`), and physical purge is a separate step that requires the subject to stay suppressed for
 *    the policy's positive cooling period, so the released bytes were servable to this caller at the linearization point and no read
 *    linearized before a suppression can observe a purge. A link signed before a later suppression is revoked by that suppression,
 *    because its redemption is a new read that observes the advanced generation.
 * Every response on these routes is `no-store`, `no-referrer` and `nosniff`; refusals carry closed codes only and never echo a token. */
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {own,data,CommandError} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {jsonBody,response} from '../../control/document-application/http.mjs';
import {createSignedDownloadCodec,MIN_KEY_BYTES,MAX_TTL_MS,LINK_TARGETS} from '../../artifacts/storage/signed-download.mjs';
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
 /** Canonical inspect, generation, canonical download, exact bytes, unchanged generation, final authority and final generation, all
  * under the caller's own session.
  * With `expected` (redemption) the signed sha256 and generation must match before the download is attempted. A canonical refusal is
  * returned as `{refused}` unchanged. */
 async function authorizedRead(request,versionId,target,who,life,expected=null){
  const inspected=await life.run(signal=>forward(request,'inspect',{versionId},signal));if(inspected.status!==200)return {refused:inspected};
  const {version}=data(await life.run(()=>inspected.json()));if(version?.versionId!==versionId)fail('DOWNLOAD_LINK_REFUSED');
  if(expected&&target==='download'&&version.object.sha256!==expected.sha256)fail('DOWNLOAD_LINK_BYTES');
  const subjects=versionSubjects(who.binding,version),read=()=>life.run(()=>generation(subjects)),suppressionGeneration=await read();
  if(expected&&suppressionGeneration!==expected.suppressionGeneration)fail('DOWNLOAD_LINK_REVOKED');
  // The canonical download, or the canonical preview read (which itself binds the preview to this version's exact bytes).
  const downloaded=await life.run(signal=>forward(request,target,{versionId},signal));if(downloaded.status!==200)return {refused:downloaded};
  const bytes=Buffer.from(await life.run(()=>downloaded.arrayBuffer())),digest=sha256(bytes);
  if(target==='download'&&digest!==version.object.sha256||expected&&digest!==expected.sha256)fail('DOWNLOAD_LINK_BYTES');
  // Early refusal of a suppression that landed during the body read, before spending an authority read.
  if(await read()!==suppressionGeneration)fail('DOWNLOAD_LINK_REVOKED');
  // The linearization point (module comment): the final authority read, then the final generation read, which brackets it with the
  // pre-download generation. These are the last awaited operations; every check after them is synchronous up to release or signature.
  const latest=await current(request,life);if(latest.actorId!==who.actorId||latest.scopeDigest!==who.scopeDigest)fail('DOWNLOAD_LINK_ACTOR');
  const confirmed=await read();
  if(confirmed!==suppressionGeneration)fail('DOWNLOAD_LINK_REVOKED');if(now()>=latest.expiresAtMs)fail('SESSION_REFUSED');life.check();
  return {version,bytes,digest,headers:downloaded.headers,suppressionGeneration,sessionExpiresAtMs:latest.expiresAtMs};
 }
 async function issue(request,body,life){
  const {versionId,target='download'}=own(body,['versionId'],['target']);if(typeof versionId!=='string'||!LINK_TARGETS.includes(target))fail('INVALID_REQUEST');
  const who=await current(request,life),read=await authorizedRead(request,versionId,target,who,life);if(read.refused)return read.refused;
  const preview=target==='preview'?{target}:{},expiresAtMs=Math.min(now()+ttlMs,read.sessionExpiresAtMs);
  const token=codec.issue({versionId,...preview,sha256:read.digest,scopeDigest:who.scopeDigest,actorId:who.actorId,expiresAtMs,suppressionGeneration:read.suppressionGeneration});
  return response({versionId,...preview,token,expiresAtMs});
 }
 async function redeem(request,body,life){
  const {token}=own(body,['token']),who=await current(request,life),claims=codec.verify(token);
  if(who.actorId!==claims.actorId||who.scopeDigest!==claims.scopeDigest)fail('DOWNLOAD_LINK_ACTOR');
  const read=await authorizedRead(request,claims.versionId,claims.target??'download',who,life,claims);if(read.refused)return read.refused;
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
