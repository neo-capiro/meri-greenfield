/** Control HTTP boundary instrumentation: one server span per request carrying method, path and status. The duration metric carries
 * method and status only, so identifiers in paths never become metric dimensions. Bodies, headers and query strings are never read.
 * Streamed responses are measured to their response headers. */
import {SpanKind} from '@opentelemetry/api';
import {fault} from '../config.mjs';
export function instrumentApplication(instruments,application,{now=Date.now}={}){
 if(typeof application?.handle!=='function')throw fault('TELEMETRY_CONFIGURATION');
 return Object.freeze({async handle(request){
  const started=now(),method=request.method,span=instruments.startSpan('meri.http.request',{kind:SpanKind.SERVER,attributes:{'http.request.method':method,'url.path':new URL(request.url).pathname}});
  let status,failure;
  try{const response=await application.handle(request);status=response?.status;return response;}
  catch(error){failure=error?.code??'HTTP_HANDLER_FAILED';throw error;}
  finally{
   const attributes={'http.request.method':method,...(Number.isSafeInteger(status)?{'http.response.status_code':status}:{})};
   instruments.endSpan(span,{attributes,failure:failure??(status>=500?'HTTP_SERVER_ERROR':undefined)});instruments.recordRequest(now()-started,attributes);
  }
 }});
}
