/** Readiness gate for the signed download link routes at the runtime root. The gate wraps the canonical document application: every
 * path except `/api/documents/links/{issue,redeem}` is delegated unchanged, and those two routes answer a stable
 * `503 {error:{code:'DOWNLOADS_UNAVAILABLE'}}` until trusted startup opens the gate. `open` enables the routes only when, in order:
 * the control configuration declares `downloadLinks.enabled === true`; retention serving is composed (its journal supplies the
 * suppression generation that revokes links); the artifact authorization owner is composed (it authorizes each exact version per
 * request); the private artifact store is composed and its read-only privacy proof passes; and the signing key file reads through
 * `readSecret` with at least 32 bytes. The key is read last, so no secret is read for a gate that cannot open. Any failure leaves the
 * routes closed with a closed reason code and leaves the rest of the API untouched. The gate opens at most once and never re-closes
 * itself; per-request authority, retention and expiry are still enforced by the link application. Construction performs no IO. */
import {response} from '../../control/document-application/http.mjs';
import {createDownloadLinkApplication,readDownloadLinkKey,hardenLinkResponse,LINK_ROUTE} from './download-links.mjs';
import {createSuppressionGeneration} from './suppression-generation.mjs';
import {fault} from '../config.mjs';
export const DOWNLOADS_UNAVAILABLE='DOWNLOADS_UNAVAILABLE',DEFAULT_LINK_TTL_MS=60000;
/** Closed reason codes; `ENABLED` is the only open state. */
export const GATE_REASONS=Object.freeze(['ENABLED','DOWNLOAD_LINKS_DISABLED','DOWNLOAD_LINKS_NOT_OPENED','DOWNLOAD_LINK_RETENTION_UNAVAILABLE','DOWNLOAD_LINK_AUTHORIZATION_UNAVAILABLE','DOWNLOAD_LINK_STORE_UNAVAILABLE','DOWNLOAD_LINK_STORE_UNVERIFIED','DOWNLOAD_LINK_KEY_UNAVAILABLE']);
/** `links` is the validated `downloadLinks` control block or undefined; `suppression` is `{journal,serving}` from retention serving;
 * `authorization` and `store` are the captured `artifactOptionsOwner` and `artifactStore` product ports, when composed. */
export function createDownloadLinkGate({documents,sessions,now,maxRequestMs,links,suppression,authorization,store}){
 if(typeof documents?.handle!=='function'||typeof now!=='function')throw fault('DOWNLOAD_LINK_CONFIGURATION');
 let application=null,reason=links?.enabled===true?'DOWNLOAD_LINKS_NOT_OPENED':'DOWNLOAD_LINKS_DISABLED',opening;
 async function verify(signal){
  if(links?.enabled!==true)return 'DOWNLOAD_LINKS_DISABLED';
  if(suppression===undefined)return 'DOWNLOAD_LINK_RETENTION_UNAVAILABLE';
  if(typeof authorization?.resolve!=='function')return 'DOWNLOAD_LINK_AUTHORIZATION_UNAVAILABLE';
  if(typeof store?.verifyPrivate!=='function')return 'DOWNLOAD_LINK_STORE_UNAVAILABLE';
  try{await store.verifyPrivate({signal});}catch{signal?.throwIfAborted();return 'DOWNLOAD_LINK_STORE_UNVERIFIED';}
  signal?.throwIfAborted();let key;
  try{key=await readDownloadLinkKey(links.keyFile);}catch{signal?.throwIfAborted();return 'DOWNLOAD_LINK_KEY_UNAVAILABLE';}
  try{application=createDownloadLinkApplication({documents,sessions,key,generation:createSuppressionGeneration(suppression),now,ttlMs:links.ttlMs??DEFAULT_LINK_TTL_MS,maxRequestMs});}
  finally{key.fill(0);}
  return 'ENABLED';
 }
 return Object.freeze({
  /** Runs the startup verification once; resolves to the gate state. Only an aborted startup signal rejects. */
  open({signal}={}){return opening??=(async()=>{reason=await verify(signal);return state();})();},
  state,
  handle(request){if(!LINK_ROUTE.test(new URL(request.url).pathname))return documents.handle(request);return application?application.handle(request):hardenLinkResponse(response({error:{code:DOWNLOADS_UNAVAILABLE}},503));},
 });
 function state(){return Object.freeze({enabled:application!==null,reason});}
}
