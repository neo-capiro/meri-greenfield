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
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=code=>{throw new Error(code);};
export const continuationContextSha256=(request,scopes)=>canonicalSha256({window:request.window,skill:request.skill,scopes});
/** @returns {Pick<import('@anthropic-ai/claude-agent-sdk').Options,'resume'|'resumeSessionAt'|'forkSession'|'sessionId'>} */
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
      !same(cp.scopes,cp.opaqueSession.scopes)||cp.workspace.entries.some(entry=>entry.object.scopes.some(scope=>!cp.scopes.some(parent=>same(scope,parent))))||
      !same(cp.scopes,t.scopes)||!same(cp.versions,t.versions)||t.versions.sdk!=='0.3.295'||t.versions.cli!=='2.1.295'||
      continuationContextSha256(t.sourceRequest,cp.scopes)!==c.contextSha256||continuationContextSha256(t.request,t.scopes)!==c.contextSha256||
      !same(t.sourceRequest.windowRequest,t.request.windowRequest))fail('CONTINUATION_PIN_REFUSED');
  for(const key of ['tenantId','actorId'])if(cp.binding[key]!==t.binding[key])fail('CONTINUATION_SCOPE_REFUSED');
  if(cp.binding.runId===t.binding.runId||cp.binding.attemptId===t.binding.attemptId||cp.binding.workerId===t.binding.workerId||
      c.mode==='resume'&&t.binding.writerFence<=cp.binding.writerFence)fail('CONTINUATION_TARGET_REFUSED');
  if(c.mode==='resume' ? cp.binding.conversationId!==t.binding.conversationId :
      cp.binding.conversationId===t.binding.conversationId||c.targetSessionId===null||c.targetSessionId===cp.sessionId)fail('CONTINUATION_TARGET_REFUSED');
  if(t.request.skill!==null) {
    const selected=selectSkill(t.request.skill.skillId,t.request.skill.skillVersion);
    if(!same(selected.pin,t.request.skill))fail('CONTINUATION_SKILL_REFUSED');
  }
  // Chain entry and source restoration are verified by the trusted checkpoint
  // owner. No transcript, undo history or opaque SDK codec is reconstructed here.
  return Object.freeze({resume:cp.sessionId,...(c.resumeSessionAt===null?{}:{resumeSessionAt:c.resumeSessionAt}),
    ...(c.mode==='fork'?{forkSession:true,sessionId:c.targetSessionId}:{})});
}
