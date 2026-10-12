import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {createSourceDisabledGateway} from '../index.mjs';
import {fixture,NOW,limits,uuid} from './fixtures.mjs';

test('independent combined catalog remains invisible and refuses all56 operations before every effect',async()=>{
  const f=fixture();const gateway=createSourceDisabledGateway({authorityPorts:f.ports,budget:f.budget,limits,now:()=>NOW,newId:()=>uuid('7')});
  assert.equal(catalog.operations.length,56);assert.equal(gateway.sourceEnabled,false);
  assert.deepEqual(await gateway.discover(),[]);
  for(const {operation} of catalog.operations){
    await assert.rejects(gateway.execute(JSON.stringify({operation,arguments:{}}),'synthetic-unqualified'),/UNAVAILABLE/);
    assert.deepEqual(f.calls,[]);
  }
  assert.deepEqual(await gateway.discover(),[]);
});
