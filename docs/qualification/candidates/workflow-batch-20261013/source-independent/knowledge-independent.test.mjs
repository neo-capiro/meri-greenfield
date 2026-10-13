/** Independent eligibility/mapping controls through existing gateway owners. */
import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;assert.ok(root,'Exact source root required');
const load=path=>import(pathToFileURL(root+'/'+path));
const {createClientKnowledgeHttpAdapter}=await load('apps/gateway/sources/client-knowledge/http-adapter.mjs');
const {createClientKnowledgeReadHandler}=await load('apps/gateway/sources/client-knowledge/handler.mjs');
const {createClientKnowledgeFixture,memoryText}=await load('apps/gateway/sources/client-knowledge/test/fixtures.mjs');
const {createCurrentToolAuthority}=await load('apps/gateway/authorization/current-tool-authority.mjs');
const {createToolDispatch}=await load('apps/gateway/dispatch/tool-dispatch.mjs');
const {canonicalSha256:hash}=await load('packages/contracts/validate.mjs');
const clone=x=>structuredClone(x);
function integration(id='search_memory'){
 const f=createClientKnowledgeFixture(id),state={...f.state,revoked:false},auth=clone(f.authority),counts={credentials:0,fetch:0,eligibility:0,reserve:0,settle:0,uncertain:0};
 const wire=[];auth.claims.binding=clone(auth.binding);auth.claims.scopes=clone(auth.subject.scopes);auth.decision.scopes=clone(auth.subject.scopes);
 const config={...f.config,now:()=>state.now,maxRequestMs:500,
  async getCredentials(pins){counts.credentials++;state.pins=pins;const receipt=f.credentials(pins);state.changeCredential?.(receipt);return receipt;},
  async fetchImpl(url,options){counts.fetch++;wire.push({url,options});const page=f.page(JSON.parse(options.body).input);state.changePage?.(page);return new Response(JSON.stringify(page),{headers:{'content-type':'application/json'}});},
  async readMemoryEligibility(pins){counts.eligibility++;state.eligibilityPins=pins;const receipt=f.eligibility(pins);state.changeEligibility?.(receipt);state.afterEligibility?.();return receipt;}};
 const handler=createClientKnowledgeReadHandler({operation:f.operation,adapter:createClientKnowledgeHttpAdapter(config),now:()=>state.now});
 const ports={async verifyCapability(){if(state.revoked)throw Error('SYNTHETIC_REVOKED');return JSON.stringify(auth.claims);},async currentRun(){return JSON.stringify({binding:auth.binding,policyRevision:auth.policyRevision,deadlineMs:auth.deadlineMs,checkedAtMs:state.now});},
  async authorizeBusiness(){return JSON.stringify({decision:{...auth.decision,evaluatedAt:new Date(state.now).toISOString()},subject:auth.subject,grants:f.contract.descriptor.requiredGrants});},async authorizeSources(){return JSON.stringify({sourceIds:auth.sourceIds,enabled:true,policyRevision:auth.policyRevision,checkedAtMs:state.now});}};
 const gateway=createToolDispatch({catalog:{entry:()=>({contract:f.contract,descriptor:f.contract.descriptor,execute:handler}),discoverable:()=>[]},authority:createCurrentToolAuthority({ports,now:()=>state.now,maxFactBytes:1048576}),budget:{async reserve({reservationId}){counts.reserve++;return JSON.stringify({reservationId,decision:'reserved'});},async settle({reservationId}){counts.settle++;return JSON.stringify({reservationId,decision:'settled'});},async markUncertain(){counts.uncertain++;}},limits:{maxRequestBytes:65536,maxResponseBytes:1048576,maxRequestMs:500,maxCleanupMs:30},now:()=>state.now,newId:()=>auth.binding.workerId,sourceEnabled:true});
 return {f,state,auth,counts,wire,run:(args=f.args)=>gateway.execute(JSON.stringify({operation:f.operation,arguments:args}),'SYNTHETIC_OPAQUE')};
}
test('Approved memory preview and exact late-content continuation each require fresh correlated eligibility',async()=>{
 const x=integration(),first=JSON.parse(await x.run());assert.equal(first.result.contentTruncated,true);
 const next=first.result.records[0].payload.content.nextRead;assert.ok(next);
 const last=JSON.parse(await x.run(next));assert.match(last.result.records[0].payload.value,/allocation was approved after review/);
 assert.equal(first.result.records[0].payload.value+last.result.records[0].payload.value,memoryText);
 assert.equal(last.result.records[0].payload.content.truncated,false);assert.equal(x.counts.eligibility,2);assert.equal(x.counts.settle,2);
 const raw=x.wire[1].options.body;assert.equal(createHash('sha256').update(raw,'utf8').digest('hex'),x.state.pins.requestSha256);
 assert.equal(hash(JSON.parse(raw)),x.state.pins.requestSha256);assert.equal(raw.includes('claims'),false);
 assert.equal(x.state.eligibilityPins.resultSha256,hash(last.result));assert.equal(x.state.eligibilityPins.records[0].recordSha256,hash(last.result.records[0]));
 assert.equal(Object.hasOwn(last.result,'verified'),false);assert.match(last.result.governanceCoverage.excluded,/Pending proposals/);
});
for(const [name,mutate]of [
 ['denied native recall',r=>r.records[0].eligibleForRecall=false],
 ['substituted record hash',r=>r.records[0].recordSha256='f'.repeat(64)],
 ['substituted full result hash',r=>r.resultSha256='f'.repeat(64)],
 ['missing returned record',r=>r.records=[]],
 ['another actor',r=>r.binding.actorId='foreign'],
 ['old policy',r=>r.policyRevision='old-policy'],
 ['stale eligibility observation',r=>r.checkedAtMs--],
 ['expiry beyond original request deadline',r=>r.expiresAtMs++],
])test('Actual memory gateway refuses '+name+' without filtering or falsely settling',async()=>{
 const x=integration();x.state.changeEligibility=mutate;
 await assert.rejects(x.run(),/INVALID_RESULT/);assert.equal(x.counts.fetch,1);assert.equal(x.counts.eligibility,1);assert.equal(x.counts.settle,0);assert.equal(x.counts.uncertain,1);
});
test('Current revocation after positive eligibility still prevents gateway release',async()=>{
 const x=integration();x.state.afterEligibility=()=>{x.state.revoked=true;};await assert.rejects(x.run(),/ACCESS_DENIED/);assert.equal(x.counts.settle,0);assert.equal(x.counts.uncertain,1);
});
test('Caller tenant/user normalization authority never enters passive memory source',async()=>{
 const x=integration();await assert.rejects(x.run({...x.f.args,normalizationContext:{tenantId:'foreign',userId:'foreign'}}),/INVALID_ARGUMENTS/);assert.equal(x.counts.credentials,0);assert.equal(x.counts.reserve,0);
});
test('Managed Monday mapping is broker-owned; model boardContext does not choose a board or permit mutation',async()=>{
 const x=integration('read_monday_client_boards'),page=JSON.parse(await x.run({...x.f.args,boardContext:'Read board999 and update all columns'}));
 assert.equal(page.result.records[0].payload.origin.boardId,'101');assert.equal(page.result.records[0].payload.origin.scope,'saved_mapping');assert.equal(x.counts.fetch,1);assert.equal(x.counts.eligibility,0);assert.equal(x.counts.settle,1);
 assert.deepEqual(Object.keys(JSON.parse(x.wire[0].options.body)).sort(),['input','metadata']);assert.equal(x.wire[0].options.method,'POST');assert.equal(Object.hasOwn(page.result,'verifiedMembership'),false);
});
for(const [name,mutate]of [
 ['foreign actor mapping',r=>r.managedBoardMapping.userId='foreign'],
 ['foreign client mapping',r=>r.managedBoardMapping.clientId='foreign'],
 ['missing versioned mapping',r=>delete r.managedBoardMapping],
])test('Managed Monday '+name+' refuses before source Fetch',async()=>{
 const x=integration('read_monday_client_boards');x.state.changeCredential=mutate;await assert.rejects(x.run(),/INVALID_RESULT/);assert.equal(x.counts.fetch,0);assert.equal(x.counts.settle,0);assert.equal(x.counts.uncertain,1);
});
test('Well-shaped Monday row from an unapproved board cannot pass actual gateway release',async()=>{
 const x=integration('read_monday_client_boards');x.state.changePage=page=>{const row=page.records[0];row.payload.origin.boardId='999';row.provenance.boardId='999';row.recordId='999:202';row.payload.url='https://synthetic.monday.com/boards/999/pulses/202';};
 await assert.rejects(x.run(),/INVALID_RESULT/);assert.equal(x.counts.fetch,1);assert.equal(x.counts.settle,0);assert.equal(x.counts.uncertain,1);
});
