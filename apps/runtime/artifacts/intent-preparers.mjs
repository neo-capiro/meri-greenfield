/** Conversation document and typed ZIP intents enter the same current-session, Core-authorized, durable runtime application as HTTP.
 * Only trusted composition supplies these ports. The originating run's action session is borrowed and never revoked here;
 * the native credential and session credential never enter an intent argument, prepared result or retained command.
 * Missing owners omit the preparers. Before the application is called, refusal has no document effect; afterward every
 * failure is conservatively UNKNOWN, except the application's own NOT_DISPATCHED refusal (see `refusal`), and the canonical
 * intent journal prevents another preparation of that delivery. */
import {types} from 'node:util';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {assertActionSessionReceipt,borrowedRunSession} from '../../control/action-host/session/owner.mjs';
import {createDocumentIntentPreparer,DOCUMENT_INTENT_OPERATIONS} from '../../control/intents/document-preparer.mjs';
import {referencedAssetIds} from '../../control/intents/document-revision.mjs';
import {createAnalysisIntentPreparer,ANALYSIS_INTENT_OPERATIONS} from '../../control/intents/analysis-preparer.mjs';
import {intentFault} from '../../control/intents/faults.mjs';
import {documentLimits} from '../../control/document-application/current.mjs';
import {admitDocumentDescriptor} from '../../control/document-application/format-admission.mjs';
import {createRuntimeArtifactApplication} from './application.mjs';
import {createRuntimeDocumentRevisionSource} from './revision-source.mjs';
import {assertDocumentRevisionSelection} from '../../../packages/contracts/document-revision.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const TOKEN=/^[\x21-\x7e]{1,8192}$/u;
const same=(a,b)=>hash(a)===hash(b);
function method(owner,name){
 if(!owner||typeof owner!=='object'||types.isProxy(owner))throw intentFault('INTENT_CONFIGURATION');
 const d=Object.getOwnPropertyDescriptor(owner,name);
 if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='function'||types.isProxy(d.value))throw intentFault('INTENT_CONFIGURATION');
 return (...args)=>Reflect.apply(d.value,owner,args);
}

/** The document application's answer to a started write. Its error `outcome` is the owner's own account of the effect
 * (`apps/control/document-application/http.mjs` errorResponse): NOT_DISPATCHED means nothing was generated or committed (a
 * refusal before generation, or a definite refusal such as a PDF conversion that did not complete), which the artifact journal
 * already settled as a refusal, so it is a definite intent refusal the model can explain or retry. Every other answer, and an
 * answer that cannot be read, stays UNKNOWN: a draft may exist. */
const NOT_DISPATCHED_CODES=Object.freeze({ARTIFACT_RENDERER_UNAVAILABLE:'UNAVAILABLE',ARTIFACT_STALE_PARENT:'CONFLICT',CONFLICT:'CONFLICT',
 ACCESS_DENIED:'ACCESS_DENIED',SESSION_REFUSED:'ACCESS_DENIED',DEADLINE:'DEADLINE',CANCELLED:'CANCELLED'});
const NOT_DISPATCHED_DETAIL=Object.freeze({ARTIFACT_RENDERER_UNAVAILABLE:'The PDF conversion did not complete, so no document was created.',
 ARTIFACT_STALE_PARENT:'The selected document changed since it was read, so no revision was created.'});
async function refusal(read){
 let error;try{const text=await read();if(Buffer.byteLength(text)<=65536)error=JSON.parse(text)?.error;}catch{}
 if(error===null||typeof error!=='object'||error.outcome!=='NOT_DISPATCHED'||typeof error.code!=='string'||!/^[A-Z][A-Z0-9_]{1,62}$/u.test(error.code))return intentFault('UNKNOWN','unknown');
 return intentFault(NOT_DISPATCHED_CODES[error.code]??'UNAVAILABLE','none',NOT_DISPATCHED_DETAIL[error.code],error.code);
}

/** Returns the canonical document and typed ZIP preparers, or [] when a required production owner is absent. No sandbox owner. */
export function createRuntimeDocumentIntentPreparers(configuration){
 let c,binding,limits,revision;
 try{
  c=own(configuration,['binding','selectedClientId','now','limits'],['sessions','optionsOwner','nativeCredentials','retention','borrowSession','revision','admitPdf']);
  if(c.admitPdf!==undefined&&typeof c.admitPdf!=='boolean')throw 0;
  if(c.revision!==undefined)revision=assertDocumentRevisionSelection(c.revision);
  binding=data(c.binding);validateShape('RunBinding',binding);limits=documentLimits(c.limits);
  if(!(c.selectedClientId===null||UUID.test(c.selectedClientId??''))||typeof c.now!=='function'||types.isProxy(c.now))throw 0;
 }catch{throw intentFault('INTENT_CONFIGURATION');}
 if(c.sessions===undefined||c.optionsOwner===undefined||c.nativeCredentials===undefined)return Object.freeze([]);
 if(!c.sessions||typeof c.sessions!=='object'||types.isProxy(c.sessions))throw intentFault('INTENT_CONFIGURATION');
 const borrow=c.borrowSession??borrowedRunSession(c.sessions);if(borrow===undefined)return Object.freeze([]);
 if(typeof borrow!=='function'||types.isProxy(borrow))throw intentFault('INTENT_CONFIGURATION');
 const authenticate=method(c.sessions,'authenticateSession'),read=method(c.sessions,'readCurrentState');
 const nativeCredentialFor=method(c.nativeCredentials,'nativeCredentialFor');method(c.optionsOwner,'resolve');
 const app=createRuntimeArtifactApplication({sessions:c.sessions,optionsOwner:c.optionsOwner,now:c.now,limits,...(c.retention===undefined?{}:{retention:c.retention})});
 const revisionSource=revision?createRuntimeDocumentRevisionSource({sessions:c.sessions,optionsOwner:c.optionsOwner,now:c.now,limits,...(c.retention===undefined?{}:{retention:c.retention})}):null;
 const preparers=[...DOCUMENT_INTENT_OPERATIONS,...(revision?[]:ANALYSIS_INTENT_OPERATIONS)].map(id=>{
  const entry=catalog.operations.find(row=>row.operation.id===id);
  const descriptor={operation:entry.operation,requiredGrants:entry.requiredGrants,sourceRequirements:entry.sourceRequirements};
  const analysis=ANALYSIS_INTENT_OPERATIONS.includes(id),pdf=c.admitPdf===true&&id==='create_word';
  // The declared formats are the document application's own admission for this composition (PDF only with the renderer).
  const formats=Object.freeze(analysis?['zip']:[...admitDocumentDescriptor(descriptor,{pdf}).formats]);
  return Object.freeze({operation:data(entry.operation),owner:analysis?'artifact':'document',binding,formats,
   async prepare(call){
    let life,session,started=false,deadlineMs,ownerRefusal=null;
    try{
     const input=own(call,['arguments','deliveryId'],['signal']);nativeSignal(input.signal);
     const at=c.now();if(!Number.isSafeInteger(at)||at<0)throw intentFault('UNAVAILABLE','none');
     deadlineMs=at+limits.maxRequestMs;
     life=createOperationLifetime({deadlineMs,now:c.now,signal:input.signal,errorFactory:code=>intentFault(code,'none')});
     const clip=expiry=>{if(!Number.isSafeInteger(expiry)||expiry<=c.now())throw intentFault('UNAVAILABLE','none');deadlineMs=Math.min(deadlineMs,expiry);life.limitDeadline(deadlineMs);};
     const native=()=>{
      let value;try{value=data(own(nativeCredentialFor({binding,selectedClientId:c.selectedClientId,signal:life.signal}),['credential','expiresAtMs']));}catch{throw intentFault('UNAVAILABLE','none');}
      if(typeof value.credential!=='string'||!TOKEN.test(value.credential))throw intentFault('UNAVAILABLE','none');
      clip(value.expiresAtMs);return value.credential;
     };
     const credential=native();
     session=await life.run(signal=>borrow({binding,selectedClientId:c.selectedClientId,signal}));
     session=assertActionSessionReceipt(session,c.now());
     clip(session.expiresAtMs);
     const selected=session.context;
     if(selected.tenantId!==binding.tenantId||selected.actorId!==binding.actorId||selected.conversationId!==binding.conversationId||selected.runId!==binding.runId||selected.selectedClientId!==c.selectedClientId)throw intentFault('ACCESS_DENIED','none');
     async function current(){
      const authentication=await life.run(signal=>authenticate({credential:session.credential,signal,deadlineMs}));
      const state=data(await life.run(signal=>read({authentication,signal,deadlineMs})));
      own(state,['authenticationSha256','binding','scopes','selectedClientId','checkedAtMs','expiresAtMs']);
      if(state.authenticationSha256!==hash(authentication)||!same(state.binding,binding)||state.selectedClientId!==c.selectedClientId||
       !Array.isArray(state.scopes)||state.scopes.length<1||state.scopes.length>100||!Number.isSafeInteger(state.checkedAtMs)||state.checkedAtMs>c.now())throw intentFault('ACCESS_DENIED','none');
      try{assertNativeConversationScope(state);}catch{throw intentFault('ACCESS_DENIED','none');}
      clip(state.expiresAtMs);if(native()!==credential)throw intentFault('ACCESS_DENIED','none');life.check();
     }
     await current();
     // The retained revision capability is created here, in-process, from the private current-authorized source
     // read this prepare performs. It is never carried in the request body or any HTTP field, and the public
     // mount supplies none, so an HTTP request can never reach a retained write.
     let readSource=null;
     const readRevision=revision?async({selection,signal})=>{const source=await revisionSource.read({credential:session.credential,selection,signal,deadlineMs});readSource={selection,source};return source;}:null;
     const preservation=({retained,binding:revisionBinding,signal})=>{
       if(readSource===null||hash(revisionBinding)!==hash(binding))throw intentFault('ACCESS_DENIED','none');
       if(signal?.aborted)throw intentFault('CANCELLED','none');
       const source=readSource.source;
       // Only exactly what the trusted read proved is re-presented: the immutable parent's stored evidence and
       // the asset identifiers its immutable spec carries. Neither is taken from the caller or the model.
       if(hash(retained.evidence)!==hash(source.version.evidence)||hash(retained.assetIds)!==hash(referencedAssetIds(source.request)))throw intentFault('ACCESS_DENIED','none');
       // A retained asset object has no durable source on this path, so an asset-bearing parent is refused
       // rather than re-rendered without its retained object.
       if(retained.assetIds.length>0)throw intentFault('UNAVAILABLE','none');
       return {evidence:source.version.evidence,assets:[]};
     };
     const writes={async execute(write,signal){
       const route=write.baseVersionId===null?'create':'revise';
       const body=JSON.stringify({deliveryId:write.deliveryId,request:write.request,...(route==='revise'?{baseVersionId:write.baseVersionId}:{})});
       // Both routing and credentials are fixed by this trusted adapter. No URL, context or bearer is model supplied.
       const request=new Request('https://meri-control.internal/api/documents/'+route,{method:'POST',headers:{authorization:'Bearer '+session.credential,'content-type':'application/json','content-length':String(Buffer.byteLength(body))},body,signal});
       // The preserved parent facts ride this in-process call only, and only for the exact base they were pinned to.
       const retained=route==='revise'&&write.preserve!==undefined?{retained:{baseVersionId:write.preserve.parent.versionId,evidence:write.preserve.evidence,assets:write.preserve.assets,evidenceSha256:write.preserve.evidenceSha256}}:{};
       // From here only the application's own NOT_DISPATCHED answer is a refusal; a deadline, cancellation or unreadable answer
       // after dispatch is UNKNOWN (a draft may exist).
       started=true;let response,text;
       try{response=await life.run(()=>app.handle(request,{deadlineMs,...retained}));}catch{throw intentFault('UNKNOWN','unknown');}
       if(response.status!==200){ownerRefusal=await refusal(()=>life.run(()=>response.text()));throw ownerRefusal;}
       try{text=await life.run(()=>response.text());}catch{throw intentFault('UNKNOWN','unknown');}
       if(Buffer.byteLength(text)>limits.maxResponseBytes)throw intentFault('UNKNOWN','unknown');
       return JSON.parse(text);
     }};
     const canonical=analysis?createAnalysisIntentPreparer({descriptor,binding,artifact:{writes}}):createDocumentIntentPreparer({descriptor,binding,pdf,writes:{...writes,...(revision?{preservation}:{})},...(revision?{revision:{selection:revision,read:readRevision}}:{})});
     const result=await canonical.prepare({...input,signal:life.signal});
     await current();life.check();return result;
    }catch(error){
     // Only the owner's own definite refusal survives a started write; a later current-authority refusal withholds a draft that exists.
     if(started)throw ownerRefusal!==null&&error===ownerRefusal?error:intentFault('UNKNOWN','unknown');
     const code=['INVALID_ARGUMENTS','UNAVAILABLE','ACCESS_DENIED','CONFLICT','DEADLINE','CANCELLED'].includes(error?.code)?error.code:'ACCESS_DENIED';
     throw intentFault(code,'none');
    }finally{life?.close();}
   }});
 });
 return Object.freeze(preparers);
}
