/** Explicit synthetic producers exercise real adapters and the existing governed dispatcher. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
import {createToolDispatch} from '../dispatch/tool-dispatch.mjs';
import {createMailHttpAdapter} from '../sources/mail/http-adapter.mjs';
import {createMailReadHandler} from '../sources/mail/handler.mjs';
import {createIdentityContactsHttpAdapter} from '../sources/identity-contacts/http-adapter.mjs';
import {createIdentityContactsReadHandler} from '../sources/identity-contacts/handler.mjs';
import {sourcePage} from '../../control/document-application/mail-history/test/fixtures.mjs';
const clone=x=>structuredClone(x);
export function mailHistorySourceFixture(document,selection) {
 const {binding}=document.artifactOptions.context,subject=selection.subject,state={revoked:false},calls=[],wire=[],previous=new Map();
 const {versions:ignored,...execution}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:document.artifactOptions.context.deadlineMs,runtimeSessionId:'synthetic-mail-source-runtime-session-0001'});
 const executionSha256=canonicalSha256(execution),identity={execution,executionSha256,scopes:subject.scopes,policyRevision:subject.policyRevision},entries=new Map();
 const current=async()=>{calls.push('current');if(state.revoked)throw Error('SYNTHETIC_REVOKED');return clone(identity);};
 const contextFor=async({entry})=>{calls.push('context');if(state.revoked)throw Error('SYNTHETIC_REVOKED');return {binding,subject,executionSha256,policyRevision:subject.policyRevision,scopes:subject.scopes,sourceIds:[...new Set(entry.descriptor.sourceRequirements.map(s=>s.sourceId))],deadlineMs:execution.expiresAtMs,maxOutputBytes:1048576};};
 for(const id of ['resolve_entity','find_contacts','mail.list_messages','mail.search_messages','mail.read_thread']) {
  const operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),mail=id.startsWith('mail.');let pins;
  const config={now:document.now,maxRequestMs:1500,maxResponseBytes:1048576,
   endpoints:mail?Object.fromEntries(['mail.list_messages','mail.search_messages','mail.read_thread'].map(x=>[x,`https://mail.example.invalid/api/clio/tools/${x}`])):
    Object.fromEntries(['resolve_entity','find_contacts'].map(x=>[x,`https://identity.example.invalid/api/clio/tools/${x}`])),
   async getCredentials(value){calls.push('credentials');pins=value;const {input,deadlineMs,signal,...correlation}=value;
    return {...clone(correlation),authorizationScheme:'Bearer',bearerToken:'SYNTHETIC_TOKEN',serviceSecret:'SYNTHETIC_SECRET',expiresAtMs:Math.min(deadlineMs,document.now()+1500)};},
   async fetchImpl(url,options){wire.push({operation,body:JSON.parse(options.body),url});
    const normalizationContext=mail?{nowMs:document.now()}:pins.normalizationContext;
    const page=sourcePage({operation,request:JSON.parse(options.body).input,binding:pins.binding,subject:pins.subject,window:selection.window,normalizationContext});
    state.changePage?.(page);state.afterFetch?.();return new Response(JSON.stringify(page),{headers:{'content-type':'application/json'}});}};
  const adapter=(mail?createMailHttpAdapter:createIdentityContactsHttpAdapter)(config);
  entries.set(id,{contract,descriptor:contract.descriptor,execute:(mail?createMailReadHandler:createIdentityContactsReadHandler)({operation,adapter,now:document.now})});
 }
 const gateway=createToolDispatch({catalog:{entry:op=>entries.get(op.id)??null,discoverable:()=>[]},current,contextFor,
  now:document.now,newId:()=>binding.workerId,sourceEnabled:true,defaultCongress:119,
  limits:{maxRequestBytes:65536,maxResponseBytes:1048576,maxRequestMs:1500},
  mailContextPorts:{async loadPrevious({key}){return JSON.stringify({record:previous.get(canonicalSha256(key))??null,checkedAtMs:document.now()});},
   async retain({record}){previous.set(canonicalSha256(record.key),clone(record));return JSON.stringify({decision:'retained',keySha256:canonicalSha256(record.key),previousSha256:record.previousSha256,checkedAtMs:document.now()});}}});
 return {state,calls,wire,async readSource(call){
  // Selectors supplied by the compiler never become gateway authority.
  if(canonicalSha256(call.binding)!==canonicalSha256(binding)||canonicalSha256(call.window)!==canonicalSha256(selection.window))throw Error('ACCESS_DENIED');
  return JSON.parse(await gateway.execute(JSON.stringify({operation:call.operation,arguments:call.request}),call.signal));
 }};
}
