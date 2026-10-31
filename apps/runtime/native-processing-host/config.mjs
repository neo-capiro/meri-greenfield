/** Validated owner configuration for the native processing host. Every value is a fixed deployment declaration; there
 * is no request- or caller-supplied field. Private TLS material and the protected credential inventory are referenced by
 * path only and are never read, generated or logged here: the existing credential/provisioning owner supplies them. */
const DIGEST=/^sha256:[a-f0-9]{64}$/u;
const HEX64=/^[0-9a-f]{64}$/u;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
import {installedRuntimeConfig} from './protected-bootstrap.mjs';
import {UPLOAD_INSPECTION_WIRE_BYTES} from '../uploads/agentcore-contract.mjs';
import {privateAddress} from '../../worker/conversation/host/control/tls.mjs';
import {assertHostRunBinding,HOST_ALLOCATION_SCHEMA} from '../../worker/conversation/host/binding.mjs';
const fail=()=>{throw Object.assign(new Error('NATIVE_PROCESSING_CONFIGURATION'),{code:'NATIVE_PROCESSING_CONFIGURATION'});};
/** The canonical wire bound plus the fixed envelope allowance; never an invented 1 MB or 100 MB cap. */
function installedConfigOrNull(store){
 const reader=store??undefined;
 let present;
 try{present=(store??{read:()=>null}).read('installed.json');}
 catch{present=null;}
 if(present===null||present===undefined){
  // Absent/unbootstrapped state may use the environment path; a PRESENT bundle must validate or refuse.
  try{return installedRuntimeConfig(reader===undefined?{}:{store:reader});}catch{return null;}
 }
 try{
  // The installed reader owns bundle/profile validation and does not depend on this module.
  const config=installedRuntimeConfig(reader===undefined?{}:{store:reader});
  if(config===null||typeof config!=='object')return null;
  const credentialPaths=Object.freeze([...new Set([...String(config.paths?.credentialPaths??'')
   .split(',').filter(Boolean),'/var/lib/meri/native-bootstrap/prepare.json',
   '/var/lib/meri/native-bootstrap/installed.json','/var/lib/meri/native-bootstrap/profile.json',
   '/var/lib/meri/native-bootstrap/host.server.key','/var/lib/meri/native-bootstrap/host.server.crt',
   '/var/lib/meri/native-bootstrap/host.client.key','/var/lib/meri/native-bootstrap/host.client.crt',
   '/var/lib/meri/native-bootstrap/ca.pem','/var/lib/meri/native-bootstrap/control-ca.pem'])]);
  return Object.freeze({...config,paths:Object.freeze({...config.paths,credentialPaths})});
 }catch{return fail();}                                  // present but corrupt/expired/foreign: refuse, never fall back
}
export const NATIVE_BODY_LIMIT=UPLOAD_INSPECTION_WIRE_BYTES+65536;
const absolute=value=>{
 if(typeof value!=='string'||!value.startsWith('/')||value.includes('\0')||value.includes('..')||value.length>1024)fail();
 return value;
};
const integer=(value,min,max)=>{if(!Number.isSafeInteger(value)||value<min||value>max)fail();return value;};
const text=(value,re)=>{if(typeof value!=='string'||!re.test(value))fail();return value;};
/** Private listen address with canonical octets: loopback or RFC1918, never a public or malformed address. */
const privateListen=value=>{
 const parts=typeof value==='string'?value.split('.'):[];
 if(parts.length!==4||parts.some(part=>!/^(0|[1-9][0-9]{0,2})$/u.test(part)||Number(part)>255))fail();
 const [a,b]=parts.map(Number);
 const isLoopback=parts.every(part=>Number(part)<=255)&&a===127;
 const isPrivate=a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168);
 if(!isLoopback&&!isPrivate)fail();
 return value;
};

/** @param {{env:Record<string,string|undefined>, store?:object}} input */
export function nativeProcessingConfig({env=globalThis.process?.env??{},store}={}){
 // The protected installed bundle is the DEFAULT configuration source when it exists; the environment path is only for
 // hosts that have not been bootstrapped yet. There is no opt-in switch that silently ignores installed state.
 const installed=installedConfigOrNull(store);
 if(installed!==null)return installed;
 const get=name=>env[name]===undefined||env[name]===''?undefined:env[name];
 const allocation=Object.freeze({hostId:text(get('MERI_NATIVE_PROCESSING_HOST_ID'),UUID),
  generation:integer(Number(get('MERI_NATIVE_PROCESSING_GENERATION')),1,999999999),
  conversationId:text(get('MERI_NATIVE_PROCESSING_CONVERSATION_ID'),UUID),
  tenantId:text(get('MERI_NATIVE_PROCESSING_TENANT_ID'),UUID),
  instanceId:text(get('MERI_NATIVE_PROCESSING_INSTANCE_ID'),/^i-[0-9a-f]{8,17}$/u),
  bootId:text(get('MERI_NATIVE_PROCESSING_BOOT_ID'),UUID),
  hostMode:text(get('MERI_NATIVE_PROCESSING_HOST_MODE'),/^native-processing$/u),
  leaseDeadlineMs:integer(Number(get('MERI_NATIVE_PROCESSING_LEASE_DEADLINE_MS')),1,Number.MAX_SAFE_INTEGER)});
 /** Protected original RunBinding (allocationRecord.originalBinding). Operator-provisioned JSON only: never a request or a
  * later current upload binding. Validated canonically against THIS host's explicit native allocation before any effect. */
 const imageDigest=text(get('MERI_NATIVE_PROCESSING_IMAGE_DIGEST'),DIGEST);
 const originalBinding=raw=>{
  if(raw===undefined)fail();
  let parsed;try{parsed=JSON.parse(raw);}catch{fail();}
  if(parsed===null||typeof parsed!=='object'||Array.isArray(parsed))fail();
  try{
   return assertHostRunBinding(Object.freeze({schema:HOST_ALLOCATION_SCHEMA,tenantId:allocation.tenantId,
    conversationId:allocation.conversationId,generation:allocation.generation,hostId:allocation.hostId,
    imageDigest,leaseDeadlineMs:allocation.leaseDeadlineMs,hostMode:allocation.hostMode}),parsed);
  }catch{fail();}
 };
 const config=Object.freeze({
  listen:Object.freeze({address:privateListen(get('MERI_NATIVE_PROCESSING_ADDRESS')??'127.0.0.1'),
   port:integer(Number(get('MERI_NATIVE_PROCESSING_PORT')),1024,65535)}),
  tls:Object.freeze({installed:get('MERI_NATIVE_PROCESSING_INSTALLED')==='1',keyPath:absolute(get('MERI_NATIVE_PROCESSING_TLS_KEY')),
   certPath:absolute(get('MERI_NATIVE_PROCESSING_TLS_CERT')),
   caPath:absolute(get('MERI_NATIVE_PROCESSING_TLS_CA')),
   peerSan:text(get('MERI_NATIVE_PROCESSING_PEER_SAN'),/^[a-z0-9][a-z0-9.-]{2,252}$/u),
   peerFingerprint:text(get('MERI_NATIVE_PROCESSING_PEER_FINGERPRINT'),HEX64),
   maxPeerLifetimeMs:integer(Number(get('MERI_NATIVE_PROCESSING_PEER_MAX_LIFETIME_MS')),1000,900000),
   peerNotAfterMs:integer(Number(get('MERI_NATIVE_PROCESSING_PEER_NOT_AFTER_MS')),1,Number.MAX_SAFE_INTEGER)}),
  image:Object.freeze({digest:imageDigest}),
  binding:Object.freeze(originalBinding(get('MERI_NATIVE_PROCESSING_ORIGINAL_BINDING'))),
  /** Protected Control currentness listener this host is pinned to (existing shared server, not a new service). */
  /** DUAL TLS identity: the host PRESENTS hostServer while it PRESENTS hostClient to Control. They are distinct protected
   *  files; there is no fallback to a single shared pair and no dual-purpose certificate. */
  control:Object.freeze({clientKeyPath:absolute(get('MERI_NATIVE_PROCESSING_CONTROL_CLIENT_KEY')),
   clientCertPath:absolute(get('MERI_NATIVE_PROCESSING_CONTROL_CLIENT_CERT')),
   caPath:absolute(get('MERI_NATIVE_PROCESSING_CONTROL_CA')),
   address:privateAddress(get('MERI_NATIVE_PROCESSING_CONTROL_ADDRESS')),
   port:integer(Number(get('MERI_NATIVE_PROCESSING_CONTROL_PORT')),1,65535),
   serverName:text(get('MERI_NATIVE_PROCESSING_CONTROL_SERVER_NAME'),/^[a-z0-9][a-z0-9.-]{2,252}$/u),
   serverFingerprintSha256:text(get('MERI_NATIVE_PROCESSING_CONTROL_FINGERPRINT'),HEX64),
   policySha256:text(get('MERI_NATIVE_PROCESSING_POLICY_SHA256'),HEX64)}),
  /** THIS host's immutable trusted identity. Only an explicit native-processing allocation may process uploads. */
  allocation,
  limits:Object.freeze({cpuQuotaUs:integer(Number(get('MERI_NATIVE_PROCESSING_CPU_QUOTA_US')),1000,4000000),
   periodUs:integer(Number(get('MERI_NATIVE_PROCESSING_CPU_PERIOD_US')),1000,1000000),
   memoryBytes:integer(Number(get('MERI_NATIVE_PROCESSING_MEMORY_BYTES')),16*1024*1024,64*1024*1024*1024),
   pidsMax:integer(Number(get('MERI_NATIVE_PROCESSING_PIDS_MAX')),1,4096),
   deadlineMaxMs:integer(Number(get('MERI_NATIVE_PROCESSING_DEADLINE_MAX_MS')),1000,60000),
   bodyBytes:integer(Number(get('MERI_NATIVE_PROCESSING_BODY_BYTES')),1024,NATIVE_BODY_LIMIT)}),
  paths:Object.freeze({helperPath:absolute(get('MERI_NATIVE_PROCESSING_HELPER')),nodePath:absolute(get('MERI_NATIVE_PROCESSING_NODE')),
   home:absolute(get('MERI_NATIVE_PROCESSING_HOME')),browsersPath:absolute(get('MERI_NATIVE_PROCESSING_HOME')),
   definitionsRoot:absolute(get('MERI_NATIVE_PROCESSING_DEFINITIONS')),
   extractorPath:absolute(get('MERI_NATIVE_PROCESSING_EXTRACTOR')),
   scratchRoot:absolute(get('MERI_NATIVE_PROCESSING_SCRATCH')),
   runtimeUid:integer(Number(get('MERI_NATIVE_PROCESSING_RUNTIME_UID')),1000,1000),
   runtimeGid:integer(Number(get('MERI_NATIVE_PROCESSING_RUNTIME_GID')),1000,1000),
   childPath:absolute(get('MERI_NATIVE_PROCESSING_CHILD')),
   credentialPaths:Object.freeze(String(get('MERI_NATIVE_PROCESSING_CREDENTIAL_PATHS')??'').split(',').filter(Boolean).map(absolute)),
   childSettings:Object.freeze({runtimeUid:1000,runtimeGid:1000,
    imageDigest:text(get('MERI_NATIVE_PROCESSING_IMAGE_DIGEST'),DIGEST),
    definitionsRoot:absolute(get('MERI_NATIVE_PROCESSING_DEFINITIONS')),
    extractorPath:absolute(get('MERI_NATIVE_PROCESSING_EXTRACTOR')),
    scratchRoot:absolute(get('MERI_NATIVE_PROCESSING_SCRATCH')),
    // Operator-declared credential exclusions PLUS the protected TLS material paths, deduplicated. Only paths cross.
    credentialPaths:Object.freeze([...new Set([...String(get('MERI_NATIVE_PROCESSING_CREDENTIAL_PATHS')??'')
     .split(',').filter(Boolean).map(absolute),absolute(get('MERI_NATIVE_PROCESSING_TLS_KEY')),
     absolute(get('MERI_NATIVE_PROCESSING_TLS_CERT')),absolute(get('MERI_NATIVE_PROCESSING_TLS_CA')),
     absolute(get('MERI_NATIVE_PROCESSING_CONTROL_CLIENT_KEY')),
     absolute(get('MERI_NATIVE_PROCESSING_CONTROL_CLIENT_CERT')),
     absolute(get('MERI_NATIVE_PROCESSING_CONTROL_CA')),
     '/var/lib/meri/native-bootstrap/host.server.key','/var/lib/meri/native-bootstrap/host.server.crt',
     '/var/lib/meri/native-bootstrap/host.client.key','/var/lib/meri/native-bootstrap/host.client.crt',
     '/var/lib/meri/native-bootstrap/ca.pem','/var/lib/meri/native-bootstrap/prepare.json',
     '/var/lib/meri/native-bootstrap/installed.json','/var/lib/meri/native-bootstrap/profile.json'])])})}),
 });
 if(config.paths.credentialPaths.length===0)fail();   // never an invented empty protected inventory
 return config;
}
