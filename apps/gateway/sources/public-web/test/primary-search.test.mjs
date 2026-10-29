/** Real JSON wire crossing with synthetic MCP responses; no AWS call, credential or network egress. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createPublicWebHandlers} from '../handler.mjs';
import {createPrimaryWebSearch,createPrimarySearchReadSource,primarySearchTarget,readMcpPayload,projectRow,
 AGENTCORE_SEARCH_PROVIDER} from '../primary-search.mjs';
import {signAwsRequest,resolveAwsCredentials,amzDate} from '../aws-signing.mjs';

const ENDPOINT='https://meri-abc123.gateway.bedrock-agentcore.us-east-1.amazonaws.com';
const CREDENTIALS=Object.freeze({accessKeyId:'AKIAIOSFODNN7EXAMPLE',secretAccessKey:'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',sessionToken:'session-token'});
const NOW=1_761_700_000_000;
const TOOL='WebSearch';
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

test('documented MCP response projects into the discovery contract rows',()=>{
 const payload=readMcpPayload('application/json',JSON.stringify(mcp([{text:'Python 3.13 shipped.',publishedDate:'2024-10-07',url:'https://example.com/python/3.13',title:'Python 3.13'}])));
 assert.equal(payload.result.content[0].type,'text');
 const row=projectRow({text:'Python 3.13 shipped.',publishedDate:'2024-10-07',url:'https://example.com/python/3.13',title:'Python 3.13'});
 assert.deepEqual({...row},{title:'Python 3.13',url:'https://example.com/python/3.13',snippet:'Python 3.13 shipped.',source:AGENTCORE_SEARCH_PROVIDER,publishedAt:'2024-10-07'});
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

test('search sends the documented tools/call arguments and a SigV4 IAM header',async()=>{
 const s=state([{text:'Current release notes',url:'https://public.example.invalid/a',title:'Release'}]);
 const value=await createPrimaryWebSearch(base({fetchImpl:responder(s)})).search({query:'  latest   python release ',limit:20,deadlineMs:NOW+5000});
 assert.equal(s.requests.length,1);
 const request=s.requests[0];
 assert.equal(request.url,`${ENDPOINT}/mcp`);
 assert.equal(request.body.method,'tools/call');
 assert.equal(request.body.params.name,TOOL);
 assert.deepEqual(request.body.params.arguments,{query:'latest python release',maxResults:20});
 assert.match(request.options.headers.authorization,/^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/\d{8}\/us-east-1\/bedrock-agentcore\/aws4_request, SignedHeaders=content-type;host;x-amz-date;x-amz-security-token, Signature=[a-f0-9]{64}$/u);
 assert.equal(request.options.headers['mcp-protocol-version'],'2025-11-25');
 assert.deepEqual(value,{tool:'search_public_web',contentStatus:'discovered',generatedAt:new Date(NOW).toISOString(),provider:AGENTCORE_SEARCH_PROVIDER,total:1,
  results:[{title:'Release',url:'https://public.example.invalid/a',snippet:'Current release notes',source:AGENTCORE_SEARCH_PROVIDER,publishedAt:null}]});
});

test('query is bounded to the documented 200 characters and results to the receiving cap',async()=>{
 const s=state(Array.from({length:14},(_,i)=>({text:`snippet ${i}`,url:`https://public.example.invalid/${i}`,title:`row ${i}`})));
 const value=await createPrimaryWebSearch(base({fetchImpl:responder(s)})).search({query:'q'.repeat(400),limit:40,deadlineMs:NOW+5000});
 assert.equal(s.requests[0].body.params.arguments.query.length,200);
 assert.equal(s.requests[0].body.params.arguments.maxResults,25);
 assert.equal(value.results.length,12);
 assert.equal(value.total,12);
});

test('empty results stay an honest empty discovery',async()=>{
 const value=await createPrimaryWebSearch(base({fetchImpl:responder(state([]))})).search({query:'nothing',limit:5,deadlineMs:NOW+5000});
 assert.deepEqual(value,{tool:'search_public_web',contentStatus:'discovered',generatedAt:new Date(NOW).toISOString(),
  provider:AGENTCORE_SEARCH_PROVIDER,total:0,results:[]});
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
 // A plausible empty-results body inside an execution error is not an honest empty discovery either.
 s.payload={jsonrpc:'2.0',id:'1',result:{isError:true,content:[{type:'text',text:JSON.stringify({results:[]})}]}};
 await assert.rejects(primary.search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'UNAVAILABLE'});
});

test('malformed or tool-error payloads never claim success',async()=>{
 await assert.rejects(createPrimaryWebSearch(base({fetchImpl:async()=>new Response('not-json',{status:200,headers:{'content-type':'application/json'}})}))
  .search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'INVALID_RESULT'});
 await assert.rejects(createPrimaryWebSearch(base({fetchImpl:async()=>Response.json({jsonrpc:'2.0',id:'1',error:{code:-32000,message:'throttled'}})}))
  .search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'UNAVAILABLE'});
});

test('a stalled credential cannot hold the call past its deadline and never reaches paid dispatch',async()=>{
 let dispatched=0;
 const stalled=createPrimaryWebSearch(base({credentials:()=>new Promise(()=>{}),fetchImpl:async()=>{dispatched++;return Response.json(mcp([]));}}));
 await assert.rejects(stalled.search({query:'q',limit:5,deadlineMs:Date.now()+120}),{message:'DEADLINE'});
 assert.equal(dispatched,0);
});

test('a credential that resolves after the cutoff does not dispatch a paid search',async()=>{
 let clock=NOW,dispatched=0;
 const primary=createPrimaryWebSearch(base({now:()=>clock,fetchImpl:async()=>{dispatched++;return Response.json(mcp([]));},
  credentials:async()=>{clock=NOW+9000;return CREDENTIALS;}}));
 await assert.rejects(primary.search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'DEADLINE'});
 assert.equal(dispatched,0,'no billable call after the deadline');
});

test('an already expired deadline and caller cancellation are refused before any work',async()=>{
 let dispatched=0;
 const primary=createPrimaryWebSearch(base({fetchImpl:async()=>{dispatched++;return Response.json(mcp([]));}}));
 await assert.rejects(primary.search({query:'q',limit:5,deadlineMs:NOW}),{message:'DEADLINE'});
 const controller=new AbortController();controller.abort();
 await assert.rejects(primary.search({query:'q',limit:5,deadlineMs:NOW+5000,signal:controller.signal}),{message:'DEADLINE'});
 assert.equal(dispatched,0);
});

test('an oversized or mis-encoded response body is bounded',async()=>{
 const huge=createPrimaryWebSearch(base({maxResponseBytes:4096,fetchImpl:async()=>new Response('x'.repeat(8192),{status:200,headers:{'content-type':'application/json'}})}));
 await assert.rejects(huge.search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'RESOURCE_LIMIT'});
 const declared=createPrimaryWebSearch(base({maxResponseBytes:4096,fetchImpl:async()=>new Response('{}',{status:200,headers:{'content-type':'application/json','content-length':'9999'}})}));
 await assert.rejects(declared.search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'RESOURCE_LIMIT'});
 const encoded=createPrimaryWebSearch(base({fetchImpl:async()=>new Response('{}',{status:200,headers:{'content-type':'application/json','content-encoding':'gzip'}})}));
 await assert.rejects(encoded.search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'INVALID_RESULT'});
});

test('missing credentials are unavailable, not an unauthenticated call',async()=>{
 let calls=0;
 await assert.rejects(createPrimaryWebSearch(base({credentials:async()=>undefined,fetchImpl:async()=>{calls++;return Response.json(mcp([]));}}))
  .search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'UNAVAILABLE'});
 assert.equal(calls,0);
});

test('endpoint, region, tool name and attempt bounds are validated; admission states the real cost',()=>{
 assert.throws(()=>createPrimaryWebSearch({endpoint:'http://insecure.example',region:'us-east-1',toolName:TOOL}),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createPrimaryWebSearch({endpoint:ENDPOINT,region:'not-a-region',toolName:TOOL}),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createPrimaryWebSearch({endpoint:ENDPOINT,region:'us-east-1'}),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createPrimaryWebSearch(base({toolName:'bad tool'})),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createPrimaryWebSearch(base({maxAttempts:3})),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createPrimaryWebSearch({endpoint:ENDPOINT,region:'us-east-1',toolName:TOOL,extra:true}),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createPrimarySearchReadSource({}),{message:'GATEWAY_CONFIGURATION'});
 assert.deepEqual({...createPrimaryWebSearch(base({fetchImpl:async()=>Response.json(mcp([]))})).admission},
  {unitMicroUsd:7005,maxAttempts:1,maxMicroUsd:7005,maxCallsPerInvocation:1,billing:'aws-agentcore-web-search-and-gateway-invocation'});
 assert.equal(createPrimaryWebSearch(base({maxAttempts:2})).admission.maxMicroUsd,14010);
 assert.deepEqual(primarySearchTarget({MERI_WEB_SEARCH_GATEWAY_ENDPOINT:ENDPOINT,MERI_WEB_SEARCH_TOOL:TOOL,AWS_REGION:'us-east-1'}),
  {endpoint:ENDPOINT,region:'us-east-1',toolName:TOOL});
 assert.equal(primarySearchTarget({MERI_WEB_SEARCH_GATEWAY_ENDPOINT:ENDPOINT}),undefined,'a half-configured target stays off');
 assert.equal(primarySearchTarget({}),undefined);
});

test('SigV4 signing matches an independent reference computation for the gateway POST',()=>{
 const body='{"jsonrpc":"2.0","id":"web-search-1761700000000","method":"tools/call","params":{"name":"WebSearch","arguments":{"query":"q","maxResults":2}}}';
 assert.equal(amzDate(NOW),'20251029T010640Z');
 const {headers}=signAwsRequest({method:'POST',url:`${ENDPOINT}/mcp`,body,region:'us-east-1',service:'bedrock-agentcore',credentials:CREDENTIALS,nowMs:NOW});
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
  fetchImpl:async()=>new Response('x'.repeat(4096),{status:200})}),{message:'CREDENTIALS_UNAVAILABLE'});
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

test('the frozen receiving contract does not yet admit the primary provider label',()=>{
 // Evidence for the required contract join owned by SCRUM-238: until `packages/contracts` admits the
 // AWS-managed provider and row shape, activation fails closed with INVALID_RESULT instead of
 // mislabelling results as tavily/serper/duckduckgo.
 const contract=resolveOperationContract({id:'search_public_web',version:'0.2.0'});
 assert.throws(()=>contract.assertOutput({tool:'search_public_web',contentStatus:'discovered',generatedAt:'2026-10-29T00:00:00.000Z',
  provider:AGENTCORE_SEARCH_PROVIDER,total:1,results:[{title:null,url:'https://public.example.invalid/a',snippet:null,source:AGENTCORE_SEARCH_PROVIDER,publishedAt:null}]},
  {query:'q',limit:5}));
});
