/** Real JSON wire crossing with synthetic MCP responses; no AWS call, credential or network egress. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createPublicWebHandlers} from '../handler.mjs';
import {createPrimaryWebSearch,createPrimarySearchReadSource,primarySearchTarget,readMcpPayload,projectRow,AGENTCORE_SEARCH_PROVIDER} from '../primary-search.mjs';
import {signAwsRequest,resolveAwsCredentials,amzDate} from '../aws-signing.mjs';

const ENDPOINT='https://meri-abc123.gateway.bedrock-agentcore.us-east-1.amazonaws.com';
const CREDENTIALS=Object.freeze({accessKeyId:'AKIAIOSFODNN7EXAMPLE',secretAccessKey:'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',sessionToken:'session-token'});
const NOW=1_761_700_000_000;
const mcp = results => ({jsonrpc:'2.0',id:'invoke-tool-request',result:{isError:false,content:[{type:'text',text:JSON.stringify({id:'824f89d0',results})}]}});
const documented = (rows=[]) => ({results:rows,requests:[],statuses:[]});
function responder(state,status=200){
 return async (url,options)=>{
  state.requests.push({url,options,body:JSON.parse(options.body)});
  const used=state.nextStatus===undefined?status:state.nextStatus.shift();
  state.statuses.push(used);
  return new Response(JSON.stringify(mcp(state.rows)),{status:used,headers:{'content-type':'application/json'}});
 };
}

test('documented MCP response projects into the discovery contract rows',()=>{
 const payload=readMcpPayload('application/json',JSON.stringify(mcp([{text:'Python 3.13 shipped.',publishedDate:'2024-10-07',url:'https://example.com/python/3.13',title:'Python 3.13'}])));
 assert.equal(payload.result.content[0].type,'text');
 const row=projectRow({text:'Python 3.13 shipped.',publishedDate:'2024-10-07',url:'https://example.com/python/3.13',title:'Python 3.13'});
 assert.deepEqual({...row},{title:'Python 3.13',url:'https://example.com/python/3.13',snippet:'Python 3.13 shipped.',source:AGENTCORE_SEARCH_PROVIDER,publishedAt:'2024-10-07'});
});

test('rows without a citable URL are dropped and missing metadata stays null',()=>{
 assert.equal(projectRow({text:'no url'}),undefined);
 assert.equal(projectRow({text:'bad',url:'javascript:alert(1)'}),undefined);
 const row=projectRow({text:'snippet only',url:'https://public.example.invalid/a'});
 assert.equal(row.publishedAt,null);
 assert.equal(row.title,'https://public.example.invalid/a'.slice(0,180));
});

test('search sends the documented tools/call arguments and a SigV4 IAM header',async()=>{
 const state={...documented(),rows:[{text:'Current release notes',url:'https://public.example.invalid/a',title:'Release'}]};
 const primary=createPrimaryWebSearch({endpoint:ENDPOINT,region:'us-east-1',now:()=>NOW,credentials:async()=>CREDENTIALS,fetchImpl:responder(state)});
 const value=await primary.search({query:'  latest   python release ',limit:20,deadlineMs:NOW+5000});
 assert.equal(state.requests.length,1);
 const request=state.requests[0];
 assert.equal(request.url,`${ENDPOINT}/mcp`);
 assert.equal(request.body.method,'tools/call');
 assert.equal(request.body.params.name,'WebSearch');
 assert.deepEqual(request.body.params.arguments,{query:'latest python release',maxResults:20});
 assert.match(request.options.headers.authorization,/^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/\d{8}\/us-east-1\/bedrock-agentcore\/aws4_request, SignedHeaders=content-type;host;x-amz-date;x-amz-security-token, Signature=[a-f0-9]{64}$/u);
 assert.equal(request.options.headers['mcp-protocol-version'],'2025-11-25');
 assert.deepEqual(value,{tool:'search_public_web',contentStatus:'discovered',generatedAt:new Date(NOW).toISOString(),provider:AGENTCORE_SEARCH_PROVIDER,total:1,
  results:[{title:'Release',url:'https://public.example.invalid/a',snippet:'Current release notes',source:AGENTCORE_SEARCH_PROVIDER,publishedAt:null}]});
});

test('query is bounded to the documented 200 characters and results to the receiving cap',async()=>{
 const state={...documented(),rows:Array.from({length:14},(_,i)=>({text:`snippet ${i}`,url:`https://public.example.invalid/${i}`,title:`row ${i}`}))};
 const primary=createPrimaryWebSearch({endpoint:ENDPOINT,region:'us-east-1',now:()=>NOW,credentials:async()=>CREDENTIALS,fetchImpl:responder(state)});
 const value=await primary.search({query:'q'.repeat(400),limit:40,deadlineMs:NOW+5000});
 assert.equal(state.requests[0].body.params.arguments.query.length,200);
 assert.equal(state.requests[0].body.params.arguments.maxResults,25);
 assert.equal(value.results.length,12);
 assert.equal(value.total,12);
});

test('empty results stay an honest empty discovery',async()=>{
 const state={...documented(),rows:[]};
 const primary=createPrimaryWebSearch({endpoint:ENDPOINT,region:'us-east-1',now:()=>NOW,credentials:async()=>CREDENTIALS,fetchImpl:responder(state)});
 assert.deepEqual(await primary.search({query:'nothing',limit:5,deadlineMs:NOW+5000}),{tool:'search_public_web',contentStatus:'discovered',
  generatedAt:new Date(NOW).toISOString(),provider:AGENTCORE_SEARCH_PROVIDER,total:0,results:[]});
});

test('rate limiting is retried within the attempt bound, denial is not',async()=>{
 const limited={...documented(),rows:[{text:'s',url:'https://public.example.invalid/a',title:'t'}],nextStatus:[429,200]};
 const primary=createPrimaryWebSearch({endpoint:ENDPOINT,region:'us-east-1',now:()=>NOW,credentials:async()=>CREDENTIALS,fetchImpl:responder(limited),maxAttempts:2});
 assert.equal((await primary.search({query:'q',limit:5,deadlineMs:NOW+5000})).total,1);
 assert.deepEqual(limited.statuses,[429,200]);
 const denied={...documented(),nextStatus:[403]};
 const blocked=createPrimaryWebSearch({endpoint:ENDPOINT,region:'us-east-1',now:()=>NOW,credentials:async()=>CREDENTIALS,fetchImpl:responder(denied),maxAttempts:2});
 await assert.rejects(blocked.search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'ACCESS_DENIED'});
 assert.equal(denied.statuses.length,1);
});

test('malformed or tool-error payloads never claim success',async()=>{
 const broken=createPrimaryWebSearch({endpoint:ENDPOINT,region:'us-east-1',now:()=>NOW,credentials:async()=>CREDENTIALS,
  fetchImpl:async()=>new Response('not-json',{status:200,headers:{'content-type':'application/json'}})});
 await assert.rejects(broken.search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'INVALID_RESULT'});
 const toolError=createPrimaryWebSearch({endpoint:ENDPOINT,region:'us-east-1',now:()=>NOW,credentials:async()=>CREDENTIALS,
  fetchImpl:async()=>Response.json({jsonrpc:'2.0',id:'1',error:{code:-32000,message:'throttled'}})});
 await assert.rejects(toolError.search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'UNAVAILABLE'});
});

test('missing credentials are unavailable, not an unauthenticated call',async()=>{
 let calls=0;
 const primary=createPrimaryWebSearch({endpoint:ENDPOINT,region:'us-east-1',now:()=>NOW,credentials:async()=>undefined,
  fetchImpl:async()=>{calls++;return Response.json(mcp([]));}});
 await assert.rejects(primary.search({query:'q',limit:5,deadlineMs:NOW+5000}),{message:'UNAVAILABLE'});
 assert.equal(calls,0);
});

test('endpoint, region and read-source ports are validated',()=>{
 assert.throws(()=>createPrimaryWebSearch({endpoint:'http://insecure.example',region:'us-east-1'}),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createPrimaryWebSearch({endpoint:ENDPOINT,region:'not-a-region'}),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createPrimaryWebSearch({endpoint:ENDPOINT,region:'us-east-1',extra:true}),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createPrimarySearchReadSource({}),{message:'GATEWAY_CONFIGURATION'});
 assert.equal(primarySearchTarget({MERI_WEB_SEARCH_GATEWAY_ENDPOINT:ENDPOINT,AWS_REGION:'us-east-1'}).region,'us-east-1');
 assert.equal(primarySearchTarget({}),undefined);
});

test('SigV4 signing matches an independent reference computation for the gateway POST',()=>{
 // Reference computed from the AWS SigV4 pseudocode outside this module (Python hmac/sha256), same inputs.
 const body='{"jsonrpc":"2.0","id":"web-search-1761700000000","method":"tools/call","params":{"name":"WebSearch","arguments":{"query":"q","maxResults":2}}}';
 assert.equal(amzDate(NOW),'20251029T010640Z');
 const {headers}=signAwsRequest({method:'POST',url:`${ENDPOINT}/mcp`,body,region:'us-east-1',service:'bedrock-agentcore',credentials:CREDENTIALS,nowMs:NOW});
 assert.equal(headers.authorization,'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20251029/us-east-1/bedrock-agentcore/aws4_request, '+
  'SignedHeaders=content-type;host;x-amz-date;x-amz-security-token, Signature=669d7a34e886d9a5125f8977fcc3942c16c32a813b22d9d3c2fd747d70aca0db');
 assert.equal(headers['x-amz-security-token'],'session-token');
});

test('the credential chain prefers the role session and reports absence honestly',async()=>{
 assert.deepEqual({...await resolveAwsCredentials({env:{AWS_ACCESS_KEY_ID:'A',AWS_SECRET_ACCESS_KEY:'B',AWS_SESSION_TOKEN:'C'},fetchImpl:async()=>{throw Error('no fetch');}})},
  {accessKeyId:'A',secretAccessKey:'B',sessionToken:'C'});
 const container=await resolveAwsCredentials({env:{AWS_CONTAINER_CREDENTIALS_RELATIVE_URI:'/v2/creds'},
  fetchImpl:async url=>{assert.equal(url,'http://169.254.170.2/v2/creds');return Response.json({AccessKeyId:'X',SecretAccessKey:'Y',Token:'Z'});}});
 assert.deepEqual({...container},{accessKeyId:'X',secretAccessKey:'Y',sessionToken:'Z'});
 assert.equal(await resolveAwsCredentials({env:{},fetchImpl:async()=>{throw Error('no fetch');}}),undefined);
});

test('the search handler routes discovery to the primary port instead of Core',async()=>{
 const calls=[];
 const primary={provider:AGENTCORE_SEARCH_PROVIDER,search:async({query,limit})=>{calls.push({query,limit});return {
  tool:'search_public_web',contentStatus:'discovered',generatedAt:'2026-10-29T00:00:00.000Z',provider:AGENTCORE_SEARCH_PROVIDER,total:0,results:[]};}};
 const source=createPrimarySearchReadSource(primary);
 const value=await source({operation:'search_public_web',input:{query:'policy change',limit:6},deadlineMs:NOW+5000});
 assert.deepEqual(calls,[{query:'policy change',limit:6}]);
 assert.equal(value.provider,AGENTCORE_SEARCH_PROVIDER);
 await assert.rejects(source({operation:'scrape_web_page',input:{url:'https://public.example.invalid/a'},deadlineMs:NOW+5000}),{message:'GATEWAY_CONFIGURATION'});
 // The family split keeps one handler per operation and never invokes a primary for page consultation.
 const operations=[{id:'search_public_web',version:'0.2.0'},{id:'scrape_web_page',version:'0.2.0'}];
 const handlers=createPublicWebHandlers({origin:'https://core.example.invalid',now:()=>NOW},operations,primary);
 assert.deepEqual(handlers.map(row=>row.operation.id),['search_public_web','scrape_web_page']);
 assert.equal(createPublicWebHandlers({origin:'https://core.example.invalid',now:()=>NOW},operations).length,2);
});

test('the frozen receiving contract does not yet admit the primary provider label',()=>{
 // Evidence for the required contract join: until `packages/contracts` admits the AWS-managed provider,
 // activation fails closed with INVALID_RESULT instead of mislabelling results as tavily/serper/duckduckgo.
 const contract=resolveOperationContract({id:'search_public_web',version:'0.2.0'});
 assert.throws(()=>contract.assertOutput({tool:'search_public_web',contentStatus:'discovered',generatedAt:'2026-10-29T00:00:00.000Z',
  provider:AGENTCORE_SEARCH_PROVIDER,total:1,results:[{title:'t',url:'https://public.example.invalid/a',snippet:null,source:AGENTCORE_SEARCH_PROVIDER,publishedAt:null}]},
  {query:'q',limit:5}));
});
