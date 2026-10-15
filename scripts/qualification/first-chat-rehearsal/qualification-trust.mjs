/** Qualification-only trust binding for the composed rehearsals (source only; both execution routes stay on HOLD until a specific
 * action-time approval). One explicit environment contract: the harness process and the CLI child trust exactly one private CA
 * (MERI_QUALIFICATION_CA, which must also be the harness's own NODE_EXTRA_CA_CERTS), the stand-in's leaf is run-owned material,
 * the CA signing key is absent from the material directory before the harness starts, the database is a run-owned disposable
 * cluster held exclusively, and the source, environment and tool identity are pinned into the receipt. A non-destructive TLS
 * preflight distinguishes an untrusted stand-in from an unreachable or wrong one. Nothing here changes the product route: the
 * extra variable joins the launch template, the SDK options and the runner query together, so the launch plan hashed by the
 * supervisor and the descriptor produced by the SDK agree. */
import {readFileSync,statSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {hostname} from 'node:os';
import {dirname,join,isAbsolute} from 'node:path';
import {spawn} from 'node:child_process';
const fail=(code,extra={})=>{throw Object.assign(Error(code),{code,...extra});};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(v);
const hex40=v=>typeof v==='string'&&/^[a-f0-9]{40}$/u.test(v);
export const TLS_FAILURE_CODES=Object.freeze(new Set(['UNABLE_TO_VERIFY_LEAF_SIGNATURE','SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT','CERT_HAS_EXPIRED','ERR_TLS_CERT_ALTNAME_INVALID','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','UNABLE_TO_GET_ISSUER_CERT','CERT_UNTRUSTED','ERR_SSL_WRONG_VERSION_NUMBER','EPROTO']));
const UNREACHABLE_CODES=new Set(['ECONNREFUSED','ENOTFOUND','ECONNRESET','EHOSTUNREACH','ETIMEDOUT','EAI_AGAIN','ABORT_ERR','UND_ERR_CONNECT_TIMEOUT','UND_ERR_SOCKET']);
export const SHARED_SOCKETS=Object.freeze(['/tmp/meri-broker-pg-socket-20261014','/tmp/meri-prepared-kickoff-pg-20261014/socket']);
/** Walks the cause chain and names the failure class: UNTRUSTED (TLS verification), UNREACHABLE (no listener or network), OTHER. */
export function classifyTransportFailure(error){
 const codes=[];let e=error;for(let i=0;i<8&&e&&typeof e==='object';i++){if(typeof e.code==='string')codes.push(e.code);if(e.name==='AbortError')codes.push('ABORT_ERR');if(typeof e.message==='string'&&/unable to verify|self[- ]signed|certificate/iu.test(e.message))codes.push('CERT_UNTRUSTED');e=e.cause;}
 if(codes.some(c=>TLS_FAILURE_CODES.has(c)))return 'UNTRUSTED';if(codes.some(c=>UNREACHABLE_CODES.has(c)))return 'UNREACHABLE';return 'OTHER';
}
function ownedFile(path,{privateMode=false,uid}){if(typeof path!=='string'||!isAbsolute(path)||path.includes('/../'))fail('QUALIFICATION_TRUST_PATH',{path});let st;try{st=statSync(path);}catch{fail('QUALIFICATION_TRUST_FILE_MISSING',{path});}
 if(!st.isFile()||st.uid!==uid||(st.mode&(privateMode?0o077:0o022))!==0||st.size<1||st.size>65536)fail('QUALIFICATION_TRUST_FILE_MODE',{path,mode:(st.mode&0o777).toString(8)});return path;}
/** The run-owned disposable cluster: never a shared socket, a marker naming this run in the socket directory, and a database named by the run. */
export function ownedClusterIdentity({socket,database,runId}){
 if(!uuid(runId))fail('QUALIFICATION_RUN_ID');if(typeof socket!=='string'||!isAbsolute(socket)||SHARED_SOCKETS.includes(socket)||SHARED_SOCKETS.some(s=>socket.startsWith(s+'/')))fail('QUALIFICATION_CLUSTER_SHARED',{socket});
 let st;try{st=statSync(socket);}catch{fail('QUALIFICATION_CLUSTER_MISSING',{socket});}if(!st.isDirectory())fail('QUALIFICATION_CLUSTER_MISSING',{socket});
 let marker;try{marker=readFileSync(join(socket,'meri-rehearsal-owned'),'utf8').trim();}catch{fail('QUALIFICATION_CLUSTER_UNOWNED',{socket});}if(marker!==runId)fail('QUALIFICATION_CLUSTER_UNOWNED',{socket});
 const expected='meri_rehearsal_'+runId.replace(/-/gu,'');if(database!==expected)fail('QUALIFICATION_CLUSTER_DATABASE',{database,expected});
 return Object.freeze({socket,database,runId});
}
/** The reviewed source identity recorded by the run script (git as the checkout owner): exact head and tree, and a clean tree. */
export function readSourceIdentity(path){
 if(typeof path!=='string'||!isAbsolute(path))fail('QUALIFICATION_SOURCE_IDENTITY');let v;try{v=JSON.parse(readFileSync(path,'utf8'));}catch{fail('QUALIFICATION_SOURCE_IDENTITY');}
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!=='head,porcelain,recordedAt,root,tree'||!hex40(v.head)||!hex40(v.tree)||!Array.isArray(v.porcelain)||typeof v.root!=='string'||!Number.isFinite(Date.parse(v.recordedAt)))fail('QUALIFICATION_SOURCE_IDENTITY');
 if(v.porcelain.length)fail('QUALIFICATION_SOURCE_DIRTY',{paths:v.porcelain.length});return Object.freeze({head:v.head,tree:v.tree,root:v.root,recordedAt:v.recordedAt,clean:true});
}
/** Parses the complete qualification contract from the environment; absent entirely means the product route (no trust change). */
export function parseQualificationTrust(env,{uid=process.getuid()}={}){
 const keys=['MERI_QUALIFICATION_CA','MERI_QUALIFICATION_CERT','MERI_QUALIFICATION_KEY','MERI_REHEARSAL_RUN_ID','MERI_REHEARSAL_PG_SOCKET','MERI_REHEARSAL_PG_DATABASE','MERI_REHEARSAL_SOURCE_IDENTITY'];
 const present=keys.filter(k=>env[k]!==undefined);
 if(!present.length){if(env.NODE_EXTRA_CA_CERTS!==undefined)fail('QUALIFICATION_TRUST_INCONSISTENT',{detail:'NODE_EXTRA_CA_CERTS without the qualification contract'});return null;}
 if(present.length!==keys.length)fail('QUALIFICATION_TRUST_INCOMPLETE',{missing:keys.filter(k=>env[k]===undefined)});
 const caFile=ownedFile(env.MERI_QUALIFICATION_CA,{uid}),certFile=ownedFile(env.MERI_QUALIFICATION_CERT,{uid}),keyFile=ownedFile(env.MERI_QUALIFICATION_KEY,{uid,privateMode:true});
 if(env.NODE_EXTRA_CA_CERTS!==caFile)fail('QUALIFICATION_TRUST_INCONSISTENT',{detail:'the harness must trust the same CA file through NODE_EXTRA_CA_CERTS'});
 for(const name of ['ca.key','ca.srl','server.csr','ext.cnf'])if(existsSync(join(dirname(caFile),name)))fail('QUALIFICATION_SIGNER_MATERIAL_PRESENT',{name});
 const runId=env.MERI_REHEARSAL_RUN_ID;if(!uuid(runId))fail('QUALIFICATION_RUN_ID');
 const cluster=ownedClusterIdentity({socket:env.MERI_REHEARSAL_PG_SOCKET,database:env.MERI_REHEARSAL_PG_DATABASE,runId}),sourceIdentity=readSourceIdentity(env.MERI_REHEARSAL_SOURCE_IDENTITY);
 return Object.freeze({caFile,caSha256:sha(readFileSync(caFile)),certFile,keyFile,runId,cluster,sourceIdentity});
}
/** The one launch-environment change of the qualification route, applied identically to the launch plan, the descriptor probe and the runner query. */
export function withQualificationEnvironment(env,trust){
 if(!env||typeof env!=='object'||Array.isArray(env))fail('QUALIFICATION_ENVIRONMENT_SHAPE');if(!trust)return env;
 if(Object.hasOwn(env,'NODE_EXTRA_CA_CERTS'))fail('QUALIFICATION_TRUST_INCONSISTENT',{detail:'NODE_EXTRA_CA_CERTS already present'});return {...env,NODE_EXTRA_CA_CERTS:trust.caFile};
}
/** Non-destructive preflight: one probe to the stand-in before any fixture, cluster or launch; the failure class is explicit. */
export async function preflightStandIn({origin,expectedReply,fetchImpl=fetch,timeoutMs=3000}){
 let url;try{url=new URL(origin);}catch{fail('REHEARSAL_PROVIDER_STANDIN_REQUIRED',{detail:'origin'});}if(url.protocol!=='https:'||url.origin!==origin)fail('REHEARSAL_PROVIDER_STANDIN_REQUIRED',{detail:'https origin required'});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{let response;try{response=await fetchImpl(url.origin+'/v1/messages',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:'stand-in-probe',max_tokens:1,messages:[{role:'user',content:'probe'}]}),signal:controller.signal});}
  catch(error){const kind=classifyTransportFailure(error);fail(kind==='UNTRUSTED'?'REHEARSAL_PROVIDER_STANDIN_TLS_UNTRUSTED':kind==='UNREACHABLE'?'REHEARSAL_PROVIDER_STANDIN_UNREACHABLE':'REHEARSAL_PROVIDER_STANDIN_REQUIRED',{kind});}
  let reply=null;try{reply=await response.json();}catch{}if(response.status!==200||reply?.content?.[0]?.text!==expectedReply)fail('REHEARSAL_PROVIDER_STANDIN_REQUIRED',{status:response.status});
  return Object.freeze({origin:url.origin,status:response.status,trusted:true});}
 finally{clearTimeout(timer);}
}
/** Exclusive use of the run-owned cluster: a second harness on the same cluster is refused, never interleaved. */
export async function acquireExclusiveRehearsal(pool){
 const r=await pool.query("SELECT pg_try_advisory_lock(hashtextextended('meri-rehearsal-exclusive',0)) AS locked");if(r.rows[0]?.locked!==true)fail('REHEARSAL_NOT_EXCLUSIVE');
 return async()=>{await pool.query("SELECT pg_advisory_unlock(hashtextextended('meri-rehearsal-exclusive',0))");};
}
const read=path=>{try{return readFileSync(path,'utf8').trim();}catch{return null;}};
/** Pins the environment, the harness and the tools a receipt is attributed to. */
export function environmentIdentity({trust=null,harnessFile=null,cliPath=null}={}){
 const file=path=>path?{path,sha256:sha(readFileSync(path))}:null;
 return Object.freeze({hostname:hostname(),pid:process.pid,ppid:process.ppid,uid:process.getuid(),gid:process.getgid(),bootId:read('/proc/sys/kernel/random/boot_id'),pid1:read('/proc/1/comm'),node:{...file(process.execPath),version:process.version},harness:file(harnessFile),cli:file(cliPath),source:trust?.sourceIdentity??null,qualification:trust?{caSha256:trust.caSha256,runId:trust.runId,cluster:trust.cluster}:null});
}
/** Real-CLI negative control: the pinned CLI started with the stand-in origin and no CA in its environment must fail at TLS and reach no listener. */
const TLS_REFUSAL_TEXT=/UNABLE_TO_VERIFY_LEAF_SIGNATURE|SELF_SIGNED_CERT_IN_CHAIN|DEPTH_ZERO_SELF_SIGNED_CERT|unable to verify|self.signed certificate/iu;
export async function cliNegativeControl({command,args,cwd,env,timeoutMs=30000}){
 if(Object.hasOwn(env,'NODE_EXTRA_CA_CERTS'))fail('QUALIFICATION_TRUST_INCONSISTENT',{detail:'the negative control must not carry the CA'});
 return new Promise(resolve=>{
  const child=spawn(command,args,{cwd,env,stdio:['ignore','pipe','pipe']});let out='',err='';
  child.stdout.on('data',d=>{if(out.length<65536)out+=String(d);});child.stderr.on('data',d=>{if(err.length<65536)err+=String(d);});
  const timer=setTimeout(()=>child.kill('SIGKILL'),timeoutMs);
  child.once('exit',(exitCode,signal)=>{clearTimeout(timer);const text=out+'\n'+err;resolve(Object.freeze({exitCode,signal,tlsRefused:TLS_REFUSAL_TEXT.test(text),stdoutBytes:out.length,stderrBytes:err.length}));});
 });
}
