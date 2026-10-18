/** The SDK subprocess env replaces process.env: its one extra TLS anchor is the pinned runner CA runtime fact, never a free path. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildConversationOptions} from '../options.mjs';
import {projectNativeSdkOptions} from '../../../runtime/native-authority/sdk-option-projection.mjs';
import {RUNNER_SDK_CA_FILE} from '../../../runtime/native-authority/preparation-intent.mjs';
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
