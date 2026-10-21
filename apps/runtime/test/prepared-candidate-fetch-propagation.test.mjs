import {hotPathBudgets} from '../../../packages/runtime/hot-path-budgets.mjs';
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {candidateFixture} from './prepared-candidate-fixture.mjs';

let registryOptions;
mock.module('../prepared-run-registry.mjs',{namedExports:{createPreparedRunRegistry(options){registryOptions=options;return {get(){return null;},async handle(){return null;},async close(){}};}}});
const {assemblePreparedCandidate}=await import('../prepared-candidate.mjs');

test('assembled multi-run registry receives the same injected HTTP transport as first-run and Core authority',async()=>{
 const f=candidateFixture(),calls=[];
 const fetchImpl=async(url,options)=>{calls.push([url,options.method]);return Response.json({});};
 const candidate=assemblePreparedCandidate({budgets:hotPathBudgets({limits:{startupMs:30000,shutdownMs:10000,requestMs:25000},runWindowMs:900000}),configuration:f.configuration,pool:{connect(){assert.fail('No SQL');}},ecs:{send(){assert.fail('No ECS');}},objects:{get(){assert.fail('No object read');},put(){assert.fail('No object write');}},credentials:f.secret,fetchImpl,runIssuance:{},issuanceIntent(){},admissionForBinding(){}});
 try{
  assert.equal(registryOptions.fetchImpl,fetchImpl);
  assert.equal(registryOptions.identity.fetchImpl,fetchImpl);
  await registryOptions.fetchImpl('https://task.synthetic.invalid/v1/readiness',{method:'POST'});
  assert.deepEqual(calls,[['https://task.synthetic.invalid/v1/readiness','POST']]);
 }finally{await candidate.close();}
});
