import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,requestJson} from './invocation-harness.mjs';
test('durable dispatcher options cannot substitute its private canonical budget owner',async()=>{
 const h=harness();let effects=0;
 const injected={forInvocation(){effects++;return {deadlineMs:()=>undefined,reserve:async({reservationId})=>JSON.stringify({reservationId,decision:'reserved'}),settle:async({reservationId})=>JSON.stringify({reservationId,decision:'settled'}),markUncertain:async()=>{}};}};
 let gateway;
 try{gateway=h.enabledGateway({owner:injected});}catch{return;}
 await assert.rejects(gateway.execute(requestJson,h.credential,h.json()),'caller owner override must be refused');assert.equal(effects,0);assert.equal(h.f.calls.includes('handler'),false);
});
