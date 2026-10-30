/** Start/close races for the declared host-currentness listener, using the REAL
 * createHostCurrentnessServer and the real composition. Only the external HTTPS boundary of the server
 * module is replaced (mock.module on 'node:https'); no socket is opened and no native action runs.
 * Certificates are ephemeral test data with a DNS SAN, never credentials or host qualification. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const PY=String.raw`
import json,sys,base64
from datetime import datetime,timedelta,timezone
from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization
from cryptography.x509.oid import NameOID
name=sys.argv[1];now=datetime.now(timezone.utc)
key=ed25519.Ed25519PrivateKey.generate()
cert=(x509.CertificateBuilder().subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,name)]))
 .issuer_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,name)])).public_key(key.public_key())
 .serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(seconds=5))
 .not_valid_after(now+timedelta(seconds=240))
 .add_extension(x509.SubjectAlternativeName([x509.DNSName(name)]),critical=False)
 .sign(key,None))
print(base64.b64encode(cert.public_bytes(serialization.Encoding.PEM)).decode())`;
const certificate=name=>Buffer.from(execFileSync(process.platform==='win32'?'python':'python3',['-c',PY,name],{encoding:'utf8'}),'base64');

const CERT=certificate('host.synthetic.invalid');
const material={privateClient:{cert:certificate('control.synthetic.invalid'),key:Buffer.from('synthetic-key'),ca:Buffer.from('synthetic-ca')},
 hostServer:{cert:CERT,key:Buffer.from('synthetic-key'),clientCa:Buffer.from('synthetic-ca')}};
const BIND={address:'127.0.0.1',port:8443};
const declaration={enabled:true,requestMs:10000,maxCurrentnessMs:3000,maxLeaseMs:10000,
 tls:{privateClient:{clientName:'control.synthetic.invalid',certFile:'C:/m/c.pem',keyFile:'C:/m/k.pem',caFile:'C:/m/ca.pem'},
  hostServer:{serverName:'host.synthetic.invalid',certFile:'C:/m/s.pem',keyFile:'C:/m/sk.pem',clientCaFile:'C:/m/sca.pem'}},bind:BIND};

/** Minimal EventEmitter-shaped stand-in for the TLS listener's HTTPS boundary. */
function fakeHttps({failListen=false,failClose=false}={}){
 const state={listenCalls:0,closeCalls:0,listening:false,closed:false,socketsDestroyed:0};
 const handlers=new Map();
 const emit=(name,...args)=>{for(const handler of [...(handlers.get(name)??[])])handler(...args);};
 const server={
  maxConnections:0,maxHeadersCount:0,headersTimeout:0,requestTimeout:0,
  get listening(){return state.listening;},
  on(name,handler){(handlers.get(name)??handlers.set(name,[]).get(name)).push(handler);return server;},
  once(name,handler){const wrap=(...args)=>{server.off(name,wrap);handler(...args);};return server.on(name,wrap);},
  off(name,handler){handlers.set(name,(handlers.get(name)??[]).filter(entry=>entry!==handler));return server;},
  address(){return state.listening?{address:BIND.address,port:BIND.port}:null;},
  listen(){state.listenCalls++;setImmediate(()=>{
   if(failListen){emit('error',new Error('synthetic listen failure'));return;}
   state.listening=true;emit('listening');});},
  close(callback){
   state.closeCalls++;state.closed=true;state.listening=false;
   if(failClose)throw new Error('synthetic close failure');
   callback?.();return server;},
 };
 state.server=server;return state;
}

/** External owners for the composition; the listener itself is the real one. */
function owners(){
 return {pool:{connect:async()=>({query:async()=>({rows:[]}),release(){}}),end(){}},
  store:{executions:{readCurrentOnClient:async()=>({})},lifecycle:{browserCustody:{currentHost:async()=>({})}},
   read:async()=>({run:{binding:{},scopes:[],versions:{}},request:{}})},
  sessions:{nativeCredentialFor:async()=>({credential:'synthetic-native'})},core:{readCurrent:async()=>({})},
  capabilityPolicy:{forRun:async()=>({})},readBrowserPolicy:async()=>({})};
}

// The single external HTTPS boundary is replaced once, before the real composition is imported.
let current=null;
mock.module('node:https',{defaultExport:{createServer:()=>current.server}});
const {createBrowserHostComposition}=await import('../browser-host-composition.mjs');
function composition(httpState){
 current=httpState;
 return createBrowserHostComposition({declaration,...owners(),material,now:Date.now});
}

test('close while start is pending waits for retirement and the listener never survives',async()=>{
 const http=fakeHttps();
 const composed=composition(http);
 const starting=composed.start();
 const closing=composed.close();
 await closing;
 // close() waits for the in-flight start to settle, then retires the listener it just bound.
 await starting;
 assert.equal(http.closeCalls>=1,true,'the real server close ran');
 assert.equal(http.listening,false,'no listener survives the close');
 assert.equal(http.server.listening,false);
 await assert.rejects(composed.start(),{code:'BROWSER_HOST_CLOSED'});
 assert.equal(http.listenCalls,1,'nothing new is opened after close');
});

test('a listener start failure retires the server and surfaces the refusal',async()=>{
 const http=fakeHttps({failListen:true});
 const composed=composition(http);
 await assert.rejects(composed.start(),(error)=>{assert.equal(error.message,'HOST_CONTROL_UNAVAILABLE');return true;});
 assert.equal(http.closeCalls>=1,true,'the real server was retired after the failed start');
 assert.equal(http.listening,false);
});

test('a cleanup failure on the close path stays visible and the composition never reopens',async()=>{
 const http=fakeHttps({failClose:true});
 const composed=composition(http);
 await composed.start();
 await assert.rejects(composed.close(),(error)=>{assert.equal(error.code,'BROWSER_HOST_CLEANUP_FAILED');
  assert.equal(error.failures.length>=1,true,'the cleanup failure is preserved, not swallowed');return true;});
 await assert.rejects(composed.start(),{code:'BROWSER_HOST_CLOSED'},'a composition that failed to close still refuses to reopen');
});

test('an abort after the listener binds retires it instead of leaving it running',async()=>{
 const http=fakeHttps();
 const composed=composition(http);
 const controller=new AbortController();
 const starting=composed.start({signal:controller.signal});
 controller.abort(new Error('synthetic shutdown'));
 await assert.rejects(starting);
 assert.equal(http.closeCalls>=1,true,'the bound server was retired on abort');
 assert.equal(http.listening,false);
});
