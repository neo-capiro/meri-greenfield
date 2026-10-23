/** Explicit synthetic SQL/native authority resources; actual canonical owners execute. */
import {productFixture,NOW} from '../../../gateway/budget/product-scripted-fixture.mjs';
import {fixture as sessionFixture} from './fixture.mjs';
import {createServer} from 'node:http';
import {versions} from '../../../control/conversations/test/store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
export {NOW};
export async function resources(){
 const f=productFixture(),journal=sessionFixture(),reads=[];let sqlHook=()=>{};
 const binding=f.invocation.binding,clientId='11111111-1111-4111-8111-000000000006',principal={tenantId:binding.tenantId,actorId:binding.actorId},facts=f.context(),policyRevision=facts.qualificationBinding.policyRevision,expiresAtMs=NOW+8000;
 f.state().grant.expires_at=new Date(expiresAtMs);
 const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision}],createdAt=new Date(NOW).toISOString(),tuple={tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId};
 const conversation={conversationId:binding.conversationId,owner:principal,scopes,policyRevision,createdAt},run={binding,state:'running',scopes,policyRevision,createdAt,versions},request={requestId:clientId,prompt:'synthetic',skill:null,window:null};
 const record={binding,allocationKey:hash(binding),original:{binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'a'.repeat(64),expiresAtMs,versions},allocationSha256:facts.allocationSha256,qualification:{attempt:1,policyRevision},grantIntents:[{grantId:facts.grantId,capabilitySha256:facts.capabilitySha256,expiresAtMs}],taskRequestSha256:'b'.repeat(64),expiresAtMs,state:'ADMITTED',resource:{taskArn:facts.qualificationBinding.workerArn,createdAtMs:NOW,clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/Synthetic',taskDefinitionArn:'arn:aws:ecs:us-east-1:967807252336:task-definition/Synthetic:1',containerName:'worker',grantFactsJsons:[JSON.stringify(facts)]}};
 const rows=()=>({conversation:{...tuple,owner_actor_id:binding.actorId,projection:conversation,projection_sha256:hash(conversation)},run:{...tuple,projection:run,projection_sha256:hash(run),request,request_id:request.requestId,request_sha256:hash(request),last_sequence:'3',sequence_base:'0',sequence_end:null},allocation:{...tuple,intent_key:hash(binding),record,record_sha256:hash(record)},qualified:f.state().run,grant:f.state().grant,bound:{grant_id:facts.grantId,run_id:binding.runId,facts}});
 const pool={async connect(){let snapshot;
  return {async query(sql,args){
   reads.push(sql);await sqlHook(sql);
   if(sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'){snapshot=structuredClone(rows());return {rows:[]};}
   if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK'||sql.startsWith('SET LOCAL'))return {rows:[]};
   if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date(f.now())}]};
   if(snapshot&&(sql.includes('FOR UPDATE')||sql.includes('pg_advisory')||!sql.startsWith('SELECT')))throw Error('READ_ONLY_SNAPSHOT_EFFECT_REFUSED');
   if(sql.startsWith('SELECT pg_advisory'))return {rows:[]};
   const current=snapshot??rows();
   for(const [table,key] of [['meri_conversations.conversations','conversation'],['meri_conversations.runs','run'],['meri_conversations.native_allocations','allocation'],['meri_product_budget.runs','qualified'],['meri_product_budget.grants','grant'],['meri_product_budget.tool_grant_bindings','bound']])if(sql.startsWith('SELECT * FROM '+table+' '))return {rows:structuredClone(['grant','bound'].includes(key)&&args[0]!==facts.grantId?[]:[current[key]])};
   if(sql.includes('meri_conversations.sdk_'))return journal.admission.withCurrentRun({binding:journal.binding},({client})=>client.query(sql,args));
   throw Error('UNEXPECTED_RUN_OWNER_SQL');
  },release(){}};
 }};
 let hook=()=>{},authorityCalls=0;
 const identity={origin:'https://authority.synthetic.invalid',commandContext:{binding,clientResolution:{reference:clientId,clientId}},credential:'synthetic-existing-identity',async fetchImpl(url,options){authorityCalls++;await hook(url,options);const input=JSON.parse(options.body),base={principal,identityRevision:'a'.repeat(64),checkedAtMs:f.now(),expiresAtMs:NOW+9000};return Response.json(url.endsWith('/current')?{...base,role:'standard_user',permissions:[],clientIds:[clientId],membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64),conversationId:binding.conversationId,selectedClientId:clientId}:url.endsWith('/identity')?base:{...base,identitySha256:input.identitySha256,conversationId:binding.conversationId,selectedClientId:clientId,contextRevision:'synthetic-context'});}};
 return {f,pool,binding,clientId,identity,reads,journal,run,record,expiresAtMs,authorityCalls:()=>authorityCalls,setHook(value){hook=value;},setSqlHook(value){sqlHook=value;}};
}
export async function listenFetch(application){
 const server=createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const request=new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});const response=await application.handle(request);res.writeHead(response?.status??404,Object.fromEntries(response?.headers??[]));res.end(response?Buffer.from(await response.arrayBuffer()):'');}catch{res.writeHead(500);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return {origin:'http://127.0.0.1:'+server.address().port,async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
