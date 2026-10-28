/** Upload wire family. Integrity receipts are never access or retry grants. */
export const uploadApplicationVersion='1.0.0';
export const UPLOAD_POLICY_VERSION='upload-1';
export const UPLOAD_LIMITS=Object.freeze({originalBytes:10*1024*1024,zipEntries:4096,expandedBytes:64*1024*1024,
 compressionRatio:100,pdfPages:200,slides:200,sheets:50,rows:100000,columns:1024,textCharacters:2000000,
 imagePixels:40000000,scanMs:30000,parseMs:30000,ocrMs:90000,ocrPages:40,lowConfidence:0.8});
export const UPLOAD_MIME=Object.freeze({txt:'text/plain',md:'text/markdown',pdf:'application/pdf',
 docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg'});
export const uploadApplicationMetadata=Object.freeze({version:uploadApplicationVersion,schemaId:'urn:meri:uploads-application:1.0.0',
 requestBytes:8192,responseBytes:32768,originalBytes:UPLOAD_LIMITS.originalBytes,policyVersion:UPLOAD_POLICY_VERSION});
export const uploadRoutes=Object.freeze(['initiate','complete','status','inspect','read','remove']);
export const uploadErrorStatuses=Object.freeze(Object.fromEntries([
 ...['UPLOAD_ID','UPLOAD_FILENAME','UPLOAD_FORMAT','UPLOAD_HASH','UPLOAD_ENCODING','UPLOAD_MAGIC','UPLOAD_IMAGE_LIMIT','UPLOAD_ACTIVE_CONTENT',
  'UPLOAD_RELATIONSHIP','UPLOAD_ORIGINAL_MISMATCH','INVALID_COMMAND','INVALID_JSON','INVALID_BODY','INVALID_CONTENT_LENGTH','INVALID_UTF8'].map(code=>[code,400]),
 ...['UPLOAD_ACCESS_DENIED','ACCESS_DENIED'].map(code=>[code,403]),['UPLOAD_NOT_FOUND',404],['NOT_FOUND',404],['METHOD_NOT_ALLOWED',405],
 ...['DEADLINE','UPLOAD_EXPIRED'].map(code=>[code,408]),
 ...['UPLOAD_REQUEST_CONFLICT','UPLOAD_CHANGED','UPLOAD_NOT_CLEAN','UPLOAD_NOT_STORED','UPLOAD_REMOVAL_UNCERTAIN','UPLOAD_REMOVAL_HELD'].map(code=>[code,409]),
 ...['UPLOAD_SIZE','REQUEST_TOO_LARGE'].map(code=>[code,413]),['CANCELLED',499],
 ...['UPLOAD_UNAVAILABLE','UPLOAD_PUT_UNKNOWN','UPLOAD_COMMIT_UNKNOWN'].map(code=>[code,503])
]));
export const uploadNotDispatchedErrors=Object.freeze(['UPLOAD_ID','UPLOAD_FILENAME','UPLOAD_FORMAT','UPLOAD_SIZE','UPLOAD_HASH',
 'UPLOAD_ORIGINAL_MISMATCH','INVALID_COMMAND','INVALID_JSON','INVALID_BODY','INVALID_CONTENT_LENGTH','INVALID_UTF8','REQUEST_TOO_LARGE','NOT_FOUND','METHOD_NOT_ALLOWED']);
export function uploadDisposition(filename){return `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;}
