/** Short-lived revocable download links over the unchanged canonical document application. Two additive routes; every other path,
 * including the existing `/api/documents/download`, is delegated to the wrapped application unchanged, and link bytes still flow
 * through that canonical download.
 *   POST /api/documents/links/issue  {versionId} -> {versionId, token, expiresAtMs}
 *   POST /api/documents/links/redeem {token}     -> the attachment the canonical download returns
 * Both require the caller's Bearer session. Issuance runs the canonical inspect (authorization, retention gate, current bytes) and
 * signs the version's exact sha256, the current actor, the current scope digest and the current suppression generation. Redemption
 * verifies the MAC and expiry, re-reads current authority (same actor and scope digest), re-inspects the version, requires the
 * generation unchanged, runs the canonical download, requires the exact bytes hash, and rechecks generation and expiry before release. */
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {own,data,CommandError} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {jsonBody,response} from '../../control/document-application/http.mjs';
import {createSignedDownloadCodec,MIN_KEY_BYTES,MAX_TTL_MS} from '../../artifacts/storage/signed-download.mjs';
import {readSecret,fault} from '../config.mjs';
const ROUTE=/^\/api\/documents\/links\/(issue|redeem)$/u,MAX_BODY_BYTES=4096;
const statuses=new Map([['INVALID_REQUEST',400],['INVALID_COMMAND',400],['INVALID_JSON',400],['INVALID_UTF8',400],['INVALID_BODY',400],['INVALID_CONTENT_LENGTH',400],['REQUEST_TOO_LARGE',413],['METHOD_NOT_ALLOWED',405],['UNAUTHENTICATED',401],
 ['SESSION_REFUSED',403],['ACCESS_DENIED',403],['DOWNLOAD_LINK_INVALID',403],['DOWNLOAD_LINK_ACTOR',403],['DOWNLOAD_LINK_CLAIMS',403],['DOWNLOAD_LINK_EXPIRED',410],['DOWNLOAD_LINK_REVOKED',410],['RETENTION_SUPPRESSED',410],
 ['DOWNLOAD_LINK_BYTES',409],['RETENTION_RECOVERY_BARRIER',503],['RETENTION_READ_UNAVAILABLE',503],['DEADLINE',408],['CANCELLED',499]]);
const fail=code=>{throw Object.assign(new Error(code),{code});};
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
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
 async function inspect(request,versionId,life){
  const r=await life.run(signal=>forward(request,'inspect',{versionId},signal));if(r.status!==200)return {refused:r};
  const {version}=data(await life.run(()=>r.json()));if(version?.versionId!==versionId)fail('DOWNLOAD_LINK_REFUSED');return {version};
 }
 async function issue(request,body,life){
  const {versionId}=own(body,['versionId']);if(typeof versionId!=='string')fail('INVALID_REQUEST');const who=await current(request,life),inspected=await inspect(request,versionId,life);if(inspected.refused)return inspected.refused;
  const {version}=inspected,suppressionGeneration=await life.run(()=>generation(versionSubjects(who.binding,version)));life.check();
  const expiresAtMs=Math.min(now()+ttlMs,who.expiresAtMs),token=codec.issue({versionId,sha256:version.object.sha256,scopeDigest:who.scopeDigest,actorId:who.actorId,expiresAtMs,suppressionGeneration});
  return response({versionId,token,expiresAtMs});
 }
 async function redeem(request,body,life){
  const {token}=own(body,['token']),claims=codec.verify(token),who=await current(request,life);
  if(who.actorId!==claims.actorId||who.scopeDigest!==claims.scopeDigest)fail('DOWNLOAD_LINK_ACTOR');
  const inspected=await inspect(request,claims.versionId,life);if(inspected.refused)return inspected.refused;if(inspected.version.object.sha256!==claims.sha256)fail('DOWNLOAD_LINK_BYTES');
  const subjects=versionSubjects(who.binding,inspected.version),unchanged=async()=>{if(await life.run(()=>generation(subjects))!==claims.suppressionGeneration)fail('DOWNLOAD_LINK_REVOKED');};
  await unchanged();const r=await life.run(signal=>forward(request,'download',{versionId:claims.versionId},signal));if(r.status!==200)return r;
  const bytes=Buffer.from(await life.run(()=>r.arrayBuffer()));if(sha256(bytes)!==claims.sha256)fail('DOWNLOAD_LINK_BYTES');
  await unchanged();if(now()>=claims.expiresAtMs)fail('DOWNLOAD_LINK_EXPIRED');life.check();
  return new Response(bytes,{status:200,headers:r.headers});
 }
 return Object.freeze({async handle(request){
  const url=new URL(request.url),route=ROUTE.exec(url.pathname);if(!route)return documents.handle(request);let life;
  try{
   if(request.method!=='POST')fail('METHOD_NOT_ALLOWED');if(url.search||url.hash)fail('INVALID_REQUEST');const length=request.headers.get('content-length');if(length!==null&&!/^(0|[1-9][0-9]*)$/u.test(length))fail('INVALID_CONTENT_LENGTH');
   life=createOperationLifetime({deadlineMs:now()+maxRequestMs,now,signal:request.signal,errorFactory:code=>new CommandError(code)});
   const body=data(await jsonBody({body:request.body,length:length===null?null:Number(length)},MAX_BODY_BYTES,life,life.check));
   return await (route[1]==='issue'?issue:redeem)(request,body,life);
  }catch(error){return refusal(error);}finally{life?.close();}
 }});
}
