import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {createNativeSessionRegistration} from '../../../../../apps/runtime/native-authority/session-registration.mjs';
import {binding} from '../../../../../apps/control/conversations/test/store-fixture.mjs';
const id='10000000-0000-4000-8000-000000000005',NOW=1800000000000;
async function bounded(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('INDEPENDENT_TIMEOUT')),1500);})]);}finally{clearTimeout(timer);}}
async function eventually(fn){const end=performance.now()+1000;while(!fn()){assert.ok(performance.now()<end,'bounded wait');await new Promise(resolve=>setImmediate(resolve));}}
async function setup(t){
 const child=spawn(process.execPath,[new URL('./native-fixture.mjs',import.meta.url).pathname],{env:{},cwd:'/tmp',stdio:['pipe','pipe','pipe','ipc']});
 let childError;child.on('error',e=>{childError=e;});child.stderr.resume();
 const stopped=new Promise(resolve=>child.once('close',resolve));
 const messages=[],waiters=[];child.on('message',message=>{const waiter=waiters.shift();if(waiter)waiter(message);else messages.push(message);});
 const next=()=>messages.length?Promise.resolve(messages.shift()):new Promise(resolve=>waiters.push(resolve));await bounded(next());
 let at=NOW;const source=child.stdout,configDirectory='/tmp/meri-independent-native-config',projectKey='-tmp',key={projectKey,sessionId:id};
 const observer=createNativeSessionRegistration({binding,child,workspace:'/tmp',configDirectory,versions:{sdk:'0.3.295',cli:'2.1.295'},expiresAtMs:NOW+10000,enabled:true,now:()=>at,limits:{maxRequestMs:500}});
 const chunks=[];let drainError;const drained=(async()=>{try{for await(const chunk of observer.stdout)chunks.push(Buffer.from(chunk));}catch(e){drainError=e;}})();
 t.after(async()=>{observer.close();if(child.exitCode===null&&child.signalCode===null){child.send({kind:'exit'});try{await bounded(stopped);}catch{child.kill('SIGKILL');await bounded(stopped);}}await drained;assert.equal(childError,undefined);assert.ok(child.exitCode!==null||child.signalCode!==null);});
 const init={type:'system',subtype:'init',session_id:id,claude_code_version:'2.1.295'},main={type:'transcript_mirror',filePath:join(configDirectory,'projects',projectKey,id+'.jsonl'),entries:[{type:'user',text:'雪🌱'}]};
 const wire=value=>Buffer.from(JSON.stringify(value)+'\n');
 const emit=async bytes=>{child.send({kind:'bytes',bytes:Buffer.from(bytes).toString('base64')});await bounded(next());};
 return {child,source,observer,key,init,main,wire,emit,next,chunks,drainError:()=>drainError,setClock:value=>{at=value;},read:extra=>observer.registration.read({binding,key,...extra})};
}
test('fragmented UTF8 and repeated pre-init main batches preserve first witness and byte forwarding',async t=>{
 const x=await setup(t),first=x.wire(x.main),second=x.wire({...x.main,entries:[{type:'assistant',text:'later'}]}),raw=Buffer.concat([first,second,x.wire(x.init)]),split=raw.indexOf(Buffer.from('雪'))+1;
 const pending=x.read();await x.emit(raw.subarray(0,split));assert.equal(x.observer.status().ready,false);await x.emit(raw.subarray(split));const a=await bounded(pending);
 x.setClock(NOW+20);await x.emit(x.wire(x.main));const b=await x.read();assert.equal(b.observationId,a.observationId);assert.equal(b.sessionEventSha256,a.sessionEventSha256);assert.equal(b.expiresAtMs,NOW+10000);assert.equal(b.checkedAtMs,NOW+20);
 await eventually(()=>Buffer.concat(x.chunks).length===raw.length+first.length);assert.deepEqual(Buffer.concat(x.chunks).subarray(0,raw.length),raw);assert.equal(x.drainError(),undefined);
});
test('subagent frames corroborate no main authority; wrong native session permanently refuses',async t=>{
 const x=await setup(t);await x.emit(x.wire(x.init));await x.emit(x.wire({...x.main,filePath:x.main.filePath.replace('.jsonl','/subagents/agent-one.jsonl')}));assert.equal(x.observer.status().ready,false);
 await x.emit(x.wire(x.main));await x.read();await x.emit(x.wire({...x.main,filePath:x.main.filePath.replace(id,id.replace(/5$/,'6')).replace('.jsonl','/subagents/agent-one.jsonl')}));await eventually(()=>x.observer.status().refused);await assert.rejects(x.read());
});
test('stdout EOF with unterminated tail invalidates receipt even while borrowed child remains alive',async t=>{
 const x=await setup(t);await x.emit(Buffer.concat([x.wire(x.init),x.wire(x.main)]));await x.read();await x.emit(Buffer.from('{"type":"system"'));
 x.child.send({kind:'end'});await bounded(x.next());await eventually(()=>x.observer.status().refused);await assert.rejects(x.read());assert.equal(x.child.exitCode,null);assert.equal(x.child.signalCode,null);
});
test('request accessors and nested proxies are rejected without executing their traps',async t=>{
 const x=await setup(t);let effects=0;const hostile=new Proxy({}, {get(){effects++;throw Error('TRAP');},ownKeys(){effects++;throw Error('TRAP');},getPrototypeOf(){effects++;throw Error('TRAP');}});
 await assert.rejects(x.observer.registration.read(hostile));await assert.rejects(x.observer.registration.read({binding:hostile,key:x.key}));await assert.rejects(x.observer.registration.read({binding,key:hostile}));await assert.rejects(x.observer.registration.read({binding,get key(){effects++;return x.key;}}));assert.equal(effects,0);assert.equal(x.observer.status().pendingReads,0);
 await x.emit(Buffer.concat([x.wire(x.init),x.wire(x.main)]));await x.read();
});
test('canceled caller does not revoke independently observed authority or leak waiter capacity',async t=>{
 const x=await setup(t),cancel=new AbortController(),pending=x.read({signal:cancel.signal});cancel.abort();await assert.rejects(pending);assert.equal(x.observer.status().pendingReads,0);
 await x.emit(Buffer.concat([x.wire(x.init),x.wire(x.main)]));const receipt=await x.read();assert.equal(receipt.expiresAtMs,NOW+10000);assert.equal(x.observer.status().refused,false);
});
test('clock rollback cannot renew the original observation after clock recovery',async t=>{
 const x=await setup(t);await x.emit(Buffer.concat([x.wire(x.init),x.wire(x.main)]));await x.read();x.setClock(NOW-1);await assert.rejects(x.read());x.setClock(NOW+1);await assert.rejects(x.read());assert.equal(x.observer.status().pendingReads,0);assert.equal(x.source.destroyed,false);
});
