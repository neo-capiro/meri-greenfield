/** REAL intentsComposition + bindApprovalSessions + createActionSessionOwner, exercising the actual
 * browser approval ports. Only SQL, HTTP and identity/retention are synthetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {intentsComposition} from '../../product-ports/intents.mjs';
import {bindApprovalSessions} from '../approval-forwarder.mjs';
import {createActionSessionOwner} from '../../../control/action-host/session/owner.mjs';
import {createPostgresApprovalMetadataStore} from '../../../control/commands/approval-metadata/postgres-store.mjs';
import {createBrowserActionApprovalMetadataOwner} from '../../../control/commands/approval-metadata/browser-owner.mjs';
import {createMetadataPoolFixture,createMetadataPolicyFixture,id,NOW} from '../../../control/commands/approval-metadata/test/fixture.mjs';
import {BROWSER_ACTION_OPERATION,browserPreparationFromRequest} from '../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../../packages/contracts/validate.mjs';

const binding={tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),attemptId:id(5),workerId:id(6),writerFence:1};
const clientId=id(7);
const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:'policy-1'}];
const tool='browser_click',input={tool,arguments:{selector:'#go'}};

function runtimeRun(){
 const run={state:'waiting-for-approval',createdAt:new Date(NOW).toISOString(),policyRevision:'policy-1',
  versions:{imageDigest:`sha256:${'a'.repeat(64)}`,sdk:'0.1.0',cli:'0.1.0',contracts:'0.1.0',
   skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'},binding,scopes};
 validateShape('Run',run);
 return run;
}

async function fixture(t){
 const sql=createMetadataPoolFixture();
 const store0=createPostgresApprovalMetadataStore({pool:sql.pool});
 const policy=createMetadataPolicyFixture({binding,scopes,requiredApprover:{tenantId:binding.tenantId,actorId:binding.actorId},
  expiresAt:new Date(NOW+60000).toISOString()});
 const owner=createBrowserActionApprovalMetadataOwner({store:store0,preparePolicy:policy.preparePolicy,now:()=>NOW,newId:()=>id(900)});
 const state={clock:NOW,revoked:false,retentionRefused:false,requests:[],answers:new Map()};
 const subject={schema:'meri-browser-action/1',binding,server:'capiov2-browser',tool,toolUseId:'toolu_01',
  inputSha256:hash(input),pageOrigin:'https://app.example',policySha256:'c'.repeat(64)};
 const preparation=browserPreparationFromRequest({schema:'meri-browser-approval-request/3',subject,
  subjectSha256:hash(subject),input,requestedAtMs:NOW-1000,expiresAtMs:NOW+600000});
 const record=await owner.prepare({operation:BROWSER_ACTION_OPERATION,action:'browser.action',binding,
  request:preparation,deadlineMs:NOW+1000});
 const run=runtimeRun();
 const now=()=>state.clock;
 const principal={tenantId:binding.tenantId,actorId:binding.actorId};
 const store={async readOptional(){return {run:structuredClone(run),generation:1};},
  history:{async transcript(){return {latestRun:structuredClone(run),pendingTurn:null};}}};
 const retention={async assertServable(){if(state.retentionRefused)throw Error('RETENTION_REFUSED');}};
 const sessions=createActionSessionOwner({mode:'process-local',now,
  limits:{maxSessions:8,maxRequestMs:3000,maxTtlMs:120000,maxFactBytes:65536},
  async verifyIdentity({credential}){
   if(state.revoked||credential!=='synthetic-browser-user')throw Error('IDENTITY_REFUSED');
   return {principal,identityRevision:'fixture',checkedAtMs:now(),expiresAtMs:now()+120000};
  },
  async resolveContext({identity}){
   if(state.revoked)throw Error('SESSION_REFUSED');
   return {binding:structuredClone(binding),scopes:structuredClone(scopes),selectedClientId:clientId,
    identitySha256:hash(identity),contextRevision:'fixture',checkedAtMs:now(),expiresAtMs:now()+120000};
  }});
 const issued=await sessions.issue({identityCredential:'synthetic-browser-user'});
 t.after(()=>sessions.close?.());
 const gate={async admit(){return {principal,principalSha256:hash(principal),membershipRevision:'fixture',expiresAtMs:now()+600000};},
  async authorize(){return true;},
  async recheck(){return {principal,principalSha256:hash(principal),membershipRevision:'fixture',expiresAtMs:now()+600000};}};
 const context={configuration:{intents:{enabled:true,core:{origin:'https://core.example',serviceSecretFile:'C:/synthetic/core'}},
   limits:{requestMs:5000,requestBytes:131072},native:{maxResponseBytes:1048576},retention:{enabled:true}},
  pool:sql.pool,now,client:{},native:{call(){assert.fail('legacy native call');}},
  canonicalProductPorts:{conversationMembership:gate}};
 const shared=intentsComposition(context,{transport:{
  async readSecret(){return Buffer.from('synthetic-core-service-secret');},
  async fetchImpl(url,init){
   state.requests.push({url,headers:{...init.headers},body:JSON.parse(init.body)});
   const canned=state.answers.get(new URL(url).pathname.split('/').pop());
   if(canned instanceof Error)throw canned;
   return Response.json(canned,{status:200,headers:{'content-type':'application/json'}});
  }}});
 assert.equal(bindApprovalSessions(context,sessions,retention,store),true,'production composition must bind');
 const ports=shared.browser;
 assert.ok(ports,'the composition must expose the browser approval ports');
 const answerFor=(kind,value)=>state.answers.set(kind,value);
 const statusDoc=(overrides={})=>({schema:'meri-browser-approval-status/1',proposalId:record.proposalId,
  subjectSha256:hash(subject),toolUseId:subject.toolUseId,permissive:false,unknown:false,consumption:null,...overrides});
 return {sql,record,subject,run,ports,state,answerFor,statusDoc,issued,sessions,
  revoke:()=>{state.revoked=true;},refuseRetention:()=>{state.retentionRefused=true;}};
}

test('a valid pre-consumption status reaches the fixed Core route through the real composition',async(t)=>{
 const f=await fixture(t);
 f.answerFor('status',f.statusDoc());
 const answer=await f.ports.status({proposalId:f.record.proposalId,subjectSha256:hash(f.subject),binding});
 assert.equal(answer.permitted,false);
 assert.equal(answer.status.consumption,null);
 assert.equal(f.state.requests.length,1);
 const {url,headers,body}=f.state.requests[0];
 assert.equal(url,'https://core.example/api/clio/approvals/native/browser/status');
 assert.match(headers.authorization,/^Bearer \S+$/u);
 assert.equal(headers['x-internal-service-secret'],'synthetic-core-service-secret');
 assert.equal(body.proposalId,f.record.proposalId);
 assert.equal(body.subjectSha256,hash(f.subject));
 assert.deepEqual(body.binding,binding);
});

test('a successor run/attempt/worker/fence and a wrong subject refuse before any Core request',async(t)=>{
 const f=await fixture(t);
 const successor={...binding,runId:id(20),attemptId:id(21),workerId:id(22),writerFence:2};
 await assert.rejects(f.ports.status({proposalId:f.record.proposalId,subjectSha256:hash(f.subject),binding:successor}),
  /ACCESS_DENIED|UNAVAILABLE/u);
 await assert.rejects(f.ports.status({proposalId:f.record.proposalId,subjectSha256:'d'.repeat(64),binding}),
  /ACCESS_DENIED|UNAVAILABLE/u);
 assert.equal(f.state.requests.length,0);
});

test('a genuinely revoked action session cannot produce an answer',async(t)=>{
 const f=await fixture(t);
 f.answerFor('status',f.statusDoc());
 // REAL revocation of the issued session, not a fixture flag.
 f.sessions.revoke(f.issued.credential);
 await assert.rejects(f.ports.status({proposalId:f.record.proposalId,subjectSha256:hash(f.subject),binding}),
  /ACCESS_DENIED|UNAVAILABLE|SESSION/u);
 assert.equal(f.state.requests.length,0);
});
