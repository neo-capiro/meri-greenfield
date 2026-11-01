/** Closed wire contract for the custody-mediated fixed native inspection purpose.
 *
 * Custody owns the tenant/actor/client/source and the exact original S3 VersionId/hash/bytes. This contract carries
 * only the POLICY-VALID closed original declaration plus the exact original bytes, and it returns receipts that the
 * EXISTING `validateUploadInspection` gate already accepts. It is not an authority: nothing here re-checks current
 * access, so the upload owner's existing inspect operation (its current-authority recheck before dispatch and its
 * retention gate after the result) stays the only authority for an inspection, and no caller- or browser-supplied
 * owner field is honoured anywhere on this path.
 *
 * The bounds are the EXISTING upload bounds rather than new ones: the original is bounded by the contract's own
 * `originalBytes` (10 MiB), the request wire is that byte count in base64 plus ONE fixed JSON envelope allowance, and
 * the response is bounded by the extractor's own bounded output -- never by unbounded JSON. The renderer's 8 MiB and
 * 12 MiB wire values belong to a different purpose and are untouched.
 *
 * Session identity is SERVER-selected, derived from the request identity this transport generated, and immutable for
 * the call: `meri-inspect-<64 hex>`. The purpose is derived from that prefix ONLY and never from the request body, so
 * a request can neither select a runtime, session, image, tool or program nor switch the environment's purpose.
 */
import {createHash} from 'node:crypto';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {UPLOAD_LIMITS,uploadDeclaration} from '../../control/uploads/policy.mjs';
import {validateUploadInspection} from '../../control/uploads/extraction.mjs';

export const UPLOAD_INSPECTION_SESSION_PREFIX='meri-inspect-';
/** The existing upload original bound; this purpose admits nothing larger. */
export const UPLOAD_INSPECTION_ORIGINAL_BYTES=UPLOAD_LIMITS.originalBytes;
/** Exactly that byte count in base64. */
export const UPLOAD_INSPECTION_BASE64_BYTES=Math.ceil(UPLOAD_INSPECTION_ORIGINAL_BYTES/3)*4;
/** One fixed envelope allowance over the base64 body for the declaration, identity and deadline fields. */
export const UPLOAD_INSPECTION_WIRE_BYTES=UPLOAD_INSPECTION_BASE64_BYTES+65536;
/** The extractor's own bounded output; the result of one fixed inspection can never exceed it. */
export const UPLOAD_INSPECTION_RESULT_BYTES=16*1024*1024;
/** The same per-call bound the renderer purpose uses: one AgentCore invocation is never open-ended. */
export const UPLOAD_INSPECTION_MAX_DEADLINE_MS=60000;
/** The inspection and custody hosts are separate clocks. One bounded skew is admitted when the receipt's own
 * observation stamp is re-checked against this operation; the custody record's own retained window remains the
 * retention gate, and no unbounded or host-supplied window is accepted. */
export const UPLOAD_INSPECTION_CLOCK_SKEW_MS=60000;
/** The documented `InvokeAgentRuntime` payload bound. This purpose's wire bound is far below it; it is recorded so a
 * reader can see that the ordinary IAM JSON transport is used well inside its own documented limit. */
export const UPLOAD_INSPECTION_PAYLOAD_LIMIT_BYTES=100000000;

export const uploadInspectionFault=code=>Object.assign(new Error(code),{code});
export const uploadInspectionSha=bytes=>createHash('sha256').update(bytes).digest('hex');
/** The SERVER-selected session identity for one call. A caller cannot choose it: the request identity is generated
 * by the transport and the session is a pure function of it. */
export function uploadInspectionSessionId(requestId){
 if(typeof requestId!=='string'||!/^[a-f0-9]{64}$/u.test(requestId))throw uploadInspectionFault('UPLOAD_INSPECTION_REQUEST_REFUSED');
 return UPLOAD_INSPECTION_SESSION_PREFIX+requestId;
}
/** The inspection purpose of a session header, or null. Any other session is another purpose (the SDK or the
 * renderer) and is never served by this application. */
export function uploadInspectionPurpose(session){
 if(typeof session!=='string'||!session.startsWith(UPLOAD_INSPECTION_SESSION_PREFIX))return null;
 const requestId=session.slice(UPLOAD_INSPECTION_SESSION_PREFIX.length);
 return /^[a-f0-9]{64}$/u.test(requestId)?Object.freeze({session,requestId}):null;
}
/** Validate one closed inspection request and return it with the exact original bytes it binds.
 *
 * Every refusal is the same closed code, so an unauthenticated caller learns nothing about policy internals; the
 * caller-side `uploadOriginalIdentity` gate still reports the specific identity code for a locally materialized byte
 * set, and the host's structural verdict travels back inside its receipt as a retained blocked extraction.
 * Bytes are refused unless they are the declaration's exact byte count, the declaration's own sha256, the
 * declared input sha256, and a base64 round-trip identity of what was sent.
 */
export function uploadInspectionRequest(raw){
 const refuse=()=>{throw uploadInspectionFault('UPLOAD_INSPECTION_REQUEST_REFUSED');};
 try{
  const c=data(own(raw,['kind','requestId','imageDigest','declaration','bytesBase64','inputSha256','deadlineMs']));
  uploadInspectionSessionId(c.requestId);
  if(c.kind!=='upload-inspection'||typeof c.imageDigest!=='string'||!/^sha256:[a-f0-9]{64}$/u.test(c.imageDigest)||
   !Number.isSafeInteger(c.deadlineMs)||c.deadlineMs<0||typeof c.bytesBase64!=='string'||c.bytesBase64.length>UPLOAD_INSPECTION_BASE64_BYTES||
   typeof c.inputSha256!=='string'||!/^[a-f0-9]{64}$/u.test(c.inputSha256))refuse();
  const declaration=uploadDeclaration(c.declaration);
  const bytes=Buffer.from(c.bytesBase64,'base64');
  if(bytes.length<1||bytes.length>UPLOAD_INSPECTION_ORIGINAL_BYTES||bytes.length!==declaration.bytes||
   bytes.toString('base64')!==c.bytesBase64||uploadInspectionSha(bytes)!==c.inputSha256||c.inputSha256!==declaration.sha256)refuse();
  // The wire object keeps the declaration exactly as the caller sent it: the closed four-key declaration is what the
  // fixed owner's own `inspect` accepts, and re-deriving a normalized declaration here would only be re-validated.
  return Object.freeze({request:Object.freeze({...c}),bytes});
 }catch{refuse();}
}
/** Validate one closed inspection result against the closed declaration and the call that produced it.
 *
 * The receipts are re-checked by the EXISTING `validateUploadInspection` gate, so a remote result is admitted only
 * when it is bound to the exact original bytes and to a tool that was observed; a non-clean scan can never carry
 * extracted segments, and an ambiguous or malformed result is never turned into clean or extracted content. The
 * image digest is the DECLARED expectation only: unobserved provenance cannot be asserted as observed, and a
 * different declared digest refuses the result instead of being reported as the declared one.
 */
export function uploadInspectionResult(raw,{requestId,declaration,imageDigest,fromMs,toMs}){
 const refuse=()=>{throw uploadInspectionFault('UPLOAD_INSPECTION_RESULT_REFUSED');};
 try{
  const r=data(own(raw,['kind','requestId','file','scan','extraction'],['provenance']));
  if(r.kind!=='upload-inspection-result'||r.requestId!==requestId||!Number.isSafeInteger(fromMs)||!Number.isSafeInteger(toMs)||fromMs>toMs)refuse();
  const value=validateUploadInspection({file:r.file,scan:r.scan,extraction:r.extraction},declaration,{fromMs,toMs});
  if(r.provenance!==undefined){
   const p=own(data(r.provenance),['expectedImageDigest','imageObserved']);
   if(p.expectedImageDigest!==imageDigest||p.imageObserved!==false)refuse();
  }
  return Object.freeze({...value,requestId});
 }catch{refuse();}
}
/** The closed result body for one successful inspection. Built from what the fixed owner actually returned; the
 * provenance block is inert and explicitly UNOBSERVED, because observing a running image is another owner's join. */
export function uploadInspectionBody({requestId,imageDigest,value}){
 return Object.freeze({kind:'upload-inspection-result',requestId,file:value.file,scan:value.scan,extraction:value.extraction,
  provenance:Object.freeze({expectedImageDigest:imageDigest,imageObserved:false})});
}
