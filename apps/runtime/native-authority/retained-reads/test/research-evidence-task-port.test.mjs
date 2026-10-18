import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,portfolioId,recordId,operation} from '../../../../gateway/test/research-evidence-fixtures.mjs';
import {NOW,uuid} from '../../../../gateway/test/fixtures.mjs';
import {createResearchPortfolioEvidenceHttpAdapter} from '../../../../gateway/sources/research-portfolio-evidence/http-adapter.mjs';
import {createResearchEvidenceTaskPorts} from '../research-evidence-task-port.mjs';

const coreOrigin='https://core.synthetic.invalid';
function taskFor(f){
 const scope={tenantId:f.binding.tenantId,kind:'client',resourceId:uuid('d'),policyRevision:f.claims.policyRevision};
 f.subject.scopes=[scope];f.claims.scopes=[scope];
 return {binding:f.binding,original:{binding:structuredClone(f.binding),expiresAtMs:NOW+5000},scopes:[scope],
  taskCapability:'SYNTHETIC_TASK_CAPABILITY',sourceEnabled:true,
  grant:{binding:structuredClone(f.binding),qualificationBinding:{policyRevision:f.claims.policyRevision}},
  approvedReads:{enabled:true,operations:[operation],maxExecuteMs:2000,maxResponseBytes:65536}};
}
function producer(f,overrides={}){
 return createResearchEvidenceTaskPorts({coreOrigin,fetchImpl:f.config.fetchImpl,now:()=>f.state.now,
  maxRequestMs:1000,maxResponseBytes:65536,enabled:true,...overrides});
}
function call(f,ports){
 const adapter=createResearchPortfolioEvidenceHttpAdapter(ports.families['research-portfolio-evidence']);
 const {input}=f.entry.contract.normalizeInput(f.raw,{binding:f.binding,subject:f.subject});
 return adapter.read({input,authority:{binding:f.binding,subject:f.subject,claims:f.claims,
  policyRevision:f.claims.policyRevision,deadlineMs:NOW+1000}});
}

for(const kind of ['review','snapshot','current_continuity'])test(`task evidence port reads Core's fixed ${kind} GETs with a fresh task-bound bearer`,async()=>{
 const f=setup(kind),task=taskFor(f),seen=[];
 const ports=producer(f)({task,getNativeCredentialWithExpiry:async request=>{
  seen.push(request);assert.deepEqual(request.binding,f.binding);
  assert.equal(request.selectedClientId,task.scopes[0].resourceId);
  assert.equal(request.portfolioId,portfolioId);
  assert.deepEqual(request.subject,f.subject);
  return {credential:'SYNTHETIC_USER_BEARER',expiresAtMs:NOW+2500};
 }});
 assert.equal(seen.length,0);assert.equal(f.wire.length,0);
 assert.equal(ports.families['research-portfolio-evidence'].origin,coreOrigin);
 const page=await call(f,ports);
 assert.equal(page.data.origin,kind);assert.equal(page.data.portfolioId,portfolioId);
 assert.equal(page.data.coverage.corpusComplete,false);
 assert.equal(seen.length,kind==='review'?4:1);
 const root=`/api/research-portfolios/${portfolioId}`;
 const paths=kind==='review'?['mine','team','deferred','resolved'].map(lane=>`${root}/reviews?lane=${lane}`):
  [kind==='snapshot'?`${root}/snapshots/${recordId}`:`${root}/annual-review`];
 assert.deepEqual(f.wire.map(row=>new URL(row.url).pathname+new URL(row.url).search),paths);
 for(const row of f.wire){assert.equal(row.options.method,'GET');assert.equal(row.options.body,undefined);
  assert.equal(row.options.headers.authorization,'Bearer SYNTHETIC_USER_BEARER');
  assert.equal(row.options.headers['x-internal-service-secret'],undefined);}
});

test('task evidence port refuses disabled config, wrong task/client, and missing approved operation before I/O',()=>{
 const f=setup(),task=taskFor(f),bearer=async()=>({credential:'SYNTHETIC',expiresAtMs:NOW+1000});
 assert.throws(()=>createResearchEvidenceTaskPorts()({task,getNativeCredentialWithExpiry:bearer}),{message:'UNAVAILABLE'});
 for(const key of ['coreOrigin','fetchImpl','now','maxRequestMs','maxResponseBytes'])
  assert.throws(()=>producer(f,{[key]:undefined})({task,getNativeCredentialWithExpiry:bearer}));
 assert.throws(()=>producer(f)({task:{...task,original:{...task.original,binding:{...task.binding,actorId:'foreign'}}},getNativeCredentialWithExpiry:bearer}));
 assert.throws(()=>producer(f)({task:{...task,scopes:[{...task.scopes[0],resourceId:uuid('e')},{...task.scopes[0]}]},getNativeCredentialWithExpiry:bearer}));
 assert.throws(()=>producer(f)({task:{...task,scopes:[{...task.scopes[0],tenantId:'foreign-tenant'}]},getNativeCredentialWithExpiry:bearer}));
 assert.throws(()=>producer(f)({task:{...task,scopes:[{...task.scopes[0],policyRevision:'foreign-policy'}]},getNativeCredentialWithExpiry:bearer}));
 assert.throws(()=>producer(f)({task:{...task,approvedReads:{...task.approvedReads,operations:[]}},getNativeCredentialWithExpiry:bearer}));
 assert.throws(()=>producer(f)({task,getNativeCredential:bearer}));
 assert.equal(f.wire.length,0);
});

test('task evidence port refuses mismatched client scope, non-Portfolio subject and string bearer before any GET',async()=>{
 const f=setup(),task=taskFor(f),seen=[];
 const ports=producer(f)({task,getNativeCredentialWithExpiry:async request=>{seen.push(request);return 'STRING_ONLY';}});
 await assert.rejects(call(f,ports));assert.equal(f.wire.length,0);assert.equal(seen.length,1);
 const get=ports.families['research-portfolio-evidence'].getCredentials;
 await assert.rejects(get({binding:f.binding,subject:{...f.subject,scopes:[{...task.scopes[0],resourceId:uuid('e')}]},deadlineMs:NOW+1000}));
 await assert.rejects(get({binding:f.binding,subject:{...f.subject,scopes:[...f.subject.scopes,{...task.scopes[0],resourceId:uuid('e')}]},deadlineMs:NOW+1000}));
 await assert.rejects(get({binding:f.binding,subject:{...f.subject,policyRevision:'foreign-policy'},deadlineMs:NOW+1000}));
 await assert.rejects(get({binding:f.binding,subject:{...f.subject,kind:'client',entityType:'client'},deadlineMs:NOW+1000}));
 await assert.rejects(get({binding:{...f.binding,runId:uuid('e')},subject:f.subject,deadlineMs:NOW+1000}));
 assert.equal(seen.length,1);assert.equal(f.wire.length,0);
});

test('task evidence port stops a four-lane review when the live bearer expires',async()=>{
 const f=setup(),task=taskFor(f),expiresAtMs=NOW+50,fetch=f.config.fetchImpl;
 const ports=producer(f,{fetchImpl:async(url,init)=>{const result=await fetch(url,init);f.state.now=expiresAtMs;return result;}})({
  task,getNativeCredentialWithExpiry:async()=>({credential:'SYNTHETIC_USER_BEARER',expiresAtMs})});
 await assert.rejects(call(f,ports));assert.equal(f.wire.length,1);
});
