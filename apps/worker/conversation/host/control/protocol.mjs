/** Fixed wire identity for one D005 currentness read. Shape checks never establish authority. */
import {createHash} from 'node:crypto';
import {own,data,nativeSignal} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {ARTIFACT_MIME_TYPES} from '../../../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {assertHostAllocation,assertBrowserHostAllocation,assertNativeProcessingAllocation,assertHostRunBinding,assertD005HostIdentity,assertHostCurrent,assertBrowserHostCurrent,assertNativeHostCurrent} from '../binding.mjs';
import {assertBrowserApprovalRequest} from '../../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {assertNativeUploadCustody} from '../../../../runtime/uploads/native-host-contract.mjs';
import {assertBrowserActionReceipt,browserActionReceiptEventId,assertBrowserDownloadReceipt,browserDownloadReceiptEventId} from '../../../../../packages/contracts/runtime-0.2/browser-receipt.mjs';
import {assertConversationEvent,isBrowserReceiptEventType}
 from '../../../../../packages/contracts/conversation-sources/validate.mjs';
import {receiptRefusal} from '../../browser/approval-binding.mjs';
import {browserPreparationProposalId} from '../../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';

export const HOST_CONTROL_REQUEST_SCHEMA='meri-host-currentness-request/1';
export const HOST_CONTROL_RESPONSE_SCHEMA='meri-host-currentness-response/1';
export const HOST_CONTROL_PATH='/meri/host/currentness/v1';
export const HOST_CONTROL_MAX_BYTES=32768;
export const HOST_CONTROL_PURPOSES=Object.freeze(['sdk','browser','bash']);
export const HOST_NATIVE_CONTROL_PURPOSE='native-processing';
const HEX=/^[0-9a-f]{64}$/u;
const fail=()=>{throw Object.assign(new Error('HOST_CONTROL_REFUSED'),{code:'HOST_CONTROL_REFUSED'});};

export function hostClientDnsName(allocation){
 const a=assertHostAllocation(allocation);
 return `h-${a.hostId.replaceAll('-','')}-g${a.generation}.host.meri.internal`;
}

/** Named browser/SDK/Bash authority path: unchanged and still browser-allocation-only. */
export function hostBrowserControlRequest(value){
 let v,a,b,i;try{
  v=own(data(value),['schema','allocation','binding','hostIdentity','purpose','policySha256','nonce']);
  a=assertBrowserHostAllocation(v.allocation);b=assertHostRunBinding(a,v.binding);i=assertD005HostIdentity(v.hostIdentity,b,a);
 }catch{fail();}
 if(v.schema!==HOST_CONTROL_REQUEST_SCHEMA||!HOST_CONTROL_PURPOSES.includes(v.purpose)||
  typeof v.policySha256!=='string'||!HEX.test(v.policySha256)||
  typeof v.nonce!=='string'||!HEX.test(v.nonce))fail();
 return Object.freeze({schema:HOST_CONTROL_REQUEST_SCHEMA,allocation:a,binding:b,hostIdentity:i,purpose:v.purpose,
  policySha256:v.policySha256,nonce:v.nonce});
}
/** Deliberate native-processing counterpart: the SAME closed transport envelope, but admitted only against the
 * native allocation/currentness guard. It never admits a browser/SDK/Bash purpose. */
export function hostNativeControlRequest(value){
 let v,a,b,i,inspection;try{
  v=own(data(value),['schema','allocation','binding','hostIdentity','purpose','policySha256','nonce'],['inspection']);
  a=assertNativeProcessingAllocation(v.allocation);b=assertHostRunBinding(a,v.binding);i=assertD005HostIdentity(v.hostIdentity,b,a);
  if(v.inspection!==undefined){
   const raw=own(data(v.inspection),['custody','declaration']);
   const d=own(data(raw.declaration),['filename','mimeType','bytes','sha256']);
   if(typeof d.filename!=='string'||!d.filename||typeof d.mimeType!=='string'||!d.mimeType||
    !Number.isSafeInteger(d.bytes)||d.bytes<1||typeof d.sha256!=='string'||!HEX.test(d.sha256))fail();
   const declaration=Object.freeze({...d});
   const custody=assertNativeUploadCustody(raw.custody,{binding:b,declaration});
   inspection=Object.freeze({custody,declaration});
  }
 }catch{fail();}
 if(v.schema!==HOST_CONTROL_REQUEST_SCHEMA||v.purpose!==HOST_NATIVE_CONTROL_PURPOSE||
  typeof v.policySha256!=='string'||!HEX.test(v.policySha256)||
  typeof v.nonce!=='string'||!HEX.test(v.nonce))fail();
 return Object.freeze({schema:HOST_CONTROL_REQUEST_SCHEMA,allocation:a,binding:b,hostIdentity:i,purpose:v.purpose,
  policySha256:v.policySha256,nonce:v.nonce,...(inspection?{inspection}:{})});
}
/** One named route dispatches by the explicit purpose; browser purposes keep their original validator. */
export function hostControlRequest(value){
 let purpose;try{purpose=data(value)?.purpose;}catch{fail();}
 return purpose===HOST_NATIVE_CONTROL_PURPOSE?hostNativeControlRequest(value):hostBrowserControlRequest(value);
}

export function hostControlResponse(value,request,{nowMs,maxFreshMs}={}){
 const q=hostControlRequest(request);let v,receipt;
 try{v=own(data(value),['schema','nonce','purpose','receipt']);
  if(v.schema!==HOST_CONTROL_RESPONSE_SCHEMA||v.nonce!==q.nonce||v.purpose!==q.purpose)fail();
  receipt=own(v.receipt,['allocation','binding','policySha256','phase','checkedAtMs','currentUntilMs'],q.purpose==='browser'?['browserHandoff']:[]);
  (q.purpose===HOST_NATIVE_CONTROL_PURPOSE?assertNativeHostCurrent:q.purpose==='browser'?assertBrowserHostCurrent:assertHostCurrent)({allocation:q.allocation,binding:q.binding,policySha256:q.policySha256,
   current:receipt,nowMs,maxFreshMs});
 }catch{fail();}
 return Object.freeze(receipt);
}

export function makeHostControlRequest({allocation,binding,hostIdentity,purpose,policySha256,nonce,signal,inspection}={}){
 try{nativeSignal(signal);}catch{fail();}
 if(signal?.aborted)fail();
 return hostControlRequest({schema:HOST_CONTROL_REQUEST_SCHEMA,allocation,binding,hostIdentity,purpose,policySha256,nonce,
  ...(inspection?{inspection}:{})});
}

export function encodeHostControl(value,max=HOST_CONTROL_MAX_BYTES){
 if(!Number.isSafeInteger(max)||max<1)fail();let bytes;
 try{bytes=Buffer.from(JSON.stringify(data(value)),'utf8');}catch{fail();}
 if(bytes.length<1||bytes.length>max)fail();return bytes;
}
export function decodeHostControl(bytes,max=HOST_CONTROL_MAX_BYTES){
 if(!Number.isSafeInteger(max)||max<1||!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>max)fail();
 try{return data(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));}catch{fail();}
}

// ---------------------------------------------------------------------------------------------------
// Three additional named operations on the SAME private mTLS channel. Each has its own closed request
// and answer envelope, its own finite bounds, and its own single-use nonce acknowledged inside the
// authenticated allocation transaction. None of them is a generic RPC or a callable port.
// ---------------------------------------------------------------------------------------------------
export const HOST_FACTS_PATH='/meri/host/facts/v1';
export const HOST_FACTS_REQUEST_SCHEMA='meri-host-facts-request/1';
export const HOST_FACTS_RESPONSE_SCHEMA='meri-host-facts-response/1';
/** The facts payload bound is separate from the currentness 32 KiB ceiling; the envelope overhead is
 * accounted explicitly so a valid 256-origin/64x256-selector payload is never silently truncated. */
export const HOST_FACTS_MAX_BYTES=262144;
export const HOST_FACTS_ENVELOPE_BYTES=4096;
export const HOST_FACTS_WIRE_MAX_BYTES=HOST_FACTS_MAX_BYTES+HOST_FACTS_ENVELOPE_BYTES;

export const HOST_WORKFLOW_PATH='/meri/host/workflow/v1';
export const HOST_WORKFLOW_REQUEST_SCHEMA='meri-host-workflow-request/1';
export const HOST_WORKFLOW_RESPONSE_SCHEMA='meri-host-workflow-response/1';
export const HOST_WORKFLOW_MAX_BYTES=131072;
export const HOST_WORKFLOW_ENVELOPE_BYTES=4096;
export const HOST_WORKFLOW_WIRE_MAX_BYTES=HOST_WORKFLOW_MAX_BYTES+HOST_WORKFLOW_ENVELOPE_BYTES;

export const HOST_HOLD_PATH='/meri/host/hold/v1';
export const HOST_HOLD_REQUEST_SCHEMA='meri-host-hold-request/1';
export const HOST_HOLD_RESPONSE_SCHEMA='meri-host-hold-response/1';
export const HOST_HOLD_MAX_BYTES=16384;
export const HOST_HOLD_ENVELOPE_BYTES=2048;
export const HOST_HOLD_WIRE_MAX_BYTES=HOST_HOLD_MAX_BYTES+HOST_HOLD_ENVELOPE_BYTES;
export const HOST_OPERATION_REQUEST_MAX_BYTES=HOST_CONTROL_MAX_BYTES;

export const HOST_DECIDE_PATH='/meri/host/decide/v1';
export const HOST_DECIDE_REQUEST_SCHEMA='meri-host-decide-request/1';
export const HOST_DECIDE_RESPONSE_SCHEMA='meri-host-decide-response/1';
/** A decide request carries the ORIGINAL request/3 plus the pinned allocation envelope, so its body bound is
 * its own; the currentness 32 KiB / 5000 ms path is unchanged. */
export const HOST_DECIDE_MAX_BYTES=65536;
export const HOST_DECIDE_ENVELOPE_BYTES=8192;
export const HOST_DECIDE_WIRE_MAX_BYTES=HOST_DECIDE_MAX_BYTES+HOST_DECIDE_ENVELOPE_BYTES;
export const HOST_DECIDE_MIN_WINDOW_MS=1000;
export const HOST_DECIDE_MAX_WINDOW_MS=900000;

/** The named approval request: envelope + the exact original meri-browser-approval-request/3 it captured. */
export function hostDecideRequest(value){
 let v,a,b,i,r;try{
  v=own(data(value),['schema','allocation','binding','hostIdentity','nonce','request','deadlineMs']);
  a=assertHostAllocation(v.allocation);b=assertHostRunBinding(a,v.binding);i=assertD005HostIdentity(v.hostIdentity,b,a);
  r=assertBrowserApprovalRequest(v.request);
 }catch{fail();}
 if(v.schema!==HOST_DECIDE_REQUEST_SCHEMA||typeof v.nonce!=='string'||!HEX.test(v.nonce))fail();
 // The ORIGINAL request payload keeps its 64 KiB ceiling; the whole envelope has the larger wire bound.
 if(Buffer.byteLength(JSON.stringify(v.request),'utf8')>HOST_DECIDE_MAX_BYTES)fail();
 // `deadlineMs` is an ABSOLUTE epoch cutoff, never a duration: bound by the original request window and the
 // allocation lease. The original window itself is validated by the request/3 validator above.
 if(!Number.isSafeInteger(v.deadlineMs)||v.deadlineMs<=0)fail();
 if(!same(r.subject.binding,v.binding))fail();
 if(v.deadlineMs>Math.min(r.expiresAtMs,a.leaseDeadlineMs))fail();
 return Object.freeze({schema:HOST_DECIDE_REQUEST_SCHEMA,allocation:a,binding:b,hostIdentity:i,nonce:v.nonce,
  request:r,deadlineMs:v.deadlineMs});
}
/** The answer is either a canonical Core receipt or a CLOSED non-permissive outcome. Nothing here mints a grant. */
export function hostDecideResponse(value,request,atMs){
 let v;try{v=own(data(value),['schema','nonce','outcome','receipt','checkedAtMs','currentUntilMs']);
  if(v.schema!==HOST_DECIDE_RESPONSE_SCHEMA||v.nonce!==request.nonce||
   !['approved','rejected','revoked','expired','pending','unknown'].includes(v.outcome)||
   !Number.isSafeInteger(v.checkedAtMs)||!Number.isSafeInteger(v.currentUntilMs)||v.currentUntilMs<=v.checkedAtMs)fail();
  if(v.outcome==='approved'){
   // The SAME canonical permit validator the real Core forwarder uses, at this observation clock, plus the
   // deterministic proposal identity — never the weaker schema-only helper.
   const request$=request.request,proposalId=browserPreparationProposalId({binding:request.binding,
    toolUseId:request$.subject.toolUseId});
   if(receiptRefusal(v.receipt,request$,atMs)!==null)fail();
   if(v.receipt.proposalId!==proposalId||v.receipt.decision.proposalId!==proposalId)fail();
  }else if(v.receipt!==null)fail();
 }catch{fail();}
 return Object.freeze({schema:HOST_DECIDE_RESPONSE_SCHEMA,nonce:v.nonce,outcome:v.outcome,receipt:v.receipt??null,
  checkedAtMs:v.checkedAtMs,currentUntilMs:v.currentUntilMs});
}

/** Facts, workflow and hold share one closed request envelope: the host's pinned allocation identity,
 * the exact run binding, and a fresh single-use nonce. No policy digest is asserted by the host for
 * these reads, because the answer REPORTS current authority rather than claiming it. */
export function hostOperationRequest(value,schema){
 let v,a,b,i;try{
  v=own(data(value),['schema','allocation','binding','hostIdentity','nonce']);
  // Every NAMED browser/SDK/Bash authority path refuses a native-processing allocation here.
  a=assertBrowserHostAllocation(v.allocation);b=assertHostRunBinding(a,v.binding);i=assertD005HostIdentity(v.hostIdentity,b,a);
 }catch{fail();}
 if(v.schema!==schema||typeof v.nonce!=='string'||!HEX.test(v.nonce))fail();
 return Object.freeze({schema,allocation:a,binding:b,hostIdentity:i,nonce:v.nonce});
}
export const hostFactsRequest=value=>hostOperationRequest(value,HOST_FACTS_REQUEST_SCHEMA);
export const hostWorkflowRequest=value=>hostOperationRequest(value,HOST_WORKFLOW_REQUEST_SCHEMA);
export const hostHoldRequest=value=>hostOperationRequest(value,HOST_HOLD_REQUEST_SCHEMA);

const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const envelope=(value,request,schema,field)=>{let v;try{
  v=own(data(value),['schema','nonce',field,'checkedAtMs','currentUntilMs']);
  if(v.schema!==schema||v.nonce!==request.nonce||!Number.isSafeInteger(v.checkedAtMs)||
   !Number.isSafeInteger(v.currentUntilMs)||v.currentUntilMs<=v.checkedAtMs)fail();
 }catch{fail();}return v;};
export function hostFactsResponse(value,request){const v=envelope(value,request,HOST_FACTS_RESPONSE_SCHEMA,'facts');
 return Object.freeze({schema:HOST_FACTS_RESPONSE_SCHEMA,nonce:v.nonce,facts:v.facts,checkedAtMs:v.checkedAtMs,currentUntilMs:v.currentUntilMs});}
export function hostWorkflowResponse(value,request){const v=envelope(value,request,HOST_WORKFLOW_RESPONSE_SCHEMA,'workflow');
 return Object.freeze({schema:HOST_WORKFLOW_RESPONSE_SCHEMA,nonce:v.nonce,workflow:v.workflow,checkedAtMs:v.checkedAtMs,currentUntilMs:v.currentUntilMs});}
export function hostHoldResponse(value,request){let v;try{
  v=own(data(value),['schema','nonce','outcome','custody','checkedAtMs','currentUntilMs']);
  if(v.schema!==HOST_HOLD_RESPONSE_SCHEMA||v.nonce!==request.nonce||v.outcome!=='APPLIED'||
   !Number.isSafeInteger(v.checkedAtMs)||!Number.isSafeInteger(v.currentUntilMs)||v.currentUntilMs<=v.checkedAtMs)fail();
 }catch{fail();}
 return Object.freeze({schema:HOST_HOLD_RESPONSE_SCHEMA,nonce:v.nonce,outcome:'APPLIED',custody:v.custody,
  checkedAtMs:v.checkedAtMs,currentUntilMs:v.currentUntilMs});}

export const HOST_RECEIPT_PATH='/meri/host/receipt/v1';
export const HOST_RECEIPT_REQUEST_SCHEMA='meri-host-receipt-request/1';
export const HOST_RECEIPT_RESPONSE_SCHEMA='meri-host-receipt-response/1';
export const HOST_RECEIPT_MAX_BYTES=16384;
export const HOST_RECEIPT_ENVELOPE_BYTES=4096;
export const HOST_RECEIPT_WIRE_MAX_BYTES=HOST_RECEIPT_MAX_BYTES+HOST_RECEIPT_ENVELOPE_BYTES;

/** The named action receipt: envelope + the PostToolUse payload. The host never supplies scopes. */
export function hostReceiptRequest(value){
 let v,a,b,i,r;try{
  v=own(data(value),['schema','allocation','binding','hostIdentity','nonce','receipt']);
  a=assertHostAllocation(v.allocation);b=assertHostRunBinding(a,v.binding);i=assertD005HostIdentity(v.hostIdentity,b,a);
  r=assertBrowserActionReceipt(data(v.receipt));
  // The receipt's OWN binding must be the admitted one; a foreign claim is refused, never overwritten.
  if(!same(r.binding,v.binding))fail();
  if(r.kind!=='browser.action')fail();
 }catch{fail();}
 if(v.schema!==HOST_RECEIPT_REQUEST_SCHEMA||typeof v.nonce!=='string'||!HEX.test(v.nonce))fail();
 return Object.freeze({schema:HOST_RECEIPT_REQUEST_SCHEMA,allocation:a,binding:b,hostIdentity:i,nonce:v.nonce,receipt:r});
}
/** The answer carries the producer's ACTUAL durable acknowledgement, never a synthesized one. */
export function hostReceiptResponse(value,request){
 let v;try{
  v=own(data(value),['schema','nonce','eventId','recorded','event','checkedAtMs','currentUntilMs']);
  if(v.schema!==HOST_RECEIPT_RESPONSE_SCHEMA||v.nonce!==request.nonce||v.recorded!==true||
   typeof v.eventId!=='string'||!v.event||typeof v.event!=='object')fail();
  if(!Number.isSafeInteger(v.checkedAtMs)||!Number.isSafeInteger(v.currentUntilMs)||v.currentUntilMs<=v.checkedAtMs)fail();
  // A REAL conversation event acknowledgement, not a schema-only object: canonical event shape, the browser
  // receipt type, the DETERMINISTIC identity for this binding/session/tool use, the exact binding and the
  // exact submitted canonical receipt as its data.
  const event=assertConversationEvent(data(v.event));
  if(!isBrowserReceiptEventType(event.type))fail();
  const expected=browserActionReceiptEventId({binding:request.binding,sessionId:request.receipt.sessionId,
   toolUseId:request.receipt.toolUseId});
  if(v.eventId!==expected||event.eventId!==expected)fail();
  if(!same(event.binding,request.binding))fail();
  if(!same(event.data,request.receipt))fail();
 }catch{fail();}
 return Object.freeze({schema:HOST_RECEIPT_RESPONSE_SCHEMA,nonce:v.nonce,eventId:v.eventId,recorded:true,
  event:v.event,checkedAtMs:v.checkedAtMs,currentUntilMs:v.currentUntilMs});
}


export const HOST_INGEST_PATH='/meri/host/ingest/v1';
export const HOST_INGEST_REQUEST_SCHEMA='meri-host-ingest-request/1';
export const HOST_INGEST_RESPONSE_SCHEMA='meri-host-ingest-response/1';
/** Raw bytes never exceed the canonical Meri artifact wire ceiling; base64 and envelope bounds are derived from
 * that SAME constant on both ends, so client, server and parser cannot disagree. */
export const HOST_INGEST_MAX_BYTES=16777216;
export const HOST_INGEST_BASE64_MAX=Math.ceil(HOST_INGEST_MAX_BYTES/3)*4;
export const HOST_INGEST_ENVELOPE_BYTES=8192;
export const HOST_INGEST_WIRE_MAX_BYTES=HOST_INGEST_BASE64_MAX+HOST_INGEST_ENVELOPE_BYTES;
export const HOST_INGEST_RESPONSE_MAX_BYTES=4096;
const FILENAME=/^[A-Za-z0-9][A-Za-z0-9._ -]{0,199}$/u,BASE64=/^[A-Za-z0-9+/]*={0,2}$/u;
/** The worker supplies ONLY the file facts and the origin it observed; scopes, provenance digest, acquisition
 * time, idempotency key and the deadline are the durable owner's facts, never this request's. */
export function hostIngestRequest(value){
 let v,a,b,i,g,bytes;try{
  v=own(data(value),['schema','allocation','binding','hostIdentity','nonce','ingest']);
  a=assertBrowserHostAllocation(v.allocation);b=assertHostRunBinding(a,v.binding);
  i=assertD005HostIdentity(v.hostIdentity,b,a);
  // One codec owner for BOTH representations: the wire carries base64, the validated/normalized object carries
  // a Buffer. Exactly one of the two may be present; neither form skips the identity checks.
  const wire=v.ingest&&typeof v.ingest==='object'?own(v.ingest,['filename','format','mimeType','sha256','origin'],
   ['bytesBase64','bytes']):null;
  if(!wire||(wire.bytesBase64===undefined)===(wire.bytes===undefined))fail();
  g=own(wire,['filename','format','mimeType','sha256','origin',wire.bytesBase64!==undefined?'bytesBase64':'bytes']);
  if(typeof g.filename!=='string'||!FILENAME.test(g.filename)||g.filename.includes('..'))fail();
  // The format/mime pair is checked against the one canonical vocabulary here and again by the service.
  if(typeof g.format!=='string'||!Object.hasOwn(ARTIFACT_MIME_TYPES,g.format)||g.mimeType!==ARTIFACT_MIME_TYPES[g.format])fail();
  if(typeof g.sha256!=='string'||!HEX.test(g.sha256))fail();
  if(typeof g.origin!=='string')fail();
  const url=new URL(g.origin);if(url.origin!==g.origin)fail();
  if(g.bytesBase64!==undefined){
   if(typeof g.bytesBase64!=='string'||!g.bytesBase64.length||g.bytesBase64.length>HOST_INGEST_BASE64_MAX||
    !BASE64.test(g.bytesBase64))fail();
   bytes=Buffer.from(g.bytesBase64,'base64');
   if(!bytes.length||bytes.length>HOST_INGEST_MAX_BYTES||bytes.toString('base64')!==g.bytesBase64)fail();
  }else{
   if(!Buffer.isBuffer(g.bytes)||!g.bytes.length||g.bytes.length>HOST_INGEST_MAX_BYTES)fail();
   bytes=Buffer.from(g.bytes);
  }
  if(createHash('sha256').update(bytes).digest('hex')!==g.sha256)fail();
 }catch{fail();}
 if(v.schema!==HOST_INGEST_REQUEST_SCHEMA||typeof v.nonce!=='string'||!HEX.test(v.nonce))fail();
 return Object.freeze({schema:HOST_INGEST_REQUEST_SCHEMA,allocation:a,binding:b,hostIdentity:i,nonce:v.nonce,
  // ONE canonical internal representation: the validated object keeps the canonical base64 form, so it is
  // encodable by the wire codec and revalidatable by this same function (idempotent), with no Buffer inside.
  ingest:Object.freeze({filename:g.filename,format:g.format,mimeType:g.mimeType,sha256:g.sha256,origin:g.origin,
   bytesBase64:bytes.toString('base64')})});
}
/** The answer is the publication owner's exact ACK, under this request's nonce and a fresh currentness window. */
export function hostIngestResponse(value,request){
 const expectedBytes=Buffer.from(request.ingest.bytesBase64,'base64').length;
 let v;try{
  v=own(data(value),['schema','nonce','versionId','sha256','bytes','idempotencyKey','checkedAtMs','currentUntilMs'],['acquiredAtMs','replay']);
  if(v.schema!==HOST_INGEST_RESPONSE_SCHEMA||v.nonce!==request.nonce)fail();
  if(typeof v.versionId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(v.versionId)||
   v.sha256!==request.ingest.sha256||v.bytes!==expectedBytes||
   typeof v.idempotencyKey!=='string'||!HEX.test(v.idempotencyKey)||
   !Number.isSafeInteger(v.checkedAtMs)||!Number.isSafeInteger(v.currentUntilMs)||v.currentUntilMs<=v.checkedAtMs)fail();
  if(v.acquiredAtMs!==undefined&&(!Number.isSafeInteger(v.acquiredAtMs)||v.acquiredAtMs<1))fail();
  if(v.replay!==undefined&&typeof v.replay!=='boolean')fail();
 }catch{fail();}
 return Object.freeze({schema:HOST_INGEST_RESPONSE_SCHEMA,nonce:v.nonce,versionId:v.versionId,sha256:v.sha256,
  bytes:v.bytes,idempotencyKey:v.idempotencyKey,checkedAtMs:v.checkedAtMs,currentUntilMs:v.currentUntilMs,
  ...(v.acquiredAtMs===undefined?{}:{acquiredAtMs:v.acquiredAtMs}),...(v.replay===undefined?{}:{replay:v.replay})});
}


export const HOST_DOWNLOAD_RECEIPT_PATH='/meri/host/download-receipt/v1';
export const HOST_DOWNLOAD_RECEIPT_REQUEST_SCHEMA='meri-host-download-receipt-request/1';
export const HOST_DOWNLOAD_RECEIPT_RESPONSE_SCHEMA='meri-host-download-receipt-response/1';
export const HOST_DOWNLOAD_RECEIPT_MAX_BYTES=16384;
export const HOST_DOWNLOAD_RECEIPT_ENVELOPE_BYTES=4096;
export const HOST_DOWNLOAD_RECEIPT_WIRE_MAX_BYTES=HOST_DOWNLOAD_RECEIPT_MAX_BYTES+HOST_DOWNLOAD_RECEIPT_ENVELOPE_BYTES;
/** The named DOWNLOAD receipt: envelope + the acknowledged canonical download receipt. The host never supplies
 * scopes or authority; the receipt's own binding must be the admitted one. */
export function hostDownloadReceiptRequest(value){
 let v,a,b,i,r;try{
  v=own(data(value),['schema','allocation','binding','hostIdentity','nonce','receipt']);
  a=assertBrowserHostAllocation(v.allocation);b=assertHostRunBinding(a,v.binding);i=assertD005HostIdentity(v.hostIdentity,b,a);
  r=assertBrowserDownloadReceipt(data(v.receipt));
  if(!same(r.binding,v.binding))fail();
  if(r.kind!=='browser.download')fail();
 }catch{fail();}
 if(v.schema!==HOST_DOWNLOAD_RECEIPT_REQUEST_SCHEMA||typeof v.nonce!=='string'||!HEX.test(v.nonce))fail();
 return Object.freeze({schema:HOST_DOWNLOAD_RECEIPT_REQUEST_SCHEMA,allocation:a,binding:b,hostIdentity:i,
  nonce:v.nonce,receipt:r});
}
/** The answer carries the producer's ACTUAL durable acknowledgement and deterministic download identity. */
export function hostDownloadReceiptResponse(value,request){
 let v;try{
  v=own(data(value),['schema','nonce','eventId','recorded','event','checkedAtMs','currentUntilMs']);
  if(v.schema!==HOST_DOWNLOAD_RECEIPT_RESPONSE_SCHEMA||v.nonce!==request.nonce||v.recorded!==true||
   typeof v.eventId!=='string'||!v.event||typeof v.event!=='object')fail();
  if(!Number.isSafeInteger(v.checkedAtMs)||!Number.isSafeInteger(v.currentUntilMs)||v.currentUntilMs<=v.checkedAtMs)fail();
  const event=assertConversationEvent(data(v.event));
  if(!isBrowserReceiptEventType(event.type))fail();
  const expected=browserDownloadReceiptEventId({binding:request.binding,reference:request.receipt.reference});
  if(v.eventId!==expected||event.eventId!==expected)fail();
  if(!same(event.binding,request.binding)||!same(event.data,request.receipt))fail();
 }catch{fail();}
 return Object.freeze({schema:HOST_DOWNLOAD_RECEIPT_RESPONSE_SCHEMA,nonce:v.nonce,eventId:v.eventId,
  recorded:true,event:v.event,checkedAtMs:v.checkedAtMs,currentUntilMs:v.currentUntilMs});
}

export const HOST_DOWNLOAD_RECONCILE_PATH='/meri/host/download-reconcile/v1';
export const HOST_DOWNLOAD_RECONCILE_REQUEST_SCHEMA='meri-host-download-reconcile-request/1';
export const HOST_DOWNLOAD_RECONCILE_RESPONSE_SCHEMA='meri-host-download-reconcile-response/1';
export const HOST_DOWNLOAD_RECONCILE_MAX_BYTES=16384;
export const HOST_DOWNLOAD_RECONCILE_ENVELOPE_BYTES=4096;
export const HOST_DOWNLOAD_RECONCILE_WIRE_MAX_BYTES=HOST_DOWNLOAD_RECONCILE_MAX_BYTES+HOST_DOWNLOAD_RECONCILE_ENVELOPE_BYTES;
/** READ-ONLY recovery of one original browser download: the run identity and the exact normalized filename only. */
export function hostDownloadReconcileRequest(value){
 let v,a,b,i;try{
  v=own(data(value),['schema','allocation','binding','hostIdentity','nonce','filename']);
  a=assertBrowserHostAllocation(v.allocation);b=assertHostRunBinding(a,v.binding);i=assertD005HostIdentity(v.hostIdentity,b,a);
  if(typeof v.filename!=='string'||!v.filename||v.filename.length>255||v.filename!==v.filename.normalize('NFC')||
   /[\u0000-\u001f\u007f]/u.test(v.filename)||v.filename.includes('/')||v.filename.includes(String.fromCharCode(92))||
   v.filename==='.'||v.filename==='..')fail();
 }catch{fail();}
 if(v.schema!==HOST_DOWNLOAD_RECONCILE_REQUEST_SCHEMA||typeof v.nonce!=='string'||!HEX.test(v.nonce))fail();
 return Object.freeze({schema:HOST_DOWNLOAD_RECONCILE_REQUEST_SCHEMA,allocation:a,binding:b,hostIdentity:i,
  nonce:v.nonce,filename:v.filename});
}
/** The answer reports the committed version and whether its durable receipt exists; absence is an accurate partial. */
export function hostDownloadReconcileResponse(value,request){
 let v,receipt=null;try{
  v=own(data(value),['schema','nonce','versionId','sha256','bytes','mimeType','receipt','checkedAtMs','currentUntilMs']);
  if(v.schema!==HOST_DOWNLOAD_RECONCILE_RESPONSE_SCHEMA||v.nonce!==request.nonce)fail();
  if(typeof v.versionId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(v.versionId)||
   typeof v.sha256!=='string'||!/^[a-f0-9]{64}$/u.test(v.sha256)||!Number.isSafeInteger(v.bytes)||v.bytes<1||
   typeof v.mimeType!=='string'||!v.mimeType)fail();
  if(!Number.isSafeInteger(v.checkedAtMs)||!Number.isSafeInteger(v.currentUntilMs)||v.currentUntilMs<=v.checkedAtMs)fail();
  if(v.receipt!==null){
   const r=own(data(v.receipt),['eventId','createdAt','atMs','reference']);
   const expected=browserDownloadReceiptEventId({binding:request.binding,reference:v.versionId});
   if(r.eventId!==expected||r.reference!==v.versionId||typeof r.createdAt!=='string'||
    Number.isNaN(Date.parse(r.createdAt))||!Number.isSafeInteger(r.atMs))fail();
   receipt=Object.freeze({eventId:r.eventId,createdAt:r.createdAt,atMs:r.atMs,reference:r.reference});
  }
 }catch{fail();}
 return Object.freeze({schema:HOST_DOWNLOAD_RECONCILE_RESPONSE_SCHEMA,nonce:v.nonce,versionId:v.versionId,
  sha256:v.sha256,bytes:v.bytes,mimeType:v.mimeType,receipt,checkedAtMs:v.checkedAtMs,currentUntilMs:v.currentUntilMs});
}

export function encodeHostOperation(value,max){return encodeHostControl(value,max);}
export function decodeHostOperation(bytes,max){return decodeHostControl(bytes,max);}
