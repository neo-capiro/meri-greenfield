/** Public routes and failure status mapping shared by the existing routines HTTP owner and browser receiver. */
export const ROUTINE_PATHS=Object.freeze({prepare:'/api/routines/prepare',approve:'/api/routines/approve',list:'/api/routines/list',reconcile:'/api/routines/reconcile'});
export const ROUTINE_MANAGEMENT_SESSION_PATH='/api/routines/session';
export const routineErrorStatus=code=>({METHOD_NOT_ALLOWED:405,UNSUPPORTED_MEDIA_TYPE:415,UNSUPPORTED_CONTENT_ENCODING:415,NOT_FOUND:404,INVALID_REQUEST:400,INVALID_CONTENT_LENGTH:400,INVALID_JSON:400,INVALID_BODY:400,INVALID_UTF8:400,REQUEST_TOO_LARGE:413,RESPONSE_TOO_LARGE:413,APPLICATION_CLOCK:500}[code]??
 (/(?:^|_)UNAUTHENTICATED$/u.test(code)?401:/(?:^|_)ACCESS_DENIED$/u.test(code)?403:/(?:^|_)(?:STALE|APPROVAL_REFUSED)$/u.test(code)?409:code==='DEADLINE'?408:code==='CANCELLED'?499:/(?:^|_)INVALID_REQUEST$/u.test(code)?400:/(?:^|_)UNAVAILABLE$/u.test(code)?503:502));
