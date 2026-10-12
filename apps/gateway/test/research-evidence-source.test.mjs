import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createSourceDisabledGateway } from '../index.mjs';
import { createResearchPortfolioEvidenceHttpAdapter } from '../sources/research-portfolio-evidence/http-adapter.mjs';
import { setup, request, review, recordId, portfolioId } from './research-evidence-fixtures.mjs';
import { NOW, uuid, limits } from './fixtures.mjs';

for (const origin of ['review','snapshot','current_continuity']) test(`connected ${origin} uses fixed projected GET and canonical release`, async () => {
  const f = setup(origin), result = JSON.parse(await f.create().execute(request(f.raw),'WORKER_CAPABILITY_NEVER_FORWARDED'));
  assert.equal(result.data.origin,origin); assert.equal(result.data.portfolioId,portfolioId);
  assert.equal(result.data.coverage.corpusComplete,false); assert.equal(result.data.coverage.sourceBytesVerified,false);
  assert.equal(f.wire.length,origin === 'review' ? 4 : 1);
  for (const call of f.wire) {
    assert.equal(call.options.method,'GET'); assert.equal(call.options.body,undefined);
    assert.equal(call.options.redirect,'error'); assert.equal(call.options.credentials,'omit');
    assert.equal(call.options.headers.authorization,'Bearer SYNTHETIC_USER_TOKEN');
    assert.equal(call.options.headers['x-internal-service-secret'],undefined);
    assert.equal(JSON.stringify(call).includes('WORKER_CAPABILITY'),false);
  }
  assert.ok(f.calls.indexOf('reserve') < f.calls.indexOf('credentials')); assert.ok(f.calls.includes('settle'));
  if (origin === 'review') assert.deepEqual(result.data.evidenceFor,review().evidenceFor);
  if (origin === 'snapshot') { assert.equal(result.data.contributions[0].value,'9007199254740993.125'); assert.equal(Object.hasOwn(result.data.contributions[0],'sourceDisposition'),false); assert.deepEqual(result.data.clientAccessRequirements,f.pages[0].clientAccessRequirements); }
  if (origin === 'current_continuity') { assert.equal(result.data.items[0].persisted,false); assert.deepEqual(result.data.items[0].originalEvidence,f.pages[0].items[0].originalEvidence); }
});
test('actual bounded HTTP loopback preserves four routes and cancels owned server', async () => {
  const f=setup(),seen=[];
  const server=createServer((req,res)=>{seen.push(req.url);res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(f.pages[seen.length-1]));});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try {
    const result=JSON.parse(await f.create({fetchImpl:(url,options)=>fetch(`http://127.0.0.1:${server.address().port}${new URL(url).pathname}${new URL(url).search}`,options)}).execute(request(f.raw),'synthetic'));
    assert.equal(result.data.id,recordId);
    assert.deepEqual(seen,['mine','team','deferred','resolved'].map(l=>`/research-portfolios/${portfolioId}/reviews?lane=${l}`));
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));assert.equal(server.listening,false);}
});
test('all four lanes are required, duplicate identical observation allowed, missing never means absence', async () => {
  const f=setup();f.pages[3]=[review()];assert.equal(JSON.parse(await f.create().execute(request(f.raw),'synthetic')).data.id,recordId);
  const missing=setup();missing.pages[1]=[];await assert.rejects(missing.create().execute(request(missing.raw),'synthetic'));
  assert.equal(missing.wire.length,4);assert.equal(missing.calls.includes('settle'),false);
  const moved=setup();moved.pages[3]=[{...review(),revision:5}];await assert.rejects(moved.create().execute(request(moved.raw),'synthetic'));assert.equal(moved.calls.includes('settle'),false);
});
test('UUID selectors normalize accepted uppercase spelling before exact source selection', async () => {
  const f=setup(), result=JSON.parse(await f.create().execute(request({...f.raw,recordId:recordId.toUpperCase()}),'synthetic'));
  assert.equal(result.data.id,recordId);
  const selected=setup('snapshot');selected.subject.entityIds=[portfolioId.toUpperCase()];
  const snapshot=JSON.parse(await selected.create().execute(request(selected.raw),'synthetic'));
  assert.equal(snapshot.data.portfolioId,portfolioId);
  assert.equal(selected.wire[0].url,`https://source.example.invalid/research-portfolios/${portfolioId}/snapshots/${recordId}`);
});
test('foreign tenant, Portfolio, conflicting stance and incomplete snapshots refuse', async () => {
  for (const kind of ['tenant','portfolio','stance','snapshot-parent','snapshot-missing','continuity-count']) {
    const f=setup(kind.startsWith('snapshot')?'snapshot':kind.startsWith('continuity')?'current_continuity':'review');
    if(kind==='tenant')f.pages[1][0].tenantId='foreign';if(kind==='portfolio')f.pages[1][0].portfolioId=uuid('c');
    if(kind==='stance')f.pages[1][0].evidenceFor[0].stance='against';
    if(kind==='snapshot-parent')f.pages[0].projection.portfolioRevision++;
    if(kind==='snapshot-missing')delete f.pages[0].versions.sources;
    if(kind==='continuity-count')f.pages[0].counts.changed=0;
    await assert.rejects(f.create().execute(request(f.raw),'synthetic'));assert.equal(f.calls.includes('settle'),false);
  }
});
test('authority hints, unsupported raw/history selectors and URLs refuse before any current ports', async () => {
  for(const extra of [{portfolioId},{tenantId:'synthetic-tenant'},{historical:true},{limit:1},{cursor:'x'},{url:'https://evil.invalid'},{decisionIds:[recordId]}]) {
    const f=setup();await assert.rejects(f.create().execute(request({...f.raw,...extra}),'synthetic'));assert.deepEqual(f.calls,[]);
  }
  const f=setup('current_continuity');await assert.rejects(f.create().execute(request({...f.raw,recordId}),'synthetic'));assert.deepEqual(f.calls,[]);
});
test('revocation and source disabling prevent effect; revocation after body prevents release', async () => {
  for(const kind of ['revoked','fence','source','budget','after-body']) {
    const f=setup('snapshot');if(kind==='revoked')f.state.revoked=true;if(kind==='fence')f.state.fence=2;
    if(kind==='source')f.state.sourceEnabled=false;if(kind==='budget')f.budget.reserve=async()=>{throw Error('denied');};
    const changes=kind==='after-body'?{fetchImpl:async()=>{f.state.revoked=true;return new Response(JSON.stringify(f.pages[0]),{headers:{'content-type':'application/json'}});}}:{};
    await assert.rejects(f.create(changes).execute(request(f.raw),'synthetic'));assert.equal(f.calls.includes('settle'),false);
    if(kind!=='after-body')assert.equal(f.calls.includes('credentials'),false);
  }
});
test('credential correlation, expiry and malformed tokens fail closed', async () => {
  for(const kind of ['actor','fence','expiry','header','getter']) {
    const f=setup();let touched=0;
    const getCredentials=async()=>{const c=f.credentials();if(kind==='actor')c.binding.actorId='foreign';if(kind==='fence')c.binding.writerFence=2;if(kind==='expiry')c.expiresAtMs=NOW;if(kind==='header')c.bearerToken='bad\nheader';if(kind==='getter')Object.defineProperty(c,'bearerToken',{enumerable:true,get(){touched++;return 'TOKEN';}});return c;};
    await assert.rejects(f.create({getCredentials}).execute(request(f.raw),'synthetic'));assert.equal(f.wire.length,0);assert.equal(touched,0);
  }
});
test('strict media, byte count, UTF8, response errors and projected output budget remain bounded', async () => {
  for(const kind of ['status','media','length','bytes','utf8','json','budget']) {
    const f=setup('snapshot');if(kind==='budget')f.claims.budgets.maxOutputBytes=16;
    const fetchImpl=async()=>new Response(kind==='utf8'?new Uint8Array([0xc3,0x28]):kind==='json'?'{':JSON.stringify(f.pages[0]),{status:kind==='status'?403:200,headers:{'content-type':kind==='media'?'text/html':'application/json',...(kind==='length'?{'content-length':'1'}:{})}});
    await assert.rejects(f.create({fetchImpl,maxResponseBytes:kind==='bytes'?10:65536}).execute(request(f.raw),'synthetic'));assert.equal(f.calls.includes('settle'),false);
  }
});
for(const stage of ['credentials','fetch','body'])test(`parked ${stage} times out; late completion cannot start another lane`,async()=>{
  const f=setup(),parked=Promise.withResolvers();let cancelled=false;
  const changes={maxRequestMs:20};if(stage==='credentials')changes.getCredentials=()=>parked.promise;
  if(stage==='fetch')changes.fetchImpl=()=>parked.promise;
  if(stage==='body')changes.fetchImpl=async()=>new Response(new ReadableStream({pull(){return parked.promise;},cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}});
  await assert.rejects(f.create(changes).execute(request(f.raw),'synthetic'),/DEADLINE/);const before=[...f.calls];
  parked.resolve(stage==='credentials'?f.credentials():stage==='fetch'?new Response(new ReadableStream({cancel(){cancelled=true;}})):undefined);
  await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.calls,before);assert.equal(f.calls.includes('settle'),false);if(stage!=='credentials')assert.equal(cancelled,true);
});
test('source factory import/configuration has no effects and production remains disabled', async () => {
  const f=setup();for(const origin of ['http://source.invalid','https://source.invalid/path','https://a:b@source.invalid','https://source.invalid?q=x'])assert.throws(()=>createResearchPortfolioEvidenceHttpAdapter({...f.config,origin}));
  const gateway=createSourceDisabledGateway({authorityPorts:f.ports,budget:f.budget,limits,now:()=>f.state.now,newId:()=>uuid('7')});
  await assert.rejects(gateway.execute(request(f.raw),'synthetic'),/UNAVAILABLE/);assert.equal(gateway.sourceEnabled,false);assert.deepEqual(f.calls,[]);
});
