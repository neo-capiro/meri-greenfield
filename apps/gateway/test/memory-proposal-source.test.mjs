import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createSourceDisabledGateway} from '../index.mjs';
import {createToolDispatch} from '../dispatch/tool-dispatch.mjs';
import {createMemoryProposalHttpAdapter} from '../sources/memory-proposals/http-adapter.mjs';
import {createMemoryProposalReadHandler} from '../sources/memory-proposals/handler.mjs';
import {fixture,NOW,uuid,limits} from './fixtures.mjs';
const operation={id:'memory.list_own_proposals',version:'0.2.0'};
const request=argumentsData=>JSON.stringify({operation,arguments:argumentsData});
const at=n=>`2026-10-0${n}T00:00:00.000Z`;
function setup() {
  const f=fixture(), records=new Map(), wire=[];
  Object.assign(f.binding,{tenantId:uuid('a'),actorId:uuid('b')});
  Object.assign(f.subject,{tenantId:f.binding.tenantId,actorId:f.binding.actorId,entityIds:[f.binding.actorId]});
  Object.assign(f.claims.scopes[0],{tenantId:f.binding.tenantId,kind:'private-user',resourceId:f.binding.actorId});
  f.state.grants=['tool.read'];f.entry.contract=resolveOperationContract(operation);f.entry.descriptor=f.entry.contract.descriptor;
  const business=f.ports.authorizeBusiness;
  f.ports.authorizeBusiness=async(...args)=>{const p=JSON.parse(await business(...args));p.decision.operation=`${operation.id}@${operation.version}`;return JSON.stringify(p);};
  f.ports.authorizeSources=async()=>JSON.stringify({sourceIds:['memory_proposals'],enabled:f.state.sourceEnabled,policyRevision:f.claims.policyRevision,checkedAtMs:f.state.now});
  const row={id:uuid('e'),status:'pending',approvedFact:false,scope:'personal',clientId:null,sourceKind:'explicit_user',createdAt:at(2),restricted:false,title:'Synthetic proposal',proposedText:'Unapproved test text',contentTruncated:false};
  const page={tool:'list_memory_proposals',enabled:true,authority:'own_pending_proposals',claimsAreApprovedFacts:false,
    scope:{tenantId:f.binding.tenantId,userId:f.binding.actorId,clientId:null},candidates:[row],nextCursor:null,coverage:{firstPage:true,complete:true,reason:'own_pending_proposals_complete'}};
  const credentials=()=>({binding:structuredClone(f.binding),bearerToken:'SYNTHETIC_USER_TOKEN',serviceSecret:'SYNTHETIC_SERVICE_SECRET',expiresAtMs:NOW+10000});
  const config={origin:'https://source.example.invalid',now:()=>f.state.now,maxRequestMs:1000,maxResponseBytes:65536,
    getCredentials:async()=>{f.calls.push('credentials');return credentials();},
    fetchImpl:async(url,options)=>{f.calls.push('http');wire.push({url,options});return new Response(JSON.stringify(page),{headers:{'content-type':'application/json'}});}};
  const memoryContextPorts={async loadPrevious({key}){f.calls.push('load');return JSON.stringify({record:records.get(canonicalSha256(key))??null,checkedAtMs:f.state.now});},
    async retain({record}){f.calls.push('retain');records.set(canonicalSha256(record.key),structuredClone(record));return JSON.stringify({decision:'retained',keySha256:canonicalSha256(record.key),previousSha256:record.previousSha256,checkedAtMs:f.state.now});}};
  const create=(changes={})=>{const adapter=createMemoryProposalHttpAdapter({...config,...changes});f.entry.execute=createMemoryProposalReadHandler({adapter,now:()=>f.state.now});return createToolDispatch({catalog:{entry:()=>f.entry,discoverable:()=>[]},authority:f.authority,budget:f.budget,limits,now:()=>f.state.now,newId:()=>uuid('7'),sourceEnabled:true,memoryContextPorts});};
  const partial=()=>{page.coverage.complete=false;page.coverage.reason='unread_pages_restricted_or_truncated_content';};
  return {...f,records,wire,row,page,credentials,config,create,partial};
}

test('actual dispatcher/authority/handler/HTTP adapter completes fixed-route synthetic loopback exchange',async()=>{
  const f=setup(),seen=[];const server=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;seen.push({method:req.method,url:req.url,headers:req.headers,body:JSON.parse(body)});res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(f.page));});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const result=JSON.parse(await f.create({fetchImpl:(url,options)=>{assert.equal(url,'https://source.example.invalid/api/clio/tools/list_memory_proposals');return fetch(`http://127.0.0.1:${server.address().port}/api/clio/tools/list_memory_proposals`,options);}}).execute(request({}), 'synthetic'));
    assert.deepEqual(result.result,f.page);assert.equal(seen.length,1);assert.equal(seen[0].method,'POST');assert.deepEqual(seen[0].body,{clientId:null,cursor:null,limit:5});
    assert.equal(seen[0].headers.authorization,'Bearer SYNTHETIC_USER_TOKEN');assert.equal(seen[0].headers['x-internal-service-secret'],'SYNTHETIC_SERVICE_SECRET');assert.equal(seen[0].headers['x-tenant-id'],undefined);
    assert.ok(f.calls.indexOf('reserve')<f.calls.indexOf('credentials'));assert.ok(f.calls.includes('settle'));assert.equal(result.argumentsSha256,canonicalSha256(seen[0].body));
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));assert.equal(server.listening,false);}
});

test('unselected subject preserves own firm/client proposals, not personal-only queue',async()=>{const f=setup();Object.assign(f.row,{scope:'client',clientId:uuid('c')});const result=JSON.parse(await f.create().execute(request({}),'synthetic'));assert.equal(result.result.candidates[0].scope,'client');});
test('selected client preserves clientless proposals and selector binding',async()=>{const f=setup(),client=uuid('c');Object.assign(f.subject,{kind:'client',entityType:'client',entityIds:[client]});Object.assign(f.claims.scopes[0],{kind:'client',resourceId:client});f.page.scope.clientId=client;f.row.scope='firm';const result=JSON.parse(await f.create().execute(request({}),'synthetic'));assert.equal(f.wire[0].options.body,JSON.stringify({clientId:client,cursor:null,limit:5}));assert.equal(result.result.candidates[0].clientId,null);await assert.rejects(f.create().execute(request({clientId:uuid('d')}),'synthetic'));});
test('disabled response remains unavailable coverage with no fabricated records',async()=>{const f=setup();Object.assign(f.page,{enabled:false,candidates:[]});f.page.coverage={firstPage:true,complete:false,reason:'review_disabled'};const result=JSON.parse(await f.create().execute(request({}),'synthetic'));assert.deepEqual(result.result.coverage,f.page.coverage);});
test('restricted, truncated and null content remain incomplete unapproved observations',async()=>{for(const variant of ['restricted','truncated','null']){const f=setup();f.partial();if(variant==='restricted')Object.assign(f.row,{restricted:true,title:null,proposedText:null});if(variant==='truncated')Object.assign(f.row,{proposedText:'x'.repeat(2000),contentTruncated:true});if(variant==='null')f.row.proposedText=null;const result=JSON.parse(await f.create().execute(request({}),'synthetic'));assert.equal(result.result.coverage.complete,false);assert.equal(result.result.claimsAreApprovedFacts,false);}});
test('first and advancing continuation uses existing retained context and sends opaque cursor unchanged',async()=>{const f=setup();f.partial();f.page.nextCursor='SOURCE_OPAQUE_CURSOR';const gateway=f.create();await gateway.execute(request({limit:1}),'synthetic');f.page.nextCursor=null;f.page.coverage.firstPage=false;f.row.createdAt=at(1);await gateway.execute(request({limit:1,cursor:'SOURCE_OPAQUE_CURSOR'}),'synthetic');assert.equal(f.records.size,1);assert.equal(f.calls.filter(x=>x==='load').length,1);assert.equal(JSON.parse(f.wire[1].options.body).cursor,'SOURCE_OPAQUE_CURSOR');assert.equal(f.page.coverage.complete,false);});
test('unknown or replayed foreign cursor cannot reach source transport',async()=>{const f=setup();await assert.rejects(f.create().execute(request({cursor:'unknown'}),'synthetic'));assert.equal(f.calls.includes('credentials'),false);});
test('model URL/header/actor/source flags rejected before credential owner',async()=>{for(const args of [{url:'https://evil.invalid'},{headers:{}},{actorId:uuid('c')},{enabled:true}]){const f=setup();await assert.rejects(f.create().execute(request(args),'synthetic'));assert.deepEqual(f.calls,[]);}});
test('revoked authority, wrong fence, disabled source and denied budget cannot reach credentials',async()=>{for(const kind of ['revoked','fence','source','budget']){const f=setup();if(kind==='revoked')f.state.revoked=true;if(kind==='fence')f.state.fence=2;if(kind==='source')f.state.sourceEnabled=false;if(kind==='budget')f.budget.reserve=async()=>{throw Error('synthetic denial');};await assert.rejects(f.create().execute(request({}),'synthetic'));assert.equal(f.calls.includes('credentials'),false);}});
test('revocation after HTTP response cannot retain, settle or release',async()=>{const f=setup();const fetchImpl=async()=>{f.state.revoked=true;return new Response(JSON.stringify(f.page),{headers:{'content-type':'application/json'}});};await assert.rejects(f.create({fetchImpl}).execute(request({}),'synthetic'),/ACCESS_DENIED/);assert.equal(f.calls.includes('settle'),false);assert.equal(f.calls.includes('uncertain'),true);});
test('credential receipt bound to exact actor/run/task/fence and current expiry',async()=>{for(const key of ['actorId','runId','attemptId','workerId','writerFence','expiry']){const f=setup();const getCredentials=async()=>{const c=f.credentials();if(key==='expiry')c.expiresAtMs=NOW;else c.binding[key]=key==='writerFence'?2:uuid('f');return c;};await assert.rejects(f.create({getCredentials}).execute(request({}),'synthetic'));assert.equal(f.calls.includes('http'),false);}});
test('credential accessors and proxies cannot execute effects',async()=>{for(const mode of ['getter','proxy']){const f=setup();let touched=0;const getCredentials=async()=>{const c=f.credentials();if(mode==='getter')Object.defineProperty(c,'bearerToken',{enumerable:true,get(){touched++;return 'x';}});else return new Proxy(c,{get(t,key){if(key==='then')return undefined;touched++;return Reflect.get(t,key);}});return c;};await assert.rejects(f.create({getCredentials}).execute(request({}),'synthetic'));assert.equal(touched,0);assert.equal(f.calls.includes('http'),false);}});
test('credential tokens never come from gateway credential and transport is fixed closed POST',async()=>{const f=setup();await f.create().execute(request({}),'DO_NOT_FORWARD_WORKER_CAPABILITY');const call=f.wire[0];assert.equal(call.options.redirect,'error');assert.equal(call.options.credentials,'omit');assert.equal(call.options.cache,'no-store');assert.ok(!JSON.stringify(call).includes('DO_NOT_FORWARD'));assert.equal(call.url,'https://source.example.invalid/api/clio/tools/list_memory_proposals');});
test('origin refuses nonHTTPS paths queries credentials and operation substitution before I/O',()=>{const f=setup();for(const origin of ['http://source.invalid','https://source.invalid/base','https://x:y@source.invalid','https://source.invalid?x=1','https://source.invalid#x'])assert.throws(()=>createMemoryProposalHttpAdapter({...f.config,origin}));assert.equal(f.calls.length,0);});
test('HTTP error/redirect/encoding/media responses refuse without returning body diagnostics',async()=>{for(const [status,headers] of [[403,{'content-type':'application/json'}],[302,{location:'https://evil.invalid'}],[200,{'content-type':'text/html'}],[200,{'content-type':'application/json','content-encoding':'gzip'}]]){const f=setup();await assert.rejects(f.create({fetchImpl:async()=>new Response('PRIVATE SOURCE ERROR',{status,headers})}).execute(request({}),'synthetic'),error=>!error.message.includes('PRIVATE'));assert.equal(f.calls.includes('settle'),false);}});
test('byte caps reject dishonest Content-Length, streaming overflow and malformed UTF8/JSON',async()=>{for(const kind of ['length','overflow','utf8','json']){const f=setup();const fetchImpl=async()=>new Response(kind==='utf8'?new Uint8Array([0xc3,0x28]):kind==='json'?'{':JSON.stringify(f.page),{headers:{'content-type':'application/json',...(kind==='length'?{'content-length':'1'}:{})}});await assert.rejects(f.create({fetchImpl,maxResponseBytes:kind==='overflow'?50:65536}).execute(request({}),'synthetic'));assert.equal(f.calls.includes('settle'),false);}});
test('source wrong scope/restricted disclosure/false completeness/current-fact upgrade rejected by canonical family',async()=>{for(const mutate of [p=>p.scope.userId=uuid('c'),p=>p.candidates[0].restricted=true,p=>p.coverage.complete=false,p=>p.claimsAreApprovedFacts=true]){const f=setup();mutate(f.page);await assert.rejects(f.create().execute(request({}),'synthetic'));assert.equal(f.calls.includes('settle'),false);}});
for(const stage of ['credentials','fetch','body'])test(`parked ${stage} is bounded and late completion starts no subsequent work`,async()=>{
  const f=setup(),parked=Promise.withResolvers();let lateBodyCancelled=false;const changes={maxRequestMs:20};
  if(stage==='credentials')changes.getCredentials=()=>parked.promise;
  if(stage==='fetch')changes.fetchImpl=()=>parked.promise;
  if(stage==='body')changes.fetchImpl=async()=>new Response(new ReadableStream({pull(){return parked.promise;},cancel(){lateBodyCancelled=true;}}),{headers:{'content-type':'application/json'}});
  await assert.rejects(f.create(changes).execute(request({}),'synthetic'),/DEADLINE/);const after=[...f.calls];
  const response=new Response(new ReadableStream({cancel(){lateBodyCancelled=true;}}),{headers:{'content-type':'application/json'}});
  parked.resolve(stage==='credentials'?f.credentials():stage==='fetch'?response:undefined);await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.calls,after);assert.equal(f.calls.includes('settle'),false);if(stage!=='credentials')assert.equal(lateBodyCancelled,true);
});
test('canonical production gateway stays unavailable and never requests source credentials',async()=>{const f=setup();const gateway=createSourceDisabledGateway({authorityPorts:f.ports,budget:f.budget,limits,now:()=>f.state.now,newId:()=>uuid('7')});await assert.rejects(gateway.execute(request({}),'synthetic'),/UNAVAILABLE/);assert.equal(gateway.sourceEnabled,false);assert.deepEqual(f.calls,[]);});
