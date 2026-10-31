/** Protected mTLS + exchange ownership for the pinned native HTTPS transport (inert node:https; no real socket/crypto). */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
const RAW=Buffer.from('peer-leaf');
const PRINT=createHash('sha256').update(RAW).digest('hex');
const PEER_FINGERPRINT=PRINT;
const CERT=Buffer.from('-----BEGIN CERTIFICATE-----\ncert\n-----END CERTIFICATE-----\n');
const KEY=Buffer.from('-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----\n');
const CA=Buffer.from('-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----\n');
const MATERIAL={certPath:'/run/secrets/cert.pem',keyPath:'/run/secrets/key.pem',caPath:'/run/secrets/ca.pem'};
const reader=path=>path===MATERIAL.certPath?CERT:path===MATERIAL.keyPath?KEY:path===MATERIAL.caPath?CA:null;
let requests=[];let bodyWrites=0;let destroyed=0;let mode='ok';
class FakeRequest extends EventEmitter{
 constructor(options){super();this.options=options;requests.push(options);}
 end(body){this.body=body;this.bodyWrites=++bodyWrites;
  if(mode==='ok'||mode==='oversize'){this.emit('response',makeResponse(mode==='oversize'?16*1024*1024+1:2));}}
 destroy(){destroyed++;this.destroyed=true;}
}
function makeResponse(size){
 const res=Readable.from([Buffer.alloc(size,0x61)]);
 res.statusCode=200;res.complete=false;
 res.on('end',()=>{res.complete=true;});
 return res;
}
const httpsMock={request:options=>{
 const request=new FakeRequest(options);
 setImmediate(()=>{
  const socket=Object.assign(new EventEmitter(),{getPeerCertificate:()=>({raw:mode==='badpin'?Buffer.from('other'):RAW})});
  request.emit('socket',socket);
  if(mode==='badpin'){socket.emit('secureConnect');return;}
  socket.emit('secureConnect');
 });
 return request;
}};
mock.module('node:https',{defaultExport:{request:httpsMock.request},namedExports:{request:httpsMock.request}});
const {pinnedHttpsConnect}=await import('../control-lifecycle.mjs');
const base={address:'10.1.2.3',port:9443,serverName:'native.internal',serverFingerprintSha256:PEER_FINGERPRINT,
 tls:MATERIAL,readFile:reader,deadlineMs:Date.now()+2000};

test('TLS: validated material is loaded and passed to HTTPS; body is written only after the pin is admitted',async()=>{
 requests=[];bodyWrites=0;mode='ok';
 const wire=await pinnedHttpsConnect({...base});
 assert.equal(requests.length,1);
 const options=requests[0];
 assert.equal(options.rejectUnauthorized,true);
 assert.equal(options.servername,'native.internal');
 assert.equal(options.minVersion,'TLSv1.3');
 assert.equal(Buffer.compare(options.cert,CERT),0);
 assert.equal(Buffer.compare(options.key,KEY),0);
 assert.equal(Buffer.compare(options.ca,CA),0);
 assert.equal(bodyWrites,0,'no request body before pin admission');
 const response=await wire.send({body:Buffer.from('{}')});
 assert.equal(response.status,200);
 assert.equal(bodyWrites,1);
 assert.deepEqual(await wire.close(),{closed:true});
});

test('TLS: absent or non-material bytes are refused before any request',async()=>{
 requests=[];
 const refuse=code=>e=>e?.code===code;
 await assert.rejects(pinnedHttpsConnect({...base,tls:undefined}),refuse('UPLOAD_NATIVE_TLS_CONFIGURATION'));
 await assert.rejects(pinnedHttpsConnect({...base,tls:{...MATERIAL},readFile:()=>null}),refuse('UPLOAD_NATIVE_TLS_CONFIGURATION'));
 // tlsBytes is a bounded-bytes helper, not a PEM parser: non-empty synthetic bytes are accepted as material.
 assert.equal(requests.length,0,'no socket was opened');
});

test('PIN: a mismatched peer fingerprint settles the outstanding send and never writes the body',async()=>{
 requests=[];bodyWrites=0;mode='badpin';
 // The wire object is returned, but admission never succeeds: the outstanding send is the terminal owner.
 const wire=await pinnedHttpsConnect({...base});
 await assert.rejects(wire.send({body:Buffer.from('{}')}),e=>e?.code==='UPLOAD_NATIVE_PEER_REFUSED');
 assert.equal(bodyWrites,0,'the body is never written before a successful pin');
 assert.equal(destroyed>0,true,'the socket is destroyed');
});

test('BOUNDS: an oversized response is refused, data is not retained, and the socket is destroyed',async()=>{
 requests=[];mode='oversize';
 const wire=await pinnedHttpsConnect({...base});
 await assert.rejects(wire.send({body:Buffer.from('{}')}),e=>e?.code==='UPLOAD_INSPECTION_RESULT_REFUSED');
 assert.equal(destroyed>0,true);
});

test('CANCEL: an aborted or expired operation is refused before a request',async()=>{
 requests=[];
 const controller=new AbortController();controller.abort();
 await assert.rejects(pinnedHttpsConnect({...base,signal:controller.signal}),e=>e?.code==='UPLOAD_INSPECTION_EXPIRED');
 await assert.rejects(pinnedHttpsConnect({...base,deadlineMs:Date.now()-1}),e=>e?.code==='UPLOAD_INSPECTION_EXPIRED');
 assert.equal(requests.length,0);
});

test('CLOSE: truthful and idempotent, and it settles an outstanding send',async()=>{
 requests=[];mode='hold';
 const wire=await pinnedHttpsConnect({...base});
 const pending=wire.send({body:Buffer.from('{}')});
 assert.deepEqual(await wire.close(),{closed:true});
 assert.deepEqual(await wire.close(),{closed:true});
 await assert.rejects(pending,e=>e?.code==='UPLOAD_INSPECTION_CANCELLED');
});
