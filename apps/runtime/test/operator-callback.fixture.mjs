import {createServer,request} from 'node:https';
import {once} from 'node:events';
import {createHash,X509Certificate} from 'node:crypto';
import assert from 'node:assert/strict';
import {observerTransportPki} from './native-observer-transport.fixture.mjs';
import {OPERATOR_CALLBACK_CONFIGURATION} from '../operator-callback-configuration.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
export const pki=observerTransportPki(),origin='https://control.meri-preview.internal',name='control.meri-preview.internal';
export const credential='synthetic-case-control-'.repeat(3),digest=x=>createHash('sha256').update(x).digest('hex');
export const leafPin=leaf=>digest(new X509Certificate(leaf.cert).raw);
export const descriptor=()=>({schema:OPERATOR_CALLBACK_CONFIGURATION,origin,endpoint:{address:'10.0.0.7',port:443,serverName:name,serverFingerprintSha256:leafPin(pki.good)},
 caCertificate:pki.ca,retainUntilMs:Date.now()+3600000,controlCapabilitySha256:digest(credential),nativeProvisioningSha256:canonicalSha256({enabled:false})});
export async function tlsServer(t,leaf,handle){
 const server=createServer({...leaf,minVersion:'TLSv1.3'},handle);server.on('tlsClientError',()=>{});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});return server;
}
export function localRequest(server,seen=[],address='10.0.0.7'){return (options,callback)=>{
 seen.push(options);assert.equal(options.hostname,address);assert.equal(options.port,443);assert.equal(options.servername,name);
 assert.equal(options.headers.host,name);assert.equal(options.agent,false);assert.equal(options.lookup,undefined);
 return request({...options,hostname:'127.0.0.1',port:server.address().port},callback);
};}
