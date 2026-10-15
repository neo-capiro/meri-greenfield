/** Synthetic (scripted SQL protocol fixture): terminal settlement and run reconciliation over the real worker activity,
 * lifecycle service/journal/store and reconciler. SDK transport, native capture and the native stop owner are scripted. */
import test from 'node:test';
import {settlementComposition,settlementScenarios} from './terminal-settlement-harness.mjs';
for(const [name,scenario] of Object.entries(settlementScenarios))test(name,async()=>{const made=[];try{await scenario(async options=>{const h=await settlementComposition(options);made.push(h);return h;});}finally{for(const h of made)h.f.close();}});
