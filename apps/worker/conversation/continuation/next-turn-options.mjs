/** Next-prompt lineage is distinct from lifecycle resume/fork. No credentials or SDK codec. */
import {validateShape,assertWorkspacePaths,canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {continuationContextSha256} from './options.mjs';
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
const validRequest=ajv.compile({$ref:'urn:meri:conversation-application:0.1.0#/$defs/ConversationStoredRequest'});
const same=(a,b)=>hash(a)===hash(b),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const fail=()=>{throw Error('NEXT_TURN_REFUSED');};
export function assertNextTurnLineage(value,binding){
 const n=data(own(value,['checkpoint','checkpointSha256','sourceRequestSha256','contextSha256','sourceRequest','targetBinding','resumeSessionAt']));
 const cp=n.checkpoint;validateShape('Checkpoint',cp);assertWorkspacePaths(cp.workspace);validateShape('RunBinding',binding);
 if(!same(n.targetBinding,binding)||!validRequest(n.sourceRequest)||hash(cp)!==n.checkpointSha256||hash(n.sourceRequest)!==n.sourceRequestSha256||
  !same(cp.binding,cp.workspace.binding)||hash(cp.workspace)!==cp.workspaceSha256||!same(cp.scopes,cp.workspace.scopes)||!same(cp.scopes,cp.opaqueSession.scopes)||
  cp.workspace.entries.some(entry=>entry.object.scopes.some(scope=>!cp.scopes.some(parent=>same(scope,parent))))||
  continuationContextSha256(n.sourceRequest,cp.scopes)!==n.contextSha256||!uuid.test(cp.sessionId)||n.resumeSessionAt!==null&&!uuid.test(n.resumeSessionAt))fail();
 for(const key of ['tenantId','actorId','conversationId'])if(cp.binding[key]!==binding[key])fail();
 for(const key of ['runId','attemptId','workerId'])if(cp.binding[key]===binding[key])fail();
 if(binding.writerFence!==cp.binding.writerFence+1)fail();return n;
}
export function buildNextTurnOptions(value,target){
 const t=data(own(target,['binding','versions','scopes','request','sourceRequest'])),n=assertNextTurnLineage(value,t.binding),cp=n.checkpoint;
 validateShape('RuntimeVersions',t.versions);
 for(const request of [t.request,t.sourceRequest]){
  if(!validRequest(request)||(request.window===null)!==(request.windowRequest===null))fail();
  if(request.window!==null)assertWindowResolution(request.windowRequest,request.window);
 }
 if(!same(n.sourceRequest,t.sourceRequest)||!same(cp.scopes,t.scopes)||!same(cp.versions,t.versions)||t.versions.sdk!=='0.3.295'||t.versions.cli!=='2.1.295'||
  continuationContextSha256(t.request,t.scopes)!==n.contextSha256||!same(t.sourceRequest.windowRequest,t.request.windowRequest)||t.sourceRequest.requestId===t.request.requestId)fail();
 if(t.request.skill!==null&&!same(selectSkill(t.request.skill.skillId,t.request.skill.skillVersion).pin,t.request.skill))fail();
 return Object.freeze({resume:cp.sessionId,...(n.resumeSessionAt===null?{}:{resumeSessionAt:n.resumeSessionAt})});
}
