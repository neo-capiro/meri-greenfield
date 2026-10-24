/** Private closed SDK-session headers. Opaque entries require the canonical provider codec. */
import {own,data} from '../commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../validate.mjs';
import {assertNativeFileState} from './files.mjs';
const fail=()=>{throw Object.assign(Error('INVALID_SDK_SESSION_REQUEST'),{code:'INVALID_SDK_SESSION_REQUEST'});};
export const sdkSessionOperations=Object.freeze(['register','load','append','list-subkeys']);
/** Validate an already admitted conversation scope. A null client is accepted
 * only with the exact actor's private scope; this does not establish General eligibility. */
export function assertNativeConversationScope({binding,scopes,selectedClientId}){
 validateShape('RunBinding',binding);
 if(!Array.isArray(scopes)||!scopes.length||scopes.length>100||new Set(scopes.map(canonicalSha256)).size!==scopes.length||new Set(scopes.map(s=>s.policyRevision)).size!==1)fail();
 for(const scope of scopes){validateShape('Scope',scope);if(scope.tenantId!==binding.tenantId)fail();}
 if(selectedClientId===null){if(scopes.length!==1||scopes[0].kind!=='private-user'||scopes[0].resourceId!==binding.actorId)fail();}
 else if(typeof selectedClientId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(selectedClientId)||!scopes.some(s=>s.kind==='client'&&s.resourceId===selectedClientId))fail();
}
/** Private immutable next-turn reference, not authority and not a legacy checkpoint. */
export function assertNativeSessionReference(raw){
 const value=data(own(raw,['binding','key','ownerSha256','entriesCount']));validateShape('RunBinding',value.binding);assertSdkSessionKey(value.key,{main:true});
 if(!/^[a-f0-9]{64}$/u.test(value.ownerSha256)||!Number.isSafeInteger(value.entriesCount)||value.entriesCount<1||value.entriesCount>100000)fail();return value;
}
/** Native capture metadata in the existing control row. The reference identifies
 * SDK transcripts only; it makes no workspace or physical-stop assertion. */
export function assertNativeSessionCapture(raw){
 const v=data(own(raw,['kind','sdkSession','checkpointId','checkpointSha256','versions','scopes','sourceRequestSha256','contextSha256','lastEventSequence'],['files']));
 if(v.kind!=='native-session')fail();const ref=assertNativeSessionReference(v.sdkSession);validateShape('RuntimeVersions',v.versions);
 if(v.files!==undefined)assertNativeFileState(v.files,{binding:ref.binding,scopes:v.scopes});
 if(v.checkpointId!==ref.binding.runId||v.checkpointSha256!==canonicalSha256(v.files===undefined?ref:{sdkSession:ref,files:v.files})||!Number.isSafeInteger(v.lastEventSequence)||v.lastEventSequence<1||
  !/^[a-f0-9]{64}$/u.test(v.sourceRequestSha256)||!/^[a-f0-9]{64}$/u.test(v.contextSha256)||!Array.isArray(v.scopes)||!v.scopes.length||v.scopes.length>100)fail();
 for(const scope of v.scopes){validateShape('Scope',scope);if(scope.tenantId!==ref.binding.tenantId)fail();}
 if(new Set(v.scopes.map(canonicalSha256)).size!==v.scopes.length)fail();return v;
}
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
