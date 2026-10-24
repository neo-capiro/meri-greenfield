/** Actual fixed HTTP/decoder composition over synthetic Core replies; no live credentials or Core process. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createObjectiveCorePorts} from './core-ports.mjs';
import {coreRepliesFixture,NOW} from '../../control/objective-generation/test/core-replies-fixture.mjs';
import {id} from '../objective-source/test/run-start-fixture.mjs';

function fixture(){
 const f=coreRepliesFixture(),state={calls:[],secretReads:0,record:f.record,savedState:'STARTED',time:NOW,status:200};
 const a=f.admission;
 state.current={schemaVersion:1,generationJobId:f.source.generationJobId,tenantId:f.source.binding.tenantId,actorId:f.source.binding.actorId,
  clerkUserId:a.clerkUserId,clientId:a.canonical.clientId,role:'standard_user',consentId:a.consentId,controlVersion:a.controlVersion,checkedAtMs:NOW,effectExpiresAtMs:a.effectExpiresAtMs};
 state.acceptance=f.replies.accept();
 const ports=createObjectiveCorePorts({origin:'https://core.synthetic.invalid',now:()=>state.time,maxRequestMs:100,
  getServiceSecret:async()=>{state.secretReads++;return 'synthetic-objective-service-secret';},
  runStarts:{async read(){return state.savedState==='ABSENT'?{state:'ABSENT'}:{state:state.savedState,record:state.record};}},
  fetchImpl:async(url,options)=>{state.calls.push({url,options});
   if(state.failure)throw Error('synthetic-network-loss');
   if(url.endsWith('/current'))return Response.json(state.current,{status:state.status});
   if(url.includes('/generation-acceptances'))return Response.json(state.acceptance,{status:state.status===200?201:state.status});
   if(url.includes('/generation-admissions/'))return Response.json({...f.replies.admissionRead(),acceptance:{availability:'available',value:state.acceptance}},{status:state.status});
   throw Error('unexpected route');
  }});
 return {f,state,ports};
}

test('saved Objective current uses one job-only service request and actual actor UUID, without an interactive bearer',async()=>{
 const x=fixture(),r=await x.ports.forBinding({binding:x.f.source.binding});
 assert.deepEqual(r,{record:x.f.record,current:x.state.current});assert.equal(x.state.calls.length,1);assert.equal(x.state.secretReads,1);
 const {url,options}=x.state.calls[0];assert.equal(url,'https://core.synthetic.invalid/api/internal/objective-generation/current');
 assert.deepEqual(JSON.parse(options.body),{schemaVersion:1,generationJobId:x.f.source.generationJobId});assert.equal(options.method,'POST');
 assert.equal(options.headers.authorization,undefined);assert.equal(options.headers['x-internal-service-secret'],'synthetic-objective-service-secret');
 assert.equal(options.redirect,'error');assert.equal(r.current.actorId,x.f.admission.actorUserId);assert.notEqual(r.current.actorId,r.current.clerkUserId);
});

test('genuine absence leaves ordinary chat selection alone; ambiguous or foreign records never fall back',async()=>{
 const x=fixture();x.state.savedState='ABSENT';assert.equal(await x.ports.forBinding({binding:x.f.source.binding}),null);assert.equal(x.state.calls.length,0);
 for(const state of ['UNKNOWN','PENDING','MISSING']){const y=fixture();y.state.savedState=state;await assert.rejects(y.ports.forBinding({binding:y.f.source.binding}));assert.equal(y.state.calls.length,0);}
 const y=fixture();await assert.rejects(y.ports.forBinding({binding:{...y.f.source.binding,actorId:id(88)}}));assert.equal(y.state.calls.length,0);
});

for(const [field,value] of [['generationJobId',id(88)],['tenantId',id(88)],['actorId',id(88)],['clientId',id(88)],['consentId',id(88)],['controlVersion',2],['effectExpiresAtMs',NOW+1],['checkedAtMs',NOW-1],['checkedAtMs',NOW+1],['clerkUserId',''],['role',''],['extra','unrecognised']]){
 test('Core current refuses changed or malformed '+field+'='+String(value),async()=>{const x=fixture();x.state.current[field]=value;await assert.rejects(x.ports.currentRecord({record:x.f.record}));});
}
test('revocation, expired consent, cancellation and unavailable Core cannot authorize a background job',async()=>{
 for(const status of [401,403,404,409,500]){const x=fixture();x.state.status=status;await assert.rejects(x.ports.currentRecord({record:x.f.record}));}
 const x=fixture();x.state.time=x.f.record.effectExpiresAtMs;await assert.rejects(x.ports.currentRecord({record:x.f.record}));
 const y=fixture();y.state.failure=true;await assert.rejects(y.ports.currentRecord({record:y.f.record}));
 const z=fixture(),a=new AbortController();a.abort();await assert.rejects(z.ports.currentRecord({record:z.f.record,signal:a.signal}));assert.equal(z.state.calls.length,0);
});
test('acceptance and readback compare actual saved request/binding/original deadline',async()=>{
 const x=fixture();assert.deepEqual(await x.ports.accept({record:x.f.record}),x.state.acceptance);
 assert.deepEqual(await x.ports.readAcceptance({record:x.f.record}),x.state.acceptance);
 for(const [key,value] of [['sourceAdmissionSha256','0'.repeat(64)],['sourceRequestSha256','0'.repeat(64)],['sourceBinding',{...x.f.source.binding,runId:id(88)}],['effectExpiresAtMs',x.f.record.effectExpiresAtMs+1]]){
  const y=fixture();y.state.acceptance[key]=value;await assert.rejects(y.ports.accept({record:y.f.record}));await assert.rejects(y.ports.readAcceptance({record:y.f.record}));
 }
});
test('lost acceptance acknowledgement is UNKNOWN and does not cause an automatic effect retry',async()=>{
 const x=fixture();x.state.failure=true;
 await assert.rejects(x.ports.accept({record:x.f.record}),/OBJECTIVE_GENERATION_CORE_OUTCOME_UNKNOWN/u);assert.equal(x.state.calls.length,1);
 x.state.failure=false;assert.deepEqual(await x.ports.readAcceptance({record:x.f.record}),x.state.acceptance);
 assert.equal(x.state.calls.length,2);assert.equal(x.state.calls[1].options.method,'GET');
});
