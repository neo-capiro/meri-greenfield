import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {listenActionApplication} from './node-http.mjs';
import {createLocalActionDemo} from './local/demo.mjs';
import {runLocalActionFlow} from './local/flow.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
async function refusedConnection(origin){const url=new URL(origin);await assert.rejects(new Promise((resolve,reject)=>{const s=net.connect({host:'127.0.0.1',port:Number(url.port)});s.on('connect',()=>{s.destroy();resolve();});s.on('error',reject);s.setTimeout(500,()=>{s.destroy();reject(Error('timed out'));});}),/ECONNREFUSED/);}
const post=(origin,route,body,token)=>fetch(`${origin}/api/action-followthrough/${route}`,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
const start=(app,lifetimeMs=3000)=>listenActionApplication({app,host:'127.0.0.1',port:0,lifetimeMs});

test('HTTP independent real client performs accepted pending/approved/single-effect/replay flow and closes listener',async()=>{
 const previous=process.env.MERI_REVIEW_SOURCE_ROOT;process.env.MERI_REVIEW_SOURCE_ROOT=root;let demo,server;
 try{demo=await createLocalActionDemo({mode:'synthetic-local',ttlMs:10000});server=await start(demo.app,5000);
  const wire={...demo,app:{handle:r=>fetch(new Request(new URL(new URL(r.url).pathname,server.origin),r))}};
  const result=await runLocalActionFlow(wire);assert.equal(result.status,'PASS');assert.equal(result.stats.taskEffects,1);assert.equal(result.pending.status,'approval_required');assert.notEqual(result.unapproved.status,200);
  assert.deepEqual(result.executed,result.replay);assert.equal(demo.stats().closed,false);await server.close();await server.closed;assert.equal(demo.stats().closed,false);await refusedConnection(server.origin);await server.close();
 }finally{await server?.close();demo?.close();if(previous===undefined)delete process.env.MERI_REVIEW_SOURCE_ROOT;else process.env.MERI_REVIEW_SOURCE_ROOT=previous;}
});
test('HTTP independent real application requires session; revocation remains current',async()=>{
 const previous=process.env.MERI_REVIEW_SOURCE_ROOT;process.env.MERI_REVIEW_SOURCE_ROOT=root;let demo,server;
 try{demo=await createLocalActionDemo({mode:'synthetic-local',ttlMs:5000});server=await start(demo.app);let r=await post(server.origin,'query',{request:{limit:20}});assert.equal(r.status,401);assert.equal(demo.stats().sourceReads,0);
  demo.revoke();r=await post(server.origin,'query',{request:{limit:20}},demo.credential);assert.notEqual(r.status,200);assert.equal((await r.text()).includes(demo.credential),false);assert.equal(demo.stats().taskEffects,0);
 }finally{await server?.close();demo?.close();if(previous===undefined)delete process.env.MERI_REVIEW_SOURCE_ROOT;else process.env.MERI_REVIEW_SOURCE_ROOT=previous;}
});
test('HTTP independent scope hints do not create session authority',async()=>{let received;const app={async handle(r){received=r;return new Response('{}',{status:401});}};const s=await start(app);try{const r=await fetch(`${s.origin}/api/action-followthrough/query`,{method:'POST',headers:{'content-type':'application/json','x-tenant-id':'forged','x-actor-id':'forged'},body:'{"request":{}}'});assert.equal(r.status,401);assert.equal(received.headers.get('authorization'),null);}finally{await s.close();}});
test('HTTP independent disconnect cancels actual pending Fetch request',async()=>{
 const entered=gate(),aborted=gate();let borrowedClosed=0;const s=await start({handle:async r=>{r.signal.addEventListener('abort',()=>aborted.resolve(),{once:true});entered.resolve();await aborted.promise;return new Response('{}');},close(){borrowedClosed++;}});
 try{const url=new URL(s.origin),req=http.request({host:'127.0.0.1',port:url.port,path:'/api/action-followthrough/query',method:'POST',headers:{'content-type':'application/json','transfer-encoding':'chunked'}});req.on('error',()=>{});req.write('{');await entered.promise;req.destroy();await Promise.race([aborted.promise,wait(1000).then(()=>{throw Error('disconnect did not cancel');})]);}finally{await s.close();}assert.equal(borrowedClosed,0);await refusedConnection(s.origin);
});
test('HTTP independent finite server deadline aborts pending requests and destroys sockets',async()=>{
 const entered=gate(),aborted=gate();const s=await start({async handle(r){r.signal.addEventListener('abort',()=>aborted.resolve(),{once:true});entered.resolve();await aborted.promise;return new Response('{}');}},80);
 const response=fetch(`${s.origin}/pending`).then(r=>r.text(),()=>null);await entered.promise;await s.closed;await aborted.promise;await response;await refusedConnection(s.origin);await s.close();
});
test('HTTP independent app failure is bounded and content-free',async()=>{const s=await start({async handle(){throw Error('SECRET_SESSION_AND_SQL');}});try{const r=await fetch(`${s.origin}/any`);assert.equal(r.status,500);assert.equal((await r.text()).includes('SECRET_'),false);}finally{await s.close();}await refusedConnection(s.origin);});
test('HTTP independent header bytes are bounded before application dispatch',async()=>{let calls=0;const s=await start({async handle(){calls++;return new Response('{}');}});try{const u=new URL(s.origin);const raw=await new Promise((resolve,reject)=>{let out='';const socket=net.connect({host:'127.0.0.1',port:Number(u.port)},()=>socket.write('POST /api/action-followthrough/query HTTP/1.1\r\nHost: localhost\r\nX-Huge: '+ 'a'.repeat(70000)+'\r\nContent-Length: 0\r\n\r\n'));socket.on('data',d=>out+=d);socket.on('end',()=>resolve(out));socket.on('error',reject);});assert.match(raw,/HTTP\/1\.1 4\d\d/);assert.equal(calls,0);}finally{await s.close();}});
test('HTTP independent unsafe host/port/lifetime values refuse before binding',async()=>{for(const c of [{host:'0.0.0.0'},{host:'localhost'},{port:8080},{lifetimeMs:30001},{lifetimeMs:0}])await assert.rejects(listenActionApplication({app:{handle:async()=>new Response('{}')},host:'127.0.0.1',port:0,lifetimeMs:500,...c}));});
test('HTTP independent CLI help/invalid arguments are inert and bounded',()=>{for(const [arg,code]of [['--help',0],['--unknown',2]]){const r=spawnSync(process.execPath,['scripts/local-followthrough/http-run.mjs',arg],{cwd:root,encoding:'utf8',timeout:4000});assert.equal(r.status,code,r.stderr);assert.equal(r.signal,null);assert.equal(r.stdout.includes('Bearer '),false);}});
