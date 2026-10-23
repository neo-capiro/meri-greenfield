/** Native task facts stay closed; SDK launch descriptors/provider credentials are not admitted here. */
import test from 'node:test';import assert from 'node:assert/strict';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {compileNativePreparationIntent} from '../preparation-intent.mjs';
const intent={workspace:join(tmpdir(),'task','ws'),configParentDirectory:join(tmpdir(),'task','config'),secureStorageDirectory:join(tmpdir(),'task','secure'),imageSha256:'b'.repeat(64),runnerSha256:'c'.repeat(64),authoritySha256:'f'.repeat(64)};
test('task preparation retains only exact image, run authority and private directory facts',()=>{
 assert.deepEqual(compileNativePreparationIntent(intent),intent);
 for(const extra of [{launchTemplate:{}},{executableSha256:'a'.repeat(64)},{sdkOptionsSha256:'d'.repeat(64)},{proxyCredential:'synthetic'},{env:{NODE_EXTRA_CA_CERTS:'/other'}}])assert.throws(()=>compileNativePreparationIntent({...intent,...extra}));
});
test('malformed paths and digests refuse without filesystem or launch effects',()=>{
 for(const field of ['workspace','configParentDirectory','secureStorageDirectory'])for(const value of ['relative','/',intent[field]+'/',intent[field]+'\0'])assert.throws(()=>compileNativePreparationIntent({...intent,[field]:value}));
 for(const field of ['imageSha256','runnerSha256','authoritySha256'])for(const value of ['',null,'A'.repeat(64),'z'.repeat(64)])assert.throws(()=>compileNativePreparationIntent({...intent,[field]:value}));
});
test('accessors are refused without invocation and compiled facts cannot follow caller mutation',()=>{
 let calls=0;assert.throws(()=>compileNativePreparationIntent({...intent,get workspace(){calls++;return intent.workspace;}}));assert.equal(calls,0);
 const input={...intent},compiled=compileNativePreparationIntent(input);input.imageSha256='0'.repeat(64);assert.equal(compiled.imageSha256,intent.imageSha256);
});
