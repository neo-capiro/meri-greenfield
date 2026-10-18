/** Renderer sandbox probe (child process). The renderer qualification owner (`renderer-qualification.mjs`) runs this file
 * through the exact spawn path the LibreOffice converter uses (`process.mjs` `runArtifactProcess`: same parent, fixed env,
 * owned working directory, own process group), so what it observes is what a converter child gets in this container.
 *
 * It only reads: its own /proc status, mount table and network devices, the cgroup limits, its own environment variable
 * NAMES (never values), its working directory, and whether each trusted credential path named on stdin can be opened for
 * reading (opened and closed, never read). It opens no socket, spawns nothing and writes nothing outside stdout.
 * Every unreadable source is reported as null; the owner treats null as not attested. */
import {readFileSync,statSync,openSync,closeSync} from 'node:fs';
const SCHEMA='meri-renderer-sandbox-observation/1';
const text=path=>{try{return readFileSync(path,'utf8');}catch{return null;}};
const line=(status,key)=>{if(status===null)return null;const match=status.split('\n').find(l=>l.startsWith(key+':'));return match===undefined?null:match.slice(key.length+1).trim();};
const ids=value=>{if(value===null)return null;const parts=value.split(/\s+/u);return parts.length===4&&parts.every(p=>/^[0-9]{1,10}$/u.test(p))?parts.map(Number):null;};
function rootMountOptions(){
 const table=text('/proc/self/mountinfo');if(table===null)return null;
 // Fields: id parent major:minor root mountpoint options [optional...] - fstype source superoptions. The last '/' mount wins.
 let options=null;for(const row of table.split('\n')){const f=row.split(' ');if(f.length>=6&&f[4]==='/')options=f[5];}
 return options;
}
function interfaces(){
 const dev=text('/proc/net/dev');if(dev===null)return null;
 return dev.split('\n').slice(2).map(l=>l.split(':')[0].trim()).filter(Boolean).sort();
}
function cgroup(){
 const first=paths=>{for(const p of paths){const v=text(p);if(v!==null)return v.trim();}return null;};
 return {memoryMax:first(['/sys/fs/cgroup/memory.max','/sys/fs/cgroup/memory/memory.limit_in_bytes']),
  pidsMax:first(['/sys/fs/cgroup/pids.max','/sys/fs/cgroup/pids/pids.max']),
  cpuMax:first(['/sys/fs/cgroup/cpu.max','/sys/fs/cgroup/cpu/cpu.cfs_quota_us'])};
}
function readable(path){try{const fd=openSync(path,'r');closeSync(fd);return true;}catch{return false;}}
function workspace(){try{const s=statSync(process.cwd());return {mode:s.mode&0o7777,uid:s.uid};}catch{return null;}}
let input={};try{input=JSON.parse(readFileSync(0,'utf8')||'{}');}catch{input={};}
const credentialPaths=Array.isArray(input.credentialPaths)?input.credentialPaths.filter(p=>typeof p==='string').slice(0,64):[];
const status=text('/proc/self/status');
const observation={schema:SCHEMA,platform:process.platform,
 uid:ids(line(status,'Uid')),gid:ids(line(status,'Gid')),
 noNewPrivs:(v=>v===null||!/^[01]$/u.test(v)?null:Number(v))(line(status,'NoNewPrivs')),
 capabilities:Object.fromEntries(['CapInh','CapPrm','CapEff','CapBnd','CapAmb'].map(k=>[k,(v=>v!==null&&/^[0-9a-f]{16}$/u.test(v)?v:null)(line(status,k))])),
 rootMountOptions:rootMountOptions(),interfaces:interfaces(),cgroup:cgroup(),
 envNames:Object.keys(process.env).sort(),cwd:process.cwd(),home:process.env.HOME??null,tmpdir:process.env.TMPDIR??null,workspace:workspace(),
 credentialPathsReadable:credentialPaths.map(path=>({path,readable:readable(path)}))};
process.stdout.write(JSON.stringify(observation));
