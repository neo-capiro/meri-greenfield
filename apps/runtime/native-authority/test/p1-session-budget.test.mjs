import test from 'node:test';
import assert from 'node:assert/strict';
import {hotPathBudgets,budget} from '../../../../packages/runtime/hot-path-budgets.mjs';
import {createNativeSdkSessionApplication} from '../session-http.mjs';
import {createNativeCapabilityClient} from '../../native-client.mjs';
import {transportLimits} from '../remote-task-boundary.mjs';

const table=hotPathBudgets({limits:{startupMs:30000,shutdownMs:10000,requestMs:25000},runWindowMs:900000});

test('the session receiver passes the effective per-operation allowance to its owner',async()=>{
 const calls=[];
 const owner=Object.fromEntries(['register','load','append','listSubkeys'].map(name=>[name,async value=>{calls.push({name,...value});return {ok:true};}]));
 const now=()=>100000,app=createNativeSdkSessionApplication({owner,now,maxRequestMs:25000});
 for(const [operation,method] of [['register','register'],['load','load'],['append','append'],['list-subkeys','listSubkeys']]){
  const response=await app.handle(new Request('https://native.invalid/v1/runner/session/'+operation,{method:'POST',headers:{authorization:'Bearer task-only','content-type':'application/json'},body:'{}'}));
  assert.equal(response.status,200);
  const call=calls.at(-1),expected=budget(table,'control.session.'+operation);
  assert.equal(call.name,method);
  assert.equal(call.operationMaxRequestMs,expected);
  assert.equal(call.deadlineMs,now()+expected);
 }
});

test('native factories refuse omitted ordinary and transport allowances',()=>{
 const configuration={origin:'https://native.invalid',maxResponseBytes:65536},credential='task-only',fetch=async()=>{throw Error('not dispatched');};
 assert.throws(()=>createNativeCapabilityClient({configuration,credential,fetch}),{code:'NATIVE_CONFIGURATION'});
 assert.throws(()=>createNativeCapabilityClient({configuration,credential,fetch,maxRequestMs:budget(table,'native.client.request')}),{code:'NATIVE_CONFIGURATION'});
 assert.throws(()=>transportLimits());
 assert.throws(()=>transportLimits({maxFrameBytes:65536}));
 assert.equal(transportLimits({maxRequestMs:budget(table,'native.transport.request')}).maxRequestMs,8000);
});
