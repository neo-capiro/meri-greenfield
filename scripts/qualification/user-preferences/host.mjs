/** Portable native-process and ownership guards. No I/O until a returned method is called. */
import {execFile as callback} from 'node:child_process';
import {promisify} from 'node:util';
import {access,lstat,realpath,readFile,readlink,statfs} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const execFile=promisify(callback);
export const ensure=(condition,label)=>{if(!condition)throw Error(label);};
export const CLEANUP_RESERVE_MS=90000;
export const exists=filename=>lstat(filename).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;});
const equalPath=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
export async function plainDirectory(directory){
 const absolute=path.resolve(directory),parts=absolute.slice(path.parse(absolute).root.length).split(path.sep).filter(Boolean);let current=path.parse(absolute).root;
 for(const part of parts){current=path.join(current,part);const s=await lstat(current);ensure(s.isDirectory()&&!s.isSymbolicLink()&&equalPath(await realpath(current),current),'REPARSE_OR_NONCANONICAL_DIRECTORY_REFUSED');}
}
export function createHost(config,scrub){
 const env=Object.fromEntries(['SystemRoot','WINDIR','PATH','TEMP','TMP','PSModulePath','COMSPEC','USERPROFILE','APPDATA','LOCALAPPDATA','HOME','LANG','LC_ALL'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
 const windows=process.platform==='win32',extension=windows?'.exe':'';
 async function run(file,args,{timeout=10000,extraEnv={},cwd=config.out,cleanupDeadline=null}={}){
  const remaining=(cleanupDeadline??config.cutoff-CLEANUP_RESERVE_MS)-Date.now();ensure(remaining>0,cleanupDeadline?'CLEANUP_BUDGET_EXPIRED':'WINDOW_CLEANUP_RESERVE_REACHED');
  try{return await execFile(file,args,{cwd,timeout:Math.max(1,Math.min(timeout,remaining)),windowsHide:true,maxBuffer:2097152,env:{...env,...extraEnv}});}
  catch(error){const safe=Error('CHILD_FAILED_'+path.basename(file)+'_'+String(error.code??'unknown'));safe.safeOutput=scrub((error.stdout??'')+'\n'+(error.stderr??''));throw safe;}
 }
 async function binary(name){
  const candidates=config.pgBin?[path.join(config.pgBin,name+extension)]:(process.env.PATH??'').split(path.delimiter).filter(Boolean).map(dir=>path.join(dir,name+extension));
  for(const candidate of candidates)try{await access(candidate);return await realpath(candidate);}catch{}
  throw Error('MISSING_BINARY_'+name);
 }
 async function listeners({cleanupDeadline=null,cwd=config.out}={}){
  if(windows){const {stdout}=await run('netstat.exe',['-ano','-p','tcp'],{cwd,cleanupDeadline});return stdout.split(/\r?\n/u).filter(line=>new RegExp(':'+config.target.port+'\\s','u').test(line)&&/LISTENING/iu.test(line)).map(line=>({pid:Number(line.trim().split(/\s+/u).at(-1))}));}
  const {stdout}=await run('ss',['-H','-ltnp','sport = :'+config.target.port],{cwd,cleanupDeadline});
  return stdout.split(/\r?\n/u).filter(Boolean).map(line=>({pid:Number(/pid=(\d+),/u.exec(line)?.[1]??0)}));
 }
 async function windowsMetadata(pid,cleanupDeadline){
  const script=`$ErrorActionPreference='Stop'; $p=Get-Process -Id ${pid}; $c=Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}'; if($null -eq $c){throw 'process metadata absent'}; [pscustomobject]@{id=$p.Id;path=$p.Path;startMs=([DateTimeOffset]$p.StartTime.ToUniversalTime()).ToUnixTimeMilliseconds();commandLine=$c.CommandLine} | ConvertTo-Json -Compress`;
  let result;for(const shell of ['pwsh.exe','powershell.exe']){try{result=await run(shell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{cleanupDeadline});break;}catch(error){if(!String(error.message).includes('ENOENT'))throw error;}}
  ensure(result,'POWERSHELL_METADATA_REQUIRED');return JSON.parse(result.stdout);
 }
 async function processIdentity(data,postgres,{cleanupDeadline=null}={}){
  await plainDirectory(data);
  const lines=(await readFile(path.join(data,'postmaster.pid'),'utf8')).split(/\r?\n/u),pid=Number(lines[0]);
  ensure(Number.isSafeInteger(pid)&&pid>0&&equalPath(path.normalize(lines[1]??''),data)&&Number(lines[3])===config.target.port&&lines[5]===config.target.host&&/^\d{10}$/u.test(lines[2]??''),'POSTMASTER_FILE_IDENTITY_REFUSED');
  const rows=await listeners({cleanupDeadline});ensure(rows.length===1&&rows[0].pid===pid,'POSTMASTER_LISTENER_IDENTITY_REFUSED');
  let executable,startIdentity,startEpoch,argumentsIdentity,boundData;
  if(windows){
   const row=await windowsMetadata(pid,cleanupDeadline);ensure(row.id===pid&&typeof row.path==='string'&&Number.isSafeInteger(row.startMs)&&typeof row.commandLine==='string','POSTMASTER_OS_METADATA_UNREADABLE');executable=await realpath(row.path);startIdentity=String(row.startMs);startEpoch=Math.floor(row.startMs/1000);argumentsIdentity=row.commandLine;
   const match=/(?:^|\s)(?:"-D"|'-D'|-D)(?:\s+|=)(?:"([^"]*)"|'([^']*)'|(\S+))/u.exec(row.commandLine);boundData=match?.[1]??match?.[2]??match?.[3];
  }else{
   executable=await readlink('/proc/'+pid+'/exe');
   const processStat=await readFile('/proc/'+pid+'/stat','utf8'),ticks=processStat.slice(processStat.lastIndexOf(') ')+2).trim().split(/\s+/u)[19];
   const boot=/^btime (\d+)$/mu.exec(await readFile('/proc/stat','utf8'))?.[1],{stdout}=await run('getconf',['CLK_TCK'],{cleanupDeadline}),frequency=Number(stdout.trim());
   ensure(/^\d+$/u.test(ticks??'')&&/^\d+$/u.test(boot??'')&&Number.isSafeInteger(frequency)&&frequency>0,'LINUX_PROCESS_START_UNREADABLE');startIdentity=boot+':'+ticks;startEpoch=Number(boot)+Math.floor(Number(ticks)/frequency);
   const args=(await readFile('/proc/'+pid+'/cmdline','utf8')).split('\0').filter(Boolean);boundData=args[args.indexOf('-D')+1];ensure(args.includes('-D'),'POSTMASTER_DATA_ARGUMENT_REQUIRED');argumentsIdentity=JSON.stringify(args);
  }
  ensure(typeof boundData==='string'&&equalPath(path.resolve(boundData),data),'POSTMASTER_COMMAND_DATA_DIRECTORY_REFUSED');
  ensure(Number(lines[2])>=startEpoch&&Number(lines[2])-startEpoch<=3,'POSTMASTER_OS_START_TIME_REFUSED');
  ensure(equalPath(executable,postgres),'POSTMASTER_EXECUTABLE_REFUSED');return {pid,epoch:lines[2],startIdentity,commandSha256:createHash('sha256').update(argumentsIdentity).digest('hex')};
 }
 return Object.freeze({run,binary,listeners,processIdentity,async freeBytes(directory){const v=await statfs(directory);return v.bavail*v.bsize;}});
}
