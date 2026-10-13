/** Private closed SDK-session headers. Opaque entries require the canonical provider codec. */
import {own,data} from '../commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../validate.mjs';
const fail=()=>{throw Object.assign(Error('INVALID_SDK_SESSION_REQUEST'),{code:'INVALID_SDK_SESSION_REQUEST'});};
export const sdkSessionOperations=Object.freeze(['register','load','append','list-subkeys']);
export function assertSdkSessionKey(raw,{main=false}={}){const key=data(own(raw,['projectKey','sessionId'],['subpath']));
 if(typeof key.projectKey!=='string'||!key.projectKey||key.projectKey.length>256||typeof key.sessionId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(key.sessionId)||key.subpath!==undefined&&(main||typeof key.subpath!=='string'||!key.subpath||key.subpath.length>1024))fail();return key;}
export function assertSdkSessionRequestHeaders(operation,raw){try{
 if(!sdkSessionOperations.includes(operation))fail();const fields=own(raw,['binding','key',...(operation==='append'?['appendId','expectedOffset','entriesSha256','entries']:[])]),{entries,...headers}=fields;
 const value=data({...headers,key:assertSdkSessionKey(headers.key,{main:operation==='register'||operation==='list-subkeys'})});validateShape('RunBinding',value.binding);
 if(operation==='append'&&(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value.appendId)||!Number.isSafeInteger(value.expectedOffset)||value.expectedOffset<0||value.expectedOffset>100000||!/^[a-f0-9]{64}$/u.test(value.entriesSha256)))fail();return value;
}catch{fail();}}

/** Correlation only, never server authorization. Opaque load entries remain provider-codec owned. */
export function assertSdkSessionResponseHeaders(operation,raw,requestSha256,binding,key){
 const required=operation==='load'?['entries','offset']:operation==='append'?['committed','appendId','entriesSha256','offset','added']:operation==='register'?['registered']:['subkeys'];
 const fields=own(raw,['binding','key','requestSha256',...required]),{entries,...headers}=fields,value=data(headers);
 validateShape('RunBinding',value.binding);assertSdkSessionKey(value.key);
 if(canonicalSha256(value.binding)!==canonicalSha256(binding)||canonicalSha256(value.key)!==canonicalSha256(key)||value.requestSha256!==requestSha256)fail();return value;
}
