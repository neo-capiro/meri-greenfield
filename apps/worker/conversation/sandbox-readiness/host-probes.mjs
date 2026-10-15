// @ts-check
/** Real host ports for the readiness check: PATH lookup, a bounded bubblewrap probe, temporary directories and the
 * pinned SDK. Importing this module performs no I/O; each port acts only when called. */
import {accessSync,constants,existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {tmpdir} from 'node:os';
import {delimiter,dirname,isAbsolute,join} from 'node:path';
import {fileURLToPath} from 'node:url';
/** @param {string} pathEnv @returns {import('./readiness.mjs').ReadinessPorts['findExecutable']} */
const finder=pathEnv=>name=>{for(const dir of pathEnv.split(delimiter).filter(d=>isAbsolute(d))){const candidate=join(dir,name);try{accessSync(candidate,constants.X_OK);return candidate;}catch{}}return undefined;};
/** Exit status 0 within 10 s, no shell, empty environment; the child is killed on timeout. @type {import('./readiness.mjs').ReadinessPorts['runProbe']} */
const runProbe=(command,args)=>new Promise(resolve=>{execFile(command,args,{timeout:10000,killSignal:'SIGKILL',env:{},windowsHide:true,maxBuffer:65536},error=>resolve(!error));});
/** @returns {string} */
function installedSdkVersion(){
 const entry=fileURLToPath(import.meta.resolve('@anthropic-ai/claude-agent-sdk'));
 return String(JSON.parse(readFileSync(join(dirname(entry),'package.json'),'utf8')).version);
}
/** @param {{pathEnv:string}} input @returns {Promise<import('./readiness.mjs').ReadinessPorts&{close:()=>void}>} */
export async function createHostPorts({pathEnv}){
 const {query}=await import('@anthropic-ai/claude-agent-sdk');const root=mkdtempSync(join(tmpdir(),'meri-sandbox-readiness-'));
 return {findExecutable:finder(pathEnv),runProbe,exists:existsSync,query,sdkVersion:installedSdkVersion(),nodePath:process.execPath,pathEnv,
  makeTempDir:label=>mkdtempSync(join(root,`${label}-`)),removeDir:path=>rmSync(path,{recursive:true,force:true}),
  close:()=>rmSync(root,{recursive:true,force:true})};
}
