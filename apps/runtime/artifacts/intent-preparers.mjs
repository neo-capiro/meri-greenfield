/** Conversation document and typed ZIP intents enter the same current-session, Core-authorized, durable runtime application as HTTP.
 * Only trusted composition supplies these ports. The originating run's action session is borrowed and never revoked here;
 * the native credential and session credential never enter an intent argument, prepared result or retained command.
 * Missing owners omit the preparers. Before the application is called, refusal has no document effect; afterward every
 * failure is conservatively UNKNOWN and the canonical intent journal prevents another preparation of that delivery. */
import {types} from 'node:util';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {assertActionSessionReceipt,borrowedRunSession} from '../../control/action-host/session/owner.mjs';
import {createDocumentIntentPreparer,DOCUMENT_INTENT_OPERATIONS} from '../../control/intents/document-preparer.mjs';
import {createAnalysisIntentPreparer,ANALYSIS_INTENT_OPERATIONS} from '../../control/intents/analysis-preparer.mjs';
import {intentFault} from '../../control/intents/faults.mjs';
import {documentLimits} from '../../control/document-application/current.mjs';
import {createRuntimeArtifactApplication} from './application.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const TOKEN=/^[\x21-\x7e]{1,8192}$/u;
const same=(a,b)=>hash(a)===hash(b);
function method(owner,name){
 if(!owner||typeof owner!=='object'||types.isProxy(owner))throw intentFault('INTENT_CONFIGURATION');
 const d=Object.getOwnPropertyDescriptor(owner,name);
 if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='function'||types.isProxy(d.value))throw intentFault('INTENT_CONFIGURATION');
 return (...args)=>Reflect.apply(d.value,owner,args);
}

/** Returns the canonical document and typed ZIP preparers, or [] when a required production owner is absent. No sandbox owner. */
export function createRuntimeDocumentIntentPreparers(configuration){
 let c,binding,limits;
 try{
  c=own(configuration,['binding','selectedClientId','now','limits'],['sessions','optionsOwner','nativeCredentials','retention','borrowSession']);
  binding=data(c.binding);validateShape('RunBinding',binding);limits=documentLimits(c.limits);
  if(!UUID.test(c.selectedClientId??'')||typeof c.now!=='function'||types.isProxy(c.now))throw 0;
 }catch{throw intentFault('INTENT_CONFIGURATION');}
 if(c.sessions===undefined||c.optionsOwner===undefined||c.nativeCredentials===undefined)return Object.freeze([]);
 if(!c.sessions||typeof c.sessions!=='object'||types.isProxy(c.sessions))throw intentFault('INTENT_CONFIGURATION');
 const borrow=c.borrowSession??borrowedRunSession(c.sessions);if(borrow===undefined)return Object.freeze([]);
 if(typeof borrow!=='function'||types.isProxy(borrow))throw intentFault('INTENT_CONFIGURATION');
 const authenticate=method(c.sessions,'authenticateSession'),read=method(c.sessions,'readCurrentState');
 const nativeCredentialFor=method(c.nativeCredentials,'nativeCredentialFor');method(c.optionsOwner,'resolve');
 const app=createRuntimeArtifactApplication({sessions:c.sessions,optionsOwner:c.optionsOwner,now:c.now,limits,...(c.retention===undefined?{}:{retention:c.retention})});
 const preparers=[...DOCUMENT_INTENT_OPERATIONS,...ANALYSIS_INTENT_OPERATIONS].map(id=>{
  const entry=catalog.operations.find(row=>row.operation.id===id);
  const descriptor={operation:entry.operation,requiredGrants:entry.requiredGrants,sourceRequirements:entry.sourceRequirements};
  const analysis=ANALYSIS_INTENT_OPERATIONS.includes(id);
  return Object.freeze({operation:data(entry.operation),owner:analysis?'artifact':'document',binding,...(analysis?{formats:Object.freeze(['zip'])}:{}),
   async prepare(call){
    let life,session,started=false,deadlineMs;
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
      for(const scope of state.scopes){validateShape('Scope',scope);if(scope.tenantId!==binding.tenantId)throw intentFault('ACCESS_DENIED','none');}
      const clients=state.scopes.filter(scope=>scope.kind==='client');
      if(clients.length!==1||clients[0].resourceId!==c.selectedClientId)throw intentFault('ACCESS_DENIED','none');
      clip(state.expiresAtMs);if(native()!==credential)throw intentFault('ACCESS_DENIED','none');life.check();
     }
     await current();
     const writes={async execute(write,signal){
      const body=JSON.stringify({deliveryId:write.deliveryId,request:write.request});
      // Both routing and credentials are fixed by this trusted adapter. No URL, context or bearer is model supplied.
      const request=new Request('https://meri-control.internal/api/documents/create',{method:'POST',headers:{authorization:'Bearer '+session.credential,'content-type':'application/json','content-length':String(Buffer.byteLength(body))},body,signal});
      started=true;const response=await life.run(()=>app.handle(request,{deadlineMs}));
      if(response.status!==200)throw intentFault('UNKNOWN','unknown');
      const text=await life.run(()=>response.text());if(Buffer.byteLength(text)>limits.maxResponseBytes)throw intentFault('UNKNOWN','unknown');
      return JSON.parse(text);
     }};
     const canonical=analysis?createAnalysisIntentPreparer({descriptor,binding,artifact:{writes}}):createDocumentIntentPreparer({descriptor,binding,writes});
     const result=await canonical.prepare({...input,signal:life.signal});
     await current();life.check();return result;
    }catch(error){
     if(started)throw intentFault('UNKNOWN','unknown');
     const code=['INVALID_ARGUMENTS','UNAVAILABLE','ACCESS_DENIED','DEADLINE','CANCELLED'].includes(error?.code)?error.code:'ACCESS_DENIED';
     throw intentFault(code,'none');
    }finally{life?.close();}
   }});
 });
 return Object.freeze(preparers);
}
