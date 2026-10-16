/** Fixed runtime mounts over borrowed compiled owners; selectors never install authority. */
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {createRuntimeArtifactApplication} from './artifacts/application.mjs';
import {createDownloadLinkGate} from './artifacts/download-gate.mjs';
import {createSelectedTaskApplication} from './selected/http.mjs';
import {createNativeSdkSessionApplication} from './native-authority/session-http.mjs';
import {fault} from './config.mjs';
import {types} from 'node:util';
export function captureRuntimePorts(value={}){
 const c=own(value,[],['identityContext','transitionAuthority','artifactOptionsOwner','selectedController','sdkSessionOwner','sdkSessionSnapshot','selectedSkillAdmission','selectedOutputPublication','artifactStore','retentionLedgerSink']);
 const methods=(port,names)=>Object.freeze(Object.fromEntries(names.map(name=>[name,storageMethod(port,name)])));
 const optionalMethod=(port,name)=>{let cursor=port;for(let depth=0;cursor!==null&&depth<32;depth++){if(types.isProxy(cursor))throw fault('PRODUCT_PORTS_CONFIGURATION');if(Object.getOwnPropertyDescriptor(cursor,name))return storageMethod(port,name);cursor=Object.getPrototypeOf(cursor);}if(cursor!==null)throw fault('PRODUCT_PORTS_CONFIGURATION');};
 const identity=c.identityContext===undefined?Object.freeze({verifyIdentity:async()=>{throw fault('NATIVE_AUTHORITY_UNAVAILABLE');},resolveContext:async()=>{throw fault('NATIVE_AUTHORITY_UNAVAILABLE');}}):methods(c.identityContext,['verifyIdentity','resolveContext']);
 const transitionResolver=c.identityContext===undefined?undefined:optionalMethod(c.identityContext,'resolveTransitionContext'),transitionContext=transitionResolver===undefined?{}:{resolveTransitionContext:transitionResolver};
 return Object.freeze({
  identityContext:Object.freeze({...identity,...transitionContext}),
  ...(c.transitionAuthority===undefined?{}:{transitionAuthority:methods(c.transitionAuthority,['readCurrent'])}),
  ...(c.artifactOptionsOwner===undefined?{}:{artifactOptionsOwner:methods(c.artifactOptionsOwner,['resolve'])}),
  ...(c.selectedController===undefined?{}:{selectedController:methods(c.selectedController,['handle'])}),
  ...(c.sdkSessionOwner===undefined?{}:{sdkSessionOwner:methods(c.sdkSessionOwner,['register','load','append','listSubkeys'])}),
  ...(c.sdkSessionSnapshot===undefined?{}:{sdkSessionSnapshot:methods(c.sdkSessionSnapshot,['readSnapshot'])}),
  ...(c.selectedSkillAdmission===undefined?{}:{selectedSkillAdmission:methods(c.selectedSkillAdmission,['admitSelection'])}),
  ...(c.selectedOutputPublication===undefined?{}:{selectedOutputPublication:methods(c.selectedOutputPublication,['prepareEvent'])}),
  // The private artifact store's read-only privacy proof (createRuntimeArtifactStorage().verifyPrivate); required to open download links.
  ...(c.artifactStore===undefined?{}:{artifactStore:methods(c.artifactStore,['verifyPrivate'])}),
  // The authoritative retention ledger sink (the shipping owner's write-once store); without it declared retention serving stays fenced.
  ...(c.retentionLedgerSink===undefined?{}:{retentionLedgerSink:methods(c.retentionLedgerSink,['append','read'])}),
 });
}
/** `suppression` is the retention serving `{journal,serving}` pair when declared; the download-link gate needs it to revoke links. */
export function createRuntimeProductApplications({configuration,sessions,ports,now,retention,suppression}){
 const canonicalDocuments=createRuntimeArtifactApplication({sessions,now,limits:{maxRequestMs:configuration.limits.requestMs,maxRequestBytes:configuration.limits.requestBytes,maxResponseBytes:configuration.native.maxResponseBytes},...(ports.artifactOptionsOwner?{optionsOwner:ports.artifactOptionsOwner}:{}),...(retention===undefined?{}:{retention})});
 // Signed download links mount over the canonical document routes behind a readiness gate that trusted startup opens (or leaves closed).
 const downloads=createDownloadLinkGate({documents:canonicalDocuments,sessions,now,maxRequestMs:configuration.limits.requestMs,links:configuration.downloadLinks,suppression,authorization:ports.artifactOptionsOwner,store:ports.artifactStore});
 const selected=createSelectedTaskApplication({controller:ports.selectedController??{async handle(){throw fault('UNAVAILABLE');}},now,limits:{requestMs:configuration.limits.requestMs,requestBytes:configuration.limits.requestBytes},sourceEnabled:configuration.sourceEnabled});
 const unavailableSession=Object.fromEntries(['register','load','append','listSubkeys'].map(name=>[name,async()=>{throw fault('SDK_SESSION_UNAVAILABLE');}]));
 const sdkSessions=createNativeSdkSessionApplication({owner:ports.sdkSessionOwner??unavailableSession,...(ports.sdkSessionSnapshot===undefined?{}:{snapshot:ports.sdkSessionSnapshot}),now,maxRequestMs:configuration.limits.requestMs});
 return Object.freeze({downloads:Object.freeze({open:input=>downloads.open(input),state:()=>downloads.state()}),handle(request){const path=new URL(request.url).pathname;
  if(path.startsWith('/api/documents/'))return downloads.handle(request);
  if(path.startsWith('/internal/conversations/selected/'))return selected.handle(request);
  if(path.startsWith('/v1/runner/session/'))return sdkSessions.handle(request);
  return null;
 }});
}
