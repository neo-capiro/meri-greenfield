/** Actual research adapters; ordinary resource GETs are closed synthetic Core responses. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './reads-portfolio-fixture.mjs';
import {uuid} from '../../gateway/sources/mail/test/fixtures.mjs';
import {portfolioId} from '../../gateway/sources/research-portfolio-evidence/test/fixtures.mjs';

for(const client of [false,true])for(const id of ['get_research_portfolio','get_research_portfolio_changes'])test(`${id} uses explicit selector in ${client?'client':'General'} context without an entity authority`,async()=>{
 const f=await fixture(id,{client}),r=await f.execute();assert.equal(r.status,200,await r.clone().text());
 const page=JSON.parse((await r.json()).resultJson);assert.equal(page.subject.kind,client?'client':'personal');assert.equal(Object.hasOwn(page.subject,'authorizationDecisionId'),false);
 assert.equal(f.calls.length,1);assert.match(f.calls[0],new RegExp(`/api/research-portfolios/${portfolioId}`));
});
for(const origin of ['review','snapshot','current_continuity'])test(`research ${origin} evidence uses the explicit portfolio selector and original fixed GET owners`,async()=>{const f=await fixture('get_research_evidence',{origin}),r=await f.execute();assert.equal(r.status,200,await r.clone().text());assert.equal(f.calls.length,origin==='review'?4:1);});
test('missing/malformed portfolio selector refuses before Core',async()=>{const f=await fixture();for(const args of [{},{portfolioId:'not-an-id'},{portfolioId:null},{portfolioId,tenantId:'forged'}]){const r=await f.execute(args);assert.notEqual(r.status,200);}assert.equal(f.calls.length,0);});
test('Core resource refusal is never replaced by a subject grant',async()=>{const f=await fixture();f.status(403);const r=await f.execute();assert.equal(r.status,403);assert.equal(f.calls.length,1);});
test('wrong returned portfolio and actor grant cannot release a detail',async()=>{for(const mutate of [page=>{page.id=uuid('6');},page=>{page.grants[0].principalUserId='foreign';}]){const f=await fixture();f.mutate(mutate);const r=await f.execute();assert.notEqual(r.status,200);assert.equal(f.calls.length,1);}});
test('execution revoked during the resource GET withholds the page',async()=>{const f=await fixture();f.mutate(f.revoke);const r=await f.execute();assert.equal(r.status,403);assert.doesNotMatch(await r.text(),/Synthetic portfolio/);});
