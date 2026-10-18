/** The Meri-local `runOptions` owner of the documents family (lane X; dot PR #121 6246642210): the run allocation, producer
 * context, operation descriptor, evidence, assets, output ceiling, the run capability and its `authority.check` that
 * `createCoreArtifactAuthority` (`./core-authority.mjs`) asks for per request through `runOptions.read`. Core supplies none of
 * these; `../product-ports/documents.mjs` substitutes pool/versions/objects/executor afterwards.
 *
 *   createRuntimeDocumentRunOptions({now, limits:{maxRequestMs, maxFactBytes}, authorityPorts?})
 *     -> {read, register, missing, state}
 *
 * `register(tuple)` is the per-run seam the prepared-run registry calls when a run is ready, with the SAME tuple the general-reads
 * runtime receives (`createReadsRuntime`, remote-composition.mjs): `{pool, binding, original, allocationJson, grantFactsJsons,
 * grantId, taskCapability, scopes}`. The grant named by `grantId` is the run's task grant and `taskCapability` must digest to it;
 * the tuple is validated like `taskTuple` (general-read-installation/configuration.mjs) and kept in process only, keyed by the run
 * binding, until `release()` or `original.expiresAtMs`. Nothing is persisted; the capability is never logged.
 *
 * `read(call)` answers `null` (the application's 503 UNAVAILABLE) for a run that is not registered, expired, whose scopes or
 * selected client are not the session's, or while the authority ports are absent. Otherwise it answers the closed shape the Core
 * authority expects: `allocationJson` (the admitted allocation), `producerContext` (`{context: task grant facts, producer:
 * {namespace:'meri.documents', executionId}}`), `descriptor` (`create_word`/`create_excel` by the request's operation; the
 * canonical application refuses any other operation against it), `evidence`/`assets` (none: documents carry their content),
 * `maxBytes` (the allocation's output ceiling), `authority` (the gateway's current tool authority over the task capability,
 * `currentRun` from `createPostgresAdmittedRunOwner` on the run's admitted set) and `credential` (the task capability), with
 * `sourceEnabled:true`.
 *
 * `authorityPorts` are Core's `verifyCapability`, `authorizeBusiness` and `authorizeSources` owners in the exact
 * `current-tool-authority.mjs` port shapes (the same decision-gated inputs the general-reads gateway and write-intent execution
 * wait for); no Meri owner stands in for them, so without them `missing()` names `authorityPorts` and every read answers null. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createCurrentToolAuthority} from '../../gateway/authorization/current-tool-authority.mjs';
import {createPostgresAdmittedRunOwner} from '../../gateway/budget/admitted-run-owner.mjs';
import {parseAdmittedGrantSet} from '../../gateway/budget/admitted-run-binding.mjs';
import {matchesCapability} from '../native-authority/task-verifier.mjs';
import {INTENT_OPERATIONS} from './core-authority-wire.mjs';
export const DOCUMENTS_PRODUCER_NAMESPACE='meri.documents';
export const DOCUMENT_OPERATIONS=Object.freeze(['create_word','create_excel']);
const AUTHORITY_PORTS=Object.freeze(['verifyCapability','authorizeBusiness','authorizeSources']);
const TUPLE=Object.freeze(['pool','binding','original','allocationJson','grantFactsJsons','grantId','taskCapability','scopes']);
const fault=code=>Object.assign(new Error(code),{code});
const ordinary=fn=>typeof fn==='function'&&!types.isProxy(fn);
const same=(a,b)=>hash(a)===hash(b);
/** The run's selected client: exactly one client scope and nothing else (prepared-run-bindings `exactInitialScopes`). */
const selectedClientOf=scopes=>scopes.length===1&&scopes[0].kind==='client'&&typeof scopes[0].resourceId==='string'?scopes[0].resourceId:null;
const descriptors=Object.freeze(Object.fromEntries(DOCUMENT_OPERATIONS.map(id=>{const e=resolveOperationContract({id,version:'0.2.0'}).descriptor;return [id,data({operation:e.operation,requiredGrants:e.requiredGrants,sourceRequirements:e.sourceRequirements})];})));
export function createRuntimeDocumentRunOptions(configuration){
 let c,limits,ports;
 try{c=own(configuration,['now','limits'],['authorityPorts']);limits=data(own(c.limits,['maxRequestMs','maxFactBytes']));ports=c.authorityPorts===undefined?null:own(c.authorityPorts,AUTHORITY_PORTS);}
 catch{throw fault('ARTIFACT_RUN_OPTIONS_CONFIGURATION');}
 const now=c.now;
 if(!ordinary(now)||!Number.isSafeInteger(limits.maxRequestMs)||limits.maxRequestMs<1||limits.maxRequestMs>30000||!Number.isSafeInteger(limits.maxFactBytes)||limits.maxFactBytes<1||limits.maxFactBytes>131072||
  ports!==null&&(types.isProxy(c.authorityPorts)||AUTHORITY_PORTS.some(k=>!ordinary(ports[k]))))throw fault('ARTIFACT_RUN_OPTIONS_CONFIGURATION');
 const runs=new Map();
 const missing=()=>Object.freeze(ports===null?['authorityPorts']:[]);
 /** One prepared run, validated once; `release()` forgets it. */
 function register(tuple){
  let t;try{t=own(tuple,TUPLE);}catch{throw fault('ARTIFACT_RUN_OPTIONS_REFUSED');}
  const binding=data(t.binding),scopes=data(t.scopes),original=data(t.original);let set,grant;
  try{
   validateShape('RunBinding',binding);if(!Array.isArray(scopes)||!scopes.length||scopes.length>100)throw 0;scopes.forEach(scope=>validateShape('Scope',scope));
   set=parseAdmittedGrantSet({allocationJson:t.allocationJson,grantFactsJsons:t.grantFactsJsons});grant=set.facts.find(f=>f.grantId===t.grantId);
   if(!grant||!same(grant.binding,binding)||!same(original.binding,binding)||typeof original.executionId!=='string'||!original.executionId||!Number.isSafeInteger(original.expiresAtMs)||original.expiresAtMs<=now()||
    !matchesCapability(t.taskCapability,grant.capabilitySha256)||scopes.some(s=>s.tenantId!==binding.tenantId||s.policyRevision!==grant.qualificationBinding.policyRevision)||selectedClientOf(scopes)===null||
    !t.pool||typeof t.pool.connect!=='function'||types.isProxy(t.pool))throw 0;
  }catch{throw fault('ARTIFACT_RUN_OPTIONS_REFUSED');}
  const key=hash(binding),identity=hash({binding,scopes,grantId:t.grantId,allocationSha256:hash(set.allocation),capabilitySha256:grant.capabilitySha256,executionId:original.executionId});
  const existing=runs.get(key);
  if(existing){if(existing.identity!==identity)throw fault('ARTIFACT_RUN_OPTIONS_CONFLICT');return existing.handle;}
  const owner=createPostgresAdmittedRunOwner({pool:t.pool,allocationJson:t.allocationJson,grantFactsJsons:t.grantFactsJsons,namespace:'product',now,limits});
  const entry={identity,binding,scopes,selectedClientId:selectedClientOf(scopes),grant,allocationJson:t.allocationJson,maxBytes:set.allocation.budgets.maxOutputBytes,credential:t.taskCapability,executionId:original.executionId,expiresAtMs:original.expiresAtMs,owner,handle:null};
  entry.handle=Object.freeze({release(){if(runs.get(key)===entry)runs.delete(key);}});
  runs.set(key,entry);return entry.handle;
 }
 /** `runOptions.read` for `createCoreArtifactAuthority`: null means unavailable; nothing here is a refusal of the caller. */
 async function read(call){
  let v;try{v=own(call,['binding','scopes','selectedClientId','intent','body','requestSha256','authority','deadlineMs'],['signal']);nativeSignal(v.signal);}catch{throw fault('ACCESS_DENIED');}
  if(ports===null||!Object.hasOwn(INTENT_OPERATIONS,v.intent))return null;
  let binding,scopes;try{binding=data(v.binding);scopes=data(v.scopes);validateShape('RunBinding',binding);}catch{return null;}
  const entry=runs.get(hash(binding));
  if(!entry||!same(entry.binding,binding)||entry.expiresAtMs<=now()||!same(entry.scopes,scopes)||entry.selectedClientId!==v.selectedClientId||v.signal?.aborted)return null;
  const requested=v.body?.request?.operation,operation=DOCUMENT_OPERATIONS.includes(requested)?requested:DOCUMENT_OPERATIONS[0];
  const authority=createCurrentToolAuthority({now,maxFactBytes:limits.maxFactBytes,ports:{
   verifyCapability:(credential,options)=>ports.verifyCapability(credential,options),
   authorizeBusiness:value=>ports.authorizeBusiness(value),authorizeSources:value=>ports.authorizeSources(value),
   currentRun:(b,options)=>entry.owner.currentRun(b,options)}});
  return {allocationJson:entry.allocationJson,producerContext:{context:entry.grant,producer:{namespace:DOCUMENTS_PRODUCER_NAMESPACE,executionId:entry.executionId}},descriptor:descriptors[operation],
   evidence:[],assets:[],maxBytes:entry.maxBytes,authority:{check:value=>authority.check(value)},credential:entry.credential,sourceEnabled:true};
 }
 return Object.freeze({read,register,missing,state:()=>ports===null?'unavailable':'composed',size:()=>runs.size});
}
