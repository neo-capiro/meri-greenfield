/** Inert protocol fixture only; not PostgreSQL concurrency, durability or policy evidence. */
import {canonicalSha256,assertProposalIntegrity} from '../../../../../packages/contracts/validate.mjs';
import {commandToolValidators} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createCommandToolInterface} from '../../tool-interface.mjs';
import {createPostgresApprovalMetadataStore,createTaskCreateApprovalMetadataOwner} from '../index.mjs';
export const NOW=1900000000000,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export function createMetadataPoolFixture(){
 const rows=new Map(),calls=[],releases=[];
 const pool={options:{connectionTimeoutMillis:1000,query_timeout:1000},async connect(){calls.push('connect');return {async query(config){
  calls.push(config);const {text,values}=config;
  if(text.startsWith('INSERT INTO meri_approval_metadata ')){
   const [tenant,actor,proposal,,,,hash,raw]=values,key=JSON.stringify([tenant,actor,proposal.toLowerCase()]);
   if(rows.has(key))throw new Error('synthetic unique conflict');const record={payload:JSON.parse(raw),payload_sha256:hash};rows.set(key,record);return {rows:[structuredClone(record)]};
  }
  if(text.startsWith('SELECT payload,payload_sha256 FROM meri_approval_metadata ')){const key=JSON.stringify([values[0],values[1],values[2].toLowerCase()]);return {rows:rows.has(key)?[structuredClone(rows.get(key))]:[]};}
  throw new Error('not a metadata fixture statement');
 },release(error){releases.push(error);}};}};
 return {pool,rows,calls,releases};
}
export function createMetadataPolicyFixture({binding,scopes,requiredApprover,expiresAt,now=()=>NOW}){
 const calls=[],state={denyPhase:null,mutate:null};
 const preparePolicy=async call=>{
  calls.push(call);if(state.denyPhase===call.phase)throw new Error('private policy refusal');
  const result={authorized:true,selectionSha256:call.selectionSha256,binding,scopes,requiredApprover,proposalExpiresAt:expiresAt,checkedAtMs:now(),expiresAtMs:Math.min(now()+1000,Date.parse(expiresAt))};
  state.mutate?.(result,call);return result;
 };return {preparePolicy,calls,state};
}
export function setup(){
 const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const commandContext={binding,clientResolution:{reference:id(5),clientId:id(5)}},scopes=[{tenantId:'tenant',kind:'client',resourceId:id(5),policyRevision:'policy-1'}];
 const raw={title:' Review recommendation ',clientId:id(5),dueDate:'2030-03-17'};
 const p=createMetadataPolicyFixture({binding,scopes,requiredApprover:{tenantId:'tenant',actorId:'reviewer'},expiresAt:new Date(NOW+60000).toISOString()});
 const sql=createMetadataPoolFixture(),store=createPostgresApprovalMetadataStore({pool:sql.pool});let n=100,effects=0;
 const owner=createTaskCreateApprovalMetadataOwner({store,commandContext,preparePolicy:p.preparePolicy,now:()=>NOW,newId:()=>id(n++)});
 const operation={id:'create_task',version:'0.2.0'},action='task.create';
 const tool=createCommandToolInterface({operation,action,outputShape:'TaskCreateToolResult',commandContext,validators:commandToolValidators,assertProposal:assertProposalIntegrity,approvalMetadataOwner:owner,executor:{async execute(){effects++;return {status:'indeterminate',outcome:null};}},now:()=>NOW,limits:{maxRequestMs:1000,maxFactBytes:65536}});
 const normalized=commandToolValidators.normalizeCommandToolInput(action,raw,{commandContext}).input;
 const call={operation,action,binding,request:raw,input:normalized,inputSha256:canonicalSha256(normalized),deadlineMs:NOW+1000,signal:undefined};
 return {binding,commandContext,raw,sql,p,store,owner,tool,call,effects:()=>effects};
}
export {canonicalSha256,commandToolValidators};
