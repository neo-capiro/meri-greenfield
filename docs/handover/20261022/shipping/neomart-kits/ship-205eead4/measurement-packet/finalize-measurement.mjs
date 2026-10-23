#!/usr/bin/env node
// OFFLINE. Root supplies authenticated conditional-Put/HEAD version/KMS pins.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {hash,checkedJson,SOURCE_COMMIT,measurementStartRequest} from './receipt-joins.mjs';
import {decodePayload,createPinnedPayloadBuildspec} from './measurement-payload.mjs';
try{
 const a={};for(let i=2;i<process.argv.length;i+=2){assert.ok(process.argv[i+1]&&!a[process.argv[i]]);a[process.argv[i]]=process.argv[i+1];}
 assert.deepEqual(Object.keys(a).sort(),['--packet','--payload-pin'].sort());
 const packet=resolve(a['--packet']),read=name=>readFileSync(join(packet,name));
 for(const name of ['measurement-buildspec.json','measurement-start.request.json','payload-pin.json','packet-hashes.json'])assert.ok(!existsSync(join(packet,name)),'finalization output exists');
 const planBytes=read('measurement-plan.json'),plan=checkedJson(planBytes),payloadBytes=read('measurement-payload.json'),pins=checkedJson(read('preparation-hashes.json'));
 assert.equal(pins.sourceCommit,SOURCE_COMMIT);assert.equal(pins.attempt,plan.attempt);assert.equal(pins.planSha256,hash(planBytes));assert.equal(pins.payloadSha256,hash(payloadBytes));assert.equal(pins.payloadBytes,payloadBytes.length);
 const decoded=decodePayload(payloadBytes);assert.deepEqual(decoded.plan,planBytes);assert.equal(hash(decoded.wrapper),pins.wrapperSha256);
 const pin=checkedJson(readFileSync(a['--payload-pin'])),buildspec=createPinnedPayloadBuildspec({plan,payloadBytes,pin});
 const pinBytes=JSON.stringify(pin,null,2)+'\n',startBytes=JSON.stringify(measurementStartRequest(plan,buildspec),null,2)+'\n';
 const final={...pins,payloadPinSha256:hash(pinBytes),buildspecSha256:hash(buildspec),buildspecBytes:Buffer.byteLength(buildspec),startRequestSha256:hash(startBytes)};
 const write=(name,bytes)=>writeFileSync(join(packet,name),bytes,{flag:'wx',mode:0o600});
 write('payload-pin.json',pinBytes);write('measurement-buildspec.json',buildspec);write('measurement-start.request.json',startBytes);write('packet-hashes.json',JSON.stringify(final,null,2)+'\n');
 console.log(JSON.stringify({status:'OFFLINE_MEASUREMENT_REQUEST_FINALIZED',packet,...final}));
}catch(error){console.error('MEASUREMENT_FINALIZE_REFUSED: '+(error?.message??'invalid input'));process.exitCode=2;}
