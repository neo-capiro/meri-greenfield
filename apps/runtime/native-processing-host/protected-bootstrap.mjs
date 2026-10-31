/** Actual protected native guest bootstrap: the fixed installed program invoked by the SSM document.
 *
 *  The only input is the canonical `SSM_Payload` environment value. It is decoded by the shared public codec; the SendCommand
 *  request is derived through the shared public builder. Prepare generates TWO distinct RSA keys/CSRs and signs the CANONICAL
 *  shared proof statement (the prepare observation minus its two proof fields). One complete immutable state is published
 *  create-if-absent; an exact winner replays after full key/CSR/SPKI/proof/lease validation, while partial/foreign/expired state
 *  refuses and is never reminted. Install validates the retained links and the issued root/leaf identity, then publishes the
 *  complete protected bundle exactly once and reads back the same observation.
 *
 *  Only low-level filesystem/identity/clock effects are injectable. The cryptography and the public contract are real, and no
 *  private byte is ever written to stdout, an observation, a config projection or a return value.
 */
import {X509Certificate,createHash,createPublicKey,createPrivateKey} from 'node:crypto';
import {readFileSync,lstatSync,mkdirSync,openSync,closeSync,fstatSync,writeSync,fsyncSync,linkSync,unlinkSync,constants} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
 decodeNativeBootstrapPayload,assertNativeBootstrapObservation,nativeBootstrapKeyProofMessage,createNativeBootstrapRequest,
 assertNativeBootstrapSpec,NATIVE_BOOTSTRAP_INSTALLED,nativeBootstrapCleanupCeiling,
} from '@capiro/meri-contracts/native-bootstrap';
import {canonicalJson,canonicalSha256} from '@capiro/meri-contracts/node';
import {UPLOAD_INSPECTION_WIRE_BYTES} from '../uploads/agentcore-contract.mjs';
import {createRunnerPoststartCsr,verifyRunnerPoststartProof} from '../native-authority/runner-poststart-csr.mjs';

const fault=code=>{throw Object.assign(new Error(code),{code});};
const REFUSED='NATIVE_PROTECTED_BOOTSTRAP_REFUSED';
const STATE='prepare.json',BUNDLE='installed.json',MAX_MS=900000,MIN_SEND_MS=30000;
/** Canonical upload wire bound plus the fixed envelope allowance; never an invented cap. */
const CANONICAL_BODY_BYTES=UPLOAD_INSPECTION_WIRE_BYTES+65536;
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const spkiOf=certificate=>sha256(Buffer.from(certificate.publicKey.export({type:'spki',format:'der'})));
const canonicalPem=value=>new X509Certificate(value).toString();
const certHash=certificate=>sha256(Buffer.from(certificate.raw));
const stepOf=decoded=>decoded.prepareOperationId===undefined?'prepare':'install';

/** Fixed protected layout. No request data can change these paths. */
export const PROTECTED_ROOT='/var/lib/meri/native-bootstrap';
export const PROTECTED_BUNDLE_DIR='/var/lib/meri/native-bootstrap/bundle';
/** Release-supplied protected profile/physical identity inputs. Declared explicitly, never inferred from Temporal or Control. */
export const PROTECTED_PROFILE='/var/lib/meri/native-bootstrap/profile.json';
export const PROTECTED_PROGRAM='/opt/meri/native-bootstrap.mjs';
/** The ONE fixed deployment launcher selected for execution and verified against the helper pin. */
export const PROTECTED_HELPER='/opt/meri/meri-host-launcher';

/** The canonical shared proof statement: the prepare observation minus its two proof fields (no local variant). */
export const proofStatement=observation=>{
 const {hostProofBase64,serverProofBase64,...statement}=observation;
 void hostProofBase64;void serverProofBase64;
 return statement;
};

function assertRoot(identity,store){
 if(identity?.uid!==0||identity?.euid!==0)fault(REFUSED);
 if(typeof store.assertDirectory==='function'){store.assertDirectory(PROTECTED_ROOT);return;}
 // Minimal store seam (tests): require a real directory without group/world write.
 const mode=store.stat(PROTECTED_ROOT);
 if(mode===null||(mode&0o170000)!==0o040000||(mode&0o022)!==0)fault(REFUSED);
}

/** Descriptor-held protected read (no-follow open, fstat on the SAME descriptor) plus create-if-absent publication. */
export function createBootstrapStateStore({fs={readFileSync,lstatSync,openSync,closeSync,fstatSync,writeSync,fsyncSync,linkSync,unlinkSync,
 mkdirSync,constants},root=PROTECTED_ROOT}={}){
 const file=name=>join(root,name);
 const flags=constants.O_RDONLY|constants.O_NOFOLLOW;
 return Object.freeze({
  assertDirectory(path){
   let s;try{s=fs.lstatSync(path);}catch{fault(REFUSED);}
   if(s.isSymbolicLink?.()||!s.isDirectory?.()||s.uid!==0||s.gid!==0||(s.mode&0o022)!==0)fault(REFUSED);
   return true;
  },
  stat(path){
   try{const s=fs.lstatSync(path);if(s.isSymbolicLink?.())fault(REFUSED);return s.mode;}catch(error){
    if(error?.code==='ENOENT')return null;fault(REFUSED);}
  },
  /** The descriptor is opened no-follow and validated with fstat; the SAME descriptor supplies the bytes. */
  read(name){
   const path=file(name);
   let fd=null;
   try{
    fd=fs.openSync(path,flags);
    const s=fs.fstatSync(fd);
    if((s.isSymbolicLink?.()===true)||(s.isFile?.()===false)||s.uid!==0||s.gid!==0||(s.mode&0o077)!==0)fault(REFUSED);
    return fs.readFileSync(fd);
   }catch(error){
    if(error?.code==='ENOENT')return null;
    if(error?.code===REFUSED)throw error;
    fault(REFUSED);
   }finally{if(fd!==null)try{fs.closeSync(fd);}catch{/* an already-closed descriptor is not an error */}}
  },
  /** Complete durable staging file, then an atomic no-overwrite publication (link). The final name never shows partial bytes. */
  write(name,bytes){
   const path=file(name),dir=dirname(path);
   fs.mkdirSync?.(dir,{recursive:true,mode:0o700});
   const staging=join(dir,`.stage-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
   let fd=null;
   try{
    fd=fs.openSync(staging,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL,0o600);
    // A legal short write must never publish truncation: loop until every byte is durable.
    let offset=0;
    while(offset<bytes.length){
     const written=fs.writeSync(fd,bytes,offset,bytes.length-offset,null);
     if(!Number.isSafeInteger(written)||written<=0)fault(REFUSED);
     offset+=written;
    }
    fs.fsyncSync(fd);
    fs.closeSync(fd);fd=null;
   }catch{
    if(fd!==null)try{fs.closeSync(fd);}catch{/* ignore */}
    try{fs.unlinkSync(staging);}catch{/* absent staging is fine */}
    fault(REFUSED);
   }
   let winner=null;
   try{fs.linkSync(staging,path);}
   catch(error){
    if(error?.code!=='EEXIST'){try{fs.unlinkSync(staging);}catch{/* ignore */}fault(REFUSED);}
    winner=this.read(name);                                   // an existing owner wins; never overwritten
   }
   try{fs.unlinkSync(staging);}catch{/* ignore */}
   // Directory durability is required on Linux; Windows cannot open/fsync a directory, which is the only tolerated case.
   try{
    const dirFd=fs.openSync(dir,constants.O_RDONLY);
    try{fs.fsyncSync(dirFd);}finally{fs.closeSync(dirFd);}
   }catch(error){
    if(!(process.platform==='win32'&&['EISDIR','EPERM','EINVAL','EBADF'].includes(error?.code)))fault(REFUSED);
   }
   return winner;
  },
  readBundle(name){return this.read(name);},
 });
}

/** Actual Linux identity defaults: real boot UUID and effective ids. No request or environment assertion is attestation. */
export function linuxIdentity({readFile=readFileSync}={}){
 return Object.freeze({uid:typeof process.getuid==='function'?process.getuid():-1,
  euid:typeof process.geteuid==='function'?process.geteuid():-1,
  bootId(){const raw=readFile('/proc/sys/kernel/random/boot_id','utf8').trim();
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(raw))fault(REFUSED);
   return raw;}});
}

/** ONE protected-source validation shared by the CLI and the installed startup path.
 *  The immutable public profile must carry ALL mandatory source provenance and must match the request scope exactly; the helper
 *  pin is required and compared only when the scope declares one. Program/profile bytes remain fixed and pinned. */
export function validateProtectedSource({profile,scope,readFile=readFileSync,helperPath}){
 if(profile===null||typeof profile!=='object')fault(REFUSED);
 for(const field of ['programSha256','helperSha256','sourceCommit','imageDigest','bootstrapSha256'])
  if(typeof profile[field]!=='string'||profile[field].length===0)fault(REFUSED);
 if(profile.bootId!==undefined||profile.instanceId!==undefined)fault(REFUSED);   // dynamic identity is separate
 if(scope===null||typeof scope!=='object'||scope.source===null||typeof scope.source!=='object')fault(REFUSED);
 for(const field of ['sourceCommit','imageDigest','bootstrapSha256'])
  if(typeof scope.source[field]!=='string'||profile[field]!==scope.source[field])fault(REFUSED);
 if(!/^[a-f0-9]{64}$/u.test(profile.programSha256)||!/^[a-f0-9]{64}$/u.test(profile.helperSha256))fault(REFUSED);
 // The executable selected for use and the verified helper are ONE identity, checked here so BOTH the CLI and the installed
 // startup refuse a conflicting layout selection BEFORE any key/state/runtime effect.
 const layoutHelper=profile.layout?.paths?.helperPath;
 if(layoutHelper!==undefined&&layoutHelper!==PROTECTED_HELPER)fault(REFUSED);
 const helper=fixedPath(helperPath??profile.helperPath??PROTECTED_HELPER);
 if(helper!==PROTECTED_HELPER)fault(REFUSED);
 if(sha256(Buffer.from(readFile(helper)))!==profile.helperSha256)fault(REFUSED);
 if(sha256(Buffer.from(readFile(PROTECTED_PROGRAM)))!==profile.programSha256)fault(REFUSED);
 if(scope.source.nativeHelperSha256!==undefined){
  if(typeof scope.source.nativeHelperSha256!=='string'||scope.source.nativeHelperSha256!==profile.helperSha256)fault(REFUSED);
 }
 return Object.freeze({helperPath:helper});
}

/** The fixed protected installed profile: pinned reviewed program/profile/helper bytes and the physical identity binding. */
const FIXED_PREFIXES=Object.freeze(['/opt/meri/','/var/lib/meri/native-bootstrap/']);
const fixedPath=value=>{
 if(typeof value!=='string'||!FIXED_PREFIXES.some(prefix=>value.startsWith(prefix))||value.includes('..'))fault(REFUSED);
 return value;
};
/** The fixed protected profile: reviewed finite image layout, pinned program/profile/helper BYTES, physical boot binding. */
export function readProtectedProfile({store,readFile=readFileSync,spec,scope}={}){
 const raw=store.read('profile.json');
 if(raw===null)fault(REFUSED);
 let profile;try{profile=JSON.parse(raw.toString('utf8'));}catch{fault(REFUSED);}
 // The invoked program is FIXED; a profile may only confirm it, never choose another file.
 if(profile.programPath!==undefined&&profile.programPath!==PROTECTED_PROGRAM)fault(REFUSED);
 if(profile.helperPath!==undefined&&profile.helperPath!==PROTECTED_HELPER)fault(REFUSED);
 if(spec!==undefined){
  if(sha256(raw)!==spec.profileSha256)fault(REFUSED);        // the spec pins the reviewed PUBLIC profile bytes
  if(profile.programSha256!==spec.programSha256)fault(REFUSED);
 }
 const {helperPath}=validateProtectedSource({profile,scope,readFile});
 return Object.freeze({...profile,helperPath});
}

/** A create-if-absent store may return the WINNER's bytes; anything else is not an authoritative value. */
const writtenBytes=value=>Buffer.isBuffer(value)?value:(typeof value==='string'?Buffer.from(value,'utf8'):null);
function retain(observation,keyPem,otherKeyPem){
 return Buffer.from(JSON.stringify({observation,hostKeyPem:keyPem,serverKeyPem:otherKeyPem}),'utf8');
}

/** Validate a retained prepare state completely: private keys, CSR/SPKI identity, both canonical proofs, boot/operation links. */
function validateRetained(raw,{request,decoded,ctx,bootId}){
 let state;try{state=JSON.parse(raw.toString('utf8'));}catch{fault(REFUSED);}
 if(state===null||typeof state!=='object'||typeof state.hostKeyPem!=='string'||typeof state.serverKeyPem!=='string')
  fault(REFUSED);                                             // partial state without BOTH private keys refuses
 const observation=state.observation;
 if(observation===null||typeof observation!=='object')fault(REFUSED);
 if(observation.operationId!==decoded.operationId||observation.requestSha256!==canonicalSha256(request)||
  observation.bootId!==bootId||observation.scope?.instanceId!==ctx.scope.instanceId){
  fault(REFUSED);}
 try{assertNativeBootstrapObservation(observation,{request});}catch{fault(REFUSED);}
 const statement=proofStatement(observation);
 for(const [role,csrPem,proofBase64,keyPem,spki] of [['host-client',observation.hostCsrPem,observation.hostProofBase64,
  state.hostKeyPem,observation.hostSpkiSha256],['host-server',observation.serverCsrPem,observation.serverProofBase64,
  state.serverKeyPem,observation.serverSpkiSha256]]){
  verifyRunnerPoststartProof({csrPem,message:nativeBootstrapKeyProofMessage(statement,role),proofBase64});
  if(sha256(Buffer.from(createPublicKey(keyPem).export({type:'spki',format:'der'})))!==spki)fault(REFUSED);
 }
 return observation;
}

/** Guest PREPARE. */
export async function prepareProtectedGuest({request,payload,store,identity,now=Date.now,signal}){
 if(signal?.aborted===true)fault(REFUSED);
 const decoded=decodeNativeBootstrapPayload(payload);
 if(stepOf(decoded)!=='prepare')fault(REFUSED);
 assertRoot(identity,store);
 const ctx=decoded,lease=ctx.scope.allocation.leaseDeadlineMs;
 if(!Number.isSafeInteger(lease))fault(REFUSED);
 const bootId=identity.bootId();
 const at=now();
 if(!Number.isSafeInteger(at)||at>=lease)fault(REFUSED);        // ORIGINAL absolute lease bounds every replay/effect
 const existing=store.read(STATE);
 if(existing!==null){
  const observation=validateRetained(existing,{request,decoded,ctx,bootId});
  if(signal?.aborted===true||now()>=lease)fault(REFUSED);
  return observation;                                          // exact immutable replay; no remint
 }
 if(at<lease-MAX_MS)fault(REFUSED);
 const host=createRunnerPoststartCsr(),server=createRunnerPoststartCsr();
 const hostSpkiSha256=sha256(Buffer.from(createPublicKey(host.keyPem).export({type:'spki',format:'der'})));
 const serverSpkiSha256=sha256(Buffer.from(createPublicKey(server.keyPem).export({type:'spki',format:'der'})));
 if(hostSpkiSha256===serverSpkiSha256)fault(REFUSED);
 // The proof statement IS the canonical prepare observation minus its proofs.
 const statement={schema:'meri-native-bootstrap-prepare/1',operationId:decoded.operationId,
  requestSha256:canonicalSha256(request),scope:ctx.scope,bootId,preparedAtMs:at,hostCsrPem:host.csrPem,serverCsrPem:server.csrPem,
  hostSpkiSha256,serverSpkiSha256};
 const observation={...statement,
  hostProofBase64:host.signProof(nativeBootstrapKeyProofMessage(statement,'host-client')),
  serverProofBase64:server.signProof(nativeBootstrapKeyProofMessage(statement,'host-server'))};
 assertNativeBootstrapObservation(observation,{request});
 for(const [role,csrPem,proofBase64] of [['host-client',observation.hostCsrPem,observation.hostProofBase64],
  ['host-server',observation.serverCsrPem,observation.serverProofBase64]])
  verifyRunnerPoststartProof({csrPem,message:nativeBootstrapKeyProofMessage(statement,role),proofBase64});
 if(signal?.aborted===true||now()>=lease)fault(REFUSED);
 const published=store.write(STATE,retain(observation,host.keyPem,server.keyPem));
 if(writtenBytes(published)!==null){                                        // a concurrent exact winner is authoritative
  const winner=validateRetained(writtenBytes(published),{request,decoded,ctx,bootId});
  if(canonicalSha256(winner)!==canonicalSha256(observation))fault(REFUSED);
  return winner;
 }
 const readback=store.read(STATE);
 if(readback===null)fault(REFUSED);
 return validateRetained(readback,{request,decoded,ctx,bootId});
}

/** Guest INSTALL. */
export async function installProtectedGuest({request,payload,store,identity,now=Date.now,signal}){
 if(signal?.aborted===true)fault(REFUSED);
 const decoded=decodeNativeBootstrapPayload(payload);
 if(stepOf(decoded)!=='install')fault(REFUSED);
 assertRoot(identity,store);
 const ctx=decoded,lease=ctx.scope.allocation.leaseDeadlineMs;
 const at=now();
 if(!Number.isSafeInteger(at)||at>=lease)fault(REFUSED);
 const retainedRaw=store.read(STATE);
 if(retainedRaw===null)fault(REFUSED);
 const retained=JSON.parse(retainedRaw.toString('utf8'));
 const prepareObservation=validateRetained(retainedRaw,{request:createNativeBootstrapRequest(prepareWire(decoded)),
  decoded:{operationId:decoded.prepareOperationId},ctx:{scope:decoded.scope},bootId:identity.bootId()});
 if(canonicalSha256(prepareObservation)!==decoded.prepareObservationSha256)fault(REFUSED);
 if(identity.bootId()!==decoded.bootId||decoded.bootId!==prepareObservation.bootId)fault(REFUSED);
 // Certificates come ONLY from the immutable decoded payload; no caller parameter can override them.
 const spec=decoded.bootstrapSpec,ca=new X509Certificate(spec.issuerCaCertificate);
 const host=new X509Certificate(decoded.hostCertificate),server=new X509Certificate(decoded.serverCertificate);
 const hostSpki=sha256(Buffer.from(createPublicKey(retained.hostKeyPem).export({type:'spki',format:'der'})));
 const serverSpki=sha256(Buffer.from(createPublicKey(retained.serverKeyPem).export({type:'spki',format:'der'})));
 if(hostSpki!==prepareObservation.hostSpkiSha256||serverSpki!==prepareObservation.serverSpkiSha256)fault(REFUSED);
 const a=decoded.scope.allocation,hostName=`h-${a.hostId.replace(/-/gu,'')}-g${a.generation}.host.meri.internal`;
 for(const [leaf,name,purpose,spki,ceiling] of [[host,hostName,['1.3.6.1.5.5.7.3.2'],hostSpki,lease],
  [server,decoded.scope.endpoint.serverName,['1.3.6.1.5.5.7.3.1'],serverSpki,nativeBootstrapCleanupCeiling(decoded.scope)]]){
  if(!leaf.checkIssued(ca)||!leaf.verify(ca.publicKey))fault(REFUSED);
  if(leaf.subject!==''||leaf.subjectAltName!==`DNS:${name}`)fault(REFUSED);
  if(JSON.stringify(leaf.keyUsage)!==JSON.stringify(purpose))fault(REFUSED);
  const from=Date.parse(leaf.validFrom),to=Date.parse(leaf.validTo);
  if(!(from<=at&&to>at&&to<=ceiling&&to-from<=MAX_MS))fault(REFUSED);
  if(spkiOf(leaf)!==spki)fault(REFUSED);
 }
 const projection={schema:NATIVE_BOOTSTRAP_INSTALLED,scope:decoded.scope,bootId:decoded.bootId,
  prepareOperationId:decoded.prepareOperationId,prepareRequestSha256:decoded.prepareRequestSha256,
  prepareObservationSha256:decoded.prepareObservationSha256,installOperationId:decoded.operationId,
  installRequestSha256:canonicalSha256(request),hostCertificateSha256:certHash(host),serverCertificateSha256:certHash(server),
  hostSpkiSha256:hostSpki,serverSpkiSha256:serverSpki};
 const observation={schema:'meri-native-bootstrap-install/1',operationId:decoded.operationId,
  requestSha256:canonicalSha256(request),scope:decoded.scope,prepareOperationId:decoded.prepareOperationId,
  prepareRequestSha256:decoded.prepareRequestSha256,prepareObservationSha256:decoded.prepareObservationSha256,
  bootId:decoded.bootId,installedAtMs:at,hostSpkiSha256:hostSpki,serverSpkiSha256:serverSpki,
  hostCertificateSha256:projection.hostCertificateSha256,serverCertificateSha256:projection.serverCertificateSha256,
  configSha256:canonicalSha256(projection)};
 assertNativeBootstrapObservation(observation,{request,prepareObservation});
 // Existing bundle: validate the exact links and return the SAME readback (never rewrite/renew).
 const existing=store.read(BUNDLE);
 if(existing!==null){
  let bundle;try{bundle=JSON.parse(existing.toString('utf8'));}catch{fault(REFUSED);}
  const saved=bundle.observation;
  if(saved===null||typeof saved!=='object'||saved.operationId!==observation.operationId||
   saved.configSha256!==observation.configSha256||bundle.hostCertificate!==decoded.hostCertificate||
   bundle.serverCertificate!==decoded.serverCertificate||saved.installedAtMs!==undefined&&saved.installedAtMs>at)fault(REFUSED);
  return {observation:saved,config:bundle.config};
 }
 const config=Object.freeze({schema:'meri-native-bootstrap-installed/1',
  listen:{address:'127.0.0.1',port:spec.hostEndpoint.port},serverName:spec.hostEndpoint.serverName,
  control:{address:spec.control.endpoint.address,port:spec.control.endpoint.port,
   serverName:spec.control.endpoint.serverName,clientName:spec.control.clientName,policySha256:spec.control.policySha256,
   peerFingerprintSha256:sha256(Buffer.from(new X509Certificate(spec.control.serverCertificate).raw))},
  credentialPaths:Object.freeze([`${PROTECTED_BUNDLE_DIR}/host.client.key`,`${PROTECTED_BUNDLE_DIR}/host.server.key`,
   `${PROTECTED_BUNDLE_DIR}/ca.pem`,`${PROTECTED_ROOT}/${STATE}`,`${PROTECTED_ROOT}/${BUNDLE}`,`${PROTECTED_PROFILE}`])});
 const bundle={observation,projection,config,bootstrapSpec:spec,hostCertificate:decoded.hostCertificate,
  serverCertificate:decoded.serverCertificate,caCertificate:spec.issuerCaCertificate,
  controlCaCertificate:spec.control.caCertificate,
  hostKeyPem:retained.hostKeyPem,serverKeyPem:retained.serverKeyPem};
 publishBundleFiles(store,bundle);                            // the exact files the default entrypoint reads
 if(signal?.aborted===true||now()>=lease)fault(REFUSED);
 const published=store.write(BUNDLE,Buffer.from(JSON.stringify(bundle),'utf8'));
 const bundleBytes=writtenBytes(published)??store.read(BUNDLE);
 if(bundleBytes===null)fault(REFUSED);
 const readback=JSON.parse(bundleBytes.toString('utf8'));
 if(readback.observation?.configSha256!==observation.configSha256||readback.hostCertificate!==decoded.hostCertificate)
  fault(REFUSED);
 return {observation:readback.observation,config:readback.config};
}

/** Reconstruct the prepare wire payload an install retains, for retained-state validation only. */
function prepareWire(decoded){
 return {schema:'meri-native-bootstrap-prepare-request/1',operationId:decoded.prepareOperationId,
  scope:decoded.scope,bootstrapSpec:decoded.bootstrapSpec};
}

export const BUNDLE_FILES=Object.freeze({serverKey:'host.server.key',serverCert:'host.server.crt',
 clientKey:'host.client.key',clientCert:'host.client.crt',ca:'ca.pem',controlCa:'control-ca.pem'});

/** Publish the protected TLS files exactly once: create-if-absent, and an existing file must already match byte-for-byte. */
export function publishBundleFiles(store,bundle){
 const files={[BUNDLE_FILES.serverKey]:bundle.serverKeyPem,[BUNDLE_FILES.serverCert]:bundle.serverCertificate,
  [BUNDLE_FILES.clientKey]:bundle.hostKeyPem,[BUNDLE_FILES.clientCert]:bundle.hostCertificate,
  [BUNDLE_FILES.ca]:bundle.caCertificate,[BUNDLE_FILES.controlCa]:bundle.controlCaCertificate};
 for(const [name,content] of Object.entries(files)){
  const bytes=Buffer.isBuffer(content)?content:Buffer.from(String(content),'utf8');
  let existing=null;try{existing=store.read(name);}catch{fault(REFUSED);}
  if(existing!==null){if(!existing.equals(bytes))fault(REFUSED);continue;}
  const winner=writtenBytes(store.write(name,bytes));
  if(winner!==null&&!winner.equals(bytes))fault(REFUSED);
 }
 return true;
}

/** Default reader: the installed protected bundle is the ONLY source of the two TLS identities for the entrypoint.
 *  It binds keys to leaves, checks validity start/total lifetime/original lease, SPKI and certificate pins, the exact config
 *  projection, and keeps the NATIVE issuer root separate from the Control peer root. */
export function readInstalledTls({store=createBootstrapStateStore(),now=Date.now}={}){
 const raw=store.read(BUNDLE);
 if(raw===null)fault(REFUSED);
 let bundle;try{bundle=JSON.parse(raw.toString('utf8'));}catch{fault(REFUSED);}
 const observation=bundle.observation;
 if(observation===null||typeof observation!=='object'||observation.scope?.allocation===undefined)fault(REFUSED);
 const files={};
 for(const [role,name] of Object.entries(BUNDLE_FILES)){
  const bytes=store.read(name);if(bytes===null)fault(REFUSED);files[role]=bytes;
 }
 const at=now();
 const ca=new X509Certificate(files.ca),controlCa=new X509Certificate(files.controlCa);
 const server=new X509Certificate(files.serverCert),client=new X509Certificate(files.clientCert);
 const lease=observation.scope.allocation.leaseDeadlineMs;
 const a=observation.scope.allocation,hostName=`h-${a.hostId.replace(/-/gu,'')}-g${a.generation}.host.meri.internal`;
 if(server.subjectAltName!==`DNS:${bundle.config.serverName}`||client.subjectAltName!==`DNS:${hostName}`)fault(REFUSED);
 if(JSON.stringify(server.keyUsage)!==JSON.stringify(['1.3.6.1.5.5.7.3.1'])||
  JSON.stringify(client.keyUsage)!==JSON.stringify(['1.3.6.1.5.5.7.3.2']))fault(REFUSED);
 for(const leaf of [server,client])if(!leaf.checkIssued(ca)||!leaf.verify(ca.publicKey))fault(REFUSED);
 // The exact retained projection must reproduce the saved config hash.
 const projection={schema:NATIVE_BOOTSTRAP_INSTALLED,scope:observation.scope,bootId:observation.bootId,
  prepareOperationId:observation.prepareOperationId,prepareRequestSha256:observation.prepareRequestSha256,
  prepareObservationSha256:observation.prepareObservationSha256,installOperationId:observation.operationId,
  installRequestSha256:observation.requestSha256,hostCertificateSha256:certHash(client),
  serverCertificateSha256:certHash(server),hostSpkiSha256:spkiOf(client),serverSpkiSha256:spkiOf(server)};
 if(canonicalSha256(projection)!==observation.configSha256)fault(REFUSED);
 const spec=assertNativeBootstrapSpec(bundle.bootstrapSpec);
 // The retained spec must be the exact one the saved scope committed to, and the CA files must be its certificates.
 if(canonicalSha256(spec)!==observation.scope.bootstrapSpecSha256)fault(REFUSED);
 if(files.ca.toString('utf8')!==canonicalPem(spec.issuerCaCertificate))fault(REFUSED);
 if(files.controlCa.toString('utf8')!==canonicalPem(spec.control.caCertificate))fault(REFUSED);
 const from=Date.parse(server.validFrom),to=Date.parse(server.validTo);
 if(!(from<=at&&to>at&&to<=nativeBootstrapCleanupCeiling(observation.scope)&&to-from<=MAX_MS))fault(REFUSED);
 const cFrom=Date.parse(client.validFrom),cTo=Date.parse(client.validTo);
 if(!(cFrom<=at&&cTo>at&&cTo<=lease&&cTo-cFrom<=MAX_MS))fault(REFUSED);
 if(!server.checkPrivateKey(createPrivateKey(files.serverKey))||!client.checkPrivateKey(createPrivateKey(files.clientKey)))
  fault(REFUSED);                                          // each private key belongs to its own leaf
 if(spkiOf(server)!==observation.serverSpkiSha256||spkiOf(client)!==observation.hostSpkiSha256)fault(REFUSED);
 if(certHash(server)!==observation.serverCertificateSha256||certHash(client)!==observation.hostCertificateSha256)fault(REFUSED);
 if(createPublicKey(files.serverKey).export({type:'spki',format:'der'})
  .equals(createPublicKey(files.clientKey).export({type:'spki',format:'der'})))fault(REFUSED);
 return Object.freeze({tls:{serverKey:files.serverKey,serverCert:files.serverCert,clientKey:files.clientKey,
  clientCert:files.clientCert,ca:files.ca,controlCa:files.controlCa},nativeCa:files.ca,controlCa:files.controlCa,
  config:bundle.config,observation,spec,bundle});
}

/** The actual physical identity read at startup (dynamic, never part of the immutable prelaunch public profile). */
export const PROTECTED_IDENTITY='identity.json';
export function readProtectedIdentity({store,identity}={}){
 const raw=store.read(PROTECTED_IDENTITY);
 if(raw===null)fault(REFUSED);
 let value;try{value=JSON.parse(raw.toString('utf8'));}catch{fault(REFUSED);}
 if(value===null||typeof value!=='object'||typeof value.bootId!=='string'||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value.bootId)||
  typeof value.instanceId!=='string'||!/^i-[0-9a-f]{8,17}$/u.test(value.instanceId))fault(REFUSED);
 if(identity!==undefined&&value.bootId!==identity.bootId())fault(REFUSED);   // must be the live boot, not a claim
 return Object.freeze({bootId:value.bootId,instanceId:value.instanceId});
}

const LIMITS=Object.freeze({cpuQuotaUs:[1000,4000000],periodUs:[1000,1000000],memoryBytes:[16*1024*1024,64*1024*1024*1024],
 pidsMax:[1,4096],deadlineMaxMs:[1000,60000],bodyBytes:[1024,CANONICAL_BODY_BYTES]});
function validateFiniteConfig(layout){
 if(layout===null||typeof layout!=='object'||layout.limits===null||typeof layout.limits!=='object'||
  layout.paths===null||typeof layout.paths!=='object')fault(REFUSED);
 const limits={};
 for(const [key,[min,max]] of Object.entries(LIMITS)){
  const value=layout.limits[key];
  if(!Number.isSafeInteger(value)||value<min||value>max)fault(REFUSED);
  limits[key]=value;
 }
 const p=layout.paths,absolute=value=>{
  if(typeof value!=='string'||!value.startsWith('/')||value.includes('..')||value.length>1024)fault(REFUSED);
  return value;};
 if(p.helperPath!==PROTECTED_HELPER)fault(REFUSED);        // layout cannot select an unverified executable
 const paths={helperPath:absolute(p.helperPath),nodePath:absolute(p.nodePath),home:absolute(p.home),
  childPath:absolute(p.childPath),definitionsRoot:absolute(p.definitionsRoot),extractorPath:absolute(p.extractorPath),
  scratchRoot:absolute(p.scratchRoot),runtimeUid:1000,runtimeGid:1000};
 return {limits,paths};
}

/** Complete validated runtime configuration from the installed bundle + fixed protected profile + live physical identity. */
export function installedRuntimeConfig({store=createBootstrapStateStore(),now=Date.now,identity,readFile=readFileSync}={}){
 const installed=readInstalledTls({store,now});
 const bundle=installed.bundle,spec=installed.spec,observation=installed.observation,scope=observation.scope;
 const profileRaw=store.read('profile.json');
 if(profileRaw===null)fault(REFUSED);
 let profile;try{profile=JSON.parse(profileRaw.toString('utf8'));}catch{fault(REFUSED);}
 if(sha256(profileRaw)!==spec.profileSha256||profile.programSha256!==spec.programSha256)fault(REFUSED);
 // One shared protected-source validation: all mandatory provenance, helper pin iff declared, fixed byte pins.
 validateProtectedSource({profile,scope,readFile});
 // On Linux the default identity read is the LIVE boot; source tests on other platforms must pass it explicitly.
 const live=readProtectedIdentity({store,identity:(identity??(process.platform==='linux'?linuxIdentity():undefined))});
 if(live.bootId!==observation.bootId||live.instanceId!==scope.instanceId)fault(REFUSED);
 const lease=scope.allocation.leaseDeadlineMs,at=now();
 if(!Number.isSafeInteger(at)||at>=lease)fault(REFUSED);
 const {limits,paths}=validateFiniteConfig(profile.layout);
 const controlServer=new X509Certificate(spec.control.serverCertificate);
 const controlClient=new X509Certificate(spec.control.clientCertificate);
 const serverFingerprint=sha256(Buffer.from(controlServer.raw));
 const clientFingerprint=sha256(Buffer.from(controlClient.raw));
 const maxPeerLifetimeMs=900000;
 // Inbound peer is the Control CLIENT; outbound server pin is the Control SERVER. Both use their ACTUAL leaf expiry.
 const peerNotAfterMs=Date.parse(controlClient.validTo),cleanupCeilingMs=nativeBootstrapCleanupCeiling(scope);
 if(!(Date.parse(controlClient.validFrom)<=at&&Date.parse(controlClient.validTo)>at))fault(REFUSED);
 const credentialPaths=[PROTECTED_ROOT+'/prepare.json',PROTECTED_ROOT+'/installed.json',PROTECTED_ROOT+'/profile.json',
  PROTECTED_ROOT+'/identity.json',PROTECTED_ROOT+'/'+BUNDLE_FILES.serverKey,PROTECTED_ROOT+'/'+BUNDLE_FILES.serverCert,
  PROTECTED_ROOT+'/'+BUNDLE_FILES.clientKey,PROTECTED_ROOT+'/'+BUNDLE_FILES.clientCert,PROTECTED_ROOT+'/'+BUNDLE_FILES.ca,
  PROTECTED_ROOT+'/'+BUNDLE_FILES.controlCa];
 return Object.freeze({
  installed:true,
  allocation:scope.allocation,
  hostIdentity:Object.freeze({schema:'meri-d005-host-identity/1',hostId:scope.allocation.hostId,
   conversationId:scope.allocation.conversationId,instanceId:live.instanceId,bootId:live.bootId}),
  binding:scope.originalBinding,image:{digest:scope.source.imageDigest},
  tls:{installed:true,peerSan:spec.control.clientName,peerFingerprint:clientFingerprint,maxPeerLifetimeMs,
   peerNotAfterMs,cleanupCeilingMs},
  control:{address:spec.control.endpoint.address,port:spec.control.endpoint.port,serverName:spec.control.endpoint.serverName,
   clientName:spec.control.clientName,policySha256:spec.control.policySha256,serverFingerprintSha256:serverFingerprint,
   peerFingerprintSha256:serverFingerprint,clientKeyPath:PROTECTED_ROOT+'/'+BUNDLE_FILES.clientKey,
   clientCertPath:PROTECTED_ROOT+'/'+BUNDLE_FILES.clientCert,caPath:PROTECTED_ROOT+'/'+BUNDLE_FILES.controlCa},
  listen:{address:scope.endpoint.address,port:spec.hostEndpoint.port},
  limits,
  paths:Object.freeze({...paths,childSettings:Object.freeze({runtimeUid:1000,runtimeGid:1000,
   imageDigest:scope.source.imageDigest,definitionsRoot:paths.definitionsRoot,extractorPath:paths.extractorPath,
   scratchRoot:paths.scratchRoot,credentialPaths:Object.freeze(credentialPaths)})}),
  installedTls:installed});
}

/** Public stdout: the canonical public serializer plus exactly one final LF. */
export function bootstrapStdout(observation){return `${canonicalJson(observation)}\n`;}

/** The fixed installed CLI. Input: canonical SSM_Payload only; the request is derived through the shared builder. */
export async function runProtectedBootstrapCli({env={},store=createBootstrapStateStore(),identity=linuxIdentity(),
 now=Date.now,signal,readFile=readFileSync}={}){
 if(typeof env.SSM_Payload!=='string'||env.SSM_Payload.length===0)fault(REFUSED);
 const decoded=decodeNativeBootstrapPayload(env.SSM_Payload);
 // Fixed protected profile + actual program/profile/helper bytes are validated BEFORE any key generation or effect.
 readProtectedProfile({store,readFile,spec:decoded.bootstrapSpec,scope:decoded.scope});
 // Dynamic physical identity is a separate protected input; it must be the live boot and the exact instance.
 const liveIdentity=readProtectedIdentity({store,identity});
 if(liveIdentity.instanceId!==decoded.scope.instanceId)fault(REFUSED);
 if(stepOf(decoded)==='install'&&liveIdentity.bootId!==decoded.bootId)fault(REFUSED);
 const request=createNativeBootstrapRequest(decoded);
 if(stepOf(decoded)==='prepare')return prepareProtectedGuest({request,payload:env.SSM_Payload,store,identity,now,signal});
 return installProtectedGuest({request,payload:env.SSM_Payload,store,identity,now,signal});
}

/** Executable entry: emits ONLY canonical public stdout; a refusal exits non-zero without private detail. */
export async function main({argv=process.argv,env=process.env,stdout=process.stdout,stderr=process.stderr}={}){
 void argv;
 try{
  const result=await runProtectedBootstrapCli({env});
  const observation=result?.observation??result;
  stdout.write(bootstrapStdout(observation));
  return 0;
 }catch(error){
  stderr.write(`${error?.code??REFUSED}\n`);
  return 1;
 }
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const code=await main();
 process.exitCode=code;
}
