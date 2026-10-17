/** Pure bootstrap descriptor validation. No configuration/file/client startup import. */
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {parseTemporalIssuerDeliveryConfiguration} from './temporal-issuer/client.mjs';

export const temporalProductBootstrapPaths=Object.freeze({root:'/run/meri-temporal',directory:'/run/meri-temporal/identity',
 keyFile:'/run/meri-temporal/identity/client-key.pem',certFile:'/run/meri-temporal/identity/client-cert.pem',lockPath:'/run/meri-temporal/.identity.bootstrap.lock'});
const clientKeys=['schemaVersion','role','clusterArn','revision','issuerOrigin','serverName','peerSubjectCn','peerUriBase',
 'serverCaSha256','clientCaSha256','requestTimeoutMs','totalTimeoutMs','maxReplyBytes'];
const fail=()=>{throw Object.assign(Error('TEMPORAL_PRODUCT_BOOTSTRAP_UNAVAILABLE'),{code:'TEMPORAL_PRODUCT_BOOTSTRAP_UNAVAILABLE'});};
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const caPath=value=>typeof value==='string'&&/^\/run\/meri\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.pem$/u.test(value);

/** Fixed paths are templates; installed immutable generation paths are derived
 * only by the task-local owner after the genuine client's identity proof. */
export function parseTemporalProductBootstrapConfiguration(raw={enabled:false},issuerDelivery){
 try{
  const h=own(raw,['enabled'],['configuration','serverCaFile','clientCaFile','directory','keyFile','certFile']);
  if(h.enabled===false){own(raw,['enabled']);return Object.freeze({enabled:false});}
  const c=data(own(raw,['enabled','configuration','serverCaFile','clientCaFile','directory','keyFile','certFile'])),
   p=own(c.configuration,clientKeys),d=parseTemporalIssuerDeliveryConfiguration(issuerDelivery),paths=temporalProductBootstrapPaths;
  const u=new URL(p.issuerOrigin);
  if(c.enabled!==true||p.schemaVersion!==1||!['control','temporal-worker'].includes(p.role)||p.role!==d.identity.role||
     !/^arn:aws:ecs:us-east-1:967807252336:cluster\/[A-Za-z0-9_-]{1,255}$/u.test(p.clusterArn)||
     typeof p.revision!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/u.test(p.revision)||
     u.protocol!=='https:'||u.origin!==p.issuerOrigin||u.port!=='8445'||u.pathname!=='/'||u.search||u.hash||u.username||u.password||
     !/^[a-z0-9.-]+$/u.test(u.hostname)||p.issuerOrigin!==d.issuerOrigin||p.serverName!==u.hostname||p.serverName!==d.tls.serverName||
     typeof p.peerSubjectCn!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/u.test(p.peerSubjectCn)||
     typeof p.peerUriBase!=='string'||!/^spiffe:\/\/[a-z0-9.-]+\/[A-Za-z0-9/_-]+\/$/u.test(p.peerUriBase)||
     !hex(p.serverCaSha256)||!hex(p.clientCaSha256)||!integer(p.requestTimeoutMs,100,15000)||
     !integer(p.totalTimeoutMs,p.requestTimeoutMs,30000)||!integer(p.maxReplyBytes,1024,32768)||
     !caPath(c.serverCaFile)||!caPath(c.clientCaFile)||c.serverCaFile===c.clientCaFile||d.tls.issuerCaFile!==c.serverCaFile||
     c.directory!==paths.directory||c.keyFile!==paths.keyFile||c.certFile!==paths.certFile||
     d.tls.clientKeyFile!==c.keyFile||d.tls.clientCertFile!==c.certFile)fail();
  return c;
 }catch{fail();}
}
