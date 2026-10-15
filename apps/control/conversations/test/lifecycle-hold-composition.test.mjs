/** Synthetic: actual worker activity + control service/journal/store over the scripted SQL protocol fixture. */
import test from 'node:test';
import {holdComposition,holdScenarios} from './lifecycle-hold-harness.mjs';
for(const [name,scenario] of Object.entries(holdScenarios))test(name,async t=>{const made=[];try{await scenario(async options=>{const h=await holdComposition(options);made.push(h);return h;});}finally{for(const h of made)h.f.close();}});
