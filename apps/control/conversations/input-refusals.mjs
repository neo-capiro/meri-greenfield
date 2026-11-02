/** The conversation input routes' shared refusal mapping and their one unavailable log line (code only: never a message,
 * detail, identifier or body). */
import {uploadErrorStatuses} from '../../../packages/contracts/uploads-application/protocol.mjs';
import {SKILL_SELECTION_REFUSALS} from './service.mjs';
const REQUEST_REFUSALS=Object.freeze(['INVALID_JSON','INVALID_UTF8','INVALID_BODY','INVALID_CONTENT_LENGTH',...SKILL_SELECTION_REFUSALS]);
/** A selected attachment this request cannot use (missing, not the actor's, not clean, not extracted, expired): the request is
 * refused, not the service. Upload outages (a 5xx upload status or an unmapped upload code) stay unavailable. */
const uploadRefusal=code=>code==='UPLOAD_EXTRACTION_UNAVAILABLE'||typeof code==='string'&&code.startsWith('UPLOAD_')&&Object.hasOwn(uploadErrorStatuses,code)&&uploadErrorStatuses[code]<500;
export const inputRefusalCode=observed=>REQUEST_REFUSALS.includes(observed)||uploadRefusal(observed)?'INVALID_REQUEST':observed;
const CODE=/^[A-Z][A-Z0-9_]{0,63}$/u;
const stderr=line=>process.stderr.write(line+'\n');
/** One line per unavailable answer. A value that is not a closed upper-case code is never written. */
export function reportInputUnavailable(route,observed,write=stderr){
 try{write(JSON.stringify({event:'MERI_INPUT_CONTROL',route,outcome:'unavailable',code:typeof observed==='string'&&CODE.test(observed)?observed:'UNNAMED'}));}catch{/* Observability cannot change the public response. */}
}
