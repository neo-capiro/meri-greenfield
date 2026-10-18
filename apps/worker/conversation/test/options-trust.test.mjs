/** The SDK subprocess env replaces process.env: its one extra TLS anchor is the pinned runner CA runtime fact, never a free path. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildConversationOptions} from '../options.mjs';
import {projectNativeSdkOptions} from '../../../runtime/native-authority/sdk-option-projection.mjs';
import {RUNNER_SDK_CA_FILE} from '../../../runtime/native-authority/preparation-intent.mjs';
import {PRODUCT_PROXY_MODEL_ALIAS} from '../../../proxy/product/startup-config.mjs';
import {binding,versions} from '../../../control/conversations/test/application-fixture.mjs';
const runtime=extra=>({binding,versions,cwd:`/workspace/conversations/${binding.conversationId}`,proxyUrl:'https://proxy.meri.internal:8443',proxyCredential:'synthetic-task-capability',model:'qualified-model-pin',sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+1000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:1024,...extra});
const directories={sdkConfigDirectory:'/task/config/sdk-run',sdkSecureStorageDirectory:'/task/secure'};
test('the pinned runner CA reaches the SDK subprocess env exactly once and is covered by the SDK options digest',()=>{
 const o=buildConversationOptions(runtime({...directories,sdkCaFile:RUNNER_SDK_CA_FILE}),new AbortController());
 assert.equal(o.env.NODE_EXTRA_CA_CERTS,'/run/meri/poststart/bootstrap/control-ca.pem');
 assert.equal(o.env.ANTHROPIC_BASE_URL,'https://proxy.meri.internal:8443/');
 assert.ok(Object.values(o.env).every(v=>typeof v==='string'));
 const without=buildConversationOptions(runtime(directories),new AbortController());
 assert.ok(!Object.hasOwn(without.env,'NODE_EXTRA_CA_CERTS'));
 assert.equal(projectNativeSdkOptions(o).env.NODE_EXTRA_CA_CERTS,RUNNER_SDK_CA_FILE);
 assert.notDeepEqual(projectNativeSdkOptions(o),projectNativeSdkOptions(without));
});
test('any other CA path, or a CA without the admitted per-task SDK directories, refuses',()=>{
 for(const sdkCaFile of ['/tmp/attacker.pem','/run/meri/poststart/tls/runner-ca.pem','/opt/meri/certs/rds-global-bundle.pem','',null,1])
  assert.throws(()=>buildConversationOptions(runtime({...directories,sdkCaFile}),new AbortController()),/RUNTIME_CONFIGURATION/,String(sdkCaFile));
 assert.throws(()=>buildConversationOptions(runtime({sdkCaFile:RUNNER_SDK_CA_FILE}),new AbortController()),/RUNTIME_CONFIGURATION/);
});
test('public SDK controls identify the fixed proxy model and keep schema, tool and budget authority intact',()=>{
 const r=runtime({model:PRODUCT_PROXY_MODEL_ALIAS}),schema={type:'object',properties:{answer:{type:'string'}},required:['answer'],additionalProperties:false};
 const format={type:'json_schema',schema},o=buildConversationOptions(r,new AbortController(),undefined,undefined,undefined,undefined,undefined,undefined,format);
 assert.equal(o.model,PRODUCT_PROXY_MODEL_ALIAS);assert.deepEqual(o.settings,{autoMemoryEnabled:false,modelOverrides:{'claude-sonnet-4-6':PRODUCT_PROXY_MODEL_ALIAS}});
 assert.deepEqual(o.thinking,{type:'disabled'});assert.equal(o.env.DISABLE_PROMPT_CACHING,'1');assert.equal(o.env.CLAUDE_CODE_EFFORT_LEVEL,'unset');
 assert.equal(o.env.CLAUDE_CODE_MODEL_CAPABILITIES,undefined);assert.equal(o.env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS,undefined);
 assert.deepEqual(o.outputFormat,format);assert.deepEqual(o.tools,[]);assert.deepEqual(o.allowedTools,[]);assert.equal(o.maxBudgetUsd,r.maxCostMicroUSD/1000000);assert.equal(o.maxTurns,r.maxTurns);
 const projected=projectNativeSdkOptions(o);assert.deepEqual(projected.thinking,{type:'disabled'});assert.deepEqual(projected.settings,o.settings);assert.equal(projected.env.DISABLE_PROMPT_CACHING,'1');
 const {thinking,...old}=o;assert.notDeepEqual(projectNativeSdkOptions(old),projected,'disabled thinking is included in the measured options');
});
test('the native options projection refuses every enabled or malformed thinking setting without invoking getters',()=>{
 let reads=0,traps=0;
 for(const thinking of [null,{},'disabled',{type:'adaptive'},{type:'enabled',budgetTokens:1},{type:'disabled',budgetTokens:0},{type:'disabled',extra:true},{get type(){reads++;return 'disabled';}},new Proxy({type:'disabled'},{ownKeys(){traps++;return ['type'];}})])
  assert.throws(()=>projectNativeSdkOptions({thinking}));
 assert.equal(reads,0);assert.equal(traps,0);
});
