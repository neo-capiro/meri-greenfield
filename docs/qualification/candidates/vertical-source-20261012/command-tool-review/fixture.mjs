/** Independent source fixtures; metadata/HTTP/driver ports are synthetic only. */
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';
import {fixture,id,NOW,nextTurn} from '../../../../../apps/control/test/commands-independent-fixture.mjs';
import * as payloads from '../../../../../packages/contracts/commands-0.2/validate.mjs';
import {createTaskUpdateValidators} from '../../../../../packages/contracts/commands-0.2/task-update-validation.mjs';
import {createCommandToolValidators} from '../../../../../packages/contracts/commands-0.2/tool-interface-validation.mjs';
import {canonicalSha256,validateShape as validatePublicShape,assertProposalIntegrity} from '../../../../../packages/contracts/validate.mjs';
const root=new URL('../../../../../',import.meta.url),ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);
for(const path of ['meri.schema.json','commands-0.2/task-create.schema.json','commands-0.2/task-update.schema.json','commands-0.2/memory-propose.schema.json','commands-0.2/artifact-file.schema.json','commands-0.2/tool-interface.schema.json'])ajv.addSchema(JSON.parse(readFileSync(new URL('packages/contracts/'+path,root))));
const compiled=new Map();
function shape(urn,name,value){const ref=`urn:meri:commands:${urn}:0.2.0#/$defs/${name}`;let check=compiled.get(ref);if(!check){check=ajv.compile({$ref:ref});compiled.set(ref,check);}if(!check(value))throw Error('INDEPENDENT_SHAPE_REFUSAL');return value;}
const taskUpdate=createTaskUpdateValidators({validateShape:(name,v)=>shape('task-update',name,v),validatePublicShape,canonicalSha256});
export const stems={'task.create':'TaskCreate','task.update':'TaskUpdate','memory.propose':'MemoryPropose','artifact.file':'ArtifactFile'};
export {id,NOW,nextTurn,canonicalSha256,assertProposalIntegrity};
export function setup(action='task.create'){
 const f=fixture(action),raw=action==='task.create'?{title:'  Independently reviewed task  '}:action==='task.update'?{taskId:id(22),title:' Updated task '}:action==='memory.propose'?{content:' Synthetic source review ',scope:'firm'}:{...f.context.destination,objects:f.command.attachments};
 const validators=createCommandToolValidators({payloads,taskUpdate,intents:f.contracts,validateShape:(name,v)=>shape('tool-interface',name,v),canonicalSha256});
 const calls=[],hooks={};let retained;
 const owner={async prepare(call){calls.push('prepare');await hooks.prepare?.(call);retained={operation:call.operation,action,binding:f.binding,request:call.request,inputSha256:canonicalSha256(call.input),commandId:f.command.commandId,idempotencyKey:f.command.idempotencyKey,proposalId:f.proposal.proposalId,scopes:f.command.scopes,createdAt:f.proposal.createdAt,expiresAt:f.proposal.expiresAt,requiredApprover:f.proposal.requiredApprover,checkedAtMs:f.state.now};const value=structuredClone(retained);hooks.returnPrepare?.(value);return value;},async read(call){calls.push('read');await hooks.read?.(call);const value=structuredClone(retained);if(value)value.checkedAtMs=f.state.now;hooks.returnRead?.(value);return value;}};
 return {f,raw,validators,owner,hooks,calls,retained:()=>retained,requestShape:stems[action]+'ToolRequest',outputShape:stems[action]+'ToolResult',shape:(name,v)=>shape('tool-interface',name,v),base:{operation:f.descriptor.operation,action,outputShape:stems[action]+'ToolResult',commandContext:f.context,validators,assertProposal:action==='task.update'?taskUpdate.assertTaskUpdateProposal:assertProposalIntegrity,approvalMetadataOwner:owner,executor:f.make(),now:()=>f.state.now,limits:{maxRequestMs:500,maxFactBytes:65536}}};
}
