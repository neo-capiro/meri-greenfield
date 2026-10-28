/** Bounded native-result metadata route for the document application.
 *
 * It reuses the same current action session as native inspect/download: the run being projected is the authenticated
 * session's own `config.options.context.binding` (runId is the settled capture checkpoint), never a client-supplied
 * id. Collection and release both re-check the current session and retention. Workspace-only selectors are released;
 * SDK task/internal state, bytes and host paths never are, and nothing here is admitted for inspect or download.
 *
 * The explicit `results` intent is admitted through the established artifact.inspect action (A5-approved map) with the
 * canonical receipt matching the artifact service already uses, before collection and again before release, so this
 * route is never served without a current Core grant. The current-authority proof is that grant plus the journal
 * owner's own verifyRun and the session's current state (see NATIVE-RESULTS-PUBLIC-CLAIM.txt). */
import {assertNativeResultsSnapshot} from '../../../packages/contracts/document-access-application/native-results.mjs';
import {data,own,same,v} from './current.mjs';
const ACTION='artifact.inspect';
const refused=()=>Object.assign(Error('DOCUMENT_RESULT_REFUSED'),{code:'DOCUMENT_RESULT_REFUSED',status:502});
/** The receipt convention the artifact service already uses (apps/artifacts/service.mjs `authority`): the explicit
 * `results` intent is admitted through the established artifact.inspect action and matched on the canonical receipt
 * fields -- no new grant field, no invented artifact.results operation, no execution token. A denial, a foreign
 * binding/scope, a different resource or request digest, or an expired receipt all refuse. */
async function authority({config,current,life,resource,requestSha256,context}){
 const receipt=data(await current.authorize({action:ACTION,resource,binding:context.binding,scopes:context.scopes,
  requestSha256,deadlineMs:context.deadlineMs,signal:life.signal}));
 own(receipt,['receiptId','decision','action','binding','scopesSha256','resourceSha256','requestSha256','expiresAtMs']);
 if(typeof receipt.receiptId!=='string'||!receipt.receiptId||receipt.decision!=='allow'||receipt.action!==ACTION||
  !same(receipt.binding,context.binding)||receipt.scopesSha256!==v.hash(context.scopes)||
  receipt.resourceSha256!==v.hash(resource)||receipt.requestSha256!==requestSha256||
  !Number.isSafeInteger(receipt.expiresAtMs)||receipt.expiresAtMs<=config.now())
  throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED',status:403});
 return receipt;
}
export async function nativeResults({config,current,life,state}){
 if(!config.nativeResults)return null;
 const context=config.options.context,retention=config.options.retention;
 // Current retention/context identity before collection and again before release, keyed on the session's own run.
 const servable=async metadata=>{if(!retention)return;
  const subjects=[{tenantId:context.binding.tenantId,kind:'conversation',subjectId:context.binding.conversationId}];
  if(metadata&&metadata.binding.conversationId!==context.binding.conversationId)subjects.push({tenantId:metadata.binding.tenantId,kind:'conversation',subjectId:metadata.binding.conversationId});
  for(const subject of subjects)await life.run(()=>retention.assertServable(subject));};
 await servable();await current.fresh();
 // Explicit `results` intent, purpose-bound to its own outer resolver digest; before collection the resource is a
 // closed null snapshot identity, so no entry name is bound into the collection grant.
 const requestSha256=v.hash({intent:'results',body:{}});
 await authority({config,current,life,requestSha256,context,resource:{versionId:null,manifestId:null,capturedAt:null,object:null,assetObjects:[]}});
 const projected=await life.run(signal=>config.nativeResults.list(signal));
 // A withheld, deleted, revoked or unsettled snapshot is refused with a closed code and leaks no name.
 if(projected===null)return null;
 const {binding:owner,scopes,...answer}=projected;
 // The receiver's reject callback must THROW: assertNativeResultsSnapshot calls it and would otherwise continue over
 // malformed metadata. A malformed or unsafe answer therefore refuses here with a closed code and no leaked name.
 const validated=assertNativeResultsSnapshot(answer,code=>{throw Object.assign(Error(code),{code,status:502});});
 if(owner===null||typeof owner!=='object'||owner.tenantId!==context.binding.tenantId||owner.actorId!==context.binding.actorId||
  !Array.isArray(scopes)||!same(scopes,context.scopes))throw refused();
 state.readStarted=true;
 // Release grant binds the actual validated snapshot identity: manifestId and capturedAt, never a client-supplied
 // selector. No entry name or artifactId is bound into either grant.
 await authority({config,current,life,requestSha256,context,resource:{versionId:null,manifestId:validated.manifestId,capturedAt:validated.capturedAt,object:null,assetObjects:[]}});
 // The release grant binds the validated snapshot identity; current context and retention are re-checked before the
 // answer leaves the route. The settled capture itself is a one-shot read, so no second capture read is issued.
 await servable({binding:owner});
 await current.fresh();current.check();state.completed=true;
 return validated;
}
