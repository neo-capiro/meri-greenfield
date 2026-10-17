/** Real JSON receiving with synthetic native public-web pages; no external URL requests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {deny} from '../../../dispatch/operation-result.mjs';
import {createPublicWebHandlers} from '../handler.mjs';
import {createHandlers,id as family} from '../../../general-reads/families/public-web.mjs';
import {storedCase,ids} from './fixture.mjs';

for(const id of ids){
 test(`${id}: exact native flat POST, current proof and private result carrier`,async()=>{
  const f=storedCase(id),call=f.call(),out=JSON.parse(await f.handler()(call)),[wire]=f.wire,[proof]=f.credentialCalls;
  assert.deepEqual(out,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
  assert.equal(wire.url,`https://native-core.example.invalid/api/clio/tools/${id}`);assert.equal(wire.options.method,'POST');
  assert.deepEqual(wire.body,f.arguments);assert.equal(Object.hasOwn(wire.body,'input'),false);assert.equal(f.wire.length,1);
  assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');
  assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
  assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
  assert.deepEqual(proof.operation,f.operation);assert.deepEqual(proof.sourceIds,['public_web']);
  assert.equal(proof.requestSha256,hash(f.arguments));assert.equal(proof.argumentsSha256,call.argumentsSha256);
  assert.deepEqual(proof.normalizationContext,{});
 });
 test(`${id}: tenant/user/operation decision mismatches reach no credential or HTTP IO`,async()=>{
  for(const mutate of [a=>a.claims.actions=[],a=>a.claims.audience='other',a=>a.decision.decision='denied',
   a=>a.decision.operation='other@0.2.0',a=>a.decision.actor.actorId='other',a=>a.decision.scopes=[],
   a=>a.sourceIds=['other'],a=>a.claims.binding.tenantId='other',a=>a.claims.issuedAt=new Date(a.deadlineMs).toISOString()]){
   const f=storedCase(id),call=structuredClone(f.call());mutate(call.authority);
   await assert.rejects(f.handler()(call));assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
  }
 });
 test(`${id}: model authority, unknown context and digest substitution are rejected before credentials`,async()=>{
  const f=storedCase(id);
  for(const extra of [{tenantId:'other'},{actorRole:'capiro_admin'},{provider:'tavily'},{clientId:'other'},{authorized:true}]){
   await assert.rejects(f.handler()({...f.call(),request:{...f.arguments,...extra}}),{message:'INVALID_ARGUMENTS'});
  }
  await assert.rejects(f.handler()({...f.call(),normalizationContext:{sourceConnected:true}}),{message:'INVALID_ARGUMENTS'});
  await assert.rejects(f.handler()({...f.call(),argumentsSha256:'0'.repeat(64)}),{message:'INVALID_ARGUMENTS'});
  assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 });
 test(`${id}: proof-correlated current native user and service credentials are mandatory`,async()=>{
  for(const key of ['binding','subject','operation','policyRevision','sourceIds','requestSha256','argumentsSha256','normalizationContext','origin','bearerToken','serviceSecret','expiresAtMs']){
   const f=storedCase(id);f.state.credentialMutator=receipt=>receipt[key]=key==='expiresAtMs'?f.now():null;
   await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
  }
  const f=storedCase(id);await assert.rejects(f.handler({getCredentials:undefined})(f.call()),{message:'UNAVAILABLE'});assert.equal(f.wire.length,0);
 });
 test(`${id}: cancellation, expiry, bounded receiving and current credential refusal withhold bytes`,async()=>{
  const f=storedCase(id);await assert.rejects(f.handler()({...f.call(),signal:AbortSignal.abort()}),{message:'CANCELLED'});assert.equal(f.credentialCalls.length,0);
  await assert.rejects(f.handler({maxResponseBytes:16})(f.call()),{message:'RESOURCE_LIMIT'});
  const g=storedCase(id),controller=new AbortController();g.state.afterSource=()=>controller.abort();
  await assert.rejects(g.handler()({...g.call(),signal:controller.signal}),{message:'CANCELLED'});
  const h=storedCase(id);h.state.now=h.authority.deadlineMs;await assert.rejects(h.handler()(h.call()),{message:'DEADLINE'});assert.equal(h.wire.length,0);
  const k=storedCase(id);await assert.rejects(k.handler({getCredentials:async()=>deny('ACCESS_DENIED')})(k.call()),{message:'ACCESS_DENIED'});assert.equal(k.wire.length,0);
 });
 test(`${id}: native errors and foreign/wrapped DTOs are refused without source-error disclosure`,async()=>{
  for(const response of [()=>Response.json({error:'PRIVATE_SOURCE_DETAIL'}),()=>Response.json({error:'PRIVATE_SOURCE_DETAIL'},{status:400}),
   page=>Response.json({...page,tool:'other'}),page=>Response.json({output:page}),page=>Response.json({...page,authorized:true})]){
   const f=storedCase(id);f.state.responseFactory=response;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
  }
 });
 test(`${id}: per-call credential selection cannot fall back to static credentials`,async()=>{
  const f=storedCase(id),call=f.call(),{getCredentials,...configuration}=f.transport;let captured;
  const handler=createPublicWebHandlers({...configuration,now:f.now,credentialsForCall:(operation,original)=>{
   captured={operation,original};return getCredentials;
  }},[f.operation])[0];
  await handler.execute(call);assert.equal(captured.original,call);assert.deepEqual(captured.operation,f.operation);
  assert.throws(()=>f.handler({credentialsForCall:()=>getCredentials}),{message:'GATEWAY_CONFIGURATION'});
 });
}

for(const provider of ['tavily','serper','duckduckgo'])test(`${provider}: discovery status and native provider fields survive JSON unchanged`,async()=>{
 const f=storedCase('search_public_web',{provider}),out=JSON.parse(await f.handler()(f.call()));
 assert.deepEqual(out.result,f.page);assert.equal(out.result.contentStatus,'discovered');
 assert.equal(Object.hasOwn(out.result.results[0],'publishedAt'),provider!=='duckduckgo');
 f.state.resultMutator=page=>page.contentStatus='consulted';await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 f.state.resultMutator=page=>page.results[0].source=provider==='tavily'?'serper':'tavily';await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});

test('search original trim/cap/clamp values reach Core for one normalization pass',async()=>{
 const request={query:' '+('x'.repeat(239))+' y ',limit:'2.9'},f=storedCase('search_public_web',{request}),call=f.call();
 assert.equal(call.input.query,'x'.repeat(239)+' ');assert.equal(call.input.limit,2);
 await f.handler()(call);assert.deepEqual(f.wire[0].body,request);assert.equal(f.credentialCalls[0].requestSha256,hash(request));
});

test('search preserves raw DuckDuckGo URL metadata and never fetches a discovered URL',async()=>{
 const f=storedCase('search_public_web',{provider:'duckduckgo'});f.state.page={...f.page,results:[{...f.page.results[0],url:'javascript:untrusted-discovery'}]};
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.results[0].url,'javascript:untrusted-discovery');
 assert.equal(f.wire.length,1);assert.equal(new URL(f.wire[0].url).origin,f.transport.origin);
 f.state.page={...f.page,total:0,results:[]};const empty=JSON.parse(await f.handler()(f.call())).result;
 assert.equal(empty.total,0);assert.equal(empty.contentStatus,'discovered');assert.equal(Object.hasOwn(empty,'complete'),false);
});

test('search returned-count, provider fields and requested limits cannot be fabricated',async()=>{
 const f=storedCase('search_public_web',{request:{query:'Synthetic',limit:1}});
 for(const mutate of [page=>page.total=2,page=>{page.results.push({...page.results[0]});page.total=2;},
  page=>delete page.results[0].publishedAt,page=>page.results[0].title='two  spaces',page=>page.complete=true]){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('URL syntax and required selectors fail before native credentials without claiming DNS admission',async()=>{
 for(const [id,requests] of [['search_public_web',[{},{query:''},{query:3}]],['scrape_web_page',[
  {},{url:''},{url:'file:///synthetic'},{url:'https://user:secret@public.example.invalid/'},{url:3},
 ]]]){
  const f=storedCase(id);for(const request of requests)await assert.rejects(f.handler()({...f.call(),request}),{message:'INVALID_ARGUMENTS'});
  assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
});

test('native page owner retains unsafe-URL refusal instead of fabricating an empty consulted page',async()=>{
 const f=storedCase('scrape_web_page',{request:{url:'http://127.0.0.1/'}});
 f.state.responseFactory=()=>Response.json({message:'Synthetic native URL denial'},{status:400});
 await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 assert.deepEqual(f.wire[0].body,{url:'http://127.0.0.1/'});assert.equal(f.wire.length,1);
 assert.equal(new URL(f.wire[0].url).origin,f.transport.origin);
});

test('HTML final URL, untrusted consultation and original mode/default arguments remain source-owned',async()=>{
 const request={url:' https://public.example.invalid/start ',mode:' EXTRACT ',maxChars:'501.9'},f=storedCase('scrape_web_page',{request});
 f.state.page={...f.page,url:'https://public.example.invalid/redirected',coverage:{...f.page.coverage,
  locator:{...f.page.coverage.locator,url:'https://public.example.invalid/redirected'}}};
 const out=JSON.parse(await f.handler()(f.call())).result;assert.deepEqual(out,f.state.page);
 assert.equal(out.trust,'external_untrusted');assert.equal(out.authoritativeOwner,'public_url');assert.equal(out.currentStatus,'available');
 assert.equal(Object.hasOwn(out,'contentStatus'),false);assert.equal(f.call().input.mode,'EXTRACT');assert.equal(f.call().input.maxChars,501);
 assert.deepEqual(f.wire[0].body,request);
});

test('HTML truncated prefix retains unknown total; reported complete coverage is never silently promoted',async()=>{
 const f=storedCase('scrape_web_page',{request:{url:'https://public.example.invalid/article',maxChars:500}}),text='x'.repeat(497)+'...';
 f.state.page={...f.page,text,totalChars:null,truncated:true,coverage:{...f.page.coverage,
  locator:{...f.page.coverage.locator,characterEnd:500},complete:false,truncated:true}};
 const out=JSON.parse(await f.handler()(f.call())).result;assert.equal(out.text.length,500);assert.equal(out.totalChars,null);assert.equal(out.coverage.complete,false);
 for(const mutate of [page=>page.totalChars=500,page=>page.coverage.complete=true,page=>page.coverage.locator.characterEnd=499,
  page=>page.text='x'.repeat(500),page=>page.text='partial']){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('HTML projected links remain untrusted metadata, bounded, unique and unfetched',async()=>{
 const f=storedCase('scrape_web_page');f.state.resultMutator=page=>page.links=[{url:'https://user:label@public.example.invalid/reference',text:null}];
 const out=JSON.parse(await f.handler()(f.call())).result;assert.equal(out.links[0].text,null);assert.equal(f.wire.length,1);
 for(const mutate of [page=>page.links.push({...page.links[0]}),page=>page.links=Array.from({length:9},(_,i)=>({url:`https://public.example.invalid/${i}`,text:null}))]){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('PDF branch retains extraction total/pages, raw-byte hash syntax and no HTML links/title',async()=>{
 const f=storedCase('scrape_web_page',{kind:'pdf'}),out=JSON.parse(await f.handler()(f.call())).result;
 assert.deepEqual(out,f.page);assert.equal(out.kind,'pdf');assert.equal(out.pages,2);assert.equal(out.coverage.pages,2);assert.equal(out.title,null);assert.deepEqual(out.links,[]);
 for(const mutate of [page=>page.title='Invented title',page=>page.links=[{url:'https://public.example.invalid/',text:null}],
  page=>page.coverage.pages=3,page=>page.contentHash='A'.repeat(64),page=>page.contentType='text/html']){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('PDF truncation preserves full normalized extraction totals without requiring an ellipsis',async()=>{
 const f=storedCase('scrape_web_page',{kind:'pdf',request:{url:'https://public.example.invalid/report.pdf',maxChars:500}});
 f.state.page={...f.page,text:'x'.repeat(500),totalChars:501,pages:0,truncated:true,coverage:{...f.page.coverage,pages:0,
  locator:{...f.page.coverage.locator,characterEnd:500},complete:false,truncated:true}};
 const out=JSON.parse(await f.handler()(f.call())).result;assert.equal(out.totalChars,501);assert.equal(out.text.endsWith('...'),false);assert.equal(out.pages,0);
 for(const mutate of [page=>page.totalChars=500,page=>page.truncated=false,page=>page.text='partial',page=>page.coverage.complete=true]){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('neither HTML nor PDF can upgrade source trust, invent consultation fields or attest network checks',async()=>{
 for(const kind of ['html','pdf'])for(const mutate of [page=>page.trust='trusted',page=>page.authoritativeOwner='tenant',
  page=>page.contentStatus='consulted',page=>page.dnsVerified=true,page=>page.byteHashVerified=true,page=>page.currentStatus='verified']){
  const f=storedCase('scrape_web_page',{kind});f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('family composition and constructor admit only the canonical two current operation references',()=>{
 const f=storedCase();assert.equal(family,'public-web');
 assert.deepEqual(createHandlers({...f.transport,now:f.now}).map(handler=>handler.operation.id).sort(),[...ids].sort());
 for(const operations of [[],[f.operation,f.operation],[{id:'search_research_sources',version:'0.2.0'}],[{id:ids[0],version:'0.1.0'}]]){
  assert.throws(()=>createPublicWebHandlers({...f.transport,now:f.now},operations),{message:'GATEWAY_CONFIGURATION'});
 }
 let effects=0;assert.throws(()=>createPublicWebHandlers({...f.transport,now:f.now},[{get id(){effects++;return ids[0];},version:'0.2.0'}]));
 assert.equal(effects,0);assert.equal(f.wire.length,0);
});
