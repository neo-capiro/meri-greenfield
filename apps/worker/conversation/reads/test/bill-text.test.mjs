/** Actual canonical schema conversion, synthetic arguments only; no SDK/model/native execution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {advertisedArguments} from '../schema.mjs';
import {READ_FAMILIES} from '../families.mjs';

for(const [id,request] of [['search_congress_bills',{query:'H.R. 1'}],['read_bill_text',{billId:'118-hr-1'}]]){
 test(`${id}: actual canonical conversion accepts literals without defaults and rejects model authority`,()=>{
  const contract=resolveOperationContract({id,version:'0.2.0'}),converted=advertisedArguments(contract.descriptor.inputSchema);
  assert.equal(READ_FAMILIES['bill-text'].clientScope,'optional');assert.equal(converted.mode,'canonical');
  assert.deepEqual(converted.arguments.parse(request),request);
  for(const extra of [{tenantId:'foreign'},{actorRole:'capiro_admin'},{defaultCongress:118},{input:request}])assert.equal(converted.arguments.safeParse({...request,...extra}).success,false);
  assert.equal(converted.arguments.safeParse({...request,[id==='read_bill_text'?'billId':'query']:{value:'H.R. 1'}}).success,false);
 });
}
