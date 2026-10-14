/** Explicit synthetic SQL/native authority resources; actual canonical owners execute. */
import {productFixture,NOW} from '../../../gateway/budget/product-scripted-fixture.mjs';
import {createPostgresToolBudget} from '../../../gateway/budget/postgres-tool-budget.mjs';
import {fixture as sessionFixture} from './fixture.mjs';
import {createServer} from 'node:http';
export {NOW};
export async function resources(){
 const f=productFixture(),journal=sessionFixture(),reads=[];
 const writer=createPostgresToolBudget({pool:f.pool,allocationJson:JSON.stringify(f.allocation),namespace:'product',now:f.now});await writer.bindTrustedGrant(f.json());f.commands.length=0;
 const pool={async connect(){const original=await f.pool.connect();let snapshot;
  return {async query(sql,args){
   reads.push(sql);
   if(sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'){snapshot=structuredClone(f.state());return {rows:[]};}
   if(snapshot){
    if(sql==='COMMIT'||sql==='ROLLBACK'||sql.startsWith('SET LOCAL'))return {rows:[]};
    if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date(f.now())}]};
    if(sql.includes('FOR UPDATE')||!sql.startsWith('SELECT'))throw Error('READ_ONLY_SNAPSHOT_EFFECT_REFUSED');
    if(sql.startsWith('SELECT * FROM meri_product_budget.budget'))return {rows:[snapshot.budget]};
    if(sql.startsWith('SELECT * FROM meri_product_budget.runs'))return {rows:[snapshot.run]};
    if(sql.startsWith('SELECT * FROM meri_product_budget.grants'))return {rows:snapshot.grant.grant_id===args[0]?[snapshot.grant]:[]};
    if(sql.startsWith('SELECT * FROM meri_product_budget.tool_run_allocations'))return {rows:snapshot.allocation?[snapshot.allocation]:[]};
    if(sql.startsWith('SELECT * FROM meri_product_budget.tool_grant_bindings'))return {rows:snapshot.bindings.has(args[0])?[snapshot.bindings.get(args[0])]:[]};
    throw Error('UNEXPECTED_READ_ONLY_SQL');
   }
   if(sql.includes('meri_conversations.sdk_'))return journal.admission.withCurrentAllocation({binding:journal.binding},({client})=>client.query(sql,args));
   return original.query(sql,args);
  },release:error=>original.release(error)};
 }};
 const binding=f.invocation.binding,clientId='11111111-1111-4111-8111-000000000006',principal={tenantId:binding.tenantId,actorId:binding.actorId};let hook=()=>{},authorityCalls=0;
 const identity={origin:'https://authority.synthetic.invalid',commandContext:{binding,clientResolution:{reference:clientId,clientId}},credential:'synthetic-existing-identity',async fetchImpl(url,options){authorityCalls++;await hook(url,options);const input=JSON.parse(options.body),base={principal,identityRevision:'synthetic-identity',checkedAtMs:f.now(),expiresAtMs:NOW+9000};return Response.json(url.endsWith('/identity')?base:{...base,identitySha256:input.identitySha256,conversationId:binding.conversationId,selectedClientId:clientId,contextRevision:'synthetic-context'});}};
 return {f,pool,binding,clientId,identity,reads,journal,authorityCalls:()=>authorityCalls,setHook(value){hook=value;}};
}
export async function listenFetch(application){
 const server=createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const request=new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});const response=await application.handle(request);res.writeHead(response?.status??404,Object.fromEntries(response?.headers??[]));res.end(response?Buffer.from(await response.arrayBuffer()):'');}catch{res.writeHead(500);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return {origin:'http://127.0.0.1:'+server.address().port,async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
