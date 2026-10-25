import test from 'node:test';
import assert from 'node:assert/strict';
import {compileIntentsConfiguration,createIntentsFamilyWith,intentsComposition} from '../intents.mjs';
test('retired execution trust and injected execution owners are rejected instead of silently activating',()=>{
 assert.throws(()=>compileIntentsConfiguration({intents:{enabled:true,execution:{}}}),{code:'INTENTS_CONFIGURATION'});
 assert.throws(()=>createIntentsFamilyWith({execution:{}}),{code:'PRODUCT_PORTS_CONFIGURATION'});
 assert.throws(()=>intentsComposition({}, {execution:{}}),{code:'PRODUCT_PORTS_CONFIGURATION'});
 assert.deepEqual(compileIntentsConfiguration({intents:{enabled:true,core:{origin:'https://core.invalid',serviceSecretFile:'C:/synthetic/secret'}}}),{enabled:true,core:{origin:'https://core.invalid',serviceSecretFile:'C:/synthetic/secret'}});
});
