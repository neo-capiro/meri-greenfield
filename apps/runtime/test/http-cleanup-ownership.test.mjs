import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {listenRuntime} from '../http-server.mjs';
import {assertTemporalRuntimeCleanup} from '../temporal-runtime-fence.mjs';

test('actual HTTP shutdown retains an abort-ignoring borrowed handler after its socket is stopped',async()=>{
 let fetch,release,entered,observedAbort=false;
 const pending=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
 const server=new EventEmitter();Object.assign(server,{listening:true,address:()=>({port:0}),close(callback){this.listening=false;callback();this.emit('close');},closeIdleConnections(){}});
 const listener=await listenRuntime({configuration:{http:{hostname:'127.0.0.1',port:0,frontendOrigin:'https://ui.synthetic.invalid'},limits:{requestMs:100,shutdownMs:100}},
  application:{async handle(request){request.signal.addEventListener('abort',()=>{observedAbort=true;},{once:true});entered();await pending;return new Response(null,{status:204});}},readiness:async()=>{},
  testOwners:{serve(options){fetch=options.fetch;return server;}}});
 const response=fetch(new Request('http://127.0.0.1/api/conversations',{method:'POST'}));await started;
 const receipt=await listener.close();assert.equal(observedAbort,true);assert.equal(receipt.listenerStopped,true);assert.equal(receipt.pendingRequests,1);
 assert.throws(()=>assertTemporalRuntimeCleanup([{status:'fulfilled',value:receipt}]),{code:'TEMPORAL_PRODUCT_CLEANUP_UNKNOWN'});
 release();assert.equal((await response).status,204);
});
