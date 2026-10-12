import assert from 'node:assert/strict';
import {harness} from './invocation-harness.mjs';
const h=harness();
for(const name of ['prepareInvocation','executeOwned','reconcileInvocation']) assert.equal(typeof h.gateway()[name],'function',`missing connected API ${name}`);
