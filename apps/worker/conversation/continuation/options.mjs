// @ts-check
/** Supported SDK continuation options; the owner restores opaque bytes and admits a fresh target. */
import {validateShape,assertWorkspacePaths,canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertContinuationEnvelope} from '../../../../packages/contracts/conversation-lifecycle/validate.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
import AjvModule from 'ajv/dist/2020.js';
import formatsModule from 'ajv-formats';
import {conversationSchema} from '../../../../packages/contracts/conversation-application/schema.mjs';
import publicSchema from '../../../../packages/contracts/meri.schema.json' with {type:'json'};
import commonSchema from '../../../../packages/contracts/retrieval-0.2/common.schema.json' with {type:'json'};
import skillSchema from '../../../../packages/contracts/retrieval-0.2/skill.schema.json' with {type:'json'};
import {assertWindowResolution} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
const ajv=new AjvModule.default({strict:true,allErrors:true});formatsModule.default(ajv);
for(const schema of [publicSchema,commonSchema,skillSchema,conversationSchema()])ajv.addSchema(schema);
/** @type {import('ajv').ValidateFunction<any>} */
const validRequest=ajv.compile({$ref:'urn:meri:conversation-application:0.1.0#/$defs/ConversationStoredRequest'});
/** @param {unknown} a @param {unknown} b */
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** @param {string} code @returns {never} */
const fail=code=>{throw new Error(code);};
/** @param {Pick<import('../../../../packages/contracts/dist/conversation-application.js').ConversationStoredRequest,'window'|'skill'>} request @param {import('../../../../packages/contracts/dist/contracts.js').Scope[]} scopes */
export const continuationContextSha256=(request,scopes)=>canonicalSha256({window:request.window,skill:request.skill,scopes});
/** @param {unknown} value @param {unknown} target @returns {Pick<import('@anthropic-ai/claude-agent-sdk').Options,'resume'|'resumeSessionAt'|'forkSession'|'sessionId'>} */
export function buildContinuationOptions(value,target) {
  const c=assertContinuationEnvelope(value);
  const t=data(own(target,['binding','versions','scopes','request','sourceRequest'])),cp=c.checkpoint;
  validateShape('Checkpoint',cp);assertWorkspacePaths(cp.workspace);validateShape('RunBinding',t.binding);validateShape('RuntimeVersions',t.versions);
  for(const request of [t.request,t.sourceRequest]) {
    if(!validRequest(request)||(request.window===null)!==(request.windowRequest===null))fail('CONTINUATION_REQUEST_REFUSED');
    if(request.window!==null)assertWindowResolution(request.windowRequest,request.window);
  }
  if(typeof cp.sessionId!=='string'||!UUID.test(cp.sessionId)||
      canonicalSha256(cp)!==c.checkpointSha256||canonicalSha256(t.sourceRequest)!==c.sourceRequestSha256||
      !same(cp.binding,cp.workspace.binding)||canonicalSha256(cp.workspace)!==cp.workspaceSha256||!same(cp.scopes,cp.workspace.scopes)||
      !same(cp.scopes,cp.opaqueSession.scopes)||cp.workspace.entries.some((/** @type {{object:{scopes:import('../../../../packages/contracts/dist/contracts.js').Scope[]}}} */ entry)=>entry.object.scopes.some(scope=>!cp.scopes.some((/** @type {import('../../../../packages/contracts/dist/contracts.js').Scope} */ parent)=>same(scope,parent))))||
      !same(cp.scopes,t.scopes)||!same(cp.versions,t.versions)||t.versions.sdk!=='0.3.295'||t.versions.cli!=='2.1.295'||
      continuationContextSha256(t.sourceRequest,cp.scopes)!==c.contextSha256||continuationContextSha256(t.request,t.scopes)!==c.contextSha256||
      !same(t.sourceRequest.windowRequest,t.request.windowRequest)||t.request.prompt!==t.sourceRequest.prompt||
      t.request.requestId===t.sourceRequest.requestId)fail('CONTINUATION_PIN_REFUSED');
  assertContinuationTarget(c,t.binding);
  if(t.request.skill!==null) {
    const selected=selectSkill(t.request.skill.skillId,t.request.skill.skillVersion);
    if(!same(selected.pin,t.request.skill))fail('CONTINUATION_SKILL_REFUSED');
  }
  // Chain entry and source restoration are verified by the trusted checkpoint
  // owner. No transcript, undo history or opaque SDK codec is reconstructed here.
  return lineageResumeOptions({sessionId:cp.sessionId,resumeSessionAt:c.resumeSessionAt,targetSessionId:c.mode==='fork'?c.targetSessionId:null});
}
/** The target run a verified lifecycle envelope may continue into: same tenant and actor, a new run/attempt/worker; resume stays in the
 * checkpoint's conversation at a later writer fence, fork moves to another conversation under a new SDK session id.
 * Shared by buildContinuationOptions and the runner's SDK options pin (apps/runtime/native-authority/sdk-option-template.mjs).
 * @param {any} c assertContinuationEnvelope output @param {any} binding the target RunBinding */
export function assertContinuationTarget(c,binding) {
  const cp=c.checkpoint;
  for(const key of ['tenantId','actorId'])if(cp.binding[key]!==binding[key])fail('CONTINUATION_SCOPE_REFUSED');
  if(cp.binding.runId===binding.runId||cp.binding.attemptId===binding.attemptId||cp.binding.workerId===binding.workerId||
      c.mode==='resume'&&binding.writerFence<=cp.binding.writerFence)fail('CONTINUATION_TARGET_REFUSED');
  if(c.mode==='resume' ? cp.binding.conversationId!==binding.conversationId :
      cp.binding.conversationId===binding.conversationId||c.targetSessionId===null||c.targetSessionId===cp.sessionId)fail('CONTINUATION_TARGET_REFUSED');
}
/** The SDK continuation options of a verified lineage: resume the checkpoint session, optionally at a message, and for a fork write a
 * new target session. The one definition of these fields, shared by both lineage builders and the runner's SDK options pin.
 * @param {{sessionId:string,resumeSessionAt:string|null,targetSessionId:string|null}} lineage
 * @returns {Pick<import('@anthropic-ai/claude-agent-sdk').Options,'resume'|'resumeSessionAt'|'forkSession'|'sessionId'>} */
export function lineageResumeOptions({sessionId,resumeSessionAt,targetSessionId}) {
  return Object.freeze({resume:sessionId,...(resumeSessionAt===null?{}:{resumeSessionAt}),
    ...(targetSessionId===null?{}:{forkSession:true,sessionId:targetSessionId})});
}
