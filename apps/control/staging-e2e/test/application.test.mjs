/** Real Fetch application/session/artifact composition; no DNS or staging claim. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createStagingE2EClient} from '../client.mjs';
import {applicationFixture,id} from '../../conversations/test/application-fixture.mjs';
import {createLocalDocumentFixture} from '../../document-application/local/fixture.mjs';
import {createDocumentApplication} from '../../document-application/index.mjs';
const origin='https://staging.example.invalid',sourceCommit='a'.repeat(40);
function setup({sessions,credential,app,binding,scopes,clientId}){
 let calls=0;
 const client=createStagingE2EClient({target:{baseUrl:origin+'/',sourceCommit,automation:{tenantId:binding.tenantId,actorId:binding.actorId,clientId,conversationIds:[binding.conversationId]},manual:{clientId:id(990),conversationIds:[id(991)]}},
  verifyCandidate:async()=>({origin,sourceCommit,imageDigest:'sha256:'+'b'.repeat(64)}),
  async readCurrentContext({signal}){const authentication=await sessions.authenticateSession({credential,signal}),c=await sessions.readCurrentState({authentication,signal});return {binding:c.binding,scopes:c.scopes,selectedClientId:c.selectedClientId,checkedAtMs:c.checkedAtMs,expiresAtMs:c.expiresAtMs};},
  authenticatedFetch(request){calls++;const headers=new Headers(request.headers);headers.set('authorization',`Bearer ${credential}`);return app.handle(new Request(request,{headers}));}});
 return {client,calls:()=>calls};
}
test('existing conversation Fetch routes reuse opaque session and stop before fetch after revocation',async t=>{
 const f=await applicationFixture();t.after(()=>f.close());const p=setup({sessions:f.sessions,credential:f.credential,app:f.app,...f.state.context,clientId:f.state.context.selectedClientId});t.after(()=>p.client.close());
 const created=await p.client.request({family:'conversation',route:'submit',input:f.input});assert.equal(created.run.state,'queued');
 const history=await p.client.request({family:'conversation',route:'history',input:{}});assert.equal(history.run.binding.runId,created.run.binding.runId);
 const cancelled=await p.client.request({family:'conversation',route:'cancel',input:{}});assert.equal(cancelled.state,'cancelled');assert.equal(f.state.cancels,1);
 const before=p.calls();f.state.revoked=true;await assert.rejects(p.client.request({family:'conversation',route:'history',input:{}}));assert.equal(p.calls(),before);assert.equal(p.client.status().ownedVersions,0);
});
test('existing artifact owners create/revise/inspect/hash-check both downloads and exclude unowned versions',async t=>{
 const python=process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
 const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:python});t.after(()=>f.close());
 const app=createDocumentApplication({sessions:f.sessions,selectedClientId:f.selectedClientId,artifactOptions:f.artifactOptions,credential:f.credential,now:f.now,limits:f.limits,enabled:true}),issued=await f.sessions.issue({identityCredential:f.nativeCredential}),context=f.artifactOptions.context;
 const p=setup({sessions:f.sessions,credential:issued.credential,app,...context,clientId:f.selectedClientId});t.after(()=>p.client.close());
 const spec={operation:'create_word',format:'txt',title:'Automation owned probe',content:{text:'First automation version.\n'}};
 const first=await p.client.request({family:'document',route:'create',input:{deliveryId:'staging-auto-one',request:spec}});
 const second=await p.client.request({family:'document',route:'revise',input:{deliveryId:'staging-auto-two',baseVersionId:first.version.versionId,request:{...spec,content:{text:'Second automation version.\n'}}}});
 assert.equal(second.version.parentVersionId,first.version.versionId);assert.equal(p.client.status().ownedVersions,2);
 for(const version of[first.version,second.version]){const inspected=await p.client.request({family:'document',route:'inspect',input:{versionId:version.versionId}});assert(inspected.inspection.currentBytesVerified);const downloaded=await p.client.request({family:'document',route:'download',input:{versionId:version.versionId}});assert.equal(downloaded.version.object.sha256,version.object.sha256);assert(downloaded.bytes.length>0);}
 const before=p.calls();await assert.rejects(p.client.request({family:'document',route:'download',input:{versionId:id(991)}}),/STAGING_UNOWNED_VERSION/);assert.equal(p.calls(),before);
 f.revoke();await assert.rejects(p.client.request({family:'document',route:'download',input:{versionId:first.version.versionId}}));assert.equal(p.calls(),before);assert.equal(f.stats().generations,2);
});
