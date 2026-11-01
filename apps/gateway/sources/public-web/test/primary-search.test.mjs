/** Real JSON wire crossing with synthetic MCP responses; no AWS call, credential or network egress. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createPublicWebHandlers} from '../handler.mjs';
import {createPrimaryWebSearch,createPrimarySearchReadSource,primarySearchTarget,readMcpPayload,projectRow,
 AGENTCORE_SEARCH_PROVIDER} from '../primary-search.mjs';
import {signAwsRequest,resolveAwsCredentials,amzDate} from '../aws-signing.mjs';
import * as payloads from './mcp-payloads.mjs';
import {storedCase} from './fixture.mjs';

// The documented gatewayUrl is the MCP invocation endpoint; the producer binds it unchanged.
const ENDPOINT='https://meri-abc123.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp';
const ORIGIN='https://meri-abc123.gateway.bedrock-agentcore.us-east-1.amazonaws.com';
const CREDENTIALS=Object.freeze({accessKeyId:'AKIAIOSFODNN7EXAMPLE',secretAccessKey:'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',sessionToken:'session-token'});
const NOW=1_761_700_000_000;
const TOOL='WebSearch-tool-abc123';
const base=extra=>({endpoint:ENDPOINT,region:'us-east-1',toolName:TOOL,now:()=>NOW,credentials:async()=>CREDENTIALS,...extra});
const mcp = results => ({jsonrpc:'2.0',id:'invoke-tool-request',result:{isError:false,content:[{type:'text',text:JSON.stringify({id:'824f89d0',results})}]}});
function responder(s,status=200){
 return async (url,options)=>{
  s.requests.push({url,options,body:JSON.parse(options.body)});
  const used=s.nextStatus===undefined?status:s.nextStatus.shift();
  s.statuses.push(used);
  return new Response(JSON.stringify(s.payload??mcp(s.rows)),{status:used,headers:{'content-type':'application/json'}});
 };
}
const state=(rows=[])=>({rows,requests:[],statuses:[]});
/** A response whose body records cancellation, for cleanup assertions. */
function trackedResponse(status,body='{}'){
 let cancelled=0;
 const stream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(body));controller.close();},
  cancel(){cancelled+=1;}});
 const response=new Response(stream,{status,headers:{'content-type':'application/json'}});
 return {response,cancelled:()=>cancelled};
}

test('documented MCP response projects into the discovery contract rows',()=>{
 const payload=readMcpPayload('application/json',JSON.stringify(mcp([{text:'Python 3.13 shipped.',publishedDate:'2024-10-07',url:'https://example.com/python/3.13',title:'Python 3.13'}])));
 assert.equal(payload.result.content[0].type,'text');
 assert.deepEqual({...projectRow({text:'Python 3.13 shipped.',publishedDate:'2024-10-07',url:'https://example.com/python/3.13',title:'Python 3.13'})},
  {title:'Python 3.13',url:'https://example.com/python/3.13',snippet:'Python 3.13 shipped.',source:AGENTCORE_SEARCH_PROVIDER,publishedAt:'2024-10-07'});
});

test('an absent title, snippet or date stays null; the locator is never substituted for them',()=>{
 assert.deepEqual({...projectRow({url:'https://public.example.invalid/a'})},
  {title:null,url:'https://public.example.invalid/a',snippet:null,source:AGENTCORE_SEARCH_PROVIDER,publishedAt:null});
});

test('an accepted locator is published byte-for-byte and an unusable one drops the row',()=>{
 const exact='https://public.example.invalid/a%20b?x=1&y=%2F#frag';
 assert.equal(projectRow({url:exact,text:'s'}).url,exact);
 assert.equal(projectRow({url:`https://public.example.invalid/${'a'.repeat(2000)}`,text:'s'}),undefined,'over-cap locators are refused, not truncated');
 for(const url of ['javascript:alert(1)','ftp://public.example.invalid/a','https://','http:/public.example.invalid/a',
  ' https://public.example.invalid/a','https://user:pw@public.example.invalid/a','not a url','']){
  assert.equal(projectRow({url,text:'s'}),undefined,`${url} must be refused`);
 }
 assert.equal(projectRow({text:'no url'}),undefined);
});

test('the request carries the complete stateless 2026-07-28 metadata and a SigV4 IAM header',async()=>{
 const s=state([{text:'Current release notes',url:'https://public.example.invalid/a',title:'Release'}]);
 const value=await createPrimaryWebSearch(base({fetchImpl:responder(s)})).search({query:'  latest   python release ',limit:20,deadlineMs:NOW+5000});
 assert.equal(s.requests.length,1);
 const request=s.requests[0];
 assert.equal(request.url,ENDPOINT,'the invocation endpoint is used as given, never re-suffixed');
 assert.equal(request.body.method,'tools/call');
 assert.equal(request.body.params.name,TOOL);
 assert.deepEqual(request.body.params.arguments,{query:'latest python release',maxResults:20});
 // 2026-07-28: version in header AND _meta (they must match), plus request-metadata headers.
 assert.equal(request.options.headers['mcp-protocol-version'],'2026-07-28');
 assert.equal(request.options.headers['mcp-method'],'tools/call');
 assert.equal(request.options.headers['mcp-name'],TOOL);
 assert.deepEqual(request.body.params._meta,{'io.modelcontextprotocol/protocolVersion':'2026-07-28',
  'io.modelcontextprotocol/clientInfo':{name:'meri-control',version:'1.0.0'},'io.modelcontextprotocol/clientCapabilities':{}});
 assert.match(request.options.headers.authorization,/^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/\d{8}\/us-east-1\/bedrock-agentcore\/aws4_request, SignedHeaders=content-type;host;x-amz-date;x-amz-security-token, Signature=[a-f0-9]{64}$/u);
 assert.deepEqual(value,{tool:'search_public_web',contentStatus:'discovered',generatedAt:new Date(NOW).toISOString(),provider:AGENTCORE_SEARCH_PROVIDER,total:1,
  results:[{title:'Release',url:'https://public.example.invalid/a',snippet:'Current release notes',source:AGENTCORE_SEARCH_PROVIDER,publishedAt:null}]});
});

test('an over-long query is refused as INVALID_ARGUMENTS instead of being silently truncated',async()=>{
 const s=state([{text:'s',url:'https://public.example.invalid/0',title:'t'}]);
 await assert.rejects(createPrimaryWebSearch(base({fetchImpl:responder(s)})).search({query:'q'.repeat(201),limit:5,deadlineMs:NOW+5000}),{message:'INVALID_ARGUMENTS'});
 assert.equal(s.requests.length,0,'no paid call for a query the index would truncate');
 const exact=await createPrimaryWebSearch(base({fetchImpl:responder(s)})).search({query:' '+'q'.repeat(200)+' ',limit:5,deadlineMs:NOW+5000});
 assert.equal(s.requests[0].body.params.arguments.query.length,200,'whitespace is normalized before the bound applies');
 assert.equal(exact.total,1);
});

test('results are bounded to the receiving cap and the request to the documented maximum',async()=>{
 const s=state(Array.from({length:14},(_,i)=>({text:`snippet ${i}`,url:`https://public.example.invalid/${i}`,title:`row ${i}`})));
 const value=await createPrimaryWebSearch(base({fetchImpl:responder(s)})).search({query:'q',limit:40,deadlineMs:NOW+5000});
 assert.equal(s.requests[0].body.params.arguments.maxResults,25);
 assert.equal(value.results.length,12);
});

test('empty results stay an honest empty discovery',async()=>{
 assert.deepEqual(await createPrimaryWebSearch(base({fetchImpl:responder(state([]))})).search({query:'nothing',limit:5,deadlineMs:NOW+5000}),
  {tool:'search_public_web',contentStatus:'discovered',generatedAt:new Date(NOW).toISOString(),provider:AGENTCORE_SEARCH_PROVIDER,total:0,results:[]});
});

test('one submitted attempt by default; a retry is explicit and still bounded',async()=>{
 const limited=state([{text:'s',url:'https://public.example.invalid/a',title:'t'}]);limited.nextStatus=[429,200];
 await assert.rejects(createPrimaryWebSearch(base({fetchImpl:responder(limited)})).search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'UNAVAILABLE'});
 assert.deepEqual(limited.statuses,[429],'the default submits exactly one billable call');
 const twice=state([{text:'s',url:'https://public.example.invalid/a',title:'t'}]);twice.nextStatus=[429,200];
 assert.equal((await createPrimaryWebSearch(base({fetchImpl:responder(twice),maxAttempts:2})).search({query:'q',limit:5,deadlineMs:NOW+5000})).total,1);
 assert.deepEqual(twice.statuses,[429,200]);
 const denied=state([]);denied.nextStatus=[403];
 await assert.rejects(createPrimaryWebSearch(base({fetchImpl:responder(denied),maxAttempts:2})).search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'ACCESS_DENIED'});
 assert.equal(denied.statuses.length,1,'denial is never retried');
});

test('an MCP execution result with isError true is never reported as discovery',async()=>{
 const s=state();
 s.payload={jsonrpc:'2.0',id:'1',result:{isError:true,content:[{type:'text',text:JSON.stringify({results:[{url:'https://public.example.invalid/a',title:'t',text:'s'}]})}]}};
 const primary=createPrimaryWebSearch(base({fetchImpl:responder(s)}));
 await assert.rejects(primary.search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'UNAVAILABLE'});
 s.payload={jsonrpc:'2.0',id:'1',result:{isError:true,content:[{type:'text',text:JSON.stringify({results:[]})}]}};
 await assert.rejects(primary.search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'UNAVAILABLE'});
});

test('malformed or tool-error payloads never claim success',async()=>{
 await assert.rejects(createPrimaryWebSearch(base({fetchImpl:async()=>new Response('not-json',{status:200,headers:{'content-type':'application/json'}})}))
  .search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'INVALID_RESULT'});
 await assert.rejects(createPrimaryWebSearch(base({fetchImpl:async()=>Response.json({jsonrpc:'2.0',id:'1',error:{code:-32000,message:'throttled'}})}))
  .search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'UNAVAILABLE'});
});

test('a stalled default credential chain is cancelled and never reaches paid dispatch',async()=>{
 let fetched=0;
 const primary=createPrimaryWebSearch({endpoint:ENDPOINT,region:'us-east-1',toolName:TOOL,
  fetchImpl:(url,options)=>{fetched+=1;
   // The default chain must receive the caller's abort signal; this fake never resolves it.
   assert(options.signal instanceof AbortSignal,'the credential fetch receives a cancellation signal');
   return new Promise(()=>{});}});
 process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI='/v2/creds';
 try{await assert.rejects(primary.search({query:'q',limit:5,deadlineMs:Date.now()+120}),{message:'DEADLINE'});}
 finally{delete process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI;}
 assert.equal(fetched,1,'only the credential request was made; no paid search was dispatched');
});

test('the actual default credential chain is exercised end to end with fake env and fetch',async()=>{
 const calls=[];
 const primary=createPrimaryWebSearch({endpoint:ENDPOINT,region:'us-east-1',toolName:TOOL,now:()=>NOW,
  fetchImpl:async (url,options)=>{
   calls.push({url,options});
   if(url.startsWith('http://169.254.170.2')) {
    assert(options.signal instanceof AbortSignal,'credential document fetch is cancellable');
    return new Response(JSON.stringify({AccessKeyId:'AKIDEFAULTPATH',SecretAccessKey:'secret',Token:'token'}),
     {status:200,headers:{'content-type':'application/json'}});
   }
   assert.equal(url,ENDPOINT);
   assert.match(options.headers.authorization,/Credential=AKIDEFAULTPATH\//u);
   return Response.json(mcp([{text:'s',url:'https://public.example.invalid/a',title:'t'}]));
  }});
 process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI='/v2/creds';
 try{assert.equal((await primary.search({query:'q',limit:3,deadlineMs:NOW+5000})).total,1);}
 finally{delete process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI;}
 assert.equal(calls.length,2,'one credential read and one paid tools/call');
});

test('every acquired response is released, including refusals and retried attempts',async()=>{
 const first=trackedResponse(403),second=trackedResponse(500),third=trackedResponse(200,JSON.stringify(mcp([{text:'s',url:'https://public.example.invalid/a',title:'t'}])));
 let index=0;const queue=[first,second,third];
 const primary=createPrimaryWebSearch(base({maxAttempts:2,fetchImpl:async()=>queue[index++].response}));
 await assert.rejects(primary.search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'ACCESS_DENIED'});
 assert.equal(first.cancelled(),1,'a refused response body is cancelled');
 assert.equal(second.cancelled(),0,'no second attempt after a denial');
 const retryFirst=trackedResponse(503),retrySecond=trackedResponse(200,JSON.stringify(mcp([{text:'s',url:'https://public.example.invalid/a',title:'t'}])));
 let k=0;const retryQueue=[retryFirst,retrySecond];
 assert.equal((await createPrimaryWebSearch(base({maxAttempts:2,fetchImpl:async()=>retryQueue[k++].response})).search({query:'q',limit:5,deadlineMs:NOW+5000})).total,1);
 assert.equal(retryFirst.cancelled(),1,'the retried attempt releases its response');
});

test('a credential refusal releases the acquired document body',async()=>{
 const refused=trackedResponse(500);
 await assert.rejects(resolveAwsCredentials({env:{AWS_CONTAINER_CREDENTIALS_RELATIVE_URI:'/v2/creds'},
  fetchImpl:async()=>refused.response}),{message:'CREDENTIALS_UNAVAILABLE'});
 assert.equal(refused.cancelled(),1);
 const oversized={body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{}'));c.close();}}),
  getReader(){throw Error('must not be read');}};
 await assert.rejects(resolveAwsCredentials({env:{AWS_CONTAINER_CREDENTIALS_RELATIVE_URI:'/v2/creds'},maxResponseBytes:256,
  fetchImpl:async()=>new Response('x'.repeat(4096),{status:200})}),{message:'CREDENTIALS_UNAVAILABLE'});
});

test('a late credential does not dispatch a paid search after the cutoff',async()=>{
 let clock=NOW,dispatched=0;
 const primary=createPrimaryWebSearch(base({now:()=>clock,fetchImpl:async()=>{dispatched+=1;return Response.json(mcp([]));},
  credentials:async()=>{clock=NOW+9000;return CREDENTIALS;}}));
 await assert.rejects(primary.search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'DEADLINE'});
 assert.equal(dispatched,0,'no billable call after the deadline');
});

test('an already expired deadline and caller cancellation are refused before any work',async()=>{
 let dispatched=0;
 const primary=createPrimaryWebSearch(base({fetchImpl:async()=>{dispatched+=1;return Response.json(mcp([]));}}));
 await assert.rejects(primary.search({query:'q',limit:5,deadlineMs:NOW}),{message:'DEADLINE'});
 const controller=new AbortController();controller.abort();
 await assert.rejects(primary.search({query:'q',limit:5,deadlineMs:NOW+5000,signal:controller.signal}),{message:'DEADLINE'});
 assert.equal(dispatched,0);
});

test('an oversized or mis-encoded response body is bounded',async()=>{
 await assert.rejects(createPrimaryWebSearch(base({maxResponseBytes:4096,fetchImpl:async()=>new Response('x'.repeat(8192),{status:200,headers:{'content-type':'application/json'}})}))
  .search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'RESOURCE_LIMIT'});
 await assert.rejects(createPrimaryWebSearch(base({maxResponseBytes:4096,fetchImpl:async()=>new Response('{}',{status:200,headers:{'content-type':'application/json','content-length':'9999'}})}))
  .search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'RESOURCE_LIMIT'});
 await assert.rejects(createPrimaryWebSearch(base({fetchImpl:async()=>new Response('{}',{status:200,headers:{'content-type':'application/json','content-encoding':'gzip'}})}))
  .search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'INVALID_RESULT'});
});

test('missing credentials are unavailable, not an unauthenticated call',async()=>{
 let calls=0;
 await assert.rejects(createPrimaryWebSearch(base({credentials:async()=>undefined,fetchImpl:async()=>{calls+=1;return Response.json(mcp([]));}}))
  .search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'UNAVAILABLE'});
 assert.equal(calls,0);
});

test('endpoint shape, region, tool name, protocol and attempt bounds are validated; admission states the real cost',()=>{
 for(const endpoint of [ORIGIN,`${ORIGIN}/`,`http://meri-abc123.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp`,
  `${ENDPOINT}?x=1`,`${ENDPOINT}/extra`,`https://user:pw@meri-abc123.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp`]){
  assert.throws(()=>createPrimaryWebSearch({endpoint,region:'us-east-1',toolName:TOOL}),{message:'GATEWAY_CONFIGURATION'},`${endpoint} must be refused`);
 }
 assert.throws(()=>createPrimaryWebSearch({endpoint:ENDPOINT,region:'not-a-region',toolName:TOOL}),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createPrimaryWebSearch({endpoint:ENDPOINT,region:'us-east-1'}),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createPrimaryWebSearch(base({toolName:'bad tool'})),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createPrimaryWebSearch(base({protocolVersion:'2025-11-25'})),{message:'GATEWAY_CONFIGURATION'},'only the complete stateless protocol is implemented');
 assert.throws(()=>createPrimaryWebSearch(base({maxAttempts:3})),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createPrimaryWebSearch({endpoint:ENDPOINT,region:'us-east-1',toolName:TOOL,extra:true}),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createPrimarySearchReadSource({}),{message:'GATEWAY_CONFIGURATION'});
 assert.deepEqual({...createPrimaryWebSearch(base({fetchImpl:async()=>Response.json(mcp([]))})).admission},
  {provider:'agentcore-web-search',unitMicroUsd:7005,maxAttempts:1,maxMicroUsd:7005,maxCallsPerInvocation:1,billing:'aws-agentcore-web-search-and-gateway-invocation'});
 assert.equal(createPrimaryWebSearch(base({maxAttempts:2})).admission.maxMicroUsd,14010);
 assert.deepEqual(primarySearchTarget({MERI_WEB_SEARCH_GATEWAY_ENDPOINT:ENDPOINT,MERI_WEB_SEARCH_TOOL:TOOL,AWS_REGION:'us-east-1'}),
  {endpoint:ENDPOINT,region:'us-east-1',toolName:TOOL});
 assert.equal(primarySearchTarget({MERI_WEB_SEARCH_GATEWAY_ENDPOINT:ENDPOINT}),undefined,'a half-configured target stays off');
 assert.equal(primarySearchTarget({MERI_WEB_SEARCH_GATEWAY_ENDPOINT:ORIGIN,MERI_WEB_SEARCH_TOOL:TOOL,AWS_REGION:'us-east-1'}),undefined,
  'an origin-only endpoint is not the documented invocation endpoint, so the family stays on the Core route');
 assert.equal(primarySearchTarget({}),undefined);
});

test('SigV4 signing matches an independent reference computation for the gateway POST',()=>{
 const body='{"jsonrpc":"2.0","id":"web-search-1761700000000","method":"tools/call","params":{"name":"WebSearch","arguments":{"query":"q","maxResults":2}}}';
 assert.equal(amzDate(NOW),'20251029T010640Z');
 const {headers}=signAwsRequest({method:'POST',url:ENDPOINT,body,region:'us-east-1',service:'bedrock-agentcore',credentials:CREDENTIALS,nowMs:NOW});
 assert.equal(headers.authorization,'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20251029/us-east-1/bedrock-agentcore/aws4_request, '+
  'SignedHeaders=content-type;host;x-amz-date;x-amz-security-token, Signature=669d7a34e886d9a5125f8977fcc3942c16c32a813b22d9d3c2fd747d70aca0db');
 assert.equal(headers['x-amz-security-token'],'session-token');
});

test('the credential chain prefers the role session and bounds the container document',async()=>{
 assert.deepEqual({...await resolveAwsCredentials({env:{AWS_ACCESS_KEY_ID:'A',AWS_SECRET_ACCESS_KEY:'B',AWS_SESSION_TOKEN:'C'},fetchImpl:async()=>{throw Error('no fetch');}})},
  {accessKeyId:'A',secretAccessKey:'B',sessionToken:'C'});
 const container=await resolveAwsCredentials({env:{AWS_CONTAINER_CREDENTIALS_RELATIVE_URI:'/v2/creds'},
  fetchImpl:async (url,options)=>{assert.equal(url,'http://169.254.170.2/v2/creds');assert.equal(options.signal,undefined);
   return Response.json({AccessKeyId:'X',SecretAccessKey:'Y',Token:'Z'});}});
 assert.deepEqual({...container},{accessKeyId:'X',secretAccessKey:'Y',sessionToken:'Z'});
 assert.equal(await resolveAwsCredentials({env:{},fetchImpl:async()=>{throw Error('no fetch');}}),undefined);
 await assert.rejects(resolveAwsCredentials({env:{AWS_CONTAINER_CREDENTIALS_RELATIVE_URI:'/v2/creds'},
  fetchImpl:async()=>Response.json({AccessKeyId:'X',SecretAccessKey:'Y'}),signal:AbortSignal.abort()}),{message:'CREDENTIALS_ABORTED'});
});

test('the search handler routes discovery to the primary port and keeps the page route native',async()=>{
 const calls=[];
 const primary={provider:AGENTCORE_SEARCH_PROVIDER,search:async({query,limit})=>{calls.push({query,limit});return {
  tool:'search_public_web',contentStatus:'discovered',generatedAt:'2026-10-29T00:00:00.000Z',provider:AGENTCORE_SEARCH_PROVIDER,total:0,results:[]};}};
 const source=createPrimarySearchReadSource(primary);
 assert.equal((await source({operation:'search_public_web',input:{query:'policy change',limit:6},deadlineMs:NOW+5000})).provider,AGENTCORE_SEARCH_PROVIDER);
 assert.deepEqual(calls,[{query:'policy change',limit:6}]);
 await assert.rejects(source({operation:'scrape_web_page',input:{url:'https://public.example.invalid/a'},deadlineMs:NOW+5000}),{message:'GATEWAY_CONFIGURATION'});
 const operations=[{id:'search_public_web',version:'0.2.0'},{id:'scrape_web_page',version:'0.2.0'}];
 assert.deepEqual(createPublicWebHandlers({origin:'https://core.example.invalid',now:()=>NOW},operations,primary).map(row=>row.operation.id),
  ['search_public_web','scrape_web_page']);
 assert.equal(createPublicWebHandlers({origin:'https://core.example.invalid',now:()=>NOW},operations).length,2);
});

test('the receiving contract admits the managed provider rows, including an absent title and date',()=>{
 const contract=resolveOperationContract({id:'search_public_web',version:'0.2.0'});
 const page={tool:'search_public_web',contentStatus:'discovered',generatedAt:'2026-10-29T00:00:00.000Z',provider:AGENTCORE_SEARCH_PROVIDER,total:2,
  results:[{title:'Dated',url:'https://public.example.invalid/a',snippet:'s',source:AGENTCORE_SEARCH_PROVIDER,publishedAt:'2026-10-28'},
   {title:null,url:'https://public.example.invalid/b',snippet:null,source:AGENTCORE_SEARCH_PROVIDER,publishedAt:null}]};
 assert.deepEqual(contract.assertOutput(page,{request:{query:'q',limit:5}}),page);
 // and the same contract refuses more rows than the (defaulted) request limit, which is why the read source
 // must ask the index for the contract's limit rather than the provider default
 assert.throws(()=>contract.assertOutput({...page,total:7,results:Array.from({length:7},(_,i)=>({...page.results[0],url:`https://public.example.invalid/${i}`}))},{request:{query:'q'}}));
});

test('the handler hands the index the contract-normalized input: an omitted limit asks for six rows, never the provider default',async()=>{
 const calls=[];
 const primary={provider:AGENTCORE_SEARCH_PROVIDER,search:async({query,limit})=>{calls.push({query,limit});return {
  tool:'search_public_web',contentStatus:'discovered',generatedAt:'2026-10-29T00:00:00.000Z',provider:AGENTCORE_SEARCH_PROVIDER,total:0,results:[]};}};
 const handler=createPublicWebHandlers({origin:'https://core.example.invalid',now:()=>NOW},[{id:'search_public_web',version:'0.2.0'}],primary)[0];
 for(const [request,expected] of [[{query:'  policy   change '},{query:'policy   change',limit:6}],[{query:'policy change',limit:null},{query:'policy change',limit:6}],
  [{query:'policy change',limit:'40'},{query:'policy change',limit:12}],[{query:'policy change',limit:0},{query:'policy change',limit:1}]]){
  const f=storedCase('search_public_web',{request});await handler.execute(f.call());assert.deepEqual(calls.at(-1),expected,JSON.stringify(request));
 }
 // the retained call context, not the read source, refuses a request whose normalization differs or carries authority
 const f=storedCase('search_public_web',{request:{query:'policy change'}});
 await assert.rejects(handler.execute({...f.call(),input:{query:'policy change',limit:10}}),{message:'INVALID_ARGUMENTS'});
 await assert.rejects(handler.execute({...f.call(),request:{query:'policy change',tenantId:'x'}}),{message:'INVALID_ARGUMENTS'});
 await assert.rejects(handler.execute({...f.call(),request:{query:''}}),{message:'INVALID_ARGUMENTS'});
 assert.equal(calls.length,4,'a refused request never reaches the index');
});

test('recorded success payloads: dated and undated rows project with title, URL, snippet and date',async()=>{
 for(const [label,body,contentType] of [['json',JSON.stringify(payloads.success()),'application/json'],['structured',JSON.stringify(payloads.structuredSuccess()),'application/json'],['stream',payloads.streamedSuccess(),'text/event-stream']]){
  const value=await createPrimaryWebSearch(base({fetchImpl:async()=>new Response(body,{status:200,headers:{'content-type':contentType}})})).search({query:'official articles',limit:6,deadlineMs:NOW+5000});
  assert.equal(value.total,3,label);
  assert.deepEqual(value.results.map(row=>[row.title,row.url,row.publishedAt]),[
   ['Agency publishes final rule on reporting thresholds','https://public.example.invalid/news/final-rule-2026','2026-10-28T14:00:00Z'],
   ['Proposed rule opens comment period','https://public.example.invalid/news/proposed-rule-2026','2026-10-01'],
   ['About the agency','https://public.example.invalid/about',null]],label);
  assert.equal(value.results[0].snippet,'The agency published its final rule on 28 October 2026, raising the reporting threshold.');
 }
});

test('recorded refusals: inbound IAM denial is ACCESS_DENIED without retry, tool and protocol errors are UNAVAILABLE',async()=>{
 for(const refusal of [payloads.denied,payloads.unauthenticated]){
  let calls=0;
  await assert.rejects(createPrimaryWebSearch(base({maxAttempts:2,fetchImpl:async()=>{calls+=1;return new Response(refusal.body,{status:refusal.status,headers:{'content-type':'application/json'}});}}))
   .search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'ACCESS_DENIED'});
  assert.equal(calls,1);
 }
 await assert.rejects(createPrimaryWebSearch(base({fetchImpl:async()=>Response.json(payloads.toolError)})).search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'UNAVAILABLE'});
 await assert.rejects(createPrimaryWebSearch(base({fetchImpl:async()=>Response.json(payloads.protocolError)})).search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'UNAVAILABLE'});
});

test('recorded malformed payloads are INVALID_RESULT, never an empty discovery',async()=>{
 for(const [label,body] of Object.entries(payloads.malformed)){
  await assert.rejects(createPrimaryWebSearch(base({fetchImpl:async()=>new Response(body,{status:200,headers:{'content-type':'application/json'}})}))
   .search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'INVALID_RESULT'},label);
 }
 const streamedNotificationOnly=['event: message',`data: ${JSON.stringify({jsonrpc:'2.0',method:'notifications/message',params:{}})}`,''].join('\n');
 await assert.rejects(createPrimaryWebSearch(base({fetchImpl:async()=>new Response(streamedNotificationOnly,{status:200,headers:{'content-type':'text/event-stream'}})}))
  .search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'INVALID_RESULT'});
});

test('a gateway that never answers is DEADLINE at the request window, and a caller abort is CANCELLED',async()=>{
 let clock=NOW;
 const stalled=createPrimaryWebSearch(base({now:()=>clock,maxRequestMs:1000,fetchImpl:(url,options)=>new Promise((resolve,reject)=>{
  options.signal.addEventListener('abort',()=>reject(options.signal.reason));setTimeout(()=>{clock=NOW+1500;},5);})}));
 await assert.rejects(stalled.search({query:'q',limit:5,deadlineMs:NOW+60000}),{message:'DEADLINE'});
 const controller=new AbortController();
 const aborted=createPrimaryWebSearch(base({fetchImpl:(url,options)=>new Promise((resolve,reject)=>{
  options.signal.addEventListener('abort',()=>reject(options.signal.reason));setTimeout(()=>controller.abort(),5);})}));
 await assert.rejects(aborted.search({query:'q',limit:5,deadlineMs:NOW+60000,signal:controller.signal}),{message:'CANCELLED'});
});

test('a row cut at a space or inside a surrogate pair is trimmed, so the receiving contract admits the discovery',async()=>{
 const contract=resolveOperationContract({id:'search_public_web',version:'0.2.0'});
 // Live rows on 1 November 2026: page-text excerpts are cut at 320 characters on nearly every row, and when the 320th
 // character was a space the trailing blank failed the contract's normalized-text check and the whole search was
 // withheld as INVALID_RESULT ("several searches came back invalid").
 const rows=[{title:'T'.repeat(179)+' tail',url:'https://public.example.invalid/a',text:'a'.repeat(319)+' '+'b'.repeat(50),publishedDate:'05:00PM, Wednesday, September 29 2021, PDT'},
  {title:'Emoji',url:'https://public.example.invalid/b',text:'x'.repeat(319)+'\u{1F600} tail',publishedDate:'unknown'},
  {title:'Short',url:'https://public.example.invalid/c',text:'s',publishedDate:'04:50AM, Thursday, October 29 2026, PDT'}];
 const projected=rows.map(projectRow);
 assert.equal(projected[0].title,'T'.repeat(179),'a title cut on a space is trimmed');
 assert.equal(projected[0].snippet,'a'.repeat(319),'a snippet cut on a space is trimmed');
 assert.equal(projected[1].snippet,'x'.repeat(319),'a cut inside a surrogate pair drops the lone surrogate');
 assert.deepEqual(projected.map(row=>row.publishedAt),['2021-09-29',null,'2026-10-29'],'display dates become calendar dates; "unknown" is absence');
 const s=state(rows),handler=createPublicWebHandlers({origin:'https://core.example.invalid',now:()=>NOW},[{id:'search_public_web',version:'0.2.0'}],
  createPrimaryWebSearch(base({fetchImpl:responder(s)})))[0];
 const out=JSON.parse(await handler.execute(storedCase('search_public_web',{request:{query:'recent announcements'}}).call()));
 assert.equal(out.result.total,3,'the discovery reaches the model instead of INVALID_RESULT');
 assert.deepEqual(out.result.results.map(row=>row.publishedAt),['2021-09-29',null,'2026-10-29']);
 // the contract itself is unchanged: the trailing blank the old projection published is still refused
 assert.throws(()=>contract.assertOutput({...out.result,total:1,results:[{...out.result.results[0],snippet:'a'.repeat(319)+' '}]},{request:{query:'recent announcements'}}),/normalized/u);
});

test('a publication date is projected only as the date it names; an unparseable value is kept whole or stays null',()=>{
 const at=publishedDate=>projectRow({url:'https://public.example.invalid/a',publishedDate}).publishedAt;
 assert.equal(at('2026-10-28T14:00:00Z'),'2026-10-28T14:00:00Z','an ISO instant is kept');
 assert.equal(at('2026-10-01'),'2026-10-01');
 assert.equal(at('July 12 2026'),'2026-07-12');assert.equal(at('Sunday, July 12, 2026'),'2026-07-12');
 assert.equal(at('05:00PM, Sunday, July 12 2026, PDT'),'2026-07-12');
 assert.equal(at('Fall 2026'),'Fall 2026','a short unparseable value is kept whole');
 assert.equal(at('05:00PM, Wednesday, Septembre 29 2021, PDT'),null,'a value that neither parses nor fits the 40-character cap is never cut into a different date');
 assert.equal(at('11:00AM, Monday, Smarch 45 2026, PDT'),'11:00AM, Monday, Smarch 45 2026, PDT','an impossible day or month is not a date; the short original is kept whole, never repaired');
 for(const absent of ['unknown','UNKNOWN','n/a','none','null','  ',undefined,null,12])assert.equal(at(absent),null,String(absent));
 assert.equal(projectRow({url:'https://public.example.invalid/a',publishedAt:'2026-10-02'}).publishedAt,'2026-10-02','the documented alias is read too');
});
