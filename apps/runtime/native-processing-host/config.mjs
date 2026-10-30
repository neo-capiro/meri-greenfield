/** Validated owner configuration for the native processing host. Every value is a fixed deployment declaration; there
 * is no request- or caller-supplied field. Private TLS material and the protected credential inventory are referenced by
 * path only and are never read, generated or logged here: the existing credential/provisioning owner supplies them. */
const DIGEST=/^sha256:[a-f0-9]{64}$/u;
const HEX64=/^[0-9a-f]{64}$/u;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const fail=()=>{throw Object.assign(new Error('NATIVE_PROCESSING_CONFIGURATION'),{code:'NATIVE_PROCESSING_CONFIGURATION'});};
const absolute=value=>{
 if(typeof value!=='string'||!value.startsWith('/')||value.includes('\0')||value.includes('..')||value.length>1024)fail();
 return value;
};
const integer=(value,min,max)=>{if(!Number.isSafeInteger(value)||value<min||value>max)fail();return value;};
const text=(value,re)=>{if(typeof value!=='string'||!re.test(value))fail();return value;};

/** @param {{env:Record<string,string|undefined>}} input */
export function nativeProcessingConfig({env=globalThis.process?.env??{}}={}){
 const get=name=>env[name]===undefined||env[name]===''?undefined:env[name];
 const config=Object.freeze({
  listen:Object.freeze({address:text(get('MERI_NATIVE_PROCESSING_ADDRESS')??'127.0.0.1',/^(?:127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})$/u),
   port:integer(Number(get('MERI_NATIVE_PROCESSING_PORT')),1024,65535)}),
  tls:Object.freeze({keyPath:absolute(get('MERI_NATIVE_PROCESSING_TLS_KEY')),
   certPath:absolute(get('MERI_NATIVE_PROCESSING_TLS_CERT')),
   peerSan:text(get('MERI_NATIVE_PROCESSING_PEER_SAN'),/^[a-z0-9][a-z0-9.-]{2,252}$/u),
   peerFingerprint:text(get('MERI_NATIVE_PROCESSING_PEER_FINGERPRINT'),HEX64)}),
  image:Object.freeze({digest:text(get('MERI_NATIVE_PROCESSING_IMAGE_DIGEST'),DIGEST)}),
  allocation:Object.freeze({hostId:text(get('MERI_NATIVE_PROCESSING_HOST_ID'),UUID),
   generation:integer(Number(get('MERI_NATIVE_PROCESSING_GENERATION')),1,999999999),
   conversationId:text(get('MERI_NATIVE_PROCESSING_CONVERSATION_ID'),UUID),
   leaseDeadlineMs:integer(Number(get('MERI_NATIVE_PROCESSING_LEASE_DEADLINE_MS')),1,Number.MAX_SAFE_INTEGER)}),
  limits:Object.freeze({cpuQuotaUs:integer(Number(get('MERI_NATIVE_PROCESSING_CPU_QUOTA_US')),1000,4000000),
   periodUs:integer(Number(get('MERI_NATIVE_PROCESSING_CPU_PERIOD_US')),1000,1000000),
   memoryBytes:integer(Number(get('MERI_NATIVE_PROCESSING_MEMORY_BYTES')),16*1024*1024,64*1024*1024*1024),
   pidsMax:integer(Number(get('MERI_NATIVE_PROCESSING_PIDS_MAX')),1,4096),
   deadlineMaxMs:integer(Number(get('MERI_NATIVE_PROCESSING_DEADLINE_MAX_MS')),1000,60000),
   bodyBytes:integer(Number(get('MERI_NATIVE_PROCESSING_BODY_BYTES')),1024,100000000)}),
  paths:Object.freeze({helperPath:absolute(get('MERI_NATIVE_PROCESSING_HELPER')),
   home:absolute(get('MERI_NATIVE_PROCESSING_HOME')),browsersPath:absolute(get('MERI_NATIVE_PROCESSING_HOME')),
   definitionsRoot:absolute(get('MERI_NATIVE_PROCESSING_DEFINITIONS')),
   extractorPath:absolute(get('MERI_NATIVE_PROCESSING_EXTRACTOR')),
   scratchRoot:absolute(get('MERI_NATIVE_PROCESSING_SCRATCH')),
   runtimeUid:integer(Number(get('MERI_NATIVE_PROCESSING_RUNTIME_UID')),1000,65533),
   runtimeGid:integer(Number(get('MERI_NATIVE_PROCESSING_RUNTIME_GID')),1000,65533),
   credentialPaths:Object.freeze(String(get('MERI_NATIVE_PROCESSING_CREDENTIAL_PATHS')??'').split(',').filter(Boolean).map(absolute))}),
 });
 if(config.paths.credentialPaths.length===0)fail();   // never an invented empty protected inventory
 return config;
}
