import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {validateConfiguration} from '../../config.mjs';
import {agentcoreControlFixture} from '../../test/agentcore-fixture.mjs';
import {createSettingsPoolFixture} from '../../../control/settings/test/postgres-store-fixture.mjs';
import {DEFAULT_BROWSER_PLATFORM,compileBrowserPlatform,createRunBrowserPolicy,createConfiguredRunBrowserPolicy} from '../browser-policy.mjs';
const binding={tenantId:'policy-test',actorId:'actor-test',conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
const scopes=[{kind:'private-user',tenantId:binding.tenantId,resourceId:binding.actorId,policyRevision:'revision-1'}];
const request=(extra={})=>({binding,scopes,actorRole:'standard_user',...extra});
const platform=()=>{const p=structuredClone(DEFAULT_BROWSER_PLATFORM);for(const value of [p.maximum,p.defaults,...Object.values(p.roleCeilings)])value.allowedOrigins=['https://records.example','https://notices.example'];return p;};

test('configured reader uses canonical PostgreSQL store and rereads tenant restrictions',async()=>{
 const document={defaultTimezone:'UTC',capabilityPolicy:{},browserPolicy:{browser:{allowedOrigins:['https://records.example']}}};
 const steps=rows=>({steps:[{match:/^SELECT \* FROM meri_settings.tenant_settings WHERE tenant_id=\$1$/u,rows,inspect:p=>assert.deepEqual(p,[binding.tenantId])}]});
 const f=createSettingsPoolFixture([steps([]),steps([{revision:1,document,document_sha256:hash(document)}])]);
 const read=createConfiguredRunBrowserPolicy({browserPlatform:platform()},{pool:f.pool});
 assert.equal((await read(request())).allowedOrigins.length,2);
 assert.deepEqual((await read(request())).allowedOrigins,['https://records.example']);assert.equal(f.connections(),2);
});
test('current role and tenant role restrictions cannot widen the platform',async()=>{
 const p=platform();p.roleCeilings.standard_user.allowedOrigins=['https://records.example'];
 let document={browserPolicy:{roles:{user_admin:{browser:'invalid'}}}};
 const read=createRunBrowserPolicy({platform:p,store:{read:async()=>({document})}});
 await assert.rejects(read(request()));document={browserPolicy:{roles:{user_admin:{allowedOrigins:['https://notices.example']}}}};
 assert.deepEqual((await read(request())).allowedOrigins,['https://records.example']);
 assert.deepEqual((await read(request({actorRole:'user_admin'}))).allowedOrigins,['https://notices.example']);
 document={browserPolicy:{browser:{allowedOrigins:['https://outside.example']}}};await assert.rejects(read(request()),{code:'BROWSER_TENANT_WIDENING_REFUSED'});
 document={browserPolicy:{browser:{enabled:false}}};assert.deepEqual(await read(request()),{enabled:false});
});
test('only absent row/field inherits defaults; corrupt, foreign, cancelled and expired inputs refuse',async()=>{
 let saved=null,reads=0;const read=createRunBrowserPolicy({platform:DEFAULT_BROWSER_PLATFORM,store:{async read(){reads++;return saved;}}});
 assert.deepEqual((await read(request())).allowedOrigins,[]);saved={document:{capabilityPolicy:{}}};assert.equal((await read(request())).enabled,true);
 for(const value of [undefined,{}, {document:null},{document:{browserPolicy:null}},{document:{browserPolicy:{browser:{enabled:'yes'}}}}]){saved=value;await assert.rejects(read(request()));}
 const before=reads;
 for(const value of [request({actorRole:'guest'}),request({scopes:[{...scopes[0],tenantId:'foreign'}]}),request({signal:AbortSignal.abort()}),request({deadlineMs:Date.now()-1}),request({deadlineMs:String(Date.now()+1000)}),{...request(),policy:platform()}])await assert.rejects(read(value));
 assert.equal(reads,before);
 const bad=createSettingsPoolFixture([{steps:[{match:/^SELECT \*/,rows:[{revision:1,document:{},document_sha256:'0'.repeat(64)}]}]}]);
 await assert.rejects(createConfiguredRunBrowserPolicy({},{pool:bad.pool})(request()),/SETTINGS_STORE_STATE/u);
});
test('in-flight cancellation withholds a late settings result',async()=>{
 const pending=Promise.withResolvers(),started=Promise.withResolvers(),controller=new AbortController();
 const read=createRunBrowserPolicy({platform:platform(),store:{read(){started.resolve();return pending.promise;}}});
 const result=read(request({signal:controller.signal}));await started.promise;controller.abort();
 await assert.rejects(result,{code:'CANCELLED'});pending.resolve(null);
});
test('Control accepts validated browserPlatform only; missing config approves no external origins',()=>{
 assert.deepEqual(compileBrowserPlatform({}),DEFAULT_BROWSER_PLATFORM);
 const c=agentcoreControlFixture().configuration;
 assert.doesNotThrow(()=>validateConfiguration({...c,browserPlatform:platform()},'control'));
 for(const p of [null,{}, {...platform(),extra:true},{...platform(),maximum:{enabled:true,allowedOrigins:['http://127.0.0.1']}}]){
  assert.throws(()=>compileBrowserPlatform({browserPlatform:p}),{code:'BROWSER_PLATFORM_CONFIGURATION'});
  assert.throws(()=>validateConfiguration({...c,browserPlatform:p},'control'));
 }
});
