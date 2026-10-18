/** Canonical static material inventory and Linux preflight for control, Temporal worker/issuer, model-owner and model-proxy.
 * Runner material belongs to runner-bootstrap-files.mjs. No IO occurs on import. */
import {open,lstat,realpath,readdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {posix} from 'node:path';
import {validateConfiguration} from './config.mjs';
import {parseTemporalIssuerRuntimeConfiguration} from './temporal-issuer-cli.mjs';
import {validateProductOwnerConfiguration} from '../proxy/product/owner-entrypoint.mjs';
import {parseProductProxyStartupConfiguration} from '../proxy/product/startup-config.mjs';

const root='/run/meri', mode=0o600, maxBytes=32768;
const names=Object.freeze({control:'control.json','temporal-worker':'worker.json','temporal-issuer':'issuer.json','model-owner':'owner.json','model-proxy':'proxy.json'});
/** Additional configuration files whose parsed content the plan needs. model-owner reads control's exact control.json copy. */
const companions=Object.freeze({'model-owner':Object.freeze({controlConfiguration:names.control})});
/** Roles with one fixed reader identity. 10001:10001 is the Python proxy image user and is valid for model-proxy only. */
const fixedUsers=Object.freeze({'temporal-issuer':'1000:1000','model-owner':'1000:1000','model-proxy':'10001:10001'});
/** The proxy image has no Node, so its init runs from the Node image as root with only CAP_CHOWN retained: it adopts the
 * task volume (root:root 0755 by default, or an image-seeded owner), writes root-owned 0600 files, verifies them and then
 * hands files and directory to the reader. Every other role writes as its own reader identity. */
const writers=Object.freeze({'model-proxy':'0:0'});
export const productMaterialPolicy=Object.freeze({directory:root,maxBytes,configurationNames:names,companionConfigurationNames:companions,fixedRuntimeUsers:fixedUsers,writerUsers:writers});
const plans=new WeakSet();
const hex64=/^[a-f0-9]{64}$/u;
const refuse=()=>{throw Object.assign(Error('PRODUCT_MATERIAL_REFUSED'),{code:'PRODUCT_MATERIAL_REFUSED'});};
const own=(value)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const pinsOf=plan=>JSON.stringify(Object.entries(plan.requiredSha256ByPath).sort(([a],[b])=>a.localeCompare(b)));

export function parseProductRuntimeUser(value){
 if(typeof value!=='string'||!/^([1-9][0-9]{0,9}):([1-9][0-9]{0,9})$/u.test(value))refuse();
 const [uid,gid]=value.split(':').map(Number);
 if(!Number.isSafeInteger(uid)||!Number.isSafeInteger(gid)||uid>2147483647||gid>2147483647)refuse();
 return {uid,gid};
}
/** Role-bound reader (runtimeUser) and writer identities. Throws before any delivery when the pair is not allowed. */
export function productMaterialIdentity(role,runtimeUser){
 if(typeof role!=='string'||!Object.hasOwn(names,role))refuse();
 const {uid,gid}=parseProductRuntimeUser(runtimeUser);
 if(Object.hasOwn(fixedUsers,role)?runtimeUser!==fixedUsers[role]:uid===10001||gid===10001)refuse();
 const writerUser=Object.hasOwn(writers,role)?writers[role]:runtimeUser,[writerUid,writerGid]=writerUser.split(':').map(Number);
 return Object.freeze({uid,gid,writerUser,writerUid,writerGid});
}
function direct(path){
 if(typeof path!=='string'||posix.dirname(path)!==root||posix.basename(path)==='.'||posix.basename(path)==='..'||path.includes('\\')||path.includes('//'))refuse();
 return path;
}

/** Return only paths and file requirements. The caller must separately authenticate the configuration and exact byte hashes. */
export function compileProductMaterialPlan({role,configuration,runtimeUser,controlConfiguration}){
 if(!Object.hasOwn(names,role)||!own(configuration)||(role==='model-owner')!==(controlConfiguration!==undefined))refuse();
 const identity=productMaterialIdentity(role,runtimeUser),{uid,gid}=identity,configurationPath=`${root}/${names[role]}`;
 /** One purpose per direct, distinct file. Pins are the configuration's own digests of delivered files. */
 function fixed(paths,pins={}){
  if(new Set(paths.map(([path])=>direct(path))).size!==paths.length||Object.keys(pins).some(path=>!paths.some(([p])=>p===path)||!hex64.test(pins[path])))refuse();
  const requiredFiles=Object.freeze(paths.sort(([a],[b])=>a.localeCompare(b)).map(([path,purpose])=>Object.freeze({path,purposes:Object.freeze([purpose]),mode:'0600',maxBytes})));
  const plan=Object.freeze({schemaVersion:1,role,containerName:role,configurationPath,materialDirectory:root,runtimeUser,uid,gid,
   writerUser:identity.writerUser,writerUid:identity.writerUid,writerGid:identity.writerGid,
   directoryMode:'0700',requiredFiles,requiredSha256ByPath:Object.freeze({...pins}),requiresTokenRotation:false,dynamicMaterialDirectory:null});
  plans.add(plan);return plan;
 }
 if(role==='temporal-issuer'){
  let c;try{c=parseTemporalIssuerRuntimeConfiguration(configuration);}catch{refuse();}
  return fixed([
   [configurationPath,'configuration'],[c.database.connectionFile,'database-connection'],
   [c.issuer.tls.keyFile,'issuer-tls-key'],[c.issuer.tls.certFile,'issuer-tls-cert'],
   [c.issuer.tls.caFile,'issuer-tls-ca'],[c.issuer.bootstrap.caKeyFile,'issuer-bootstrap-ca-key']
  ]);
 }
 if(role==='model-owner'){
  // owner-entrypoint reads its own config, then control.json (SHA-pinned), then the DB connection and identity
  // credential at the exact paths control.json names, then its own TLS files. All belong to this one inventory.
  const controlPath=`${root}/${names.control}`;let c,control,credentialFile;
  try{
   c=validateProductOwnerConfiguration(configuration);
   if(c.enabled!==true||c.controlConfigurationFile!==controlPath)refuse();
   // The copy must be a deployable static control configuration, not merely a parseable one.
   compileProductMaterialPlan({role:'control',configuration:controlConfiguration,runtimeUser});
   control=validateConfiguration(controlConfiguration,'control');const candidate=control.nativeCandidate;
   if(candidate?.multiRun?.dynamicInitialRuns!==true||candidate.identity.commandContext.clientResolution.clientId!==c.clientPolicy.selectedClientId)refuse();
   credentialFile=candidate.identity.credentialFile;
  }catch{refuse();}
  return fixed([
   [configurationPath,'configuration'],[controlPath,'control-configuration'],
   [control.database.connectionFile,'database-connection'],[credentialFile,'identity-capability'],
   [c.tls.caFile,'owner-tls-ca'],[c.tls.certFile,'owner-tls-cert'],[c.tls.keyFile,'owner-tls-key']
  ],{[controlPath]:c.controlConfigurationSha256,[credentialFile]:c.nativeCredentialFileSha256});
 }
 if(role==='model-proxy'){
  let f;try{f=parseProductProxyStartupConfiguration(configuration).files;}catch{refuse();}
  return fixed([
   [configurationPath,'configuration'],[f.serverCertificate.path,'server-tls-cert'],[f.serverPrivateKey.path,'server-tls-key'],
   [f.ownerCa.path,'owner-tls-ca'],[f.ownerCertificate.path,'owner-tls-cert'],[f.ownerPrivateKey.path,'owner-tls-key']
  ],Object.fromEntries(Object.values(f).map(ref=>[ref.path,ref.sha256])));
 }
 let c;try{c=validateConfiguration(configuration,role);}catch{refuse();}
 if(c.http.hostname!=='0.0.0.0'||c.http.port!==(role==='control'?8080:8081))refuse();
 // Static product control must never fall back to the legacy shared listener:
 // the public ALB target reaches 8080 while native capabilities reach 8082.
 if(role==='control'&&(c.privateHttp===undefined||c.taskRouter?.enabled!==true))refuse();
 const files=new Map([[configurationPath,new Set(['configuration'])]]);
 function add(path,purpose){
  direct(path);if(path===configurationPath)refuse();
  const purposes=files.get(path)??new Set();purposes.add(purpose);files.set(path,purposes);
 }
 add(c.native.capabilityFile,'native-capability');
 add(c.temporal.tls.caFile,'temporal-ca');add(c.temporal.tls.certFile,'temporal-cert');add(c.temporal.tls.keyFile,'temporal-key');
 if(c.temporal.tokenWriter?.enabled===true){
  const d=c.temporal.issuerDelivery;
  add(d.publicKey.manifestFile,'temporal-issuer-jwk');add(d.tls.issuerCaFile,'temporal-issuer-ca');
  add(c.temporal.issuerBootstrap.clientCaFile,'temporal-issuer-client-ca');
 }else if(c.temporal.authorization)add(c.temporal.authorization.tokenFile,'temporal-authorization-token');
 if(role==='control'){
  add(c.database.connectionFile,'database-connection');
  if(c.downloadLinks?.enabled)add(c.downloadLinks.keyFile,'download-signing-key');
  if(c.reads?.enabled===true){add(c.reads.serviceSecretFile,'reads-service-secret');if(c.reads.readModeServiceSecretFile!==undefined)add(c.reads.readModeServiceSecretFile,'reads-read-mode-service-secret');
   // P2: the pinned general-read installation measurement, brotli-compressed JSON (not a secret; byte-exact, digest-pinned like every other material file).
   if(c.reads.installation?.enabled===true)add(c.reads.installation.measurementFile,'reads-installation-measurement');}
  if(c.nativeCandidate){
   add(c.nativeCandidate.identity.credentialFile,'identity-capability');
   add(c.nativeCandidate.taskCapabilityFile,'task-capability');
   add(c.nativeCandidate.controlCapabilityFile,'control-capability');
   add(c.nativeCandidate.proxyCredentialFile,'proxy-capability');
  }
  if(c.taskRouter?.enabled)add(c.taskRouter.runnerCaFile,'runner-ca');
  if(c.taskRouter?.poststart?.enabled){add(c.taskRouter.poststart.runnerCaKeyFile,'runner-ca-key');add(c.taskRouter.poststart.controlCaFile,'poststart-control-ca');}
 }
 const dynamicMaterialDirectory=c.nativeCandidate?.multiRun?.materialDirectory??null;
 if(dynamicMaterialDirectory!==null){const path=posix.normalize(dynamicMaterialDirectory);if(!posix.isAbsolute(path)||path===root||path.startsWith(root+'/'))refuse();}
 for(const [path,purposes] of files){
  if(purposes.size>1&&!(purposes.size===2&&purposes.has('native-capability')&&purposes.has('control-capability')))refuse();
  if(path!==configurationPath)direct(path);
 }
 const requiredFiles=Object.freeze([...files].sort(([a],[b])=>a.localeCompare(b)).map(([path,purposes])=>Object.freeze({path,purposes:Object.freeze([...purposes].sort()),mode:'0600',maxBytes})));
 const plan=Object.freeze({schemaVersion:1,role,containerName:role,configurationPath,materialDirectory:root,runtimeUser,uid,gid,
  writerUser:identity.writerUser,writerUid:identity.writerUid,writerGid:identity.writerGid,
  directoryMode:'0700',requiredFiles,requiredSha256ByPath:Object.freeze({}),requiresTokenRotation:!!c.temporal.authorization,
  dynamicMaterialDirectory,...(c.temporal.tokenWriter?.enabled===true?{temporalTokenWriter:Object.freeze({directory:'/run/meri-temporal',tokenFile:'/run/meri-temporal/token.json',identityDirectory:'/run/meri-temporal/identity',role})}:{})});
 plans.add(plan);return plan;
}

/** Read-only task-local preflight. Pins are exact SHA-256s from an independently authenticated shipping owner, never emitted. */
export async function verifyProductMaterial(plan,{expectedSha256ByPath}={}){
 if(!plans.has(plan)||process.platform!=='linux'||typeof process.getuid!=='function'||!own(expectedSha256ByPath))refuse();
 // The reader checks its own files. A distinct staging writer (model-proxy root init) checks them before handover.
 const owner=[[plan.uid,plan.gid],[plan.writerUid,plan.writerGid]].find(([uid,gid])=>process.getuid()===uid&&process.getgid()===gid);
 if(!owner)refuse();const [ownerUid,ownerGid]=owner;
 const paths=plan.requiredFiles.map(file=>file.path),keys=Object.keys(expectedSha256ByPath);
 if(keys.length!==paths.length||keys.some(key=>!paths.includes(key)||!hex64.test(expectedSha256ByPath[key])))refuse();
 if(Object.entries(plan.requiredSha256ByPath).some(([path,sha])=>expectedSha256ByPath[path]!==sha))refuse();
 const companionPaths=Object.fromEntries(Object.entries(companions[plan.role]??{}).map(([key,name])=>[`${root}/${name}`,key])),parsedCompanions={};
 let directory;try{directory=await lstat(root);if(!directory.isDirectory()||directory.isSymbolicLink()||directory.uid!==ownerUid||directory.gid!==ownerGid||(directory.mode&0o777)!==0o700||await realpath(root)!==root)refuse();
  const entries=await readdir(root);if(entries.length!==paths.length||entries.some(name=>!paths.includes(`${root}/${name}`)))refuse();}catch{refuse();}
 let parsed;
 for(const {path} of plan.requiredFiles){
  let handle,bytes;try{
   // A foreign FIFO at an expected path must not block the preflight before fstat can reject it.
   handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const st=await handle.stat();
   if(!st.isFile()||st.uid!==ownerUid||st.gid!==ownerGid||(st.mode&0o777)!==mode||st.size<1||st.size>maxBytes)refuse();
   bytes=Buffer.alloc(maxBytes+1);let used=0;
   while(used<bytes.length){const {bytesRead}=await handle.read(bytes,used,bytes.length-used,used);if(bytesRead===0)break;used+=bytesRead;}
   const after=await handle.stat();
   if(used!==st.size||used>maxBytes||after.size!==st.size||after.ino!==st.ino||hash(bytes.subarray(0,used))!==expectedSha256ByPath[path])refuse();
   if(path===plan.configurationPath)parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,used)));
   if(Object.hasOwn(companionPaths,path))parsedCompanions[companionPaths[path]]=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,used)));
  }catch{refuse();}finally{bytes?.fill(0);await handle?.close();}
 }
 let actual;try{actual=compileProductMaterialPlan({role:plan.role,configuration:parsed,runtimeUser:plan.runtimeUser,...parsedCompanions});}catch{refuse();}
 if(actual.requiredFiles.length!==plan.requiredFiles.length||pinsOf(actual)!==pinsOf(plan)||actual.requiredFiles.some((file,index)=>file.path!==plan.requiredFiles[index].path||file.purposes.join(',')!==plan.requiredFiles[index].purposes.join(',')))refuse();
 let after;try{after=await lstat(root);}catch{refuse();}
 if(!after.isDirectory()||after.dev!==directory.dev||after.ino!==directory.ino||after.uid!==directory.uid||after.gid!==directory.gid||(after.mode&0o777)!==0o700)refuse();
 return Object.freeze({ready:true,role:plan.role,configurationPath:plan.configurationPath,fileCount:paths.length});
}
