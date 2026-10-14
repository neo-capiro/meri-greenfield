/** Fixed runtime mounts over borrowed compiled owners; selectors never install authority. */
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {createRuntimeArtifactApplication} from './artifacts/application.mjs';
import {createSelectedTaskApplication} from './selected/http.mjs';
import {createNativeSdkSessionApplication} from './native-authority/session-http.mjs';
import {fault} from './config.mjs';
export function captureRuntimePorts(value={}){
 const c=own(value,[],['identityContext','artifactOptionsOwner','selectedController','sdkSessionOwner','sdkSessionSnapshot','selectedSkillAdmission','selectedOutputPublication','nativeAdmission','approvals']);
 const methods=(port,names)=>Object.freeze(Object.fromEntries(names.map(name=>[name,storageMethod(port,name)])));
 return Object.freeze({
  identityContext:c.identityContext===undefined?Object.freeze({verifyIdentity:async()=>{throw fault('NATIVE_AUTHORITY_UNAVAILABLE');},resolveContext:async()=>{throw fault('NATIVE_AUTHORITY_UNAVAILABLE');}}):methods(c.identityContext,['verifyIdentity','resolveContext']),
  ...(c.artifactOptionsOwner===undefined?{}:{artifactOptionsOwner:methods(c.artifactOptionsOwner,['resolve'])}),
  ...(c.selectedController===undefined?{}:{selectedController:methods(c.selectedController,['handle'])}),
  ...(c.sdkSessionOwner===undefined?{}:{sdkSessionOwner:methods(c.sdkSessionOwner,['register','load','append','listSubkeys'])}),
  ...(c.sdkSessionSnapshot===undefined?{}:{sdkSessionSnapshot:methods(c.sdkSessionSnapshot,['readSnapshot'])}),
  ...(c.selectedSkillAdmission===undefined?{}:{selectedSkillAdmission:methods(c.selectedSkillAdmission,['admitSelection'])}),
  ...(c.nativeAdmission===undefined?{}:{nativeAdmission:methods(c.nativeAdmission,['admit','retire'])}),
  ...(c.approvals===undefined?{}:{approvals:methods(c.approvals,['read','readDecision'])}),
  ...(c.selectedOutputPublication===undefined?{}:{selectedOutputPublication:methods(c.selectedOutputPublication,['prepareEvent'])}),
 });
}
export function createRuntimeProductApplications({configuration,sessions,ports,now}){
 const documents=createRuntimeArtifactApplication({sessions,now,limits:{maxRequestMs:configuration.limits.requestMs,maxRequestBytes:configuration.limits.requestBytes,maxResponseBytes:configuration.native.maxResponseBytes},...(ports.artifactOptionsOwner?{optionsOwner:ports.artifactOptionsOwner}:{})});
 const selected=createSelectedTaskApplication({controller:ports.selectedController??{async handle(){throw fault('UNAVAILABLE');}},now,limits:{requestMs:configuration.limits.requestMs,requestBytes:configuration.limits.requestBytes},sourceEnabled:configuration.sourceEnabled});
 const unavailableSession=Object.fromEntries(['register','load','append','listSubkeys'].map(name=>[name,async()=>{throw fault('SDK_SESSION_UNAVAILABLE');}]));
 const sdkSessions=createNativeSdkSessionApplication({owner:ports.sdkSessionOwner??unavailableSession,...(ports.sdkSessionSnapshot===undefined?{}:{snapshot:ports.sdkSessionSnapshot}),now,maxRequestMs:configuration.limits.requestMs});
 return Object.freeze({handle(request){const path=new URL(request.url).pathname;
  if(path.startsWith('/api/documents/'))return documents.handle(request);
  if(path.startsWith('/internal/conversations/selected/'))return selected.handle(request);
  if(path.startsWith('/v1/runner/session/'))return sdkSessions.handle(request);
  return null;
 }});
}
