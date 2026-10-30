/** Private physical host metadata. No browser credentials or private TLS keys are persisted. */
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertHostAllocation,assertHostRunBinding,assertD005HostIdentity} from '../../worker/conversation/host/binding.mjs';
import {hostClientDnsName} from '../../worker/conversation/host/control/protocol.mjs';
import {privateAddress,dnsName,fingerprint,checkedCertificate} from '../../worker/conversation/host/control/tls.mjs';
export const fail=()=>{throw Object.assign(Error('BROWSER_HOST_ALLOCATION_REFUSED'),{code:'BROWSER_HOST_ALLOCATION_REFUSED'});};
export const same=(a,b)=>hash(a)===hash(b);
const uuid=value=>{if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value))fail();return value;};
const milliseconds=value=>{if(!Number.isSafeInteger(value)||value<1)fail();return value;};
export function hostKey(raw){const value=data(own(raw,['hostId','generation']));uuid(value.hostId);if(!Number.isSafeInteger(value.generation)||value.generation<1)fail();return value;}

export function hostAllocationRecord(raw){
 const r=data(own(raw,['allocation','originalBinding','hostIdentity','ownerInstanceId','endpoint','hostCertificate','serverCertificateNotAfterMs']));
 assertHostAllocation(r.allocation);assertHostRunBinding(r.allocation,r.originalBinding);
 assertD005HostIdentity(r.hostIdentity,r.originalBinding,r.allocation);uuid(r.ownerInstanceId);
 const e=own(r.endpoint,['address','port','serverName','serverFingerprintSha256']);
 privateAddress(e.address);dnsName(e.serverName);fingerprint(e.serverFingerprintSha256);
 if(!Number.isSafeInteger(e.port)||e.port<1||e.port>65535)fail();
 const c=own(r.hostCertificate,['fingerprintSha256','dnsName','notAfterMs']);fingerprint(c.fingerprintSha256);
 if(c.dnsName!==hostClientDnsName(r.allocation)||milliseconds(c.notAfterMs)>r.allocation.leaseDeadlineMs||
   milliseconds(r.serverCertificateNotAfterMs)>r.allocation.leaseDeadlineMs)fail();
 return Object.freeze(r);
}

/** Called only by the trusted allocator after its native allocation/boot proof.
 * Derive pins from the actual issued public certificates, never a claimed hash. */
export function prepareHostAllocation(raw,nowMs){
 const r=own(raw,['allocation','originalBinding','hostIdentity','ownerInstanceId','endpoint','hostCertificate','serverCertificate']);
 const allocation=assertHostAllocation(r.allocation),endpoint=data(own(r.endpoint,['address','port','serverName']));
 if(!Number.isSafeInteger(nowMs)||nowMs<0||allocation.leaseDeadlineMs<=nowMs||allocation.leaseDeadlineMs>nowMs+900000)fail();
 const host=checkedCertificate(r.hostCertificate,{name:hostClientDnsName(allocation),nowMs,notAfterMs:allocation.leaseDeadlineMs});
 const server=checkedCertificate(r.serverCertificate,{name:endpoint.serverName,nowMs,notAfterMs:allocation.leaseDeadlineMs});
 return hostAllocationRecord({allocation,originalBinding:r.originalBinding,hostIdentity:r.hostIdentity,ownerInstanceId:r.ownerInstanceId,
  endpoint:{...endpoint,serverFingerprintSha256:server.fingerprintSha256},hostCertificate:{...host,dnsName:hostClientDnsName(allocation)},serverCertificateNotAfterMs:server.notAfterMs});
}

/** Reconstitute the one allocation row used by both routing and host currentness. */
export function allocationRow(row){
 const n=value=>{const result=typeof value==='string'&&/^[1-9][0-9]*$/u.test(value)?Number(value):value;return milliseconds(result);};
 const r=hostAllocationRecord({allocation:row.allocation_json,originalBinding:row.original_binding_json,hostIdentity:row.host_identity_json,
  ownerInstanceId:row.owner_instance_id,endpoint:row.endpoint_json,
  hostCertificate:{fingerprintSha256:row.client_cert_sha256,dnsName:row.client_dns_name,notAfterMs:n(row.client_cert_not_after_ms)},serverCertificateNotAfterMs:n(row.server_cert_not_after_ms)});
 if(row.host_id!==r.allocation.hostId||n(row.generation)!==r.allocation.generation||row.tenant_id!==r.allocation.tenantId||
  row.conversation_id!==r.allocation.conversationId||n(row.lease_deadline_ms)!==r.allocation.leaseDeadlineMs||
  row.allocation_sha256!==hash(r.allocation)||row.host_identity_sha256!==hash(r.hostIdentity)||row.record_sha256!==hash(r)||
  !['active','revoked','quarantined','terminated'].includes(row.state)||n(row.credential_revision)!==1)fail();
 return Object.freeze({record:r,state:row.state});
}
export function assertRequestedBinding(binding){const b=data(binding);validateShape('RunBinding',b);return b;}
