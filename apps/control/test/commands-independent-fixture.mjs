/** Scripted driver/HTTP boundaries around actual command and canonical authority modules.
 * No real Pool, SQL engine, network, credentials or native source is opened.
 */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {canonicalSha256,validateShape as validatePublicShape} from '../../../packages/contracts/validate.mjs';
import {createCommandAuthority} from '../../gateway/index.mjs';

export const sourceRoot=process.env.MERI_COMMAND_SOURCE_ROOT;
const sourceUrl=path=>sourceRoot?pathToFileURL(resolve(sourceRoot,path)):new URL(`../../../${path}`,import.meta.url);
const load=path=>import(sourceUrl(path));
const {createCommandExecutor}=await load('apps/control/commands/executor.mjs');
const {createPostgresCommandJournal}=await load('apps/control/commands/postgres-command-journal.mjs');
const {createCommandHttpSource}=await load('apps/control/commands/source-http.mjs');
const {createCommandIntentValidator}=await load('apps/control/commands/intent.mjs');
const {createTaskUpdateValidators}=await load('packages/contracts/commands-0.2/task-update-validation.mjs');
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);
ajv.addSchema(JSON.parse(readFileSync(new URL('../../../packages/contracts/meri.schema.json',import.meta.url))));
const updateSchema=JSON.parse(readFileSync(sourceUrl('packages/contracts/commands-0.2/task-update.schema.json')));ajv.addSchema(updateSchema);
const validators=new Map(Object.keys(updateSchema.$defs).map(name=>[name,ajv.compile({$ref:`${updateSchema.$id}#/$defs/${name}`})]));
const taskUpdate=createTaskUpdateValidators({validateShape:(name,value)=>{const fn=validators.get(name);if(!fn(value))throw Error('REVIEW_SHAPE_REFUSAL');return value;},validatePublicShape,canonicalSha256});
const contracts=createCommandIntentValidator({taskUpdate});
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const NOW=Date.parse('2026-10-12T22:00:00.000Z');
export const nextTurn=()=>new Promise(r=>setImmediate(r));

export function fixture(action='task.create'){
 const calls=[],state={now:NOW,revoked:false,approvalRevoked:false,policy:'review-p1',effects:0,sqlRows:[],failCommit:0,commitCount:0,hooks:{},maxOutputBytes:65536};
 const binding={tenantId:'review-tenant',actorId:'review-actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const scope={tenantId:binding.tenantId,kind:'tenant',resourceId:binding.tenantId,policyRevision:'review-p1'};
 const context=action==='task.create'?{binding,clientResolution:null}:action==='task.update'?{binding}:action==='memory.propose'?{binding,conversationClientId:null}:{binding,destination:{clientId:id(20),conversationId:id(1)}};
 const object={objectId:id(21),versionId:'review-v1',sha256:'b'.repeat(64),bytes:3,scopes:[scope]};
 const argumentsByAction={'task.create':{title:'Independently reviewed task',clientId:null,dueDate:null},'task.update':{taskId:id(22),mode:'unconditional_patch',patch:{title:'Updated task'}},'memory.propose':{content:'Synthetic source review',key:null,scope:'firm',clientId:null,ttlDays:null},'artifact.file':{clientId:id(20),conversationId:id(1)}};
 const command={contractVersion:action==='task.update'?'0.2.0':'0.1.0',commandId:id(5),binding,action,arguments:argumentsByAction[action],attachments:action==='artifact.file'?[object]:[],scopes:[scope],idempotencyKey:'independent-delivery'};
 const proposal={proposalId:id(6),command,commandSha256:canonicalSha256(command),createdAt:new Date(NOW-1000).toISOString(),expiresAt:new Date(NOW+10000).toISOString(),requiredApprover:{tenantId:binding.tenantId,actorId:'review-approver'}};
 const execution={contractVersion:'0.1.0',requestId:id(7),capabilityId:id(8),executorBinding:structuredClone(binding),proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:command.idempotencyKey};
 const value={proposal,execution};
 const descriptor={action,operation:{id:({'task.create':'create_task','task.update':'update_task','memory.propose':'save_memory','artifact.file':'save_chat_attachments'})[action],version:'0.2.0'},requiredGrants:['command.execute'],sourceRequirements:[{sourceId:'review-source'}]};
 const claims=()=>({capabilityId:execution.capabilityId,issuer:'review',audience:'meri-gateway',binding:execution.executorBinding,actions:['command.execute'],scopes:[scope],issuedAt:new Date(NOW-2000).toISOString(),expiresAt:new Date(NOW+10000).toISOString(),policyRevision:state.policy,budgets:{maxTurns:5,maxRuntimeSeconds:10,maxCostMicrousd:100,maxOutputBytes:state.maxOutputBytes}});
 const hook=async(name,arg)=>{calls.push(name);return state.hooks[name]?.(arg);};
 const ports={
  async verifyCapability(){await hook('verify');if(state.revoked)throw Error('private revoked detail');return JSON.stringify(claims());},
  async currentRun(){await hook('currentRun');return JSON.stringify({binding:execution.executorBinding,policyRevision:state.policy,deadlineMs:state.authorityDeadline??NOW+10000,checkedAtMs:state.now});},
  async authorizeBusiness(){await hook('business');return JSON.stringify({decision:{decisionId:id(9),actor:{tenantId:binding.tenantId,actorId:binding.actorId},operation:`${descriptor.operation.id}@${descriptor.operation.version}`,scopes:[scope],policyRevision:state.policy,evaluatedAt:new Date(state.now).toISOString(),decision:'allowed',reasonCode:'REVIEW'},subject:{kind:'personal',entityType:'user',entityIds:[binding.actorId],tenantId:binding.tenantId,actorId:binding.actorId,authorizationDecisionId:id(9),policyRevision:state.policy,scopes:[scope],rosterVersionId:null},grants:['command.execute']});},
  async authorizeSources(){await hook('sourcePolicy');return JSON.stringify({sourceIds:['review-source'],enabled:true,policyRevision:state.policy,checkedAtMs:state.now});}
 };
 const approvalStore={async getCurrent(){await hook('approval');return JSON.stringify({decision:{proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision:'approved',decidedAt:new Date(NOW-500).toISOString(),expiresAt:new Date(NOW+10000).toISOString(),approver:proposal.requiredApprover,policyRevision:state.policy,...state.decisionOverride},checkedAtMs:state.now,revoked:state.approvalRevoked});}};
 let gate=Promise.resolve();
 const pool={async connect(){
  await hook('connect');let unlock;const prior=gate;gate=new Promise(r=>{unlock=r;});await prior;
  let working=structuredClone(state.sqlRows);
  return {async query(sql,params){
   const label=sql==='BEGIN'?'begin':sql==='COMMIT'?'commit':sql==='ROLLBACK'?'rollback':sql.startsWith('SET LOCAL statement')?'statementTimeout':sql.startsWith('SET LOCAL lock')?'lockTimeout':sql.startsWith('INSERT')?'insert':sql.startsWith('SELECT')?'select':sql.includes("state='OUTCOME'")?'complete':sql.includes("state='UNKNOWN'")?'unknown':'unexpected';
   await hook(label,{sql,params});
   if(label==='commit'){state.sqlRows=structuredClone(working);state.commitCount++;if(state.commitCount===state.failCommit)throw Error('synthetic lost commit ACK');return {rows:[]};}
   if(label==='rollback'){working=structuredClone(state.sqlRows);return {rows:[]};}
   if(label==='insert'){
    const [tenant_id,actor_id,idempotency_key,command_id,command_sha256,proposal_sha256,payload_sha256,payload,executor]=params;
    if(working.some(r=>r.tenant_id===tenant_id&&r.actor_id===actor_id&&(r.idempotency_key===idempotency_key||r.command_id===command_id)))return {rows:[]};
    const row={tenant_id,actor_id,idempotency_key,command_id,command_sha256,proposal_sha256,payload_sha256,payload:JSON.parse(payload),executor:JSON.parse(executor),state:'CLAIMED',outcome:null,created_at:new Date(state.now),updated_at:new Date(state.now)};working.push(row);return {rows:[structuredClone(row)]};
   }
   if(['select','complete','unknown'].includes(label)){
    const [tenant,actor,idem,commandId]=params;const rows=working.filter(r=>r.tenant_id===tenant&&r.actor_id===actor&&(label==='select'?(r.idempotency_key===idem||r.command_id===commandId):(r.idempotency_key===idem&&r.command_id===commandId&&r.state==='CLAIMED')));
    if(label!=='select')for(const row of rows){row.state=label==='complete'?'OUTCOME':'UNKNOWN';if(label==='complete')row.outcome=JSON.parse(params[4]);row.updated_at=new Date(state.now);}
    return {rows:structuredClone(rows)};
   }
   return {rows:[]};
  },release(){calls.push('release');unlock();}};
 }};
 const journal=createPostgresCommandJournal({pool});
 const result=()=>action==='task.create'?{tool:'create_task',generatedAt:new Date(state.now).toISOString(),created:true,task:{id:id(23),title:command.arguments.title,status:'todo',dueDate:null,clientId:null,createdAt:new Date(state.now).toISOString()}}:action==='task.update'?{tool:'update_task',generatedAt:new Date(state.now).toISOString(),updated:true,task:{id:id(22),title:command.arguments.patch.title,status:'todo',dueDate:null,clientId:null,updatedAt:new Date(state.now).toISOString()}}:action==='memory.propose'?{saved:false,scope:command.arguments.scope,candidateId:id(24),message:'Synthetic pending candidate'}:{tool:'save_chat_attachments',status:'saved',generatedAt:new Date(state.now).toISOString(),clientId:id(20),clientName:'Synthetic',location:'/synthetic',savedCount:1,pendingCount:0,failedCount:0,files:[{attachmentId:id(25),fileName:'synthetic.txt',status:'saved',documentId:id(26),location:'/synthetic/document',indexingStatus:'pending',reused:false,reason:'Partial extracted text'}]};
 const source=createCommandHttpSource({origin:'https://source.invalid',now:()=>state.now,maxResponseBytes:65536,
  async getCredentials(){const custom=await hook('credentials');return custom??{binding:execution.executorBinding,bearerToken:'synthetic-bearer',serviceSecret:'synthetic-secret',expiresAtMs:NOW+10000};},
  async resolveAttachments(){const custom=await hook('attachments');return custom??{binding:execution.executorBinding,destination:context.destination,expiresAtMs:NOW+10000,objects:[{object,attachmentId:id(25)}]};},
  async fetchImpl(url,options){state.effects++;state.lastRequest={url,options};const custom=await hook('http',{url,options});return custom??new Response(JSON.stringify(result()),{headers:{'content-type':'application/json'}});}
 });
 const budget={async reserve({reservationId}){const custom=await hook('reserve');return custom??JSON.stringify({reservationId,decision:'reserved'});},async settle({reservationId}){const custom=await hook('settle');return custom??JSON.stringify({reservationId,decision:'settled'});},async markUncertain(){await hook('uncertain');}};
 const make=(extra={})=>createCommandExecutor({journal,authority:createCommandAuthority({authorityPorts:ports,now:()=>state.now,maxFactBytes:65536}),approvalStore,source,budget,contracts,descriptor,context,now:()=>state.now,newId:()=>id(30),limits:{maxRequestMs:500,maxResponseBytes:65536,maxCleanupMs:30},sourceEnabled:true,...extra});
 const resign=()=>{proposal.commandSha256=canonicalSha256(command);execution.commandSha256=proposal.commandSha256;};
 return {calls,state,binding,scope,context,command,proposal,execution,value,descriptor,ports,approvalStore,pool,journal,source,budget,contracts,make,resign,result};
}
