import test from 'node:test';import assert from 'node:assert/strict';
import {createBrowserHostRouter} from '../router.mjs';
import {binding} from '../../conversations/test/store-fixture.mjs';
function fixture(){let at=1000,resolves=0,closed=0,changed=false;const calls=[];
 const record={binding,ownerInstanceId:'synthetic-owner',recordSha256:'a'.repeat(64),expiresAtMs:200000,allocation:{hostId:'synthetic-host',generation:1},endpoint:{address:'synthetic-private'}};
 const router=createBrowserHostRouter({now:()=>at,tls:{clientName:'synthetic-control',cert:Buffer.from('cert'),key:Buffer.from('key'),ca:Buffer.from('ca')},
  allocations:{async resolve(){resolves++;return {...record,...(changed?{recordSha256:'b'.repeat(64)}:{})};}},
  connect:options=>{assert.deepEqual(options.endpoint,record.endpoint);assert.equal(options.requestMs,10000);return {
   executeBrowserOperation:async(operation,request,context)=>{calls.push({operation,request,context});at+=11000;return {content:[{type:'text',text:'snapshot'}]};},
   read:async()=>{at+=11000;return {admitted:true};},close:()=>{closed++;}};}});
 return {router,calls,resolves:()=>resolves,closed:()=>closed,change:()=>{changed=true;},clock:value=>{at=value;}};
}
test('browser tools use their selected deadline while viewer requests retain their existing cap',async()=>{
 const f=fixture();try{assert.deepEqual(await f.router.executeBrowserOperation('browser-call',{binding,requestId:'a'.repeat(64),tool:'browser_snapshot',args:{}},{deadlineMs:66000}),{content:[{type:'text',text:'snapshot'}]});assert.equal(f.resolves(),2);assert.equal(f.closed(),1);assert.equal(f.calls[0].context.deadlineMs,66000);}finally{f.router.close();}
 const viewer=fixture();try{await assert.rejects(viewer.router.read({binding}));assert.equal(viewer.closed(),1);}finally{viewer.router.close();}
});
test('router cannot use caller destinations, and an expired allocation deadline withholds late output',async()=>{
 const f=fixture();try{
  assert.throws(()=>f.router.executeBrowserOperation('browser-call',{binding,requestId:'a'.repeat(64),tool:'browser_snapshot',args:{},endpoint:'https://other.invalid'},{deadlineMs:66000}));assert.equal(f.resolves(),0);
  f.clock(195000);await assert.rejects(f.router.executeBrowserOperation('browser-call',{binding,requestId:'a'.repeat(64),tool:'browser_snapshot',args:{}},{deadlineMs:260000}));assert.equal(f.closed(),1);
 }finally{f.router.close();}
});
