/** PURE native bootstrap wire contract: closed payload/observation unions, canonical codec, exact SDK request,
 * reservation joins and cross-record checks. No I/O, issuer, key generation or transport trust. Actual CSR
 * signature/key-proof authentication remains owned by the existing 235 verifier. */
import {canonicalJson,canonicalSha256 as hash} from './validate.mjs';
import {privateAddress,dnsName,sha256Der,canonicalCertificatePem} from './native-tls-kernel.mjs';
import {own} from './commands-0.2/execution-boundary.mjs';
import {assertNativeHostAllocation,assertHostRunBindingPin} from './native-lifecycle.mjs';
import {NATIVE_DECLARATION_V2,nativeObserverDeadline} from './native-observer.mjs';

export const NATIVE_BOOTSTRAP_OPERATION_SCHEMA='meri-native-bootstrap-operation/1';
export const NATIVE_BOOTSTRAP_SPEC_SCHEMA='meri-native-bootstrap-spec/1';
export const NATIVE_BOOTSTRAP_PREPARE_REQUEST='meri-native-bootstrap-prepare-request/1';
export const NATIVE_BOOTSTRAP_INSTALL_REQUEST='meri-native-bootstrap-install-request/1';
export const NATIVE_BOOTSTRAP_PREPARE='meri-native-bootstrap-prepare/1';
export const NATIVE_BOOTSTRAP_INSTALL='meri-native-bootstrap-install/1';
export const NATIVE_BOOTSTRAP_INSTALLED='meri-native-bootstrap-installed/1';
export const NATIVE_BOOTSTRAP_PAYLOAD_MAX_BYTES=16384;
export const NATIVE_BOOTSTRAP_PAYLOAD_MAX_CHARS=21846;
export const NATIVE_BOOTSTRAP_STDOUT_MAX_BYTES=20000;
export const NATIVE_BOOTSTRAP_CLAIM_MIN_MS=30000;
export const NATIVE_BOOTSTRAP_STEPS=Object.freeze(['prepare','install']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const HEX64=/^[0-9a-f]{64}$/u,INSTANCE=/^i-(?:[0-9a-f]{8}|[0-9a-f]{17})$/u;
const CERT=/^-----BEGIN CERTIFICATE-----/u;
const refuse=code=>{throw Object.assign(Error(code),{code});};
const closed=(value,required)=>{try{return own(value,required);}catch{refuse('NATIVE_BOOTSTRAP_REQUEST_REFUSED');}};
const isPrivate=v=>{try{privateAddress(v);return true;}catch{return false;}};
const text=(v,min=1,max=Infinity)=>typeof v==='string'&&v.length>=min&&v.length<=max;
function certificate(value){try{return canonicalCertificatePem(value,8192);}catch{refuse('NATIVE_BOOTSTRAP_SPEC_REFUSED');}}
function csr(value){if(typeof value!=='string'||Buffer.byteLength(value,'ascii')>8192||!value.startsWith('-----BEGIN CERTIFICATE REQUEST-----'))refuse('NATIVE_BOOTSTRAP_OBSERVATION_REFUSED');
 const body=value.endsWith('\n')?value.slice(0,-1):value;
 if(!body.endsWith('-----END CERTIFICATE REQUEST-----')||value.split('-----BEGIN CERTIFICATE REQUEST-----').length!==2)refuse('NATIVE_BOOTSTRAP_OBSERVATION_REFUSED');return value;}
const spki=c=>sha256Der(Buffer.from(c.publicKey.export({type:'spki',format:'der'})));
const certHash=c=>sha256Der(Buffer.from(c.raw));
function b64(value){if(typeof value!=='string'||value.length>1024||!/^[A-Za-z0-9+/]+={0,2}$/u.test(value))refuse('NATIVE_BOOTSTRAP_OBSERVATION_REFUSED');
 const b=Buffer.from(value,'base64');if(!b.length||b.toString('base64')!==value)refuse('NATIVE_BOOTSTRAP_OBSERVATION_REFUSED');return value;}

export function nativeBootstrapOperationId(input={}){
 const {hostId,generation,step}=closed(input,['hostId','generation','step']);
 if(typeof hostId!=='string'||!UUID.test(hostId)||!Number.isSafeInteger(generation)||generation<1||!NATIVE_BOOTSTRAP_STEPS.includes(step))
  refuse('NATIVE_BOOTSTRAP_OPERATION_REFUSED');
 return hash({schema:NATIVE_BOOTSTRAP_OPERATION_SCHEMA,hostId,generation,step});
}

export function assertNativeBootstrapSpec(raw){
 const s=closed(raw,['schema','document','programSha256','profileSha256','hostEndpoint','control','issuerCaCertificate']);
 if(s.schema!==NATIVE_BOOTSTRAP_SPEC_SCHEMA||!HEX64.test(s.programSha256)||!HEX64.test(s.profileSha256))refuse('NATIVE_BOOTSTRAP_SPEC_REFUSED');
 const d=closed(s.document,['name','version','sha256','pluginName']);
 if(!/^[A-Za-z0-9_.-]{3,128}$/u.test(d.name)||d.name.startsWith('AWS-')||
  typeof d.version!=='string'||!/^[1-9][0-9]{0,5}$/u.test(d.version)||!HEX64.test(d.sha256)||d.pluginName!=='nativeBootstrap')
  refuse('NATIVE_BOOTSTRAP_SPEC_REFUSED');
 const he=closed(s.hostEndpoint,['port','serverName']);
 if(!Number.isSafeInteger(he.port)||he.port<1024||he.port>65535||!text(he.serverName,1,253))
  refuse('NATIVE_BOOTSTRAP_SPEC_REFUSED');
 const c=closed(s.control,['endpoint','clientName','serverCertificate','clientCertificate','caCertificate','policySha256']);
 const e=closed(c.endpoint,['address','port','serverName']);
 if(!isPrivate(e.address)||!Number.isSafeInteger(e.port)||e.port<1||e.port>65535||!text(e.serverName,1,253)||
  !text(c.clientName,1,253)||!HEX64.test(c.policySha256))refuse('NATIVE_BOOTSTRAP_SPEC_REFUSED');
 for(const n of [he.serverName,c.endpoint.serverName,c.clientName])try{dnsName(n);}catch{refuse('NATIVE_BOOTSTRAP_SPEC_REFUSED');}
 for(const v of [c.serverCertificate,c.clientCertificate,c.caCertificate,s.issuerCaCertificate])certificate(v);
 return Object.freeze({...s,document:Object.freeze({...d}),hostEndpoint:Object.freeze({...he}),
  control:Object.freeze({...c,endpoint:Object.freeze({...e})})});
}

/** Protected cleanup bound; it never extends workload/currentness or supplies authorization by itself. */
export function nativeBootstrapCleanupCeiling(scope){
 const lease=scope?.allocation?.leaseDeadlineMs,c=scope?.cleanupCeilingMs;
 if(!Number.isSafeInteger(lease)||lease<1||c!==undefined&&c!==nativeObserverDeadline(lease))refuse('NATIVE_BOOTSTRAP_SCOPE_REFUSED');
 return c??lease;
}
function assertScope(raw,{reservation,specSha256}={}){
 const scopeKeys=['allocation','originalBinding','ownerInstanceId','instanceId','endpoint','source','declarationSha256','bootstrapSpecSha256'];
 const s=closed(raw,Object.hasOwn(raw??{},'cleanupCeilingMs')?[...scopeKeys,'cleanupCeilingMs']:scopeKeys);
 nativeBootstrapCleanupCeiling(s);
 const a=assertNativeHostAllocation(s.allocation),b=assertHostRunBindingPin(a,s.originalBinding);
 if(a.hostMode!=='native-processing'||!UUID.test(s.ownerInstanceId)||!INSTANCE.test(s.instanceId)||
  !HEX64.test(s.declarationSha256)||!HEX64.test(s.bootstrapSpecSha256))refuse('NATIVE_BOOTSTRAP_SCOPE_REFUSED');
 const e=closed(s.endpoint,['address','port','serverName']);
 if(!isPrivate(e.address)||!Number.isSafeInteger(e.port)||e.port<1||e.port>65535||!text(e.serverName,1,253))
  refuse('NATIVE_BOOTSTRAP_SCOPE_REFUSED');
 const keys=['imageDigest','sourceCommit','bootstrapSha256'];const hasHelper=Object.hasOwn(s.source,'nativeHelperSha256');
 const src=closed(s.source,hasHelper?[...keys,'nativeHelperSha256']:keys);
 if(!/^sha256:[0-9a-f]{64}$/u.test(src.imageDigest)||!/^[0-9a-f]{40}$/u.test(src.sourceCommit)||!HEX64.test(src.bootstrapSha256)||
  (hasHelper&&!HEX64.test(src.nativeHelperSha256)))refuse('NATIVE_BOOTSTRAP_SCOPE_REFUSED');
 if(reservation!==undefined){
  const d=reservation.declaration;
  if(s.cleanupCeilingMs!==undefined&&(d.schema!==NATIVE_DECLARATION_V2||
   s.cleanupCeilingMs!==d.watchdog?.cleanupCeilingMs||d.watchdog?.leaseDeadlineMs!==a.leaseDeadlineMs))refuse('NATIVE_BOOTSTRAP_SCOPE_REFUSED');
  if(reservation.observedInstance===null||reservation.observedInstance.instanceId!==s.instanceId||
   reservation.observedInstance.privateIp!==e.address||reservation.ownerInstanceId!==s.ownerInstanceId||
   hash(reservation.allocation)!==hash(a)||hash(reservation.originalBinding)!==hash(b)||
   reservation.declarationSha256!==s.declarationSha256||hash(d)!==s.declarationSha256||a.imageDigest!==d.imageDigest||
   d.imageDigest!==src.imageDigest||d.sourceCommit!==src.sourceCommit||d.bootstrapSha256!==src.bootstrapSha256||
   (Object.hasOwn(d,'nativeHelperSha256')!==hasHelper)||
   (hasHelper&&d.nativeHelperSha256!==src.nativeHelperSha256))
   refuse('NATIVE_BOOTSTRAP_SCOPE_REFUSED');
 }
 if(specSha256!==undefined&&s.bootstrapSpecSha256!==specSha256)refuse('NATIVE_BOOTSTRAP_SCOPE_REFUSED');
 return Object.freeze({...s,allocation:a,originalBinding:b,endpoint:Object.freeze({...e}),source:Object.freeze({...src})});
}

function wirePayload(raw){
 let p=raw;
 const schema=p?.schema;
 if(schema===NATIVE_BOOTSTRAP_PREPARE_REQUEST){
  const v=closed(p,['schema','operationId','scope','bootstrapSpec']);
  return Object.freeze({step:'prepare',schema,operationId:v.operationId,scope:v.scope,bootstrapSpec:v.bootstrapSpec});
 }
 if(schema===NATIVE_BOOTSTRAP_INSTALL_REQUEST){
  const v=closed(p,['schema','operationId','scope','bootstrapSpec','prepareOperationId','prepareRequestSha256',
   'prepareObservationSha256','bootId','hostCertificate','serverCertificate']);
  certificate(v.hostCertificate);certificate(v.serverCertificate);
  return Object.freeze({...v,step:'install'});
 }
 refuse('NATIVE_BOOTSTRAP_REQUEST_REFUSED');
}

function checkOperation(p){const a=p.scope.allocation;if(p.operationId!==nativeBootstrapOperationId({hostId:a.hostId,generation:a.generation,step:p.step}))refuse('NATIVE_BOOTSTRAP_OPERATION_REFUSED');}

export function encodeNativeBootstrapPayload(raw){
 const p=wirePayload(raw);
 checkOperation(p);
 const out={schema:p.schema,operationId:p.operationId,scope:p.scope,bootstrapSpec:p.bootstrapSpec};
 if(p.step==='install')for(const k of ['prepareOperationId','prepareRequestSha256','prepareObservationSha256','bootId','hostCertificate','serverCertificate'])out[k]=p[k];
 assertScope(out.scope,{specSha256:hash(assertNativeBootstrapSpec(out.bootstrapSpec))});
 const json=canonicalJson(out);
 if(Buffer.byteLength(json,'utf8')>NATIVE_BOOTSTRAP_PAYLOAD_MAX_BYTES)refuse('NATIVE_BOOTSTRAP_PAYLOAD_TOO_LARGE');
 const b64v=Buffer.from(json,'utf8').toString('base64url');
 if(b64v.length>NATIVE_BOOTSTRAP_PAYLOAD_MAX_CHARS)refuse('NATIVE_BOOTSTRAP_PAYLOAD_TOO_LARGE');
 return b64v;
}

export function decodeNativeBootstrapPayload(value){
 if(typeof value!=='string'||!value.length||value.length>NATIVE_BOOTSTRAP_PAYLOAD_MAX_CHARS||
  !/^[A-Za-z0-9_-]+$/u.test(value)||value.includes('='))refuse('NATIVE_BOOTSTRAP_REQUEST_REFUSED');
 let bytes;try{bytes=Buffer.from(value,'base64url');}catch{refuse('NATIVE_BOOTSTRAP_REQUEST_REFUSED');}
 if(bytes.toString('base64url')!==value||bytes.length>NATIVE_BOOTSTRAP_PAYLOAD_MAX_BYTES)refuse('NATIVE_BOOTSTRAP_REQUEST_REFUSED');
 let textValue;try{textValue=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{refuse('NATIVE_BOOTSTRAP_REQUEST_REFUSED');}
 let parsed;try{parsed=JSON.parse(textValue);}catch{refuse('NATIVE_BOOTSTRAP_REQUEST_REFUSED');}
 if(canonicalJson(parsed)!==textValue)refuse('NATIVE_BOOTSTRAP_REQUEST_REFUSED');
 const p=wirePayload(parsed);
 checkOperation(p);
 assertScope(p.scope,{specSha256:hash(assertNativeBootstrapSpec(p.bootstrapSpec))});
 const out={schema:p.schema,operationId:p.operationId,scope:p.scope,bootstrapSpec:p.bootstrapSpec};
 if(p.step==='install')for(const k of ['prepareOperationId','prepareRequestSha256','prepareObservationSha256','bootId','hostCertificate','serverCertificate'])out[k]=p[k];
 return Object.freeze(out);
}

export function createNativeBootstrapRequest(raw){
 const p=wirePayload(raw),spec=assertNativeBootstrapSpec(p.bootstrapSpec);
 const wire={schema:p.schema,operationId:p.operationId,scope:p.scope,bootstrapSpec:p.bootstrapSpec};
 if(p.step==='install')for(const k of ['prepareOperationId','prepareRequestSha256','prepareObservationSha256','bootId','hostCertificate','serverCertificate'])wire[k]=p[k];
 const payload=encodeNativeBootstrapPayload(wire);
 return Object.freeze({
  DocumentName:spec.document.name,DocumentVersion:spec.document.version,DocumentHash:spec.document.sha256,
  DocumentHashType:'Sha256',InstanceIds:Object.freeze([p.scope.instanceId]),
  Parameters:Object.freeze({Payload:Object.freeze([payload])}),TimeoutSeconds:30,
  Comment:`meri-native-${p.step}-${p.operationId}`,MaxConcurrency:'1',MaxErrors:'0'});
}
function structuralRequest(request){
 const r=closed(request,['DocumentName','DocumentVersion','DocumentHash','DocumentHashType','InstanceIds','Parameters',
  'TimeoutSeconds','Comment','MaxConcurrency','MaxErrors']);
 if(r.DocumentHashType!=='Sha256'||r.TimeoutSeconds!==30||r.MaxConcurrency!=='1'||r.MaxErrors!=='0'||
  !Array.isArray(r.InstanceIds)||r.InstanceIds.length!==1)refuse('NATIVE_BOOTSTRAP_REQUEST_REFUSED');
 const params=closed(r.Parameters,['Payload']);
 if(!Array.isArray(params.Payload)||params.Payload.length!==1)refuse('NATIVE_BOOTSTRAP_REQUEST_REFUSED');
 const payload=wirePayload(decodeNativeBootstrapPayload(params.Payload[0]));
 if(payload.scope.instanceId!==r.InstanceIds[0])refuse('NATIVE_BOOTSTRAP_SCOPE_REFUSED');
 const spec=assertNativeBootstrapSpec(payload.bootstrapSpec),specSha=hash(spec);
 const wire={schema:payload.schema,operationId:payload.operationId,scope:payload.scope,bootstrapSpec:payload.bootstrapSpec};
 if(payload.step==='install')for(const k of ['prepareOperationId','prepareRequestSha256','prepareObservationSha256','bootId','hostCertificate','serverCertificate'])wire[k]=payload[k];
 const rebuilt=createNativeBootstrapRequest(wire);
 if(canonicalJson(rebuilt)!==canonicalJson(r))refuse('NATIVE_BOOTSTRAP_REQUEST_REFUSED');
 return Object.freeze({step:payload.step,payload,scope:payload.scope,bootstrapSpec:spec,bootstrapSpecSha256:specSha,request:r});
}

export function assertNativeBootstrapRequest(request,{reservation,step}={}){
 if(!NATIVE_BOOTSTRAP_STEPS.includes(step)||reservation===undefined)refuse('NATIVE_BOOTSTRAP_REQUEST_REFUSED');
 const ctx=structuralRequest(request);
 if(ctx.step!==step)refuse('NATIVE_BOOTSTRAP_REQUEST_REFUSED');
 const a=assertNativeHostAllocation(reservation.allocation);
 if(ctx.payload.operationId!==nativeBootstrapOperationId({hostId:a.hostId,generation:a.generation,step}))refuse('NATIVE_BOOTSTRAP_OPERATION_REFUSED');
 const specSha=hash(ctx.bootstrapSpec),declSpec=reservation.declaration?.bootstrapSpec;
 if(declSpec===undefined||hash(assertNativeBootstrapSpec(declSpec))!==specSha)refuse('NATIVE_BOOTSTRAP_SCOPE_REFUSED');
 if(ctx.scope.endpoint.address!==reservation.observedInstance?.privateIp||
  ctx.scope.endpoint.port!==ctx.bootstrapSpec.hostEndpoint.port||
  ctx.scope.endpoint.serverName!==ctx.bootstrapSpec.hostEndpoint.serverName)refuse('NATIVE_BOOTSTRAP_SCOPE_REFUSED');
 const scope=assertScope(ctx.scope,{reservation,specSha256:specSha});
 return Object.freeze({...ctx,scope});
}

function validatePrepare(raw,ctx){
 const o=closed(raw,['schema','operationId','requestSha256','scope','bootId','preparedAtMs','hostCsrPem','serverCsrPem',
  'hostSpkiSha256','serverSpkiSha256','hostProofBase64','serverProofBase64']);
 if(o.schema!==NATIVE_BOOTSTRAP_PREPARE||o.operationId!==ctx.payload.operationId||o.requestSha256!==hash(ctx.request)||
  canonicalJson(assertScope(o.scope,{specSha256:ctx.bootstrapSpecSha256}))!==canonicalJson(ctx.scope)||
  !UUID.test(o.bootId)||!Number.isSafeInteger(o.preparedAtMs)||o.preparedAtMs<0)refuse('NATIVE_BOOTSTRAP_OBSERVATION_REFUSED');
 const lease=ctx.scope.allocation.leaseDeadlineMs;
 if(o.preparedAtMs<lease-900000||o.preparedAtMs>=lease)refuse('NATIVE_BOOTSTRAP_OBSERVATION_REFUSED');
csr(o.hostCsrPem);csr(o.serverCsrPem);b64(o.hostProofBase64);b64(o.serverProofBase64);
 if(!HEX64.test(o.hostSpkiSha256)||!HEX64.test(o.serverSpkiSha256)||o.hostSpkiSha256===o.serverSpkiSha256)
  refuse('NATIVE_BOOTSTRAP_OBSERVATION_REFUSED');
 return Object.freeze(o);
}
function validateInstall(raw,ctx,prepare){
 const o=closed(raw,['schema','operationId','requestSha256','scope','prepareOperationId','prepareRequestSha256',
  'prepareObservationSha256','bootId','installedAtMs','hostSpkiSha256','serverSpkiSha256','hostCertificateSha256',
  'serverCertificateSha256','configSha256']);
 const p=ctx.payload;
 if(o.schema!==NATIVE_BOOTSTRAP_INSTALL||o.operationId!==p.operationId||o.requestSha256!==hash(ctx.request)||
  canonicalJson(assertScope(o.scope,{specSha256:ctx.bootstrapSpecSha256}))!==canonicalJson(ctx.scope))
  refuse('NATIVE_BOOTSTRAP_OBSERVATION_REFUSED');
 if(prepare===undefined||prepare.schema!==NATIVE_BOOTSTRAP_PREPARE||prepare.operationId!==p.prepareOperationId||
  prepare.requestSha256!==p.prepareRequestSha256||hash(prepare)!==p.prepareObservationSha256||prepare.bootId!==p.bootId||
  prepare.scope.instanceId!==ctx.scope.instanceId||hash(assertScope(prepare.scope,{specSha256:ctx.bootstrapSpecSha256}))!==hash(ctx.scope))
  refuse('NATIVE_BOOTSTRAP_OBSERVATION_REFUSED');
 const hc=certificate(p.hostCertificate,true),sc=certificate(p.serverCertificate,true);
 if(o.prepareOperationId!==p.prepareOperationId||o.prepareRequestSha256!==p.prepareRequestSha256||
  o.prepareObservationSha256!==p.prepareObservationSha256||o.bootId!==p.bootId||
  o.hostSpkiSha256!==prepare.hostSpkiSha256||o.serverSpkiSha256!==prepare.serverSpkiSha256||
  !Number.isSafeInteger(o.installedAtMs)||o.installedAtMs<prepare.preparedAtMs||o.installedAtMs>=ctx.scope.allocation.leaseDeadlineMs)
  refuse('NATIVE_BOOTSTRAP_OBSERVATION_REFUSED');
 if(spki(hc)!==prepare.hostSpkiSha256||spki(sc)!==prepare.serverSpkiSha256||certHash(hc)!==o.hostCertificateSha256||
  certHash(sc)!==o.serverCertificateSha256)refuse('NATIVE_BOOTSTRAP_OBSERVATION_REFUSED');
 const projection={schema:NATIVE_BOOTSTRAP_INSTALLED,scope:ctx.scope,bootId:p.bootId,prepareOperationId:p.prepareOperationId,
  prepareRequestSha256:p.prepareRequestSha256,prepareObservationSha256:p.prepareObservationSha256,
  installOperationId:p.operationId,installRequestSha256:hash(ctx.request),hostCertificateSha256:o.hostCertificateSha256,
  serverCertificateSha256:o.serverCertificateSha256,hostSpkiSha256:o.hostSpkiSha256,serverSpkiSha256:o.serverSpkiSha256};
 if(hash(projection)!==o.configSha256)refuse('NATIVE_BOOTSTRAP_OBSERVATION_REFUSED');
 return Object.freeze(o);
}

export function assertNativeBootstrapObservation(raw,{request,prepareObservation}={}){
 let ctx;
 if(request?.payload!==undefined)ctx=request;else ctx=structuralRequest(request);
 if(ctx.step==='prepare')return validatePrepare(raw,ctx);
 return validateInstall(raw,ctx,prepareObservation);
}

export function decodeNativeBootstrapObservation(stdout,context){
 let textValue;
 if(Buffer.isBuffer(stdout)){if(stdout.length>NATIVE_BOOTSTRAP_STDOUT_MAX_BYTES)refuse('NATIVE_BOOTSTRAP_OBSERVATION_REFUSED');
  textValue=new TextDecoder('utf-8',{fatal:true}).decode(stdout);}
 else if(typeof stdout==='string')textValue=stdout;else refuse('NATIVE_BOOTSTRAP_OBSERVATION_REFUSED');
 if(!textValue.endsWith('\n')||textValue.endsWith('\n\n')||Buffer.byteLength(textValue,'utf8')>NATIVE_BOOTSTRAP_STDOUT_MAX_BYTES)
  refuse('NATIVE_BOOTSTRAP_OBSERVATION_REFUSED');
 const json=textValue.slice(0,-1);let parsed;try{parsed=JSON.parse(json);}catch{refuse('NATIVE_BOOTSTRAP_OBSERVATION_REFUSED');}
 if(canonicalJson(parsed)!==json)refuse('NATIVE_BOOTSTRAP_OBSERVATION_REFUSED');
 return assertNativeBootstrapObservation(parsed,context);
}

export function nativeBootstrapKeyProofMessage(statement,role){
 if(!['host-client','host-server'].includes(role))refuse('NATIVE_BOOTSTRAP_KEY_PROOF_REFUSED');
 const s=closed(statement,['schema','operationId','requestSha256','scope','bootId','preparedAtMs','hostCsrPem',
  'serverCsrPem','hostSpkiSha256','serverSpkiSha256']);
 const msg=`meri-native-bootstrap-key-proof/1\n${role}\n${hash(s)}`;
 if(Buffer.byteLength(msg,'utf8')>32768)refuse('NATIVE_BOOTSTRAP_KEY_PROOF_REFUSED');
 return Buffer.from(msg,'utf8');
}
