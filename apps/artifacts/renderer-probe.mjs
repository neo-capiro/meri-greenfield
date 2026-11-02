/** Renderer sandbox probe (child process). The renderer qualification owner (`renderer-qualification.mjs`) runs this file
 * through the exact spawn path the LibreOffice converter uses (`process.mjs` `runArtifactProcess`: same parent, fixed env,
 * owned working directory, own process group), so what it observes is what a converter child gets in this container.
 *
 * It only reads: its own /proc status and limits, its own cgroup membership plus the selected cgroup2 mount and visible
 * ancestors, mount table and network devices, its own environment variable NAMES (never values), its working directory,
 * and whether each trusted credential path named on stdin exposes content to it (a file is opened and closed, never
 * read; a directory is listed by name only, see `readable`). It opens no socket, spawns nothing and writes nothing
 * outside stdout. Every unreadable source is reported as null; the owner treats null as not attested. */
import {readFileSync,readSync,statSync,openSync,closeSync,fstatSync,readdirSync} from 'node:fs';
import {isAbsolute,relative,sep,join} from 'node:path';
import {observeProbeCgroup,parseProcLimits,readBoundedInput} from './renderer-probe-observation.mjs';
const SCHEMA='meri-renderer-sandbox-observation/1';
const MAX_INPUT_BYTES=65536;
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
 const dev=text('/proc/self/net/dev');if(dev===null)return null;
 return dev.split('\n').slice(2).map(l=>l.split(':')[0].trim()).filter(Boolean).sort();
}
/** Bounded visible cgroup view with the established v1/fixed-path fallback. Membership and the selected mount are read
 * before and after the controller reads; a changed identity returns no ancestor values. It never claims that a hidden
 * ancestor above the visible namespace root is absent. */
function cgroup(){return observeProbeCgroup({read:text});}
function processLimits(){return parseProcLimits(text('/proc/self/limits'));}
/** Whether a protected path's CONTENT is reachable from this child. A path that cannot be opened is unreadable, and a
 * file (anything that opens and is not a directory) is readable. A directory is judged by what it lists: bubblewrap
 * materialises the ancestors of the bound workspace inside the child's private root, so an inventory root above the
 * workspace (the upload scratch lives under `/run/meri`) is always traversable while none of its protected content is
 * present. Such an ancestor is unreadable only when every level from it down to the working directory lists exactly
 * the next component of that chain; a directory that is not an ancestor, a failed listing, or any other entry on the
 * chain is readable. Names are compared and never reported; nothing is read. */
function readable(path){
 let fd;try{fd=openSync(path,'r');}catch{return false;}
 let directory=false;try{directory=fstatSync(fd).isDirectory();}catch{}finally{closeSync(fd);}
 if(!directory)return true;
 const chain=relative(path,process.cwd());
 if(chain===''||chain.startsWith('..')||isAbsolute(chain))return true;
 let level=path;
 for(const next of chain.split(sep)){
  let names;try{names=readdirSync(level);}catch{return true;}
  if(names.length!==1||names[0]!==next)return true;
  level=join(level,next);
 }
 return false;
}
function workspace(){try{const s=statSync(process.cwd());return {mode:s.mode&0o7777,uid:s.uid};}catch{return null;}}
/** Exact-cap stdin consumption through the pure bounded port. The established shared-renderer default remains valid:
 * zero bytes means no configured credential paths, not malformed input. Over-cap, read failure, malformed JSON or a
 * non-absolute/oversized list is invalid and its credential results stay null. */
function stdinInput(){
 const raw=readBoundedInput({readSync,maxBytes:MAX_INPUT_BYTES});
 if(raw.state==='read-error')return {valid:false,credentialPaths:[],truncated:false};
 if(raw.state==='over-cap')return {valid:false,credentialPaths:[],truncated:true};
 if(raw.state==='empty')return {valid:true,credentialPaths:[]};
 try{
  const parsed=JSON.parse(raw.text);
  if(parsed===null||typeof parsed!=='object'||Array.isArray(parsed))return {valid:false,credentialPaths:[]};
  if(parsed.credentialPaths===undefined)return {valid:true,credentialPaths:[]};
  if(!Array.isArray(parsed.credentialPaths)||parsed.credentialPaths.length>64||
   !parsed.credentialPaths.every(p=>typeof p==='string'&&isAbsolute(p)))return {valid:false,credentialPaths:[]};
  return {valid:true,credentialPaths:[...parsed.credentialPaths]};
 }catch{return {valid:false,credentialPaths:[]};}
}
const input=stdinInput();
const credentialPathsReadable=input.valid?input.credentialPaths.map(path=>({path,readable:readable(path)})):null;
const status=text('/proc/self/status');
const observation={schema:SCHEMA,platform:process.platform,
 uid:ids(line(status,'Uid')),gid:ids(line(status,'Gid')),
 noNewPrivs:(v=>v===null||!/^[01]$/u.test(v)?null:Number(v))(line(status,'NoNewPrivs')),
 capabilities:Object.fromEntries(['CapInh','CapPrm','CapEff','CapBnd','CapAmb'].map(k=>[k,(v=>v!==null&&/^[0-9a-f]{16}$/u.test(v)?v:null)(line(status,k))])),
 rootMountOptions:rootMountOptions(),interfaces:interfaces(),cgroup:cgroup(),processLimits:processLimits(),
 envNames:Object.keys(process.env).sort(),cwd:process.cwd(),home:process.env.HOME??null,tmpdir:process.env.TMPDIR??null,workspace:workspace(),
 inputValid:input.valid,credentialPathsReadable};
process.stdout.write(JSON.stringify(observation));
