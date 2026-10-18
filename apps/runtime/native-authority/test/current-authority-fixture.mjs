/** SYNTHETIC Core, relay, secret files and product-budget SQL for the current-authority adapters. The Core answers are golden
 * vectors derived from capiro-backend #84 @ 0304b0ef: `auth/application-authority.ts` (identity receipt), `application-membership.
 * service.ts` + `.spec.ts` lines 243/365 (membership receipt with `permissions:['memory.propose.firm']`), `readApplicationAuthority
 * Context` (context receipt). The run facts come from the execution fixture's admitted set over a Core-UUID principal. */
import {createHash} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {admittedSet,WORKER_ARN} from './execution-capability-fixture.mjs';
export const uuid=d=>`${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`;
export const TENANT=uuid('b'),ACTOR=uuid('c'),CLIENT=uuid('d'),OTHER_CLIENT=uuid('e');
export const BINDING=Object.freeze({tenantId:TENANT,actorId:ACTOR,conversationId:uuid('1'),runId:uuid('2'),attemptId:uuid('3'),workerId:uuid('4'),writerFence:1});
export const POLICY=createHash('sha256').update('current-authority-policy').digest('hex');
export const SCOPES=Object.freeze([Object.freeze({tenantId:TENANT,kind:'client',resourceId:CLIENT,policyRevision:POLICY})]);
export const NOW=Date.parse('2026-10-18T14:30:00.000Z');
export const ORIGIN='https://core.example.test',CORE_ORIGIN='https://core-issuance.example.test';
export const FILES=Object.freeze({identity:'/run/meri/identity-credential',task:'/run/meri/task-capability',control:'/run/meri/control-capability',proxy:'/run/meri/proxy-credential',service:'/run/meri/core-tool-service-secret',readMode:'/run/meri/core-read-mode-service-secret',executionService:'/run/meri/core-execution-service-secret'});
/** The task capability bytes must digest to the admitted task grant's `capabilitySha256` (`admittedSet`: `synthetic-task-capability`). */
export const TASK_CAPABILITY='synthetic-task-capability',MODEL_CAPABILITY='synthetic-model-capability';
export const SESSION_BEARER='clerk_session_jwt_SYNTHETIC_2nT4kQ7vXbR9mWc3LpY8sHd1Fz6';
export const SERVICE_SECRET='INTERNAL_SERVICE_SECRET_SYNTHETIC';
export const CONTROL_CREDENTIAL='MARKED_CONTROL_CREDENTIAL_SYNTHETIC';
const IDENTITY_REVISION='a'.repeat(64),CONTEXT_REVISION='d'.repeat(64),MEMBERSHIP_REVISION='e'.repeat(64);
export const PATHS=Object.freeze({identity:'/api/clio/application-authority/identity',membership:'/api/clio/application-authority/membership',context:'/api/clio/application-authority/context'});

/** Golden Core receipts for the fixture principal at Meri time `at`. */
export function coreVectors(at,state){
 const principal={tenantId:state.principalTenant??TENANT,actorId:state.principalActor??ACTOR};
 return {
  identity:{principal,identityRevision:state.identityRevision??IDENTITY_REVISION,checkedAtMs:at,expiresAtMs:at+60000},
  membership:{tenantId:principal.tenantId,actorId:principal.actorId,status:state.membershipStatus??'active',role:state.role??'standard_user',permissions:['memory.propose.firm'],clientIds:[...(state.clientIds??[CLIENT])],membershipRevision:MEMBERSHIP_REVISION,checkedAtMs:at,expiresAtMs:at+60000},
  context:body=>({identitySha256:body.identitySha256,principal,identityRevision:state.identityRevision??IDENTITY_REVISION,conversationId:body.conversationId,selectedClientId:state.contextClient??body.clientId,contextRevision:CONTEXT_REVISION,checkedAtMs:at,expiresAtMs:at+60000}),
 };
}
export function fixture(options={}){
 const clock={at:NOW},now=()=>clock.at;
 const set=admittedSet({binding:BINDING,policyRevision:POLICY});
 const state={core:[],relay:[],secretReads:[],sql:[],connects:0,metadataReads:[],session:{credential:SESSION_BEARER,expiresAtMs:NOW+300000},status:{},mutate:null,respond:null,
  grantState:new Map(),run:{binding:BINDING,state:'running',scopes:structuredClone(SCOPES),createdAt:new Date(NOW-10000).toISOString(),policyRevision:POLICY},admittedGrants:null,stored:null};
 const files={[FILES.identity]:CONTROL_CREDENTIAL,[FILES.task]:TASK_CAPABILITY,[FILES.control]:'CONTROL_CAPABILITY_SYNTHETIC',[FILES.proxy]:MODEL_CAPABILITY,[FILES.service]:SERVICE_SECRET,[FILES.readMode]:SERVICE_SECRET,[FILES.executionService]:SERVICE_SECRET,...(options.files??{})};
 const readSecret=async path=>{state.secretReads.push(path);if(!Object.hasOwn(files,path))throw Error('ENOENT');return Buffer.from(files[path]+'\n');};
 // Synthetic Core: the bearer must be the live session's (never a candidate credential); every request is recorded.
 const fetchImpl=async(url,init)=>{
  const path=new URL(url).pathname,headers=Object.fromEntries(Object.entries(init.headers??{}).map(([k,v])=>[k.toLowerCase(),v])),body=typeof init.body==='string'?JSON.parse(init.body):undefined;
  state.core.push({path,headers,body,method:init.method});
  const bearer=(headers.authorization??'').replace(/^Bearer /u,'');
  if(bearer!==state.session?.credential&&bearer!==state.acceptedBearer)return Response.json({statusCode:401,message:'Unauthorized'},{status:401});
  if(state.status[path]!==undefined)return Response.json({statusCode:state.status[path],message:'refused'},{status:state.status[path]});
  const vectors=coreVectors(now(),state);
  const value=path===PATHS.identity?vectors.identity:path===PATHS.membership?vectors.membership:path===PATHS.context?vectors.context(body):null;
  if(value===null)return Response.json({statusCode:404,message:'Cannot POST '+path},{status:404});
  state.mutate?.(value,path,state.core.length);
  return state.respond?.(value,path)??Response.json(value);
 };
 const nativeCredentials=Object.freeze({nativeCredentialFor(input){
  state.relay.push({binding:structuredClone(input.binding),selectedClientId:input.selectedClientId});
  const session=state.session;if(session===null)throw Object.assign(Error('SESSION_UNAVAILABLE'),{code:'SESSION_UNAVAILABLE'});
  if(hash({tenantId:input.binding.tenantId,actorId:input.binding.actorId,conversationId:input.binding.conversationId,runId:input.binding.runId})!==hash({tenantId:BINDING.tenantId,actorId:BINDING.actorId,conversationId:BINDING.conversationId,runId:BINDING.runId})||input.selectedClientId!==CLIENT)throw Object.assign(Error('SESSION_UNAVAILABLE'),{code:'SESSION_UNAVAILABLE'});
  if(state.replaceAfter!==undefined&&state.relay.length>state.replaceAfter)return Object.freeze({credential:'clerk_session_jwt_REPLACED',expiresAtMs:session.expiresAtMs});
  return Object.freeze({credential:session.credential,expiresAtMs:session.expiresAtMs});
 }});
 // Product-budget rows exactly as `readCurrentAdmission` and the capability-digest join read them.
 const rows={budget:{id:1,cap_micro_usd:'5000000',consumed_micro_usd:'0',quarantined:false},run:{run_id:BINDING.runId,attempt:1,worker_arn:WORKER_ARN,fence:1,policy_revision:POLICY},
  allocation:{run_id:BINDING.runId,allocation_sha256:hash(set.allocation),allocation:structuredClone(set.allocation),started_at:new Date(NOW-5000),max_tool_calls:'1',max_cost_micro_usd:'2000000'},
  grants:new Map(set.facts.map(f=>[f.grantId,{grant_id:f.grantId,run_id:BINDING.runId,attempt:1,worker_arn:WORKER_ARN,fence:1,policy_revision:POLICY,capability_sha256:f.capabilitySha256,expires_at:new Date(NOW+600000),state:'ACTIVE'}])),
  bindings:new Map(set.facts.map(f=>[f.grantId,{grant_id:f.grantId,run_id:BINDING.runId,facts:structuredClone(f)}]))};
 const grantRow=id=>{const g=rows.grants.get(id);return g?{...structuredClone(g),state:state.grantState.get(id)??g.state}:null;};
 const pool={options:{connectionTimeoutMillis:2000,query_timeout:5000},async connect(){state.connects++;return {async query(sql,params=[]){state.sql.push(sql.split(/\s+/u).slice(0,6).join(' '));
  if(sql.startsWith('BEGIN')||sql.startsWith('SET LOCAL')||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[]};
  if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date(now())}]};
  if(sql.includes('FOR UPDATE'))throw Error('read-only scripted pool');
  if(sql.startsWith('SELECT * FROM meri_product_budget.budget'))return {rows:[structuredClone(rows.budget)]};
  if(sql.startsWith('SELECT * FROM meri_product_budget.runs'))return {rows:params[0]===rows.run.run_id?[structuredClone(rows.run)]:[]};
  if(sql.startsWith('SELECT * FROM meri_product_budget.tool_run_allocations')||sql.startsWith('SELECT allocation,allocation_sha256 FROM meri_product_budget.tool_run_allocations'))return {rows:params[0]===BINDING.runId?[structuredClone(rows.allocation)]:[]};
  if(sql.startsWith('SELECT * FROM meri_product_budget.grants')){const g=grantRow(params[0]);return {rows:g?[g]:[]};}
  if(sql.startsWith('SELECT * FROM meri_product_budget.tool_grant_bindings')){const b=rows.bindings.get(params[0]);return {rows:b?[structuredClone(b)]:[]};}
  if(sql.startsWith('SELECT g.grant_id')){const g=[...rows.grants.values()].map(r=>grantRow(r.grant_id)).find(r=>r.capability_sha256===params[0]);if(!g)return {rows:[]};const b=rows.bindings.get(g.grant_id);
   return {rows:[{grant_id:g.grant_id,run_id:g.run_id,state:g.state,expires_at:g.expires_at,policy_revision:g.policy_revision,facts:structuredClone(b.facts),allocation:structuredClone(rows.allocation.allocation),allocation_sha256:rows.allocation.allocation_sha256,started_at:rows.allocation.started_at}]};}
  throw Error('unexpected SQL '+sql);},release(){}};}};
 // The conversation store's two reads the adapters use: the ADMITTED allocation record and the run row.
 const conversations=Object.freeze({allocations:Object.freeze({async read({binding,allocationKey},check){check();if(hash(binding)!==hash(BINDING)||allocationKey!==hash(BINDING))return null;
   return {run:{},record:{state:'ADMITTED',binding:structuredClone(BINDING),allocationSha256:hash(set.allocation),resource:{grantFactsJsons:[...(state.admittedGrants??set.grantFactsJsons)]}}};}}),
  async readOptional(binding,cursor,check){check();if(state.run===null||hash(binding)!==hash(BINDING))return null;return {run:structuredClone(state.run),request:{requestId:uuid('9'),prompt:'synthetic'}};}});
 const approvalMetadata=Object.freeze({async insert(payload,check){check();state.stored=structuredClone(payload);return structuredClone(payload);},async read(key,check){state.metadataReads.push(key);check();return state.stored===null?null:structuredClone(state.stored);}});
 const facts=Object.fromEntries(set.facts.map(f=>[f.capabilitySha256===createHash('sha256').update(TASK_CAPABILITY).digest('hex')?'task':'model',f]));
 return {clock,now,state,set,facts,files,readSecret,fetchImpl,nativeCredentials,pool,rows,conversations,approvalMetadata,
  outbound:()=>state.core.map(r=>r.path),bearers:()=>new Set(state.core.map(r=>(r.headers.authorization??'').replace(/^Bearer /u,'')))};
}
