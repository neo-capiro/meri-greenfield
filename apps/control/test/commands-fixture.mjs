/** Synthetic transaction and HTTP boundaries; actual application modules are used. */
import {readFileSync} from 'node:fs';import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';
import {canonicalSha256,validateShape as validatePublicShape} from '../../../packages/contracts/validate.mjs';
import * as payloads from '../../../packages/contracts/commands-0.2/validate.mjs';
import {createTaskUpdateValidators} from '../../../packages/contracts/commands-0.2/task-update-validation.mjs';
import {createCommandAuthority} from '../../gateway/index.mjs';
import {createCommandExecutor} from '../commands/executor.mjs';import {createCommandIntentValidator} from '../commands/intent.mjs';
import {createPostgresCommandJournal} from '../commands/postgres-command-journal.mjs';import {createCommandHttpSource} from '../commands/source-http.mjs';
export const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const NOW=Date.parse('2026-10-12T20:00:00.000Z');
const schema=JSON.parse(readFileSync(new URL('../../../packages/contracts/commands-0.2/task-update.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(JSON.parse(readFileSync(new URL('../../../packages/contracts/meri.schema.json',import.meta.url))));ajv.addSchema(schema);
const checks=new Map(Object.keys(schema.$defs).map(n=>[n,ajv.compile({$ref:`${schema.$id}#/$defs/${n}`})]));
export const taskUpdate=createTaskUpdateValidators({validateShape:(n,v)=>{const check=checks.get(n);if(!check?.(v))throw Error('Task update shape refused');return v;},validatePublicShape,canonicalSha256});
export function scriptedPool(state){
 const rows=new Map(),events=[];let queue=Promise.resolve();
 const pool={async connect(){events.push('connect');if(state.connectWait)await state.connectWait;let tx,unlock,begun=false,kind;
  return {async query(sql,args=[]){events.push(sql.split(/\s+/).filter(Boolean).slice(0,3).join(' '));if(state.queryHook)await state.queryHook(sql,args);
   if(sql==='BEGIN'){const old=queue;queue=new Promise(r=>unlock=r);await old;tx=new Map([...rows].map(([k,v])=>[k,structuredClone(v)]));begun=true;return {rows:[]};}
   if(sql.startsWith('SET LOCAL'))return {rows:[]};
   if(sql==='ROLLBACK'){begun=false;unlock?.();return {rows:[]};}
   if(sql==='COMMIT'){rows.clear();for(const [k,v]of tx)rows.set(k,structuredClone(v));begun=false;unlock?.();if(state.loseAck&&state.loseAck===kind){state.loseAck=null;throw Error('synthetic lost commit ACK');}return {rows:[]};}
   const key=JSON.stringify(args.slice(0,3));
   if(sql.startsWith('INSERT')){kind='claim';if([...tx.values()].some(v=>v.tenant_id===args[0]&&v.actor_id===args[1]&&(v.idempotency_key===args[2]||v.command_id===args[3])))return {rows:[]};
    const row={tenant_id:args[0],actor_id:args[1],idempotency_key:args[2],command_id:args[3],command_sha256:args[4],proposal_sha256:args[5],payload_sha256:args[6],payload:JSON.parse(args[7]),executor:JSON.parse(args[8]),state:'CLAIMED',outcome:null,created_at:new Date(NOW),updated_at:new Date(NOW)};tx.set(key,row);return {rows:[structuredClone(row)]};}
   if(sql.startsWith('SELECT'))return {rows:[...tx.values()].filter(v=>v.tenant_id===args[0]&&v.actor_id===args[1]&&(v.idempotency_key===args[2]||v.command_id===args[3])).map(v=>structuredClone(v))};
   if(sql.startsWith('UPDATE')){const row=tx.get(key);if(!row||row.command_id!==args[3]||row.state!=='CLAIMED')return {rows:[]};kind=sql.includes("state='OUTCOME'")?'complete':'unknown';row.state=kind==='complete'?'OUTCOME':'UNKNOWN';if(kind==='complete')row.outcome=JSON.parse(args[4]);return {rows:[structuredClone(row)]};}
   throw Error('Unrecognized synthetic transaction statement');
  },release(error){events.push(error?'release:error':'release');if(begun)unlock?.();if(state.releaseError)throw Error('synthetic release failure');}};
 },end(){throw Error('Borrowed pool must not be ended');}};
 return {pool,rows,events};
}
export function fixture(action='task.create'){
 const state={now:NOW,revoked:false,fence:1,approvalRevoked:false,fetches:0,policy:0};
 const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const scopes=[{tenantId:'tenant',kind:'tenant',resourceId:'tenant',policyRevision:'p1'}];
 const context=action==='task.create'?{binding,clientResolution:null}:action==='memory.propose'?{binding,conversationClientId:id(9)}:action==='artifact.file'?{binding,destination:{clientId:id(9),conversationId:id(1)}}:{binding};
 const object={objectId:id(20),versionId:'v1',sha256:'a'.repeat(64),bytes:2,scopes};
 const args=action==='task.create'?payloads.normalizeTaskCreateInput({title:'Task'},context):action==='memory.propose'?payloads.normalizeMemoryProposeInput({content:'Memory',scope:'firm'},context):action==='artifact.file'?context.destination:taskUpdate.normalizeTaskUpdateInput({taskId:id(21),title:'Updated',status:'open'},context);
 const command={contractVersion:action==='task.update'?'0.2.0':'0.1.0',commandId:id(5),binding,action,arguments:args,attachments:action==='artifact.file'?[object]:[],scopes,idempotencyKey:'delivery-1'};
 const proposal={proposalId:id(6),command,commandSha256:canonicalSha256(command),createdAt:new Date(NOW-1000).toISOString(),expiresAt:new Date(NOW+45000).toISOString(),requiredApprover:{tenantId:'tenant',actorId:'reviewer'}};
 const execution={contractVersion:'0.1.0',requestId:id(7),capabilityId:id(8),executorBinding:binding,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:command.idempotencyKey};
 const claims={capabilityId:id(8),issuer:'test',audience:'meri-gateway',binding,actions:['command.execute'],scopes,issuedAt:new Date(NOW-1000).toISOString(),expiresAt:new Date(NOW+60000).toISOString(),policyRevision:'p1',budgets:{maxTurns:5,maxRuntimeSeconds:60,maxCostMicrousd:100,maxOutputBytes:65536}};
 const operationId={'task.create':'create_task','task.update':'update_task','memory.propose':'save_memory','artifact.file':'save_chat_attachments'}[action];
 const descriptor={action,operation:{id:operationId,version:'0.2.0'},requiredGrants:['command.execute'],sourceRequirements:[{sourceId:'capiro_commands',authority:'authoritative',purpose:'enumeration'}]};
 const ports={verifyCapability:async()=>{if(state.revoked)throw Error('revoked');return JSON.stringify(claims);},currentRun:async()=>JSON.stringify({binding:{...binding,writerFence:state.fence},policyRevision:'p1',deadlineMs:NOW+60000,checkedAtMs:state.now}),authorizeBusiness:async()=>{state.policy++;return JSON.stringify({decision:{decisionId:id(10),actor:{tenantId:'tenant',actorId:'actor'},operation:`${operationId}@0.2.0`,scopes,policyRevision:'p1',evaluatedAt:new Date(state.now).toISOString(),decision:'allowed',reasonCode:'SYNTHETIC'},subject:{kind:'personal',entityType:'user',entityIds:['actor'],tenantId:'tenant',actorId:'actor',authorizationDecisionId:id(10),policyRevision:'p1',scopes,rosterVersionId:null},grants:['command.execute']});},authorizeSources:async()=>JSON.stringify({sourceIds:['capiro_commands'],enabled:true,policyRevision:'p1',checkedAtMs:state.now})};
 const authority=createCommandAuthority({authorityPorts:ports,now:()=>state.now,maxFactBytes:65536});
 const decision={proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision:'approved',decidedAt:new Date(NOW-500).toISOString(),expiresAt:new Date(NOW+40000).toISOString(),approver:proposal.requiredApprover,policyRevision:'p1'};
 const approvalStore={async getCurrent(){if(state.approvalWait)await state.approvalWait;return JSON.stringify({decision,checkedAtMs:state.now,revoked:state.approvalRevoked});}};
 const pg=scriptedPool(state),journal=createPostgresCommandJournal({pool:pg.pool}),contracts=createCommandIntentValidator({taskUpdate});
 const native=()=>action==='task.create'?{tool:'create_task',generatedAt:new Date(state.now).toISOString(),created:true,task:{id:id(30),title:command.arguments.title,status:'todo',dueDate:null,clientId:null,createdAt:new Date(state.now).toISOString()}}:action==='task.update'?{tool:'update_task',generatedAt:new Date(state.now).toISOString(),updated:true,task:{id:id(21),title:'Updated',status:'todo',dueDate:null,clientId:null,updatedAt:new Date(state.now).toISOString()}}:action==='memory.propose'?{saved:false,scope:command.arguments.scope,candidateId:id(30),message:'Pending source review'}:{tool:'save_chat_attachments',status:'saved',generatedAt:new Date(state.now).toISOString(),clientId:id(9),clientName:'Client',location:'/files',savedCount:1,pendingCount:0,failedCount:0,files:[{attachmentId:id(40),fileName:'f',status:'saved',documentId:id(31),location:'/files/31',indexingStatus:'pending',reused:false,reason:'Chat extraction was partial'}]};
 const source=createCommandHttpSource({origin:'https://source.invalid',now:()=>state.now,maxResponseBytes:65536,getCredentials:async({binding})=>({binding,bearerToken:'synthetic-user',serviceSecret:'synthetic-service',expiresAtMs:NOW+60000}),resolveAttachments:async({objects,destination,binding})=>({binding,destination,objects:objects.map(object=>({object,attachmentId:id(40)})),expiresAtMs:NOW+60000}),fetchImpl:async(url,options)=>{state.fetches++;state.http={url,options};if(state.fetchHook)return state.fetchHook(url,options,native());return new Response(JSON.stringify(native()),{headers:{'content-type':'application/json'}});}});
 const budget={async reserve(v){state.reserves=(state.reserves??0)+1;state.reservation=v;if(state.reserveHook)return state.reserveHook(v);return JSON.stringify({reservationId:v.reservationId,decision:'reserved'});},async settle(v){state.settles=(state.settles??0)+1;state.settlement=v;if(state.settleHook)return state.settleHook(v);return JSON.stringify({reservationId:v.reservationId,decision:'settled'});},async markUncertain(){state.uncertain=(state.uncertain??0)+1;}};
 const create=changes=>createCommandExecutor({journal,authority,approvalStore,source,budget,contracts,descriptor,context,now:()=>state.now,newId:()=>id(50),limits:{maxRequestMs:10000,maxResponseBytes:65536,maxCleanupMs:50},sourceEnabled:true,...changes});
 return {state,binding,scopes,context,command,proposal,execution,claims,decision,descriptor,ports,authority,approvalStore,pg,journal,contracts,source,budget,create,call:()=>({proposal,execution}),run:()=>create().execute({proposal,execution},'synthetic')};
}
