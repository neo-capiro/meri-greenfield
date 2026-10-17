// @ts-check
/** Executable entry for the lane 8 Linux runtime qualification (`linux-qualification.mjs`). Run it inside the exact
 * target task (the Meri runner image on Fargate, or a candidate browser/Bash host) as the task user:
 *
 *   node apps/worker/conversation/sandbox-readiness/linux-qualification-cli.mjs --run-directory /run/meri [--skip-sdk] [--live-egress-name <allowlisted public name>]
 *
 * It writes `lane8-qualification-<ms>.json` under `<run-directory>/qualification/` and prints the same JSON. Temporary
 * files go under `<run-directory>/qualification/tmp` (the root is read-only on the runner). No credential is read or
 * required; the SDK step makes no model request (loopback discard base URL, placeholder token); no metadata endpoint
 * is contacted. `--live-egress-name` is the only option that uses the network: one CONNECT through the proxy to that
 * allowlisted name on 443 with the system resolver, plus refused metadata and IP-literal probes.
 * Exit: 0 both sandboxes feasible and the egress matrix verified; 1 measured, something infeasible; 2 usage; 3 incomplete. */
import {pathToFileURL} from 'node:url';
import {accessSync,constants,mkdirSync,readFileSync,rmSync,writeFileSync,mkdtempSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {arch,platform,release} from 'node:os';
import {delimiter,isAbsolute,join} from 'node:path';
import * as net from 'node:net';
import * as http from 'node:http';
import {qualifyLinuxHost,egressLoopbackSelfTest} from './linux-qualification.mjs';
export const USAGE=`Usage: node apps/worker/conversation/sandbox-readiness/linux-qualification-cli.mjs --run-directory /abs [--skip-sdk] [--live-egress-name name]
`;
/** @param {string[]} argv */
export function parseArguments(argv){
 /** @type {{runDirectory?:string,skipSdk:boolean,liveEgressName?:string}} */const out={skipSdk:false};const seen=new Set();
 for(let i=0;i<argv.length;i++){const flag=String(argv[i]);if(seen.has(flag))return undefined;seen.add(flag);
  if(flag==='--skip-sdk')out.skipSdk=true;
  else if(flag==='--run-directory'){const v=argv[++i];if(typeof v!=='string'||!v.startsWith('/')||v.includes('\0')||v.includes('/../'))return undefined;out.runDirectory=v.replace(/\/+$/u,'')||'/';}
  else if(flag==='--live-egress-name'){const v=argv[++i];if(typeof v!=='string'||!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u.test(v))return undefined;out.liveEgressName=v;}
  else return undefined;}
 return out.runDirectory?out:undefined;
}
/** @param {string} pathEnv */
const finder=pathEnv=>(/** @type {string} */name)=>{for(const dir of pathEnv.split(delimiter).filter(d=>isAbsolute(d))){const c=join(dir,name);try{accessSync(c,constants.X_OK);return c;}catch{}}return undefined;};
/** No shell, empty environment, 10 s bound, killed on timeout. @param {string} command @param {string[]} args */
const run=(command,args)=>new Promise(resolve=>{execFile(command,args,{timeout:10000,killSignal:'SIGKILL',env:{},windowsHide:true,maxBuffer:65536},(error,stdout,stderr)=>resolve({ok:!error,stdout:String(stdout),stderr:String(stderr)}));});
/** @param {string} directory */
function canWrite(directory){try{const d=mkdtempSync(join(directory,'.meri-write-probe-'));rmSync(d,{recursive:true,force:true});return true;}catch{return false;}}
/** @param {string[]} argv @param {{write?:(t:string)=>void,error?:(t:string)=>void}} [io] */
export async function main(argv=process.argv.slice(2),{write=t=>process.stdout.write(t),error=t=>process.stderr.write(t)}={}){
 if(argv.length===1&&['--help','-h'].includes(String(argv[0]))){write(USAGE);return 0;}
 const o=parseArguments(argv);if(!o||!o.runDirectory){error('QUALIFICATION_ARGUMENTS\n');return 2;}
 const runDirectory=o.runDirectory,outDir=join(runDirectory,'qualification'),tmp=join(outDir,'tmp');
 try{
  mkdirSync(tmp,{recursive:true});process.env.TMPDIR=tmp;// the SDK readiness ports use os.tmpdir()
  const [{startEgressProxy},{createBashEgressControl,systemResolver}]=await Promise.all([import('../egress/proxy-server.mjs'),import('../egress/bash-egress.mjs')]);
  const pathEnv=process.env.PATH??'';
  const report=await qualifyLinuxHost({
   host:()=>({platform:platform(),arch:arch(),kernel:release(),uid:process.getuid?.()??null,gid:process.getgid?.()??null,node:process.version}),
   env:name=>process.env[name],
   readText:path=>{try{return readFileSync(path,'utf8').slice(0,65536);}catch{return undefined;}},
   canWrite,findExecutable:finder(pathEnv),run,nodePath:process.execPath,now:Date.now,
   ...(o.skipSdk?{}:{sdkReadiness:async()=>{
    const [{checkSandboxReadiness},{createHostPorts}]=await Promise.all([import('./readiness.mjs'),import('./host-probes.mjs')]);
    const ports=await createHostPorts({pathEnv});try{return await checkSandboxReadiness(ports,{deadlineMs:30000});}finally{try{ports.close();}catch{}}
   }}),
   egressSelfTest:()=>egressLoopbackSelfTest({startEgressProxy,createBashEgressControl,net,http,now:Date.now}),
   ...(o.liveEgressName?{liveEgress:async()=>{
    const name=/** @type {string} */(o.liveEgressName);
    const control=createBashEgressControl({domains:[name],resolve:systemResolver,now:Date.now,expiresAtMs:Date.now()+60000});
    const proxy=await startEgressProxy({control,httpPort:0});
    const tunnel=(/** @type {string} */authority)=>new Promise(resolve=>{const r=http.request({host:'127.0.0.1',port:proxy.ports.http,method:'CONNECT',path:authority});r.on('connect',(res,s)=>{s.destroy();resolve(res.statusCode);});r.on('response',res=>{res.resume();resolve(res.statusCode);});r.on('error',()=>resolve(0));r.setTimeout(15000,()=>{r.destroy();resolve(0);});r.end();});
    try{const cases={allowlistedTunnel:await tunnel(`${name}:443`)===200,metadataLiteralRefused:await tunnel('169.254.169.254:80')===403,ecsCredentialsLiteralRefused:await tunnel('169.254.170.2:80')===403,unlistedRefused:await tunnel('example.com:443')===403||name==='example.com'};
     return {passed:Object.values(cases).every(Boolean),cases};}
    finally{await proxy.close();}
   }}:{}),
  },{runDirectory});
  const text=JSON.stringify(report);
  writeFileSync(join(outDir,`lane8-qualification-${report.measuredAtMs}.json`),text+'\n',{flag:'wx'});
  write(text+'\n');
  const v=report.verdicts;
  return v.bashSandbox.verdict==='feasible'&&v.chromiumSandbox.verdict==='feasible'&&v.egressProxy.verdict==='verified'&&v.liveEgress.verdict!=='failed'?0:1;
 }catch(e){error(`QUALIFICATION_INCOMPLETE ${/** @type {{code?:string}} */(e)?.code??'UNEXPECTED'}\n`);return 3;}
 finally{try{rmSync(tmp,{recursive:true,force:true});}catch{}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await main();
