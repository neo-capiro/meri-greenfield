import {validateInitiate,validateId,validateStatus,validateReceipt,validateError} from './generated-validator.mjs';
import {uploadApplicationMetadata as limits,uploadRoutes,uploadErrorStatuses,uploadNotDispatchedErrors} from './protocol.mjs';
import {requests,receipts,fail,parse,declaration,copy,digest} from './boundary.mjs';
export * from './protocol.mjs';
export {UploadResponseError} from './boundary.mjs';
export {receiveUploadDownload} from './download.mjs';
export function receiveUploadRequest(route,bytes){
 if(!uploadRoutes.includes(route))fail('INVALID_UPLOAD_ROUTE');const q=parse(bytes,limits.requestBytes);
 if(!(route==='initiate'?validateInitiate(q):route==='status'?validateStatus(q):validateId(q)))fail('INVALID_UPLOAD_REQUEST');
 if(route==='initiate')declaration(q);requests.set(q,route);return q;
}
export function uploadRequestPath(route,request){
 if(requests.get(request)!==route)fail('UNADMITTED_UPLOAD_REQUEST');
 return route==='complete'?'/api/uploads/original/'+request.uploadId:'/api/uploads/'+route;
}
export function receiveUploadResponse(route,status,bytes,request){
 if(!uploadRoutes.includes(route)||requests.get(request)!==route)fail('UNADMITTED_UPLOAD_REQUEST');
 const result=parse(bytes,limits.responseBytes);
 if(status!==200){
  if(!validateError(result)||uploadErrorStatuses[result.error.code]!==status)fail('INVALID_UPLOAD_ERROR');
  const {code,outcome}=result.error;
  if(uploadNotDispatchedErrors.includes(code)?outcome!=='NOT_DISPATCHED':outcome==='NOT_DISPATCHED'?code!=='UPLOAD_UNAVAILABLE':
    ['status','read'].includes(route)&&outcome!=='READ_UNAVAILABLE')fail('INVALID_UPLOAD_OUTCOME');
  return result;
 }
 if(route==='read')fail('UPLOAD_BINARY_REQUIRED');if(!validateReceipt(result))fail('INVALID_UPLOAD_RECEIPT');declaration(result.original);
 if(route==='initiate'?request.requestId!==result.requestId||['filename','mimeType','bytes','sha256'].some(key=>request[key]!==result.original[key]):route==='status'&&Object.hasOwn(request,'requestId')?request.requestId!==result.requestId:request.uploadId!==result.uploadId)fail('UPLOAD_CORRELATION');
 const {storageStatus:state,scanStatus:scan,extraction,original}=result;
 if(['awaiting_upload','unknown'].includes(state)&&(original.versionId!==null||scan!=='pending'||extraction.status!=='pending')||
  ['stored','removing'].includes(state)&&original.versionId===null||
  result.originalBytesAvailable!==(state==='stored'&&scan==='clean')||
  (result.scanReason===null)!==['pending','clean'].includes(scan)||
  ['pending','available'].includes(extraction.status)&&extraction.limitations.length!==0||
  ['partial','unavailable','blocked'].includes(extraction.status)&&extraction.limitations.length===0||
  ['available','partial','blocked'].includes(extraction.status)&&scan!=='clean'||
  (scan==='pending')!==(extraction.status==='pending')||
  state==='removed'&&(scan!=='unavailable'||result.scanReason!=='UPLOAD_REMOVED'||extraction.status!=='unavailable'||extraction.limitations.length!==1||extraction.limitations[0]!=='UPLOAD_REMOVED'))fail('UPLOAD_STATE_MISMATCH');
 receipts.add(result);return result;
}
/** Preflight only: a received pending receipt never grants retry authority after an uncertain PUT. */
export async function receiveUploadOriginal(bytes,request,receipt){
 if(requests.get(request)!=='complete'||!receipts.has(receipt)||request.uploadId!==receipt.uploadId)fail('UNADMITTED_UPLOAD_RECEIPT');
 if(receipt.storageStatus!=='awaiting_upload')fail('UPLOAD_ATTEMPT_ALREADY_ALLOCATED');
 const original=copy(bytes,limits.originalBytes);
 if(original.length!==receipt.original.bytes||await digest(original)!==receipt.original.sha256)fail('UPLOAD_ORIGINAL_MISMATCH');
 return original;
}
