import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {researchCurrentRequest,researchCurrentReceipt} from './research-current-receipt.mjs';
import {currentReceipt} from './current-receipt.mjs';
import {createCapiroApplicationAuthorityClient} from './authority-http.mjs';
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`,at=1000;
function receipt(){
 const captured={kind:'research_portfolio',researchPortfolioId:id(4),researchPortfolioName:'Captured portfolio',researchPortfolioRevision:1};
 return {principal:{tenantId:id(1),actorId:id(2)},role:'standard_user',permissions:[],clientIds:[],
  identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64),
  conversationId:id(3),selectedClientId:null,checkedAtMs:at,expiresAtMs:at+1000,
  researchPortfolio:{...captured,scopeVersion:createHash('sha256').update(JSON.stringify(captured)).digest('hex'),
   currentResearchPortfolioName:'Current portfolio',currentResearchPortfolioRevision:2,stale:true,resourceRevision:'d'.repeat(64)}};
}
test('explicit Research selector carries no model-selected portfolio or authority',()=>{
 assert.deepEqual(researchCurrentRequest({conversationId:id(3),clientId:null}),{conversationId:id(3),clientId:null,scopeKind:'research_portfolio'});
 for(const extra of [{portfolioId:id(9)},{scopeKind:'research_portfolio'},{grant:'owner'},{clientId:id(9)}])
  assert.throws(()=>researchCurrentRequest({conversationId:id(3),clientId:null,...extra}));
});
test('captures old and current revisions separately and cannot be parsed as General',()=>{
 const r=researchCurrentReceipt(receipt());
 assert.equal(r.researchPortfolio.researchPortfolioRevision,1);
 assert.equal(r.researchPortfolio.currentResearchPortfolioRevision,2);
 assert.equal(r.researchPortfolio.stale,true);assert.ok(Object.isFrozen(r));
 assert.throws(()=>currentReceipt(r));
 const {researchPortfolio,...general}=receipt();assert.throws(()=>researchCurrentReceipt(general));
});
test('refuses forged capture, inconsistent staleness, extra authority and malformed revisions',()=>{
 for(const delta of [{scopeVersion:'f'.repeat(64)},{researchPortfolioId:id(9)},{researchPortfolioName:'Forged'},
  {researchPortfolioRevision:9},{currentResearchPortfolioRevision:-1},{stale:false},{resourceRevision:'x'},
  {grant:'owner'},{currentResearchPortfolioName:'🙂'.repeat(201)}]){
  const r=receipt();Object.assign(r.researchPortfolio,delta);assert.throws(()=>researchCurrentReceipt(r));
 }
 assert.throws(()=>researchCurrentReceipt({...receipt(),selectedClientId:id(9),clientIds:[id(9)]}));
});
test('uses authenticated fixed current route with explicit mode and correlated response',async()=>{
 const calls=[];let answer=receipt(),status=200;
 const client=createCapiroApplicationAuthorityClient({origin:'https://core.invalid',enabled:true,now:()=>at,
  limits:{maxRequestMs:1000,maxResponseBytes:8192},fetchImpl:async(url,options)=>{
   calls.push({url,options});return Response.json(answer,{status});}});
 const input={credential:'synthetic-bearer',conversationId:id(3),clientId:null,expect:{contextRevision:'c'.repeat(64)},deadlineMs:at+1000};
 assert.deepEqual(await client.readResearchCurrent(input),receipt());
 assert.equal(calls[0].url,'https://core.invalid/api/clio/application-authority/current');
 assert.equal(calls[0].options.headers.authorization,'Bearer synthetic-bearer');
 assert.deepEqual(JSON.parse(calls[0].options.body),{conversationId:id(3),clientId:null,expect:input.expect,scopeKind:'research_portfolio'});
 answer={...receipt(),conversationId:id(9)};await assert.rejects(client.readResearchCurrent(input));
 answer={...receipt(),contextRevision:'e'.repeat(64)};await assert.rejects(client.readResearchCurrent(input),e=>e.status===409);
 for(status of [401,403,409])await assert.rejects(client.readResearchCurrent(input),e=>e.status===status);
 status=503;await assert.rejects(client.readResearchCurrent(input),e=>e.status===503);
 const count=calls.length;await assert.rejects(client.readResearchCurrent({...input,portfolioId:id(9)}));assert.equal(calls.length,count);
});
test('does not retry a refused or malformed Research response through General',async()=>{
 let calls=0;const {researchPortfolio,...general}=receipt();
 const client=createCapiroApplicationAuthorityClient({origin:'https://core.invalid',enabled:true,now:()=>at,
  limits:{maxRequestMs:1000,maxResponseBytes:8192},fetchImpl:async()=>{calls++;return Response.json(general);}});
 await assert.rejects(client.readResearchCurrent({credential:'synthetic-bearer',conversationId:id(3),clientId:null,deadlineMs:at+1000}));
 assert.equal(calls,1);
});
