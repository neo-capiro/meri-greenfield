import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {testBudgetTable} from '../../../packages/runtime/test/budget-fixture.mjs';

test('HTTP transports receive the canonical library caps and preserve the operation signal',async()=>{
 let agentOptions,handlerOptions,closed=0,forwarded;
 class Agent{constructor(options){agentOptions=options;}close(){closed++;return Promise.resolve();}}
 class NodeHttpHandler{constructor(options){handlerOptions=options;}}
 mock.module('undici',{namedExports:{Agent}});
 mock.module('@smithy/node-http-handler',{namedExports:{NodeHttpHandler}});
 const {createHotPathFetch,createHotPathAwsRequestHandler}=await import('../hot-path-transports.mjs');
 const owner=createHotPathFetch(testBudgetTable,{fetchImpl:async(...args)=>{forwarded=args;return 'response';}});
 const signal=new AbortController().signal;
 assert.equal(await owner.fetch('https://synthetic.invalid/',{signal,method:'POST'}),'response');
 assert.deepEqual(agentOptions,{connect:{timeout:10000},headersTimeout:300000,bodyTimeout:300000});
 assert.strictEqual(forwarded[1].signal,signal);assert.equal(forwarded[1].method,'POST');
 assert.ok(forwarded[1].dispatcher instanceof Agent);
 assert.ok(createHotPathAwsRequestHandler(testBudgetTable) instanceof NodeHttpHandler);
 assert.deepEqual(handlerOptions,{connectionTimeout:0,requestTimeout:0,socketAcquisitionWarningTimeout:3000});
 await owner.close();assert.equal(closed,1);
 assert.throws(()=>createHotPathFetch(testBudgetTable,{fetchImpl:null}),/HOT_PATH_FETCH_CONFIGURATION/u);
 mock.restoreAll();
});
