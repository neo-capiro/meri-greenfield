/** First-chat native /2 composition. Public pins and private bytes stay separate; no issuance or provider effects. */
import {createHash,createPrivateKey,createPublicKey,X509Certificate} from 'node:crypto';
import {open,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {isAbsolute} from 'node:path';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalJson} from '../../../packages/contracts/validate.mjs';
import {compileNativeDeployment} from '../../../apps/runtime/native-deployment-configuration.mjs';
import {compileNativeWatchdogDefinition} from '../../browser-enforcement/workflow.mjs';
import {createNativeObserverSecret} from '../../../apps/runtime/native-observer-entrypoint.mjs';
import {NATIVE_OBSERVER_ORIGIN} from '../../../apps/runtime/native-observer-http.mjs';
const ACCOUNT='967807252336',REGION='us-east-1',HEX=/^[a-f0-9]{64}$/u;
const fail=()=>{throw Object.assign(Error('RENDER_NATIVE_PROCESSING_REFUSED'),{code:'RENDER_NATIVE_PROCESSING_REFUSED'});};
const sha=b=>createHash('sha256').update(b).digest('hex');
export const NATIVE_PATHS=Object.freeze({
 controlClientCertificate:'/run/meri/native-control-client.pem',controlClientKey:'/run/meri/native-control-client.key',
 issuerCaCertificate:'/run/meri/native-issuer-ca.pem',issuerCaKey:'/run/meri/native-issuer-ca.key',
 observerKey:'/run/meri/native-observer.key',databaseConnection:'/run/meri/native-database.uri',
});
const keys=Object.keys(NATIVE_PATHS);
export function parseNativeProcessing(raw){
 if(raw===undefined)return undefined;
 try{
  const v=own(raw,['enabled'],['deployment','watchdog','observerKeyId','maxRequestMs','materialSha256']);
  if(typeof v.enabled!=='boolean')fail();
  if(!v.enabled){if(Object.keys(v).length!==1)fail();return {enabled:false};}
  const d=compileNativeDeployment(v.deployment),w=own(v.watchdog,['stateMachineVersionArn','definitionSha256','qualificationEvidenceSha256','definitionReadback']);
  // Release supplies this projection of the actual numeric-version DescribeStateMachine result, without parsing/re-encoding its definition.
  // Publication uses canonical bytes deliberately; the unchanged worker independently hashes the raw service string before effects.
  const readback=own(w.definitionReadback,['stateMachineArn','type','status','revisionId','definition']);
  const definition=canonicalJson(compileNativeWatchdogDefinition({physicalObserver:d.physicalObserver}));
  if(d.accountId!==ACCOUNT||d.region!==REGION||
   !new RegExp(`^arn:aws:states:${REGION}:${ACCOUNT}:stateMachine:[A-Za-z0-9_-]{1,80}:[1-9][0-9]*$`,'u').test(w.stateMachineVersionArn)||
   !HEX.test(w.qualificationEvidenceSha256)||readback.stateMachineArn!==w.stateMachineVersionArn||readback.type!=='STANDARD'||readback.status!=='ACTIVE'||
   typeof readback.revisionId!=='string'||!readback.revisionId||readback.revisionId.length>128||
   readback.definition!==definition||w.definitionSha256!==sha(readback.definition)||
   typeof v.observerKeyId!=='string'||!/^[A-Za-z0-9_-]{1,64}$/u.test(v.observerKeyId)||
   !Number.isSafeInteger(v.maxRequestMs)||v.maxRequestMs<1||v.maxRequestMs>30000)fail();
  const pins=own(v.materialSha256,keys);if(keys.some(k=>!HEX.test(pins[k])))fail();
  return structuredClone({...v,deployment:d,watchdog:w,materialSha256:pins});
 }catch{fail();}
}
const cert=b=>new X509Certificate(b);
const sameCert=(a,b)=>sha(cert(a).raw)===sha(cert(b).raw);
function keyMatches(pem,key){
 const privateKey=createPrivateKey(key);
 return createPublicKey(privateKey).export({format:'der',type:'spki'}).equals(cert(pem).publicKey.export({format:'der',type:'spki'}));
}
/** The existing material initializer validates exact role inventory and mode after this composition. */
export function composeNativeProcessing({feature,material={},deployment,pki,nowMs}){
 try{
  const f=parseNativeProcessing(feature),m=own(material,f?.enabled?keys:[]);
  if(!f?.enabled)return {control:null,worker:f===undefined?undefined:{enabled:false},files:{control:[],worker:[]},pins:{}};
  const d=f.deployment,s=d.bootstrapSpec;
  if(d.sourceCommit!==deployment.images.nodeRuntimeSourceCommit||d.placement.vpcId!==deployment.vpcId||
   !deployment.privateSubnetIds.includes(d.placement.subnetId)||s.control.endpoint.serverName!==deployment.names.control_private||
   s.control.endpoint.serverName!==new URL(NATIVE_OBSERVER_ORIGIN).hostname||s.control.endpoint.port!==443||
   !sameCert(s.control.serverCertificate,pki.certs['control-private'])||!sameCert(s.control.caCertificate,pki.certs['server-ca']))fail();
  for(const k of keys)if(!Buffer.isBuffer(m[k])||!m[k].length||m[k].length>32768||sha(m[k])!==f.materialSha256[k])fail();
  if(m.observerKey.length<32||m.observerKey.length>128||!sameCert(m.issuerCaCertificate,s.issuerCaCertificate)||
   !sameCert(m.controlClientCertificate,s.control.clientCertificate)||
   !keyMatches(m.issuerCaCertificate,m.issuerCaKey)||!keyMatches(m.controlClientCertificate,m.controlClientKey)||!cert(m.issuerCaCertificate).ca)fail();
  for(const pem of [m.issuerCaCertificate,m.controlClientCertificate]){
   const c=cert(pem);if(c.validFromDate.getTime()>nowMs||c.validToDate.getTime()<=nowMs)fail();
  }
  const client=cert(m.controlClientCertificate),controlCa=cert(s.control.caCertificate);
  if(client.ca||!client.checkIssued(controlCa)||!client.verify(controlCa.publicKey)||
   client.subjectAltName!==`DNS:${s.control.clientName}`||client.keyUsage?.length!==1||client.keyUsage[0]!=='1.3.6.1.5.5.7.3.2'||
   client.validToDate.getTime()-client.validFromDate.getTime()>900000||client.validToDate.getTime()-nowMs<=87000)fail();
  const db=new URL(m.databaseConnection.toString('utf8')),target=deployment.database;
  if(db.protocol!=='postgresql:'||db.hostname!==target.host||db.port!==String(target.port)||
   db.pathname!==`/${target.database}`||decodeURIComponent(db.username)!==target.roles.nativeWorker||!db.password||db.hash||
   db.search!=='?sslmode=verify-full')fail();
  const control={native:{enabled:true,policySha256:s.control.policySha256,host:{
   tls:{caPath:NATIVE_PATHS.issuerCaCertificate,certPath:NATIVE_PATHS.controlClientCertificate,keyPath:NATIVE_PATHS.controlClientKey,clientName:s.control.clientName},
   maxRequestMs:f.maxRequestMs,observer:{keyId:f.observerKeyId,keyPath:NATIVE_PATHS.observerKey},
   deployment:{accountId:d.accountId,region:d.region,amiId:d.launch.ImageId,vpcId:d.placement.vpcId,subnetId:d.placement.subnetId,
    securityGroupId:d.placement.securityGroupIds[0],rootDeviceName:'/dev/xvda'},
  }}};
  const {definitionReadback,...watchdog}=f.watchdog;
  const worker={enabled:true,databaseFile:NATIVE_PATHS.databaseConnection,issuerCaCertFile:NATIVE_PATHS.issuerCaCertificate,
   issuerCaKeyFile:NATIVE_PATHS.issuerCaKey,deployment:d,watchdog};
  const entries=names=>names.map(k=>[NATIVE_PATHS[k],Buffer.from(m[k])]);
  return {control,worker,files:{control:entries(['issuerCaCertificate','controlClientCertificate','controlClientKey','observerKey']),
   worker:entries(['databaseConnection','issuerCaCertificate','issuerCaKey'])},pins:{...f.materialSha256},materialNotAfterMs:client.validToDate.getTime(),
   observerMaterial:createNativeObserverSecret({keyId:f.observerKeyId,key:m.observerKey,ca:Buffer.from(s.control.caCertificate)})};
 }catch{fail();}
}
/** CLI input is an exact map of private absolute files. Never echo paths, values or raw exceptions. */
export async function readNativeMaterial(raw){
 try{
  const m=own(raw,keys),out={};
  for(const k of keys){
   const path=m[k];if(typeof path!=='string'||!isAbsolute(path))fail();
   const before=await lstat(path);if(before.isSymbolicLink()||!before.isFile())fail();
   const fd=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
   try{
    const s=await fd.stat();if(!s.isFile()||s.size<1||s.size>32768||s.ino!==before.ino||s.dev!==before.dev||
     process.platform!=='win32'&&((s.mode&0o077)!==0||s.uid!==process.getuid()))fail();
    const b=Buffer.alloc(s.size+1);const {bytesRead}=await fd.read(b,0,b.length,0);if(bytesRead!==s.size)fail();out[k]=b.subarray(0,bytesRead);
   }finally{await fd.close();}
  }
  return out;
 }catch{fail();}
}
