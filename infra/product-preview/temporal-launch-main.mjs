#!/opt/meri/node
/** Bounded ECS launcher. Imported modules never start a server or fetch a network. */
import {createHash,createPrivateKey,createPublicKey,X509Certificate} from 'node:crypto';
import {readFile,mkdtemp,open,rm,lstat} from 'node:fs/promises';
import {constants as fsConstants} from 'node:fs';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {renderTemporalConfig,validateTemporalLaunch} from './temporal-launch-render.mjs';

const fail=()=>{throw Error('TEMPORAL_LAUNCH_REFUSED');};
const ROOT='/run/temporal';
const CONFIG_MODULE=new URL('./temporal-launch-render.mjs',import.meta.url);
const ip4=/^(?:10|172|192)\.(?:\d{1,3}\.){2}\d{1,3}$/u;

async function boundedJson(url,fetcher,limit=65536){
 const response=await fetcher(url,{signal:AbortSignal.timeout(1500),redirect:'error',cache:'no-store'});
 if(response.status!==200||!response.body)fail();
 const reader=response.body.getReader();let size=0;const chunks=[];
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)fail();chunks.push(value);}}
 finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail();}
}

/** ECS metadata v4, from the single container in this one-container task only. */
export async function readTaskEniAddress(env,fetcher=fetch){
 const raw=env?.ECS_CONTAINER_METADATA_URI_V4;let uri;
 try{uri=new URL(raw);}catch{fail();}
 if(uri.protocol!=='http:'||uri.host!=='169.254.170.2'||uri.username||uri.password||uri.search||uri.hash||
    !/^\/v4\/[a-zA-Z0-9-]+\/?$/u.test(uri.pathname))fail();
 const task=await boundedJson(`${uri.href.replace(/\/$/u,'')}/task`,fetcher);
 const container=task?.Containers?.length===1?task.Containers[0]:null;
 if(task.Family!==`meri-product-preview-temporal-${env.MERI_TEMPORAL_SERVICE_NAME}`||
    container?.Name!==env.MERI_TEMPORAL_SERVICE_NAME||container?.Networks?.length!==1||
    container.Networks[0].NetworkMode!=='awsvpc'||container.Networks[0].IPv4Addresses?.length!==1)fail();
 const ip=container.Networks[0].IPv4Addresses[0];
 if(typeof ip!=='string'||!ip4.test(ip)||ip.split('.').some(x=>Number(x)>255)||
    !(ip.startsWith('10.')||ip.startsWith('192.168.')||/^172\.(?:1[6-9]|2\d|3[01])\./u.test(ip)))fail();
 return ip;
}

function checkPemPair(certText,keyText){
 try{
  const cert=new X509Certificate(certText),key=createPrivateKey(keyText);
  if(Date.parse(cert.validFrom)>=Date.now()||Date.parse(cert.validTo)<=Date.now()||
     !cert.publicKey.export({type:'spki',format:'der'}).equals(createPublicKey(key).export({type:'spki',format:'der'})))fail();
 }catch{fail();}
}
export function checkCa(text,now=Date.now()){
 try{const cert=new X509Certificate(text);
  if(cert.ca!==true||Date.parse(cert.validFrom)>now||Date.parse(cert.validTo)<=now)fail();
 }catch{fail();}
}
async function writePrivate(file,text){
 const fd=await open(file,fsConstants.O_CREAT|fsConstants.O_EXCL|fsConstants.O_WRONLY|fsConstants.O_NOFOLLOW,0o600);
 try{await fd.writeFile(text,{encoding:'utf8'});await fd.sync();}finally{await fd.close();}
}

/** Prepare private task-local files only; any failure removes this invocation's directory. */
export async function prepareTemporalLaunch(env,argv,{fetcher=fetch}={}){
 validateTemporalLaunch(env,argv);
 const contract=createHash('sha256').update(await readFile(CONFIG_MODULE)).digest('hex');
 if(contract!==env.MERI_TEMPORAL_LAUNCH_CONTRACT_SHA256)fail();
 const caDigest=createHash('sha256').update(env.MERI_TEMPORAL_RDS_CA_PEM,'utf8').digest('hex');
 if(caDigest!==env.MERI_TEMPORAL_RDS_CA_SHA256)fail();
 checkCa(env.MERI_TEMPORAL_RDS_CA_PEM);checkCa(env.MERI_TEMPORAL_INTERNODE_CA_PEM);
 checkCa(env.MERI_TEMPORAL_FRONTEND_CA_PEM);
 checkPemPair(env.MERI_TEMPORAL_INTERNODE_CERT_PEM,env.MERI_TEMPORAL_INTERNODE_KEY_PEM);
 if(env.MERI_TEMPORAL_SERVICE_NAME==='frontend'){
  checkCa(env.MERI_TEMPORAL_CLIENT_CA_PEM);
  checkPemPair(env.MERI_TEMPORAL_FRONTEND_CERT_PEM,env.MERI_TEMPORAL_FRONTEND_KEY_PEM);
 }
 const root=await lstat(ROOT);
 if(!root.isDirectory()||root.isSymbolicLink()||root.uid!==process.getuid()||
    (root.mode&0o700)!==0o700||(root.mode&0o022)!==0)fail();
 const ip=await readTaskEniAddress(env,fetcher);
 const dir=await mkdtemp(`${ROOT}/launch-`);let complete=false;
 try{
  const files={rdsCa:join(dir,'rds-ca.pem'),internodeCert:join(dir,'internode-cert.pem'),
   internodeKey:join(dir,'internode-key.pem'),internodeCa:join(dir,'internode-ca.pem'),frontendCa:join(dir,'frontend-ca.pem')};
  const material=[['rdsCa','MERI_TEMPORAL_RDS_CA_PEM'],['internodeCert','MERI_TEMPORAL_INTERNODE_CERT_PEM'],
   ['internodeKey','MERI_TEMPORAL_INTERNODE_KEY_PEM'],['internodeCa','MERI_TEMPORAL_INTERNODE_CA_PEM'],
   ['frontendCa','MERI_TEMPORAL_FRONTEND_CA_PEM']];
  if(env.MERI_TEMPORAL_SERVICE_NAME==='frontend'){
   Object.assign(files,{frontendCert:join(dir,'frontend-cert.pem'),frontendKey:join(dir,'frontend-key.pem'),clientCa:join(dir,'client-ca.pem')});
   material.push(['frontendCert','MERI_TEMPORAL_FRONTEND_CERT_PEM'],['frontendKey','MERI_TEMPORAL_FRONTEND_KEY_PEM'],['clientCa','MERI_TEMPORAL_CLIENT_CA_PEM']);
  }
  for(const [field,key] of material)await writePrivate(files[field],env[key]);
  const yaml=renderTemporalConfig(env,argv,ip,files);
  const configPath=join(dir,'config.yaml');await writePrivate(configPath,yaml);
  complete=true;return {configPath,dir,role:env.MERI_TEMPORAL_ROLE};
 }finally{if(!complete)await rm(dir,{recursive:true,force:true});}
}

async function launch(){
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--help'){
  process.stdout.write('Usage: temporal-launch <frontend|history|matching|worker|internal-frontend>\n'
   +'Renders one private Temporal 1.32.1 role after reviewed activation and ECS task checks.\n'
   +'Exit 0: help or clean server exit; 64: invalid role; 78: configuration, preflight, start, or cleanup refusal.\n');
  return;
 }
 if(args.length!==1||!['frontend','history','matching','worker','internal-frontend'].includes(args[0])){
  process.stderr.write('TEMPORAL_LAUNCH_USAGE\n');process.exitCode=64;return;
 }
 let prepared;
 try{prepared=await prepareTemporalLaunch(process.env,args);}
 catch{process.stderr.write('TEMPORAL_LAUNCH_REFUSED\n');process.exitCode=78;return;}
 let child;
 try{child=spawn('/usr/local/bin/temporal-server',['--config-file',prepared.configPath,'start','--service',prepared.role],
   {stdio:'inherit',env:{PATH:'/usr/local/bin:/usr/bin:/bin',HOME:'/etc/temporal'}});}
 catch{await rm(prepared.dir,{recursive:true,force:true});process.stderr.write('TEMPORAL_SERVER_START_REFUSED\n');process.exitCode=78;return;}
 const forwarders=new Map(['SIGTERM','SIGINT'].map(signal=>[signal,()=>child.kill(signal)]));
 for(const [signal,forward] of forwarders)process.on(signal,forward);
 let failed=false;
 child.once('error',()=>{failed=true;process.stderr.write('TEMPORAL_SERVER_START_REFUSED\n');});
 child.once('close',async(code,signal)=>{
  for(const [signal,forward] of forwarders)process.off(signal,forward);
  try{await rm(prepared.dir,{recursive:true,force:true});}
  catch{failed=true;process.stderr.write('TEMPORAL_LAUNCH_CLEANUP_FAILED\n');}
  process.exitCode=failed?78:Number.isInteger(code)?code:signal?143:78;
 });
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await launch();
