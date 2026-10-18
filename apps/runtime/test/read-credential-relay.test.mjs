import test from 'node:test';import assert from 'node:assert/strict';
import {createReadCredentialRelay} from '../read-credential-relay.mjs';
const code=c=>e=>e?.code===c;
test('the relay refuses until bound, forwards to the bound owner with its receiver, and refuses after close',()=>{
 const relay=createReadCredentialRelay();assert.equal(relay.state(),'unbound');
 assert.throws(()=>relay.port.nativeCredentialFor({}),code('SESSION_UNAVAILABLE'));
 const owner={seen:null,nativeCredentialFor(input){this.seen=input;return {credential:'native',expiresAtMs:1};}};
 relay.bind(owner);assert.equal(relay.state(),'bound');
 assert.deepEqual(relay.port.nativeCredentialFor({binding:1}),{credential:'native',expiresAtMs:1});assert.deepEqual(owner.seen,{binding:1});
 assert.throws(()=>relay.bind(owner),code('READ_RELAY_CONFIGURATION'));
 relay.close();assert.equal(relay.state(),'closed');assert.throws(()=>relay.port.nativeCredentialFor({}),code('SESSION_UNAVAILABLE'));
});
test('binding refuses owners without the method, Proxies, and owner refusals pass through unchanged',()=>{
 assert.throws(()=>createReadCredentialRelay().bind({}),code('READ_RELAY_CONFIGURATION'));
 assert.throws(()=>createReadCredentialRelay().bind(new Proxy({nativeCredentialFor(){}},{})),code('READ_RELAY_CONFIGURATION'));
 const relay=createReadCredentialRelay();relay.bind({nativeCredentialFor(){throw Object.assign(Error('SESSION_UNAVAILABLE'),{code:'SESSION_UNAVAILABLE'});}});
 assert.throws(()=>relay.port.nativeCredentialFor({}),code('SESSION_UNAVAILABLE'));
});
