/** Structural JavaScript mirror of startup_config.parse_product_proxy_startup for
 * static material planning only. The Python proxy remains the startup authority:
 * it additionally rejects duplicate JSON keys, non-finite constants, floats and
 * an expired expiresAtMs against its own clock. No IO occurs on import. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {parseProductServicePairConfiguration} from './service-pair-discovery.mjs';

/** Must equal apps/proxy/qualification/state/pricing.py PRICING_REVISION; a
 * Python cross-check test pins the two values together. */
export const PRODUCT_PROXY_PRICING_REVISION='b21cfc4941e346275d9503700a094dc892f838172c41bc2e14c8284d91b1677a';
const fail=()=>{throw Error('PRODUCT_PROXY_STARTUP_DENIED');};
const sha=v=>typeof v==='string'&&/^[0-9a-f]{64}$/u.test(v);
const instant=v=>Number.isSafeInteger(v)&&v>0;
const slot=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/u.test(v);
function reference(raw){
 const r=own(raw,['path','sha256']);
 // Same normalized absolute ASCII POSIX path rule as the Python reader.
 if(typeof r.path!=='string'||!/^\/[\x01-\x7f]+$/u.test(r.path)||
    r.path.split('/').slice(1).some(part=>part===''||part==='.'||part==='..')||!sha(r.sha256))fail();
 return {path:r.path,sha256:r.sha256};
}
function ownerPeer(raw){
 const v=own(raw,['origin','server_name','server_cert_sha256','server_issuer_sha256','client_cert_sha256','client_subject','max_exchange_ms']);
 if(typeof v.server_name!=='string'||!/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/u.test(v.server_name)||v.origin!==`https://${v.server_name}:8444`||
    ![v.server_cert_sha256,v.server_issuer_sha256,v.client_cert_sha256].every(sha)||v.server_cert_sha256===v.client_cert_sha256||
    !slot(v.client_subject)||!Number.isSafeInteger(v.max_exchange_ms)||v.max_exchange_ms<1||v.max_exchange_ms>3000)fail();
 return v;
}

/** Closed proxy configuration and its explicit `{path,sha256}` file references. */
export function parseProductProxyStartupConfiguration(raw){
 try{
  const v=data(own(raw,['schemaVersion','enabled','deploymentRevision','expiresAtMs','pricingRevision','serverTls','ownerPeer','ownerTls','serviceTasks']));
  if(v.schemaVersion!==1||v.enabled!==true||!instant(v.expiresAtMs)||!slot(v.deploymentRevision)||v.pricingRevision!==PRODUCT_PROXY_PRICING_REVISION)fail();
  const server=own(v.serverTls,['certificateFile','privateKeyFile','certificateSha256']),owner=own(v.ownerTls,['caFile','certificateFile','privateKeyFile']);
  if(!sha(server.certificateSha256))fail();
  const files=Object.freeze({serverCertificate:reference(server.certificateFile),serverPrivateKey:reference(server.privateKeyFile),
   ownerCa:reference(owner.caFile),ownerCertificate:reference(owner.certificateFile),ownerPrivateKey:reference(owner.privateKeyFile)});
  const peer=ownerPeer(v.ownerPeer),pair=parseProductServicePairConfiguration(v.serviceTasks);
  if(pair.deploymentRevision!==v.deploymentRevision||pair.expiresAtMs!==v.expiresAtMs||
     pair.ownerCertSha256!==peer.server_cert_sha256||pair.proxyCertSha256!==peer.client_cert_sha256)fail();
  return Object.freeze({configuration:v,files});
 }catch{fail();}
}
