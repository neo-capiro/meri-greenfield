/** FINITE96: material owner lifecycle — one-shot owned cleanup, borrowed transport untouched, no work after closing. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeHostMaterialOwner} from '../native-authority/native-host-material.mjs';

const noop=async()=>{throw Error('unexpected writer call');};
const writer=Object.fromEntries(['readNativeReservation','reserveBootstrapOperation','claimBootstrapDispatch',
 'recordBootstrapCommand','readBootstrapOperation','recordBootstrapObservation'].map(name=>[name,noop]));

test('LIFECYCLE: close is idempotent, never disposes a borrowed transport, and refuses new work',async()=>{
 let disposed=0;
 const transport={async sendOnce(){throw Error('unexpected send');},async observe(){throw Error('unexpected observe');},
  async close(){disposed+=1;return {closed:true};}};
 const owner=await createNativeHostMaterialOwner({writer,issuer:{issue:async()=>{throw Error('unexpected issue');}},transport});
 const first=await owner.close();
 const second=await owner.close();
 assert.equal(first.closed,true);
 assert.equal(first.pendingCalls,0);
 assert.equal(first.physicalStopProven,false);
 assert.equal(first,second,'the same one-shot close result is replayed');
 assert.equal(disposed,0,'a borrowed transport is owned by its caller');
 await assert.rejects(()=>owner.forHost({binding:{},generation:1,hostId:'h',declaration:{},instanceId:'i',
  state:'created',privateIp:'10.0.0.1'}),e=>e.code==='NATIVE_HOST_MATERIAL_REFUSED');
});
