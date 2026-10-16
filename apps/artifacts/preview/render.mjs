/** Preview rendering: the bounded, read-only PDF a reader sees for one exact artifact version. DOCX, XLSX and PPTX are
 * converted through the qualified-renderer port (an XLSX loads with the fixed recalculation profile, so a workbook preview
 * shows recalculated values); a PDF version previews as its own verified bytes. Every preview must be a structurally valid
 * PDF within the byte and page bounds. Structural validity is not native visual quality: previews stay nativeQualified=false. */
import {createHash} from 'node:crypto';
import {pdfPageCount} from '../structure/file-structure.mjs';
export const PREVIEW_FORMATS=Object.freeze(['docx','xlsx','pptx','pdf']);
export const PREVIEW_MIME_TYPE='application/pdf',MAX_PREVIEW_BYTES=8388608,MAX_PREVIEW_PAGES=500;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};

/** `{bytes, pages, conversion}`; `renderer` is an admitted renderer port or null (office formats then fail closed). */
export async function renderPreview({bytes,format,renderer,deadlineMs,maxBytes,signal}){
 if(!PREVIEW_FORMATS.includes(format))fail('ARTIFACT_PREVIEW_UNSUPPORTED');
 if(!Buffer.isBuffer(bytes)||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>MAX_PREVIEW_BYTES)fail('ARTIFACT_PREVIEW_INPUT');
 const inputSha256=sha(bytes);let output,conversion;
 if(format==='pdf'){output=bytes;conversion={method:'source-pdf',inputSha256,outputSha256:inputSha256,qualificationId:null,imageDigest:null};}
 else{
  if(!renderer)fail('ARTIFACT_RENDERER_UNAVAILABLE');
  const converted=await renderer.transform({bytes,format,target:'pdf',deadlineMs,maxBytes,signal});
  output=converted?.bytes;const receipt=converted?.receipt;
  if(!Buffer.isBuffer(output)||receipt?.inputSha256!==inputSha256||receipt.outputSha256!==sha(output)||receipt.nativeQualification!==false||typeof receipt.qualificationId!=='string')fail('ARTIFACT_TRANSFORM_MISMATCH');
  conversion={method:'office-pdf',inputSha256,outputSha256:receipt.outputSha256,qualificationId:receipt.qualificationId,imageDigest:receipt.imageDigest};
 }
 if(output.length>maxBytes)fail('ARTIFACT_PREVIEW_LIMIT');
 const pages=pdfPageCount(output);if(pages===null)fail('ARTIFACT_PREVIEW_STRUCTURE');if(pages<1||pages>MAX_PREVIEW_PAGES)fail('ARTIFACT_PREVIEW_LIMIT');
 if(signal?.aborted||Date.now()>=deadlineMs)fail('ARTIFACT_CANCELLED');
 return {bytes:Buffer.from(output),pages,conversion};
}
