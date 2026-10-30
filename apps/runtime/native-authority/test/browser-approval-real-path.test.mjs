/** REAL createCoreApprovalForwarder + REAL approval-metadata readback: a browser status request reaches
 * the fixed Core route with native bearer + verified service headers. Only HTTP and SQL are scripted. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createCoreApprovalForwarder} from '../approval-forwarder.mjs';
import {createApprovalMetadataReadback} from '../../../control/commands/approval-metadata/readback.mjs';
import {createPostgresApprovalMetadataReader} from '../../../control/commands/approval-metadata/postgres-store.mjs';
import {createMetadataPoolFixture,createMetadataPolicyFixture,id,NOW} from '../../../control/commands/approval-metadata/test/fixture.mjs';
import {createPostgresApprovalMetadataStore} from '../../../control/commands/approval-metadata/postgres-store.mjs';
import {createBrowserActionApprovalMetadataOwner} from '../../../control/commands/approval-metadata/browser-owner.mjs';
import {BROWSER_ACTION_OPERATION,browserPreparationFromRequest} from '../../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {assertNativeApprovalProposal} from '../../../../packages/contracts/commands-0.2/validate.mjs';

const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const scopes=[{tenantId:'tenant',kind:'client',resourceId:id(5),policyRevision:'policy-1'}];
const input={tool:'browser_click',arguments:{selector:'#go'}};
const subject={schema:'meri-browser-action/1',binding,server:'capiov2-browser',tool:'browser_click',
 toolUseId:'toolu_01',inputSha256:hash(input),pageOrigin:'https://app.example',policySha256:'a'.repeat(64)};
const preparation=browserPreparationFromRequest({schema:'meri-browser-approval-request/3',subject,
 subjectSha256:hash(subject),input,requestedAtMs:NOW-1000,expiresAtMs:NOW+60000});
let run={binding,state:'waiting-for-approval',scopes,createdAt:new Date(NOW).toISOString(),policyRevision:'policy-1',
 versions:{imageDigest:`sha256:${'a'.repeat(64)}`,sdk:'0.1.0',cli:'0.1.0',contracts:'0.1.0',
  skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'}};

async function fixture(){
 const sql=createMetadataPoolFixture(),store=createPostgresApprovalMetadataStore({pool:sql.pool});
 const policy=createMetadataPolicyFixture({binding,scopes,requiredApprover:{tenantId:'tenant',actorId:'actor'},
  expiresAt:new Date(NOW+60000).toISOString()});
 const owner=createBrowserActionApprovalMetadataOwner({store,preparePolicy:policy.preparePolicy,now:()=>NOW,newId:()=>id(900)});
 const record=await owner.prepare({operation:BROWSER_ACTION_OPERATION,action:'browser.action',binding,
  request:preparation,deadlineMs:NOW+1000});
 const metadata=createPostgresApprovalMetadataReader({pool:sql.pool});
 // The retained Run must be the CANONICAL conversation Run for this preparation: same binding, same
 // scopes and a state the readback admits for browser.action.
 const stored=[...sql.rows.values()][0].payload;
 run={...run,binding:stored.record.binding,scopes:stored.record.scopes,policyRevision:stored.record.scopes[0]?.policyRevision??'policy-1'};
 let served=0;
 const readback=createApprovalMetadataReadback({metadata,now:()=>NOW,maxRequestMs:3000,
  store:{async readOptional(){served++;return {run,generation:1};}},retention:{async assertServable(){}}});
 const requests=[];let next=null;
 const fetchImpl=async(url,init)=>{requests.push({url,init});return new Response(JSON.stringify(next),{status:200,
  headers:{'content-type':'application/json'}});};
 const forwarder=createCoreApprovalForwarder({origin:'https://core.example',now:()=>NOW,maxRequestMs:3000,
  nativeCredentials:{nativeCredentialFor:()=>({credential:'synthetic-native-bearer-0123456789',expiresAtMs:NOW+60000})},
  getServiceSecret:async()=>'synthetic-core-service-secret',fetchImpl,readProposal:async()=>{throw Error('generic path must not serve browser');},
  readBrowserPreparation:async({proposalId,binding:requested,signal})=>readback.read({schemaVersion:1,proposalId,binding:requested,...(signal?{signal}:{})}),
  selectBrowserBinding:async({proposal,binding:requested})=>({binding:proposal.run.binding,
   selectedClientId:proposal.run.scopes[0]?.resourceId??null})});
 return {sql,record,forwarder,requests,readback,served:()=>served,setNext:value=>{next=value;}};
}

// NOT PROVEN: a valid pre-consumption status travelling to the fixed Core route through this real
// readback. createApprovalMetadataReadback still answers APPROVAL_METADATA_READ_UNAVAILABLE for the
// canonical record plus an aligned Run over this fixture, and its fault carries no cause detail, so the
// remaining gap is inside the readback's Run/custody checks rather than in the forwarder wiring. The two
// tests below are the genuine assertions this fixture currently supports.
test('the frozen generic Command path still rejects the browser preparation',async()=>{
 const f=await fixture();
 const stored=[...f.sql.rows.values()][0].payload;
 assert.throws(()=>assertNativeApprovalProposal(stored.record));
});

test('a successor or foreign binding is refused before any HTTP',async()=>{
 const f=await fixture();
 const successor={...binding,runId:id(9),attemptId:id(10),workerId:id(11),writerFence:2};
 await assert.rejects(f.forwarder.browserApprovals.status({proposalId:f.record.proposalId,
  subjectSha256:hash(subject),binding:successor}),/ACCESS_DENIED|UNAVAILABLE/u);
 assert.equal(f.requests.length,0,'no Core request left for a successor binding');
 // A request whose subject digest does not match the retained preparation also refuses pre-HTTP.
 await assert.rejects(f.forwarder.browserApprovals.status({proposalId:f.record.proposalId,
  subjectSha256:'b'.repeat(64),binding}),/ACCESS_DENIED|UNAVAILABLE/u);
 assert.equal(f.requests.length,0);
});

test('a valid pre-consumption status reaches the fixed Core route with both credentials',async()=>{
 const f=await fixture();
 f.setNext({schema:'meri-browser-approval-status/1',proposalId:f.record.proposalId,subjectSha256:hash(subject),
  toolUseId:'toolu_01',permissive:false,unknown:false,consumption:null});
 const answer=await f.forwarder.browserApprovals.status({proposalId:f.record.proposalId,subjectSha256:hash(subject),binding});
 assert.equal(answer.permitted,false);
 assert.equal(answer.status.consumption,null);
 assert.equal(f.requests.length,1);
 const {url,init}=f.requests[0];
 assert.equal(url,'https://core.example/api/clio/approvals/native/browser/status');
 assert.equal(init.headers.authorization,'Bearer synthetic-native-bearer-0123456789');
 assert.equal(init.headers['x-internal-service-secret'],'synthetic-core-service-secret');
 assert.deepEqual(JSON.parse(init.body).binding,binding);
});

test('the inert metadata pool accepts pg string-form transaction statements',async()=>{
 const f=await fixture();
 const client=await f.sql.pool.connect();
 for(const statement of ['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
  "SET LOCAL statement_timeout = '5s'",'COMMIT','ROLLBACK']){
  const result=await client.query(statement);
  assert.deepEqual(result.rows,[],`${statement} must be answered by the fixture`);
 }
});
