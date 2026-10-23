/** Synthetic row/protocol fixture. Native PostgreSQL contention is qualified separately. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {binding,versions,id} from '../conversations/test/store-fixture.mjs';
export function runOwnerFixture({at=1800000000000,leaseMs=10000}={}){
 const expiry=at+leaseMs,policyRevision='d'.repeat(64),scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:id(5),policyRevision}],createdAt=new Date(at).toISOString();
 const projection={conversationId:binding.conversationId,owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes,policyRevision,createdAt};
 const run={binding,state:'running',scopes,policyRevision,createdAt,versions},request={requestId:id(6),prompt:'synthetic',skill:null,window:null};
 const taskArn='arn:aws:ecs:us-east-1:967807252336:task/Synthetic/'+'a'.repeat(32),q={runId:binding.runId,attempt:1,workerArn:taskArn,fence:1,policyRevision};
 const grantId=id(7),modelGrantId=id(8),grants=[{grantId,capabilitySha256:'e'.repeat(64),expiresAtMs:expiry},{grantId:modelGrantId,capabilitySha256:'f'.repeat(64),expiresAtMs:expiry}];
 const allocationSha256='c'.repeat(64),facts=grants.map(g=>({grantId:g.grantId,binding,qualificationBinding:q,capabilitySha256:g.capabilitySha256,allocationSha256}));
 const record={binding,allocationKey:hash(binding),original:{binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'a'.repeat(64),expiresAtMs:expiry,versions},allocationSha256,qualification:{attempt:1,policyRevision},grantIntents:grants,taskRequestSha256:'b'.repeat(64),expiresAtMs:expiry,state:'ADMITTED',resource:{taskArn,createdAtMs:at,clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/Synthetic',taskDefinitionArn:'arn:aws:ecs:us-east-1:967807252336:task-definition/Synthetic:1',containerName:'worker',grantFactsJsons:facts.map(f=>JSON.stringify(f))}};
 const tuple={tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId};
 const qualified={run_id:q.runId,attempt:q.attempt,worker_arn:q.workerArn,fence:q.fence,policy_revision:q.policyRevision};
 const state={now:at,calls:[],releases:[],effects:0,commits:0,
  conversation:{...tuple,owner_actor_id:binding.actorId,projection,projection_sha256:hash(projection)},
  runs:[{...tuple,projection:run,projection_sha256:hash(run),request,request_id:request.requestId,request_sha256:hash(request),last_sequence:'3',sequence_base:'0',sequence_end:null}],
  allocation:{...tuple,intent_key:hash(binding),record,record_sha256:hash(record)},qualified,
  grants:grants.map(g=>({...qualified,grant_id:g.grantId,state:'ACTIVE',capability_sha256:g.capabilitySha256,expires_at:new Date(g.expiresAtMs)})),
  bound:facts.map(f=>({grant_id:f.grantId,run_id:binding.runId,facts:f}))};
 for(const key of ['conversation','runs','allocation','qualified','grants','bound'])state[key]=structuredClone(state[key]);
 const pool={async connect(){return {async query(sql,args=[]){state.calls.push({sql,args});const override=await state.onQuery?.(sql,args);if(override!==undefined)return override;
  if(sql.startsWith('BEGIN')||sql.startsWith('SET ')||sql.startsWith('SELECT pg_advisory'))return {rows:[]};
  if(sql==='COMMIT'){state.commits++;if(state.commitUnknown)throw Error('lost commit acknowledgement');return {rows:[]};}
  if(sql==='ROLLBACK')return {rows:[]};
  if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date(state.now)}]};
  if(sql.startsWith('SELECT * FROM meri_conversations.conversations'))return {rows:structuredClone([state.conversation])};
  if(sql.startsWith('SELECT * FROM meri_conversations.runs'))return {rows:structuredClone(state.runs)};
  if(sql.startsWith('SELECT * FROM meri_conversations.native_allocations'))return {rows:structuredClone([state.allocation])};
  if(sql.startsWith('SELECT * FROM meri_product_budget.runs'))return {rows:structuredClone([state.qualified])};
  if(sql.startsWith('SELECT * FROM meri_product_budget.grants'))return {rows:structuredClone(state.grants.filter(g=>g.grant_id===args[0]))};
  if(sql.startsWith('SELECT * FROM meri_product_budget.tool_grant_bindings'))return {rows:structuredClone(state.bound.filter(g=>g.grant_id===args[0]))};
  if(sql==='SELECT synthetic_session_effect'){state.effects++;return {rows:[{saved:true}]};}
  throw Error('unexpected query');},release(error){state.releases.push(error??null);if(state.releaseUnknown)throw Error('release unknown');}};}};
 return {state,pool,binding:structuredClone(binding),grantId,modelGrantId,expiresAtMs:expiry,now:()=>state.now,configuration:{pool,binding,grantId,expiresAtMs:expiry,now:()=>state.now}};
}
