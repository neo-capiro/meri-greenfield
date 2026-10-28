import test from 'node:test';import assert from 'node:assert/strict';
import {receiveUsageOverviewRequest as admit,receiveUsageOverviewResponse as receive,receiveUsageOverviewRequestV2 as admitV2,receiveUsageOverviewResponseV2 as receiveV2,usageOverviewMetadataV2,USAGE_OVERVIEW_SCHEMA_V2,USAGE_OVERVIEW_PATH,receiveConversationUsageRequest as admitRun,receiveConversationUsageResponse as receiveRun} from '@capiro/meri-contracts/conversation-usage';
import {request,requestV2,response,responseV2} from '../../../apps/control/conversations/usage-overview/test/fixture.mjs';
import {request as runRequest} from '../../../apps/control/conversations/usage-read/test/fixture.mjs';
const bytes=value=>new TextEncoder().encode(JSON.stringify(value));
test('independent named overview receiver preserves closed ordinary run receiver and brands neither execution nor run authority',()=>{
 const q=admit(bytes(request)),body=response(),value=receive(200,bytes(body),q);assert.deepEqual(value,body);assert(Object.isFrozen(q)&&Object.isFrozen(value.periods[0]));
 assert.throws(()=>receive(200,bytes(body),structuredClone(q)),/UNADMITTED_REQUEST/);
 assert.throws(()=>admitRun(bytes(request)));assert.throws(()=>admit(bytes(runRequest)));
 assert.throws(()=>receiveRun(200,bytes(body),admitRun(bytes(runRequest))));
 assert.throws(()=>admit(bytes({...request,tenantId:'forged'})));assert.throws(()=>admit(bytes({...request,limit:20})));
});
test('periods, denominators and cost/capacity uncertainty cannot be promoted into complete-job or physical capacity facts',()=>{
 const q=admit(bytes(request));for(const change of [v=>v.periods.reverse(),v=>v.periods[1].startInclusive=v.periods[0].startInclusive,
  v=>v.periods[0].attempts++,v=>v.periods[0].recording.unavailable++,v=>v.periods[0].completedAttemptsWithRecordedUsage++,
  v=>v.periods[0].completedAttemptKnownChargeMicroUsd=41,v=>v.periods[0].recording.recorded=0,
  v=>v.monthlyAdmission.remainingKnownMicroUsd=100,v=>v.monthlyAdmission.reached=true,v=>v.queue.states.completed=1,
  v=>v.queue.availableCapacity=10,v=>v.queue.physicalConcurrency=3,v=>v.coverage.providerBilledMicroUsd=0,
  v=>v.coverage.completeJobCost='complete',v=>v.periods[0].knownChargeMicroUsd=Number.MAX_SAFE_INTEGER+1,
  v=>v.policy.monthlyCapMicroUsd=0,v=>v.privateDiagnostics='secret']){
  const value=structuredClone(response());change(value);assert.throws(()=>receive(200,bytes(value),q));
 }
});
test('strict failures preserve read uncertainty only for its owner and reject raw diagnostics/status mismatch/hostile bytes',()=>{
 const q=admit(bytes(request));assert.deepEqual(receive(503,bytes({error:{code:'USAGE_OVERVIEW_UNAVAILABLE',outcome:'UNKNOWN'}}),q),{error:{code:'USAGE_OVERVIEW_UNAVAILABLE',outcome:'UNKNOWN'}});
 for(const [status,value]of [[403,{error:{code:'MEMBERSHIP_REVOKED',outcome:'UNKNOWN'}}],[400,{error:{code:'USAGE_OVERVIEW_UNAVAILABLE'}}],[503,{error:{code:'USAGE_OVERVIEW_UNAVAILABLE',outcome:'ACK'}}],[503,{error:{code:'USAGE_OVERVIEW_UNAVAILABLE',detail:'database-private'}}]])assert.throws(()=>receive(status,bytes(value),q));
 assert.throws(()=>admit(new Uint8Array(1025)));assert.throws(()=>receive(200,new Uint8Array(16385),q));assert.throws(()=>admit(new TextEncoder().encode('{"schemaVersion":"meri.usage-overview/1","schemaVersion":"x"}')));
});
test('the current generated /1 receiver keeps ordinary parity for /1 and refuses the successor /2 body',()=>{
 // Precision (review F5iii): this runs the workspace dist through the public export, i.e. the CURRENT
 // generated artifact. Genuine frozen-archive parity is the external physical .25/.26 proof, not this test.
 const q=admit(bytes(request));
 // Parity is already proven above by receiving the ordinary /1 body unchanged. This is the other half:
 // a well-formed successor response must be refused, never silently accepted as an ordinary one.
 assert.throws(()=>receive(200,bytes(responseV2()),q));
 assert.throws(()=>admit(bytes(requestV2)));
});
// The successor cases below run against the generated dist artifact through the same public export, so
// they qualify what a browser actually loads rather than the source modules behind it.
test('generated successor receiver handles the ordinary and current /2 exchange within its declared bounds',()=>{
 const q=admitV2(bytes(requestV2)),body=responseV2(),value=receiveV2(200,bytes(body),q);
 assert.deepEqual(value,body);assert.equal(value.schemaVersion,USAGE_OVERVIEW_SCHEMA_V2);
 assert(Object.isFrozen(q)&&Object.isFrozen(value.periods[0]));
 assert.equal(usageOverviewMetadataV2.requestBytes,1024);assert.equal(usageOverviewMetadataV2.responseBytes,32768);
 assert.equal(usageOverviewMetadataV2.path,USAGE_OVERVIEW_PATH);assert.equal(usageOverviewMetadataV2.method,'POST');
});
test('generated successor receiver keeps numeric bounds closed and refuses promoted or hostile numbers',()=>{
 const q=admitV2(bytes(requestV2));
 for(const change of [v=>v.periods[0].attempts=Number.MAX_SAFE_INTEGER+1,v=>v.periods[0].knownChargeMicroUsd=-1,
  v=>v.periods[0].completedAttempts.microUsdPerCompletedAttempt=-1,v=>v.periods[0].counters.inputTokens=1.5,
  v=>v.monthlyAdmission.remainingKnownMicroUsd=-5,v=>v.queue.physicalConcurrency=1,v=>v.queue.availableCapacity=10,
  v=>v.policy.revision=0])assert.throws(()=>receiveV2(200,bytes(change(structuredClone(responseV2()))),q));
});
test('generated successor receiver keeps the body closed and carries no cross-row correlation identifier',()=>{
 const q=admitV2(bytes(requestV2)),body=responseV2();
 for(const change of [v=>v.privateDiagnostics='secret',v=>v.periods[0].extraAttempts=1,v=>v.coverage.providerBilledMicroUsd=0,
  v=>v.periods[0].lineage.other={attempts:0,chargeMicroUsd:0},v=>v.denominators.jobIdentity='complete',
  v=>v.periods[0].completedAttempts.jobIdentity='complete'])assert.throws(()=>receiveV2(200,bytes(change(structuredClone(body))),q));
 const text=JSON.stringify(receiveV2(200,bytes(body),q));
 for(const field of ['conversationId','runId','clientId','memberId','tenantId','actorId','requestId','toolCallId'])assert.equal(text.includes(field),false);
 assert.match(usageOverviewMetadataV2.scope,/tenant aggregate numbers only/u);
});
test('generated successor receiver preserves closed error bodies and refuses cross-version settlement',()=>{
 const q=admitV2(bytes(requestV2));
 assert.deepEqual(receiveV2(503,bytes({error:{code:'USAGE_OVERVIEW_UNAVAILABLE',outcome:'UNKNOWN'}}),q),{error:{code:'USAGE_OVERVIEW_UNAVAILABLE',outcome:'UNKNOWN'}});
 for(const [status,value] of [[403,{error:{code:'MEMBERSHIP_REVOKED',outcome:'UNKNOWN'}}],[400,{error:{code:'USAGE_OVERVIEW_UNAVAILABLE'}}],
  [503,{error:{code:'USAGE_OVERVIEW_UNAVAILABLE',outcome:'ACK'}}],[503,{error:{code:'NOT_A_PUBLIC_CODE'}}],[503,{error:{code:'USAGE_OVERVIEW_UNAVAILABLE',detail:'database-private'}}]])
  assert.throws(()=>receiveV2(status,bytes(value),q));
 // The successor receiver refuses the ordinary /1 request and response; the /1 receiver already refuses /2.
 assert.throws(()=>admitV2(bytes(request)));
 assert.throws(()=>receiveV2(200,bytes(response()),q));
 assert.throws(()=>receiveV2(200,bytes(responseV2()),admit(bytes(request))));
 assert.throws(()=>admitV2(new Uint8Array(1025)));assert.throws(()=>receiveV2(200,new Uint8Array(32769),q));
});
// The successor schema identity is resolvable on its own: its document carries the advertised 2.0.0 `$id`
// and the published metadata digest matches that document, distinct from the unchanged /1 document digest.
test('the successor schema identity resolves to its own document with a distinct digest',async()=>{
 const {readFile}=await import('node:fs/promises');const {createHash}=await import('node:crypto');
 const dist=new URL('../dist/',import.meta.url),sha=value=>createHash('sha256').update(value).digest('hex');
 const v1=await readFile(new URL('usage-overview.schema.json',dist),'utf8'),v2=await readFile(new URL('usage-overview-v2.schema.json',dist),'utf8');
 const metadata=JSON.parse(await readFile(new URL('conversation-usage.metadata.json',dist),'utf8'));
 assert.equal(JSON.parse(v1).$id,'urn:meri:usage-overview:1.0.0');
 assert.equal(JSON.parse(v2).$id,'urn:meri:usage-overview:2.0.0');
 assert.deepEqual(Object.keys(JSON.parse(v2).$defs),['UsageOverviewRequest2','UsageOverviewResponse2']);
 // The /1-named document is the EXACT document physically published by the immutable 0.1.25 and 0.1.26
 // packages: two defs and the published digest. Re-stating the successor shapes inside it is the defect
 // this assertion locks out, so a future edit cannot quietly change a published file's digest.
 assert.deepEqual(Object.keys(JSON.parse(v1).$defs),['UsageOverviewRequest','UsageOverviewResponse']);
 assert.equal(sha(v1),'4598cc036f6db179ca0c430df3a9859750d685e2e67e218a1666366e1cd1e52e');
 assert.notEqual(metadata.overview.schemaSha256,metadata.overviewV2.schemaSha256);
 assert.equal(metadata.overview.schemaSha256,sha(v1));
 assert.equal(metadata.overviewV2.schemaSha256,sha(v2));
 assert.equal(metadata.overviewV2.schemaId,JSON.parse(v2).$id);
});
