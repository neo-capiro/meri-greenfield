/** Static template and descriptor matcher: the task credential is verified separately, never configured. */
import test from 'node:test';import assert from 'node:assert/strict';
import {compileNativePreparationIntent,matchPreparedDescriptor,matchPreparedDescriptorShape,RUNNER_SDK_CA_FILE} from '../preparation-intent.mjs';
const intent={workspace:'/task/ws',configParentDirectory:'/task/config',secureStorageDirectory:'/task/secure',launchTemplate:{command:'/opt/claude',args:['--output-format','stream-json'],env:{CLAUDE_SECURESTORAGE_CONFIG_DIR:'/task/secure',ANTHROPIC_BASE_URL:'https://proxy.synthetic.invalid/'}},executableSha256:'a'.repeat(64),imageSha256:'b'.repeat(64),runnerSha256:'c'.repeat(64),sdkOptionsSha256:'d'.repeat(64),authoritySha256:'f'.repeat(64)};
const descriptor=credential=>({command:'/opt/claude',args:['--output-format','stream-json'],cwd:'/task/ws',env:{CLAUDE_CONFIG_DIR:'/task/config/sdk-run',CLAUDE_SECURESTORAGE_CONFIG_DIR:'/task/secure',ANTHROPIC_BASE_URL:'https://proxy.synthetic.invalid/',...(credential===undefined?{}:{ANTHROPIC_AUTH_TOKEN:credential})}});
test('the serialized template never carries the task credential or the per-run config directory',()=>{
 assert.deepEqual(compileNativePreparationIntent(intent).launchTemplate.env,intent.launchTemplate.env);
 assert.throws(()=>compileNativePreparationIntent({...intent,launchTemplate:{...intent.launchTemplate,env:{...intent.launchTemplate.env,ANTHROPIC_AUTH_TOKEN:'configured-secret'}}}),/PREPARATION_REFUSED/);
 assert.throws(()=>compileNativePreparationIntent({...intent,launchTemplate:{...intent.launchTemplate,env:{...intent.launchTemplate.env,CLAUDE_CONFIG_DIR:'/task/config/x'}}}),/PREPARATION_REFUSED/);
});
test('the descriptor matches the static template only with the issuer\'s exact credential; missing, empty, wrong or changed values refuse',()=>{
 const d=matchPreparedDescriptor(descriptor('issued-credential'),intent,'issued-credential');assert.equal(d.env.ANTHROPIC_AUTH_TOKEN,'issued-credential');assert.equal(d.env.CLAUDE_CONFIG_DIR,'/task/config/sdk-run');
 for(const [value,credential] of [[descriptor(undefined),'issued-credential'],[descriptor(''),'issued-credential'],[descriptor('other'),'issued-credential'],[descriptor('issued-credential'),'other'],[descriptor('issued-credential'),undefined],[descriptor('issued-credential'),''],[descriptor('issued-credential'),'with space'],[descriptor('issued-credential'),'x'.repeat(8193)]])assert.throws(()=>matchPreparedDescriptor(value,intent,credential),/PREPARATION_REFUSED/);
});
test('every other descriptor check stays intact with the credential verified',()=>{
 const base=descriptor('issued-credential');
 for(const change of [{cwd:'/task/other'},{command:'/opt/other'},{args:[]},{env:{...base.env,CLAUDE_CONFIG_DIR:'/elsewhere/sdk-run'}},{env:{...base.env,CLAUDE_CONFIG_DIR:'/task/config/nested/sdk-run'}},{env:{...base.env,EXTRA:'1'}},{env:{...base.env,CLAUDE_SECURESTORAGE_CONFIG_DIR:'/other'}},{env:{...base.env,ANTHROPIC_BASE_URL:'https://other.invalid/'}}])assert.throws(()=>matchPreparedDescriptor({...base,...change},intent,'issued-credential'),/PREPARATION_REFUSED/);
});
test('the task-side shape check requires a well-formed credential value and every other check, but never decides exactness',()=>{
 assert.equal(matchPreparedDescriptorShape(descriptor('any-presented-value'),intent).env.ANTHROPIC_AUTH_TOKEN,'any-presented-value');
 for(const value of [descriptor(undefined),descriptor(''),descriptor('with space'),{...descriptor('x'),cwd:'/task/other'},{...descriptor('x'),env:{...descriptor('x').env,EXTRA:'1'}}])assert.throws(()=>matchPreparedDescriptorShape(value,intent),/PREPARATION_REFUSED/);
});
test('the template may carry only the pinned runner CA as extra TLS trust; no other path or trust-store override',()=>{
 const withEnv=env=>({...intent,launchTemplate:{...intent.launchTemplate,env:{...intent.launchTemplate.env,...env}}});
 assert.equal(RUNNER_SDK_CA_FILE,'/run/meri/poststart/bootstrap/control-ca.pem');
 assert.equal(compileNativePreparationIntent(withEnv({NODE_EXTRA_CA_CERTS:RUNNER_SDK_CA_FILE})).launchTemplate.env.NODE_EXTRA_CA_CERTS,RUNNER_SDK_CA_FILE);
 const pinned=withEnv({NODE_EXTRA_CA_CERTS:RUNNER_SDK_CA_FILE}),d={...descriptor('issued-credential'),env:{...descriptor('issued-credential').env,NODE_EXTRA_CA_CERTS:RUNNER_SDK_CA_FILE}};
 assert.equal(matchPreparedDescriptor(d,pinned,'issued-credential').env.NODE_EXTRA_CA_CERTS,RUNNER_SDK_CA_FILE);
 // The SDK's exact descriptor must carry the template's value: absent on either side refuses.
 assert.throws(()=>matchPreparedDescriptor(descriptor('issued-credential'),pinned,'issued-credential'),/PREPARATION_REFUSED/);
 assert.throws(()=>matchPreparedDescriptor(d,intent,'issued-credential'),/PREPARATION_REFUSED/);
 for(const env of [{NODE_EXTRA_CA_CERTS:'/tmp/attacker.pem'},{NODE_EXTRA_CA_CERTS:'/run/meri/poststart/tls/runner-ca.pem'},{NODE_EXTRA_CA_CERTS:''},{NODE_OPTIONS:'--use-openssl-ca'},{NODE_TLS_REJECT_UNAUTHORIZED:'0'},{SSL_CERT_FILE:RUNNER_SDK_CA_FILE},{SSL_CERT_DIR:'/run/meri'},{CLAUDE_CODE_CERT_STORE:'system'}])
  assert.throws(()=>compileNativePreparationIntent(withEnv(env)),/PREPARATION_REFUSED/,JSON.stringify(env));
});
